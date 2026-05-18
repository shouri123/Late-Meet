import { VoiceActivityTracker, isChunkViable } from "./audioProcessing";

let mediaStream: MediaStream | null = null;
let microphoneStream: MediaStream | null = null;
let recorderStream: MediaStream | null = null;
let mediaRecorder: MediaRecorder | null = null;
let audioContext: AudioContext | null = null;
let analyserNode: AnalyserNode | null = null;
let chunkTimer: ReturnType<typeof setInterval> | null = null;
let vadTimer: ReturnType<typeof setInterval> | null = null;
let audioSources: MediaStreamAudioSourceNode[] = [];

let pendingChunks: Blob[] = [];
let isStopping = false;
let isDrainingQueue = false;

const CHUNK_MS = 10000;
const VAD_SAMPLE_MS = 250;
let rmsThreshold = 0.012;

let isFlushInProgress = false;
let voiceActivity = new VoiceActivityTracker({
  rmsThreshold: rmsThreshold,
});

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

async function flushAudioChunk() {
  if (isFlushInProgress || !mediaRecorder || mediaRecorder.state !== "recording") {
    return;
  }

  isFlushInProgress = true;

  try {
    if (!voiceActivity.consumeShouldFlush()) {
      return;
    }

    await drainPendingChunks();

    try {
      mediaRecorder.requestData();
    } catch (err) {
      console.error("[LateMeet][offscreen] requestData failed:", err);
    }
  } finally {
    isFlushInProgress = false;
  }
}

async function postChunk(blob: Blob) {
  console.log("[LateMeet][offscreen] postChunk called, blob size:", blob?.size || 0);

  if (!isChunkViable(blob)) {
    console.warn("[LateMeet][offscreen] Chunk too small, skipping:", blob?.size ?? 0, "bytes");
    return;
  }

  const currentRecorder = mediaRecorder;
  const audioBase64 = await blobToBase64(blob);
  const mimeType = currentRecorder?.mimeType || "audio/webm";

  if (!mimeType) {
    console.warn("[LateMeet][offscreen] Missing MIME type");
    return;
  }

  console.log("[LateMeet][offscreen] Sending chunk:", {
    mimeType,
    size: blob.size,
  });

  try {
    await chrome.runtime.sendMessage({
      type: "OFFSCREEN_AUDIO_CHUNK",
      audioBase64,
      mimeType,
    });
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

async function startCapture(streamId: string, _tabId: number, includeMicrophone = true) {
  if (mediaRecorder && mediaRecorder.state === "recording") {
    console.log("[LateMeet][offscreen] Capture already running");

    return {
      microphoneActive: Boolean(microphoneStream),
    };
  }
  const config = await chrome.storage.local.get("settings");

  rmsThreshold = config?.settings?.vadThreshold || 0.012;

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
      }
    };
  });

  audioContext = new AudioContext();

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

  mediaRecorder.start(CHUNK_MS);

  voiceActivity = new VoiceActivityTracker({
    rmsThreshold: rmsThreshold,
  });

  vadTimer = setInterval(() => {
    voiceActivity.observe(getCurrentRms());
  }, VAD_SAMPLE_MS);

  chunkTimer = setInterval(async () => {
    try {
      if (isStopping) return;

      await flushAudioChunk();
      await drainPendingChunks();
    } catch (err) {
      console.error("[LateMeet][offscreen] Chunk pipeline error:", err);
    }
  }, CHUNK_MS);

  console.log("[LateMeet][offscreen] Capture started");

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
    if (chunkTimer) {
      clearInterval(chunkTimer);
      chunkTimer = null;
    }

    if (vadTimer) {
      clearInterval(vadTimer);
      vadTimer = null;
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
