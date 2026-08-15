import assert from "node:assert/strict";
import test from "node:test";

import {
  connectMicrophoneToOffscreenAudioGraph,
  createOffscreenAudioGraph,
  MICROPHONE_AUDIO_CONSTRAINTS,
  OFFSCREEN_ANALYSER_FFT_SIZE,
  resumeAudioContextForCapture,
} from "../src/offscreenAudioGraph.ts";

class MockAudioNode {
  readonly connections: MockAudioNode[] = [];

  connect(destination: MockAudioNode): MockAudioNode {
    this.connections.push(destination);
    return destination;
  }
}

class MockSourceNode extends MockAudioNode {
  constructor(readonly stream: MediaStream) {
    super();
  }
}

class MockAnalyserNode extends MockAudioNode {
  fftSize = 2048;
}

class MockMediaStreamDestinationNode extends MockAudioNode {
  readonly stream = createMockStream("recorder-output");
}

class MockAudioContext {
  readonly destination = new MockAudioNode();
  readonly analysers: MockAnalyserNode[] = [];
  readonly recorderDestinations: MockMediaStreamDestinationNode[] = [];
  readonly sources: MockSourceNode[] = [];

  createMediaStreamDestination(): MediaStreamAudioDestinationNode {
    const destination = new MockMediaStreamDestinationNode();
    this.recorderDestinations.push(destination);

    return destination as unknown as MediaStreamAudioDestinationNode;
  }

  createAnalyser(): AnalyserNode {
    const analyser = new MockAnalyserNode();
    this.analysers.push(analyser);

    return analyser as unknown as AnalyserNode;
  }

  createMediaStreamSource(stream: MediaStream): MediaStreamAudioSourceNode {
    const source = new MockSourceNode(stream);
    this.sources.push(source);

    return source as unknown as MediaStreamAudioSourceNode;
  }
}

class MockResumableAudioContext {
  state: AudioContextState = "suspended";
  resumeError: unknown;
  resumeCalls = 0;
  closeCalls = 0;

  async resume(): Promise<void> {
    this.resumeCalls += 1;
    if (this.resumeError) throw this.resumeError;
    this.state = "running";
  }

  async close(): Promise<void> {
    this.closeCalls += 1;
    this.state = "closed";
  }
}

function createTrackedStream() {
  const track = {
    onended: () => {},
    stopCalls: 0,
    stop() {
      this.stopCalls += 1;
    },
  };

  return {
    stream: { getTracks: () => [track] } as unknown as MediaStream,
    track,
  };
}

function createMockStream(id: string): MediaStream {
  return { id } as unknown as MediaStream;
}

function asAudioContext(context: MockAudioContext): AudioContext {
  return context as unknown as AudioContext;
}

test("creates exactly one recorder destination and one analyser for tab capture", () => {
  const context = new MockAudioContext();
  const tabStream = createMockStream("tab");

  const graph = createOffscreenAudioGraph(asAudioContext(context), tabStream);

  assert.equal(context.recorderDestinations.length, 1);
  assert.equal(context.analysers.length, 1);
  assert.equal(context.sources.length, 1);

  assert.equal(graph.recorderDestination, context.recorderDestinations[0]);

  assert.equal(graph.analyser, context.analysers[0]);
  assert.equal(graph.tabSource, context.sources[0]);
});

test("configures the analyser with the offscreen FFT size", () => {
  const context = new MockAudioContext();

  createOffscreenAudioGraph(asAudioContext(context), createMockStream("tab"));

  assert.equal(context.analysers[0].fftSize, OFFSCREEN_ANALYSER_FFT_SIZE);

  assert.equal(context.analysers[0].fftSize, 1024);
});

test("routes tab audio to recorder, analyser, and playback output", () => {
  const context = new MockAudioContext();

  createOffscreenAudioGraph(asAudioContext(context), createMockStream("tab"));

  assert.deepEqual(context.sources[0].connections, [
    context.recorderDestinations[0],
    context.analysers[0],
    context.destination,
  ]);
});

test("routes microphone audio to recorder and analyser", () => {
  const context = new MockAudioContext();

  const graph = createOffscreenAudioGraph(asAudioContext(context), createMockStream("tab"));

  const microphoneSource = connectMicrophoneToOffscreenAudioGraph(
    asAudioContext(context),
    createMockStream("microphone"),
    graph,
  );

  assert.equal(microphoneSource, context.sources[1]);

  assert.deepEqual(context.sources[1].connections, [
    context.recorderDestinations[0],
    context.analysers[0],
  ]);
});

test("does not route microphone audio to local playback", () => {
  const context = new MockAudioContext();

  const graph = createOffscreenAudioGraph(asAudioContext(context), createMockStream("tab"));

  connectMicrophoneToOffscreenAudioGraph(
    asAudioContext(context),
    createMockStream("microphone"),
    graph,
  );

  assert.equal(
    context.sources[1].connections.includes(context.destination),
    false,
    "microphone playback would create local monitoring or feedback",
  );
});

test("keeps tab and microphone source nodes independent", () => {
  const context = new MockAudioContext();
  const tabStream = createMockStream("tab");
  const microphoneStream = createMockStream("microphone");

  const graph = createOffscreenAudioGraph(asAudioContext(context), tabStream);

  connectMicrophoneToOffscreenAudioGraph(asAudioContext(context), microphoneStream, graph);

  assert.notEqual(context.sources[0], context.sources[1]);
  assert.equal(context.sources[0].stream, tabStream);
  assert.equal(context.sources[1].stream, microphoneStream);

  assert.equal(context.sources[0].connections.length, 3);
  assert.equal(context.sources[1].connections.length, 2);
});

test("enables microphone processing and automatic gain control", () => {
  assert.deepEqual(MICROPHONE_AUDIO_CONSTRAINTS, {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
  });
});

test("resumes a suspended audio context before capture", async () => {
  const context = new MockResumableAudioContext();
  const { stream, track } = createTrackedStream();

  await resumeAudioContextForCapture(context as unknown as AudioContext, stream, () =>
    assert.fail("successful resume must not log a warning"),
  );

  assert.equal(context.resumeCalls, 1);
  assert.equal(context.closeCalls, 0);
  assert.equal(track.stopCalls, 0);
});

test("logs resume errors and releases resources when context stays suspended", async () => {
  const context = new MockResumableAudioContext();
  context.resumeError = new Error("gesture required");
  const { stream, track } = createTrackedStream();
  const logs: string[] = [];

  await assert.rejects(
    resumeAudioContextForCapture(context as unknown as AudioContext, stream, (message) =>
      logs.push(message),
    ),
    /AudioContext could not be resumed.*autoplay policy/,
  );

  assert.deepEqual(logs, ["[warn] AudioContext.resume() failed: gesture required"]);
  assert.equal(context.closeCalls, 1);
  assert.equal(track.stopCalls, 1);
  assert.equal(track.onended, null);
});

test("fails and releases resources when resume resolves but context stays suspended", async () => {
  const context = new MockResumableAudioContext();
  context.resume = async () => {
    context.resumeCalls += 1;
  };
  const { stream, track } = createTrackedStream();

  await assert.rejects(
    resumeAudioContextForCapture(context as unknown as AudioContext, stream, () => {}),
    /AudioContext could not be resumed/,
  );

  assert.equal(context.closeCalls, 1);
  assert.equal(track.stopCalls, 1);
});
