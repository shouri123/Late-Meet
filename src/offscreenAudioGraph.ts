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
  recorderDestination: MediaStreamAudioDestinationNode,
  analyser: AnalyserNode,
  playbackDestination?: AudioDestinationNode,
): MediaStreamAudioSourceNode {
  const source = context.createMediaStreamSource(stream);

  source.connect(recorderDestination);
  source.connect(analyser);

  if (playbackDestination) {
    source.connect(playbackDestination);
  }

  return source;
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

  analyser.fftSize = OFFSCREEN_ANALYSER_FFT_SIZE;

  const tabSource = connectCaptureSource(
    context,
    tabStream,
    recorderDestination,
    analyser,
    context.destination,
  );

  return {
    recorderDestination,
    analyser,
    tabSource,
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
  return connectCaptureSource(context, microphoneStream, graph.recorderDestination, graph.analyser);
}
