import { VoiceActivityTracker } from './audioProcessing';

let mediaStream: MediaStream | null = null;
let microphoneStream: MediaStream | null = null;
let recorderStream: MediaStream | null = null;
let mediaRecorder: MediaRecorder | null = null;
let audioContext: AudioContext | null = null;
let analyserNode: AnalyserNode | null = null;
let chunkTimer: number | NodeJS.Timeout | null = null;
let vadTimer: number | NodeJS.Timeout | null = null;
let audioSources: MediaStreamAudioSourceNode[] = [];

let pendingChunks: Blob[] = [];
let isChunkRequested = false;
let isStopping = false;
let isDrainingQueue = false;

const CHUNK_MS = 8000;
const VAD_SAMPLE_MS = 250;
const RMS_THRESHOLD = 0.012;
let isFlushInProgress = false;
let voiceActivity = new VoiceActivityTracker({ rmsThreshold: RMS_THRESHOLD });

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
      const base64String = result.split(',')[1];
      resolve(base64String);
    };
    reader.onerror = () => {
      cleanup();
      reject(reader.error ?? new Error('FileReader failed to read blob'));
    };
    reader.onabort = () => {
      cleanup();
      reject(new Error('FileReader read was aborted'));
    };
    reader.readAsDataURL(blob);
  });
}

function pickSupportedMimeType(): string {
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus'
  ];
  return candidates.find(type => MediaRecorder.isTypeSupported(type)) || '';
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
  if (isFlushInProgress || isChunkRequested || !mediaRecorder || mediaRecorder.state !== 'recording') return;

  isFlushInProgress = true;
  try {
    if (!voiceActivity.consumeShouldFlush()) return;

    isChunkRequested = true;
    mediaRecorder.requestData();
  } finally {
    isFlushInProgress = false;
  }
}

async function postChunk(blob: Blob) {
  console.log('[LateMeet][offscreen] postChunk called, blob size:', blob?.size || 0);
  if (!blob || blob.size < 1024) { console.log('[LateMeet][offscreen] Chunk too small, skipping'); return; }

  const audioBase64 = await blobToBase64(blob);
  const mimeType = mediaRecorder?.mimeType || 'audio/webm';

  await chrome.runtime.sendMessage({
    type: 'OFFSCREEN_AUDIO_CHUNK',
    audioBase64,
    mimeType
  });
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
  stream?.getTracks().forEach(track => track.stop());
}

async function getTabAudioStream(streamId: string) {
  return navigator.mediaDevices.getUserMedia({
    audio: {
      // @ts-ignore - chromeMediaSource is non-standard
      mandatory: {
        chromeMediaSource: 'tab',
        chromeMediaSourceId: streamId
      }
    } as any,
    video: false
  });
}

async function getMicrophoneStream() {
  try {
    return await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      },
      video: false
    });
  } catch (err) {
    console.warn('[LateMeet][offscreen] Microphone capture unavailable; recording tab audio only:', err);
    return null;
  }
}

function connectSourceToRecorder(stream: MediaStream, destination: MediaStreamAudioDestinationNode) {
  if (!audioContext || !analyserNode) return;

  const source = audioContext.createMediaStreamSource(stream);
  source.connect(destination);
  source.connect(analyserNode);
  audioSources.push(source);
}

async function startCapture(streamId: string, _tabId: number, includeMicrophone = true) {
  if (mediaRecorder && mediaRecorder.state === 'recording') {
    console.log('[LateMeet][offscreen] Capture started. Mic active:', Boolean(microphoneStream), '| MIME:', mediaRecorder.mimeType || 'default');
  return { microphoneActive: Boolean(microphoneStream) };
  }

  mediaStream = await getTabAudioStream(streamId);

  if (!mediaStream) {
    throw new Error('Failed to capture tab audio stream');
  }

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
  mediaRecorder = mimeType ? new MediaRecorder(recorderStream, { mimeType }) : new MediaRecorder(recorderStream);

  mediaRecorder.addEventListener('dataavailable', (event: BlobEvent) => {
    if (event.data && event.data.size > 0) {
      pendingChunks.push(event.data);
    }
    isChunkRequested = false;
  });

  mediaRecorder.start();
  voiceActivity = new VoiceActivityTracker({ rmsThreshold: RMS_THRESHOLD });

  vadTimer = setInterval(() => {
    voiceActivity.observe(getCurrentRms());
  }, VAD_SAMPLE_MS);

  chunkTimer = setInterval(async () => {
    try {
      if (isStopping) return;
      await flushAudioChunk();
      await drainPendingChunks();
    } catch (err) {
      console.error('[LateMeet][offscreen] Chunk pipeline error:', err);
    }
  }, CHUNK_MS);

  console.log('[LateMeet][offscreen] Capture started. Mic active:', Boolean(microphoneStream), '| MIME:', mimeType || 'default');
  return { microphoneActive: Boolean(microphoneStream) };
}

async function stopCapture() {
  if (chunkTimer) {
    clearInterval(chunkTimer as any);
    chunkTimer = null;
  }
  if (vadTimer) {
    clearInterval(vadTimer as any);
    vadTimer = null;
  }
  isStopping = true;

  if (mediaRecorder && mediaRecorder.state === 'recording') {
    const recorder = mediaRecorder;
    await new Promise<void>(resolve => {
      const timeout = setTimeout(resolve, 2000);
      recorder.addEventListener('stop', () => resolve(), { once: true });
      recorder.addEventListener('error', () => resolve(), { once: true });
      recorder.stop();
      recorder.addEventListener('stop', () => clearTimeout(timeout), { once: true });
    });
  }

  await drainPendingChunks();

  stopTracks(mediaStream);
  stopTracks(microphoneStream);
  stopTracks(recorderStream);
  mediaStream = null;
  microphoneStream = null;
  recorderStream = null;

  if (audioContext) {
    await audioContext.close();
    audioContext = null;
  }

  mediaRecorder = null;
  analyserNode = null;
  audioSources = [];
  pendingChunks = [];
  isChunkRequested = false;
  isStopping = false;
  voiceActivity = new VoiceActivityTracker({ rmsThreshold: RMS_THRESHOLD });
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  // Only handle messages intended for the offscreen document
  if (!message?.type?.startsWith('OFFSCREEN_')) {
    return false; // Not for us — let other listeners handle it
  }

  (async () => {
    if (message.type === 'OFFSCREEN_START_CAPTURE') {
      try {
        const captureInfo = await startCapture(message.streamId, message.tabId, message.includeMicrophone !== false);
        sendResponse({ success: true, ...captureInfo });
      } catch (err) {
        console.error('[LateMeet][offscreen] Failed to start capture:', (err as Error).message);
        sendResponse({ success: false, error: (err as Error).message || 'Start capture failed' });
      }
      return;
    }

    if (message.type === 'OFFSCREEN_STOP_CAPTURE') {
      try {
        await stopCapture();
      } finally {
        await chrome.runtime.sendMessage({ type: 'OFFSCREEN_CAPTURE_STOPPED' });
      }
      sendResponse({ success: true });
      return;
    }

    sendResponse({ success: false, error: 'Unknown offscreen message type' });
  })();

  return true;
});
