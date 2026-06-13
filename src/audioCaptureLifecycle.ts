export interface AudioCaptureStopPlan {
  shouldSavePendingSession: boolean;
  shouldNotifySessionEnded: boolean;
}

export function createAudioCaptureStopPlan(audioActive: boolean): AudioCaptureStopPlan {
  return {
    shouldSavePendingSession: audioActive,
    shouldNotifySessionEnded: audioActive,
  };
}
