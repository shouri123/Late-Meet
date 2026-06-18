import { VoiceActivityTracker, isChunkViable } from "./audioProcessing";
import { computeRms, shouldRunVadAnalysis } from "./vadTuning";
import {
  DRAIN_TIMEOUT_MS,
  MAX_BUFFER_MS,
  MAX_PENDING_CHUNKS,
  SILENCE_FLUSH_MS,
  VAD_SAMPLE_MS,
  WAVEFORM_BUCKETS,
  WAVEFORM_GAIN,
  WAVEFORM_INTERVAL_MS,
} from "./config";
import {
  connectMicrophoneToOffscreenAudioGraph,
  createOffscreenAudioGraph,
  MICROPHONE_AUDIO_CONSTRAINTS,
} from "./offscreenAudioGraph";

let mediaStream: MediaStream | null = null;
let microphoneStream: MediaStream | null = null;
let recorderStream: MediaStream | null = null;
let mediaRecorder: MediaRecorder | null = null;
let audioContext: AudioContext | null = null;
let analyserNode: AnalyserNode | null = null;
let vadTimer: ReturnType<typeof setInterval> | null = null;
let waveformTimer: ReturnType<typeof setInterval> | null = null;
let audioSources: MediaStreamAudioSourceNode[] = [];

let pendingChunks: Blob[] = [];
let isStopping = false;
let isDrainingQueue = false;

const SILENCE_FLUSH_TICKS = Math.ceil(SILENCE_FLUSH_MS / VAD_SAMPLE_MS);
let rmsThreshold = 0.012;

let isFlushInProgress = false;
let isVadBusy = false;
let silenceTicks = 0;
let bufferStartTime = 0;
let recorderMimeType = "";
// Reused across analyser reads to avoid allocating a Uint8Array on every VAD and
// waveform tick (≈14×/sec). Sized to the analyser's fftSize when capture starts.
let analysisBuffer: Uint8Array<ArrayBuffer> | null = null;
// Tracks whether the last analysed tick detected speech, plus a tick counter, so
// the VAD loop can throttle analysis while speech is sustained (#632).
let speechActive = false;
let vadTickCounter = 0;
let voiceActivity = new VoiceActivityTracker({
  rmsThreshold: rmsThreshold,
});

// Forwards a log line to the background service worker so it appears in the
// SW console (chrome://extensions → service worker), which is far easier to
// open than the offscreen DevTools.
function relay(message: string) {
  console.log(`[LateMeet][offscreen] ${message}`);
  chrome.runtime.sendMessage({ type: "OFFSCREEN_LOG", message }).catch(() => {});
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    const cleanup = () => {
      reader.onloadend = null;
      reader.onerror = null;
      reader.onabort = null;
    };

    reader.onloadend = () => {
      cleanup();
      const result = reader.result as string;
      const base64String = result.split(",")[1];
      resolve(base64String);
    };

    reader.onerror = () => {
      cleanup();
      reject(reader.error ?? new Error("FileReader failed to read blob"));
    };

    reader.onabort = () => {
      cleanup();
      reject(new Error("FileReader read was aborted"));
    };

    reader.readAsDataURL(blob);
  });
}

function pickSupportedMimeType(): string {
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/ogg",
    "audio/mp4",
  ];

  const supported = candidates.find((type) => MediaRecorder.isTypeSupported(type));

  console.log("[LateMeet][offscreen] Selected MIME type:", supported);

  return supported || "";
}

function getCurrentRms(): number {
  if (!analyserNode || !analysisBuffer) return 0;

  analyserNode.getByteTimeDomainData(analysisBuffer);
  return computeRms(analysisBuffer);
}

function sampleAndSendWaveform() {
  if (
    !analyserNode ||
    !analysisBuffer ||
    !mediaRecorder ||
    mediaRecorder.state !== "recording" ||
    isStopping
  )
    return;

  const buffer = analysisBuffer;
  analyserNode.getByteTimeDomainData(buffer);

  const bucketSize = Math.floor(buffer.length / WAVEFORM_BUCKETS);
  const buckets: number[] = [];

  for (let i = 0; i < WAVEFORM_BUCKETS; i++) {
    let sum = 0;
    for (let j = 0; j < bucketSize; j++) {
      sum += Math.abs((buffer[i * bucketSize + j] - 128) / 128);
    }
    buckets.push(Math.min(1, (sum / bucketSize) * WAVEFORM_GAIN));
  }

  chrome.runtime.sendMessage({ type: "WAVEFORM_DATA", buckets }).catch(() => {});
}

async function flushAudioChunk(force = false) {
  if (isFlushInProgress || !mediaRecorder || mediaRecorder.state !== "recording") {
    return;
  }

  isFlushInProgress = true;

  try {
    const hasSpeech = voiceActivity.consumeShouldFlush();

    if (!force && !hasSpeech) {
      return;
    }

    // Finalize the current segment by stopping the recorder. Stopping emits a
    // complete, self-contained file (WebM initialization segment + media) via
    // `dataavailable` — unlike `requestData()`, whose post-first blobs are
    // headerless fragments the STT API cannot decode (see issue #678). A fresh
    // recorder is then started so the next segment carries its own header too.
    const previousRecorder = mediaRecorder;
    // Drop the persistent error listener first so a stop-time error is handled
    // by the wait helper below instead of recursing into stopCapture().
    previousRecorder.removeEventListener("error", handleRecorderError);

    // Wait for the final `dataavailable` so the complete segment is pushed into
    // pendingChunks before we drain. Per the MediaStream Recording spec the
    // order is `dataavailable` → `stop`, and on a non-fatal error it is
    // `error` → `dataavailable` → `stop`, so the final blob always arrives;
    // a timeout guards against the event never firing.
    await stopRecorderAndAwaitData(previousRecorder);
    previousRecorder.removeEventListener("dataavailable", handleRecorderDataAvailable);

    if (isStopping || !recorderStream) {
      await drainWithTimeout();
      return;
    }

    // Start a fresh recorder so the next segment carries its own header. Resume
    // capture before draining so the inter-segment gap stays minimal.
    // `MediaRecorder` creation/`start()` can throw synchronously (e.g.
    // NotSupportedError when the stream has gone inactive); if it does, end
    // capture cleanly instead of leaving the VAD loop spinning on a dead recorder.
    try {
      mediaRecorder = createRecorder();
      mediaRecorder.start();
      bufferStartTime = Date.now();
    } catch (err) {
      console.error("[LateMeet][offscreen] Failed to restart recorder after flush:", err);
      relay(`recorder restart failed — ${(err as Error)?.message ?? "unknown error"}`);
      mediaRecorder = null;
      await stopCapture();
      await chrome.runtime
        .sendMessage({
          type: "UNEXPECTED_TRACK_END",
          reason: "Recorder failed to restart after flush",
        })
        .catch(() => {});
      return;
    }

    await drainWithTimeout();
  } finally {
    isFlushInProgress = false;
  }
}

async function postChunk(blob: Blob) {
  if (!isChunkViable(blob)) {
    relay(`chunk too small, skipped — ${blob?.size ?? 0} bytes (min 5 000)`);
    return;
  }

  const currentRecorder = mediaRecorder;
  const audioBase64 = await blobToBase64(blob);
  const mimeType = currentRecorder?.mimeType || "audio/webm";

  relay(`sending chunk — ${blob.size} bytes  mimeType=${mimeType}`);

  try {
    const response = await chrome.runtime.sendMessage({
      type: "OFFSCREEN_AUDIO_CHUNK",
      audioBase64,
      mimeType,
    });

    if (!response?.success) {
      relay(`chunk rejected by background — ${response?.error || "unknown error"}`);
    }
  } catch (err) {
    console.error("[LateMeet][offscreen] Failed to send chunk:", err);
  }
}

async function drainWithTimeout() {
  const drainPromise = drainPendingChunks();
  const timeoutPromise = new Promise<void>((resolve) => {
    setTimeout(() => {
      if (pendingChunks.length > 0 || isDrainingQueue) {
        relay(
          `drainPendingChunks exceeded ${DRAIN_TIMEOUT_MS}ms timeout — dropping ${pendingChunks.length} remaining chunks and restarting recorder`,
        );
        pendingChunks = [];
        isDrainingQueue = false;
        if (mediaRecorder?.state === "paused" || mediaRecorder?.state === "recording") {
          try {
            mediaRecorder.stop();
          } catch (e) {
            console.warn("[LateMeet][offscreen] Failed to stop recorder on drain timeout:", e);
          }
        }
      }
      resolve();
    }, DRAIN_TIMEOUT_MS);
  });
  await Promise.race([drainPromise, timeoutPromise]);
}

async function drainPendingChunks() {
  if (isDrainingQueue) return;

  isDrainingQueue = true;

  try {
    while (pendingChunks.length > 0) {
      const blob = pendingChunks.shift();

      if (blob) {
        await postChunk(blob);
      }
    }
  } finally {
    isDrainingQueue = false;
    if (mediaRecorder?.state === "paused") {
      relay("pendingChunks drained, resuming recording");
      try {
        mediaRecorder.resume();
      } catch (e) {
        console.warn("[LateMeet][offscreen] Failed to resume recorder:", e);
      }
    }
  }
}

function stopTracks(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => track.stop());
}

async function cleanupResources() {
  stopTracks(mediaStream);
  stopTracks(microphoneStream);
  stopTracks(recorderStream);

  mediaStream = null;
  microphoneStream = null;
  recorderStream = null;

  if (waveformTimer) {
    clearInterval(waveformTimer);
    waveformTimer = null;
  }

  if (audioContext) {
    try {
      await audioContext.close();
    } catch (err) {
      console.warn("[LateMeet][offscreen] AudioContext close failed:", err);
    }

    audioContext = null;
  }

  mediaRecorder = null;
  analyserNode = null;
  analysisBuffer = null;
  audioSources = [];
  pendingChunks = [];
  isStopping = false;
  isVadBusy = false;
  silenceTicks = 0;
  speechActive = false;
  vadTickCounter = 0;
  bufferStartTime = 0;

  voiceActivity = new VoiceActivityTracker({
    rmsThreshold: rmsThreshold,
  });
}
async function getTabAudioStream(streamId: string) {
  return navigator.mediaDevices.getUserMedia({
    audio: {
      // @ts-ignore
      mandatory: {
        chromeMediaSource: "tab",
        chromeMediaSourceId: streamId,
      },
    } as any,
    video: false,
  });
}

async function getMicrophoneStream() {
  try {
    return await navigator.mediaDevices.getUserMedia({
      audio: MICROPHONE_AUDIO_CONSTRAINTS,
      video: false,
    });
  } catch (err) {
    console.warn("[LateMeet][offscreen] Microphone capture unavailable:", err);
    return null;
  }
}

async function stopMediaRecorder() {
  if (mediaRecorder && mediaRecorder.state !== "inactive") {
    const recorder = mediaRecorder;

    await new Promise<void>((resolve) => {
      const timeout = setTimeout(resolve, 2000);

      recorder.addEventListener("stop", () => resolve(), { once: true });

      recorder.addEventListener("error", () => resolve(), { once: true });

      try {
        recorder.stop();
      } catch (err) {
        console.warn("[LateMeet][offscreen] Recorder stop failed:", err);
        resolve();
      }

      recorder.addEventListener("stop", () => clearTimeout(timeout), { once: true });
    });
  }
}

// Stops a recorder and resolves once its final `dataavailable` has fired (which
// handleRecorderDataAvailable pushes into pendingChunks), so callers can drain a
// complete segment. Resolves on `stop` for the no-data case and on a 2 000 ms
// timeout so a missing event can't wedge the flush loop.
function stopRecorderAndAwaitData(recorder: MediaRecorder): Promise<void> {
  return new Promise<void>((resolve) => {
    if (recorder.state === "inactive") {
      resolve();
      return;
    }

    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      recorder.removeEventListener("dataavailable", onData);
      recorder.removeEventListener("stop", onStop);
      resolve();
    };
    // handleRecorderDataAvailable is registered first, so the blob is already in
    // pendingChunks by the time this listener runs and resolves.
    const onData = () => finish();
    const onStop = () => finish();
    const timeoutId = setTimeout(() => {
      relay("recorder stop timeout — proceeding with queued chunks");
      finish();
    }, 2000);

    recorder.addEventListener("dataavailable", onData, { once: true });
    recorder.addEventListener("stop", onStop, { once: true });

    try {
      recorder.stop();
    } catch (err) {
      console.error("[LateMeet][offscreen] recorder stop failed:", err);
      finish();
    }
  });
}

function handleRecorderDataAvailable(event: BlobEvent) {
  console.log("[LateMeet][offscreen] Chunk received:", {
    type: event.data?.type,
    size: event.data?.size,
  });

  if (event.data && event.data.size > 0) {
    pendingChunks.push(event.data);
    if (pendingChunks.length >= MAX_PENDING_CHUNKS && mediaRecorder?.state === "recording") {
      relay(`pendingChunks cap reached (${MAX_PENDING_CHUNKS}), pausing recording`);
      try {
        mediaRecorder.pause();
      } catch (e) {
        console.warn("[LateMeet][offscreen] Failed to pause recorder:", e);
      }
    }
  }
}

async function handleRecorderError(err: Event) {
  console.error("[LateMeet][offscreen] Recorder error:", err);

  if (!isStopping) {
    await stopCapture();
  }
}

// Builds a MediaRecorder bound to the active recorder stream with the shared
// listeners attached. A new recorder is created per capture and again on every
// flush so each emitted file is independently decodable (see issue #678).
function createRecorder(): MediaRecorder {
  if (!recorderStream) {
    throw new Error("Cannot create recorder without an active stream");
  }

  const recorder = recorderMimeType
    ? new MediaRecorder(recorderStream, { mimeType: recorderMimeType })
    : new MediaRecorder(recorderStream);

  recorder.addEventListener("dataavailable", handleRecorderDataAvailable);
  recorder.addEventListener("error", handleRecorderError);

  return recorder;
}

async function startCapture(
  streamId: string,
  _tabId: number,
  includeMicrophone = true,
  vadThreshold?: number,
) {
  if (mediaRecorder && mediaRecorder.state === "recording") {
    console.log("[LateMeet][offscreen] Capture already running");

    return {
      microphoneActive: Boolean(microphoneStream),
    };
  }
  // Offscreen documents cannot access chrome.storage — threshold is forwarded
  // by the background service worker which reads it before sending this message.
  rmsThreshold = vadThreshold ?? 0.012;

  mediaStream = await getTabAudioStream(streamId);

  if (!mediaStream) {
    throw new Error("Failed to capture tab audio stream");
  }

  mediaStream.getTracks().forEach((track) => {
    track.onended = async () => {
      console.warn("[LateMeet][offscreen] Media track ended unexpectedly");

      if (isStopping) return;

      isStopping = true;

      try {
        if (vadTimer) {
          clearInterval(vadTimer);
          vadTimer = null;
        }

        if (waveformTimer) {
          clearInterval(waveformTimer);
          waveformTimer = null;
        }

        await stopMediaRecorder();

        await drainPendingChunks();
        await cleanupResources();
      } catch (err) {
        console.error("[LateMeet][offscreen] Cleanup after track end failed:", err);
        await cleanupResources();
      } finally {
        await chrome.runtime
          .sendMessage({
            type: "UNEXPECTED_TRACK_END",
            reason: "Track ended unexpectedly (tab closed or mic disconnected)",
          })
          .catch(() => {});
      }
    };
  });

  audioContext = new AudioContext();

  if (audioContext.state === "suspended") {
    await audioContext.resume();
  }

  const audioGraph = createOffscreenAudioGraph(audioContext, mediaStream);
  const destination = audioGraph.recorderDestination;

  analyserNode = audioGraph.analyser;
  audioSources.push(audioGraph.tabSource);

  if (includeMicrophone) {
    microphoneStream = await getMicrophoneStream();

    if (microphoneStream) {
      const microphoneSource = connectMicrophoneToOffscreenAudioGraph(
        audioContext,
        microphoneStream,
        audioGraph,
      );

      audioSources.push(microphoneSource);

      microphoneStream.getTracks().forEach((track) => {
        track.onended = () => {
          console.warn("[LateMeet][offscreen] Microphone track ended unexpectedly");
          if (isStopping) return;
          relay("Microphone track ended unexpectedly (input device disconnected)");
        };
      });
    }
  }

  recorderStream = destination.stream;

  recorderMimeType = pickSupportedMimeType();
  mediaRecorder = createRecorder();

  // No timeslice argument — flush timing is controlled by VAD. Each flush stops
  // and restarts the recorder so every emitted chunk is a complete file with its
  // own WebM header (see issue #678).
  mediaRecorder.start();

  waveformTimer = setInterval(sampleAndSendWaveform, WAVEFORM_INTERVAL_MS);

  voiceActivity = new VoiceActivityTracker({
    rmsThreshold: rmsThreshold,
  });

  silenceTicks = 0;
  speechActive = false;
  vadTickCounter = 0;
  bufferStartTime = Date.now();

  vadTimer = setInterval(async () => {
    if (isStopping || isVadBusy || isDrainingQueue) return;

    vadTickCounter += 1;
    const overflowReached = Date.now() - bufferStartTime >= MAX_BUFFER_MS;
    const runAnalysis = shouldRunVadAnalysis(speechActive, vadTickCounter);

    // While speech is sustained, skip the analyser read on alternate ticks to
    // cut CPU (#632). The overflow flush is time-based, so it still runs.
    if (!runAnalysis && !overflowReached) return;

    isVadBusy = true;

    try {
      let naturalPause = false;
      let rms = -1;

      if (runAnalysis) {
        rms = getCurrentRms();
        voiceActivity.observe(rms);
        speechActive = rms >= rmsThreshold;
        if (speechActive) {
          silenceTicks = 0;
        } else {
          silenceTicks++;
        }
        naturalPause = silenceTicks >= SILENCE_FLUSH_TICKS;
      }

      if (naturalPause || overflowReached) {
        const reason = naturalPause ? "silence-pause" : "overflow-cap";
        relay(
          `flush triggered — reason=${reason} rms=${rms >= 0 ? rms.toFixed(4) : "n/a"} silenceTicks=${silenceTicks}`,
        );
        silenceTicks = 0;
        bufferStartTime = Date.now();
        // Force-flush on overflow so silent audio doesn't block the buffer cap.
        await flushAudioChunk(overflowReached && !naturalPause);
      }
    } catch (err) {
      console.error("[LateMeet][offscreen] VAD loop error:", err);
    } finally {
      isVadBusy = false;
    }
  }, VAD_SAMPLE_MS);

  relay(`capture started — mic=${Boolean(microphoneStream)} rmsThreshold=${rmsThreshold}`);

  return {
    microphoneActive: Boolean(microphoneStream),
  };
}

async function stopCapture() {
  // Prevent concurrent cleanup execution
  if (isStopping) {
    return;
  }

  isStopping = true;

  try {
    if (vadTimer) {
      clearInterval(vadTimer);
      vadTimer = null;
    }

    if (waveformTimer) {
      clearInterval(waveformTimer);
      waveformTimer = null;
    }

    await stopMediaRecorder();

    await drainPendingChunks();

    await cleanupResources();
  } catch (err) {
    console.error("[LateMeet][offscreen] stopCapture failed:", err);

    await cleanupResources();
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message?.type?.startsWith("OFFSCREEN_")) {
    return false;
  }

  (async () => {
    if (message.type === "OFFSCREEN_PING") {
      sendResponse({ success: true });
      return;
    }

    if (message.type === "OFFSCREEN_START_CAPTURE") {
      try {
        const captureInfo = await startCapture(
          message.streamId,
          message.tabId,
          message.includeMicrophone !== false,
          message.vadThreshold,
        );

        sendResponse({
          success: true,
          ...captureInfo,
        });
      } catch (err) {
        console.error("[LateMeet][offscreen] Failed to start capture:", (err as Error).message);

        sendResponse({
          success: false,
          error: (err as Error).message || "Start capture failed",
        });
      }

      return;
    }

    if (message.type === "OFFSCREEN_STOP_CAPTURE") {
      if (isStopping) {
        sendResponse({ success: false, alreadyStopping: true });
        return;
      }

      try {
        await stopCapture();
      } finally {
        await chrome.runtime.sendMessage({
          type: "OFFSCREEN_CAPTURE_STOPPED",
        });
      }

      sendResponse({ success: true });

      return;
    }

    sendResponse({
      success: false,
      error: "Unknown offscreen message type",
    });
  })();

  return true;
});
