import test from "node:test";
import assert from "node:assert/strict";

import { AudioChunkQueue } from "./audioChunkQueue.ts";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
}

async function waitForDrain() {
  await Promise.resolve();
  await Promise.resolve();
}

test("audio chunk queue acknowledges enqueue before processing finishes", async () => {
  const gate = deferred<void>();
  const processed: string[] = [];
  const queue = new AudioChunkQueue<string>({
    maxPending: 4,
    process: async ({ item }) => {
      await gate.promise;
      processed.push(item);
    },
  });

  const result = queue.enqueue("first");

  assert.equal(result.accepted, true);
  assert.equal(queue.isProcessing, true);
  assert.deepEqual(processed, []);

  gate.resolve();
  await waitForDrain();

  assert.deepEqual(processed, ["first"]);
});

test("audio chunk queue processes chunks in deterministic FIFO order", async () => {
  const processed: string[] = [];
  const queue = new AudioChunkQueue<string>({
    maxPending: 4,
    process: async ({ item }) => {
      processed.push(item);
    },
  });

  queue.enqueue("one");
  queue.enqueue("two");
  queue.enqueue("three");

  await waitForDrain();

  assert.deepEqual(processed, ["one", "two", "three"]);
});

test("audio chunk queue continues after a chunk processing failure", async () => {
  const processed: string[] = [];
  const errors: string[] = [];
  const queue = new AudioChunkQueue<string>({
    maxPending: 4,
    process: async ({ item }) => {
      if (item === "bad") throw new Error("stt failed");
      processed.push(item);
    },
    onError: (err) => {
      errors.push(err instanceof Error ? err.message : String(err));
    },
  });

  queue.enqueue("bad");
  queue.enqueue("next");

  await waitForDrain();

  assert.deepEqual(errors, ["stt failed"]);
  assert.deepEqual(processed, ["next"]);
});

test("audio chunk queue rejects new chunks when pending backlog is full", async () => {
  const gate = deferred<void>();
  const queue = new AudioChunkQueue<string>({
    maxPending: 2,
    process: async () => {
      await gate.promise;
    },
  });

  assert.equal(queue.enqueue("active").accepted, true);
  assert.equal(queue.enqueue("pending-1").accepted, true);
  assert.equal(queue.enqueue("pending-2").accepted, true);

  const rejected = queue.enqueue("overflow");

  assert.equal(rejected.accepted, false);
  assert.equal(rejected.error, "Audio chunk queue is full");

  gate.resolve();
  await waitForDrain();
});

test("audio chunk queue continues after onError hook failure", async () => {
  const processed: string[] = [];
  const queue = new AudioChunkQueue<string>({
    maxPending: 4,
    process: async ({ item }) => {
      if (item === "bad") throw new Error("stt failed");
      processed.push(item);
    },
    onError: () => {
      throw new Error("onError threw an error");
    },
  });

  queue.enqueue("bad");
  queue.enqueue("next");

  await waitForDrain();

  assert.deepEqual(processed, ["next"]);
});
