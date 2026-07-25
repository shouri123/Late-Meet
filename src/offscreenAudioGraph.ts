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
  noiseGate: DynamicsCompressorNode;
}

/**
 * Connects a media stream to the shared recorder and analyser nodes.
 *
 * Only the tab stream receives a playback destination. The microphone must
 * never be routed to AudioContext.destination because that would create local
 * monitoring and potentially audible feedback.
 */
function connectCaptureSource(
  context: AudioContext,
  stream: MediaStream,
  noiseGate: DynamicsCompressorNode,
  analyser: AnalyserNode,
  playbackDestination?: AudioDestinationNode,
): MediaStreamAudioSourceNode {
  const source = context.createMediaStreamSource(stream);

  source.connect(noiseGate);
  source.connect(analyser);

  if (playbackDestination) {
    source.connect(playbackDestination);
  }

  return source;
}

/**
 * Creates an adaptive noise gate using DynamicsCompressorNode.
 *
 * The compressor acts as a noise gate by attenuating signals below a
 * dynamically computed threshold. With a high ratio and low knee, it
 * effectively silences ambient noise while passing speech.
 */
function createNoiseGate(context: AudioContext): DynamicsCompressorNode {
  const gate = context.createDynamicsCompressor();
  gate.threshold.value = -50;
  gate.knee.value = 6;
  gate.ratio.value = 12;
  gate.attack.value = 0.003;
  gate.release.value = 0.25;
  return gate;
}

/**
 * Creates the base offscreen Web Audio graph for tab audio capture.
 */
export function createOffscreenAudioGraph(
  context: AudioContext,
  tabStream: MediaStream,
): OffscreenAudioGraph {
  const recorderDestination = context.createMediaStreamDestination();
  const analyser = context.createAnalyser();
  const noiseGate = createNoiseGate(context);

  analyser.fftSize = OFFSCREEN_ANALYSER_FFT_SIZE;

  const tabSource = connectCaptureSource(
    context,
    tabStream,
    noiseGate,
    analyser,
    context.destination,
  );

  noiseGate.connect(recorderDestination);

  return {
    recorderDestination,
    analyser,
    tabSource,
    noiseGate,
  };
}

/**
 * Adds an optional microphone stream to the existing offscreen audio graph.
 *
 * The microphone is recorded and analysed but intentionally not played
 * through the local output destination.
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
