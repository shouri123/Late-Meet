export const OFFSCREEN_ANALYSER_FFT_SIZE = 1024;

export const MICROPHONE_AUDIO_CONSTRAINTS: MediaTrackConstraints = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
};

export interface OffscreenAudioGraph {
  recorderDestination: MediaStreamAudioDestinationNode;
  analyser: AnalyserNode;
  tabSource: MediaStreamAudioSourceNode;
  compressor: DynamicsCompressorNode;
}

/**
 * Connects a media stream to the target node (which will be the compressor).
 */
function connectCaptureSource(
  context: AudioContext,
  stream: MediaStream,
  targetNode: AudioNode,
): MediaStreamAudioSourceNode {
  const source = context.createMediaStreamSource(stream);
  source.connect(targetNode);
  return source;
}

/**
 * Creates the base offscreen Web Audio graph for tab audio capture, with an added
 * dynamics compressor to prevent clipping.
 */
export function createOffscreenAudioGraph(
  context: AudioContext,
  tabStream: MediaStream,
): OffscreenAudioGraph {
  const recorderDestination = context.createMediaStreamDestination();
  const analyser = context.createAnalyser();

  analyser.fftSize = OFFSCREEN_ANALYSER_FFT_SIZE;

  // Add limiter (compressor) to prevent audio clipping
  const compressor = context.createDynamicsCompressor();
  compressor.threshold.value = -3;
  compressor.knee.value = 0;
  compressor.ratio.value = 20;
  compressor.attack.value = 0.005;
  compressor.release.value = 0.1;

  // Route the compressor to all destinations
  compressor.connect(recorderDestination);
  compressor.connect(analyser);
  // The tab audio gets played back locally through the offscreen document
  // so the user can still hear the tab while recording.
  compressor.connect(context.destination);

  const tabSource = connectCaptureSource(context, tabStream, compressor);

  return {
    recorderDestination,
    analyser,
    tabSource,
    compressor,
  };
}

/**
 * Adds an optional microphone stream to the existing offscreen audio graph.
 *
 * The microphone is recorded and analysed but intentionally not played
 * through the local output destination. It bypasses the tab audio compressor
 * to avoid local echo, relying on native AGC.
 */
export function connectMicrophoneToOffscreenAudioGraph(
  context: AudioContext,
  microphoneStream: MediaStream,
  graph: Pick<OffscreenAudioGraph, "recorderDestination" | "analyser">,
): MediaStreamAudioSourceNode {
  const source = context.createMediaStreamSource(microphoneStream);
  source.connect(graph.recorderDestination);
  source.connect(graph.analyser);
  return source;
}
