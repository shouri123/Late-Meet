import { VoiceActivityTracker, isChunkViable } from "./audioProcessing";

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

const VAD_SAMPLE_MS = 250;
const WAVEFORM_INTERVAL_MS = 50;
const WAVEFORM_BUCKETS = 32;
const WAVEFORM_GAIN = 6;
const SILENCE_FLUSH_MS = 1500;
const MAX_BUFFER_MS = 25000;
const SILENCE_FLUSH_TICKS = Math.ceil(SILENCE_FLUSH_MS / VAD_SAMPLE_MS);
let rmsThreshold = 0.012;

let isFlushInProgress = false;
let isVadBusy = false;
let silenceTicks = 0;
let bufferStartTime = 0;
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
  if (!analyserNode) return 0;

  const buffer = new Uint8Array(analyserNode.fftSize);
  analyserNode.getByteTimeDomainData(buffer);

  let sumSquares = 0;

  for (let i = 0; i < buffer.length; i += 1) {
    const normalized = (buffer[i] - 128) / 128;
    sumSquares += normalized * normalized;
  }

  return Math.sqrt(sumSquares / buffer.length);
}

function sampleAndSendWaveform() {
  if (!analyserNode || !mediaRecorder || mediaRecorder.state !== "recording" || isStopping) return;

  const buffer = new Uint8Array(analyserNode.fftSize);
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

    // In continuous mode, dataavailable only fires on requestData() or stop().
    // We must wait for the event before draining so the new blob lands in pendingChunks.
    // A 1 000 ms timeout guards against the event never firing (browser throttling,
    // system load) which would otherwise leave isFlushInProgress permanently true.
    await new Promise<void>((resolve) => {
      const recorder = mediaRecorder!;
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutId);
        recorder.removeEventListener("dataavailable", onData);
        resolve();
      };
      const onData = () => finish();
      const timeoutId = setTimeout(() => {
        relay("requestData timeout — resuming with queued chunks");
        finish();
      }, 1000);
      recorder.addEventListener("dataavailable", onData, { once: true });
      try {
        recorder.requestData();
      } catch (err) {
        console.error("[LateMeet][offscreen] requestData failed:", err);
        finish();
      }
    });

    await drainPendingChunks();
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
  audioSources = [];
  pendingChunks = [];
  isStopping = false;
  isVadBusy = false;
  silenceTicks = 0;
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
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      video: false,
    });
  } catch (err) {
    console.warn("[LateMeet][offscreen] Microphone capture unavailable:", err);

    return null;
  }
}

function connectSourceToRecorder(
  stream: MediaStream,
  destination: MediaStreamAudioDestinationNode,
) {
  if (!audioContext || !analyserNode) return;

  const source = audioContext.createMediaStreamSource(stream);

  source.connect(destination);
  source.connect(analyserNode);

  audioSources.push(source);
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

      try {
        await stopCapture();
      } catch (err) {
        console.error("[LateMeet][offscreen] Cleanup after track end failed:", err);
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

  const destination = audioContext.createMediaStreamDestination();

  analyserNode = audioContext.createAnalyser();
  analyserNode.fftSize = 1024;

  const tabSource = audioContext.createMediaStreamSource(mediaStream);

  tabSource.connect(destination);
  tabSource.connect(analyserNode);
  tabSource.connect(audioContext.destination);

  audioSources.push(tabSource);

  if (includeMicrophone) {
    microphoneStream = await getMicrophoneStream();

    if (microphoneStream) {
      connectSourceToRecorder(microphoneStream, destination);
    }
  }

  recorderStream = destination.stream;

  const mimeType = pickSupportedMimeType();

  mediaRecorder = mimeType
    ? new MediaRecorder(recorderStream, { mimeType })
    : new MediaRecorder(recorderStream);

  mediaRecorder.addEventListener("dataavailable", (event: BlobEvent) => {
    console.log("[LateMeet][offscreen] Chunk received:", {
      type: event.data?.type,
      size: event.data?.size,
    });

    if (event.data && event.data.size > 0) {
      pendingChunks.push(event.data);
    }
  });

  mediaRecorder.addEventListener("error", async (err) => {
    console.error("[LateMeet][offscreen] Recorder error:", err);

    if (!isStopping) {
      await stopCapture();
    }
  });

  // Continuous mode: no timeslice argument — we control flush timing via VAD.
  mediaRecorder.start();

  waveformTimer = setInterval(sampleAndSendWaveform, WAVEFORM_INTERVAL_MS);

  voiceActivity = new VoiceActivityTracker({
    rmsThreshold: rmsThreshold,
  });

  silenceTicks = 0;
  bufferStartTime = Date.now();

  vadTimer = setInterval(async () => {
    if (isStopping || isVadBusy) return;

    isVadBusy = true;

    try {
      const rms = getCurrentRms();
      voiceActivity.observe(rms);

      if (rms < rmsThreshold) {
        silenceTicks++;
      } else {
        silenceTicks = 0;
      }

      const naturalPause = silenceTicks >= SILENCE_FLUSH_TICKS;
      const overflowReached = Date.now() - bufferStartTime >= MAX_BUFFER_MS;

      if (naturalPause || overflowReached) {
        const reason = naturalPause ? "silence-pause" : "overflow-cap";
        relay(
          `flush triggered — reason=${reason} rms=${rms.toFixed(4)} silenceTicks=${silenceTicks}`,
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
