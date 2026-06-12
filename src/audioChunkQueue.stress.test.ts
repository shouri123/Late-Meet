import test from "node:test";
import assert from "node:assert/strict";

import { AudioChunkQueue } from "./audioChunkQueue.ts";

// Stress / high-volume load tests for the audio chunk FIFO queue (issue #672).
// These complement the unit (audioChunkQueue.test.ts) and property-based fuzz
// (audioChunkQueue.fuzz.test.ts) suites by hammering the queue with thousands of
// fast-paced tasks and asserting it never loses, reorders, double-processes, or
// concurrently processes chunks under load.

/** Resolves once the queue has fully drained, with a hard iteration cap so a
 * stuck queue fails fast instead of hanging the test runner. */
async function drainUntilIdle<T>(queue: AudioChunkQueue<T>, maxTicks = 200_000) {
  let ticks = 0;
  while (queue.isProcessing || queue.pending > 0) {
    if (ticks++ > maxTicks) throw new Error("queue did not drain within tick budget");
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

test("processes 5000 chunks under load without loss or reordering", async () => {
  const processed: number[] = [];
  const queue = new AudioChunkQueue<number>({
    maxPending: 10_000,
    process: async ({ item }) => {
      // Yield on a mix of micro/macro tasks to simulate variable STT latency.
      await (item % 2 === 0 ? Promise.resolve() : new Promise((r) => setTimeout(r, 0)));
      processed.push(item);
    },
  });

  for (let i = 0; i < 5000; i++) {
    assert.equal(queue.enqueue(i).accepted, true);
  }

  await drainUntilIdle(queue);

  assert.equal(processed.length, 5000);
  for (let i = 0; i < 5000; i++) assert.equal(processed[i], i, `out-of-order at index ${i}`);
});

test("never processes more than one chunk concurrently under high load", async () => {
  let active = 0;
  let maxConcurrent = 0;
  const queue = new AudioChunkQueue<number>({
    maxPending: 10_000,
    process: async () => {
      active += 1;
      maxConcurrent = Math.max(maxConcurrent, active);
      await Promise.resolve();
      await new Promise((r) => setTimeout(r, 0));
      active -= 1;
    },
  });

  for (let i = 0; i < 3000; i++) queue.enqueue(i);

  await drainUntilIdle(queue);

  assert.equal(maxConcurrent, 1, "queue must serialize processing (single-flight)");
  assert.equal(active, 0);
});

test("processes every chunk when producers enqueue while the queue is draining", async () => {
  const processed: number[] = [];
  const queue = new AudioChunkQueue<number>({
    maxPending: 10_000,
    process: async ({ item }) => {
      await Promise.resolve();
      processed.push(item);
    },
  });

  // Emit chunks in bursts spread across many macrotasks, so new chunks keep
  // arriving while earlier ones are still being drained (real-time capture).
  let next = 0;
  for (let burst = 0; burst < 10; burst++) {
    for (let i = 0; i < 500; i++) {
      assert.equal(queue.enqueue(next++).accepted, true);
    }
    await new Promise((r) => setTimeout(r, 0));
  }

  await drainUntilIdle(queue);

  assert.equal(processed.length, 5000);
  for (let i = 0; i < 5000; i++) assert.equal(processed[i], i);
});

test("applies backpressure under burst saturation and processes every accepted chunk once", async () => {
  const processed = new Set<number>();
  const acceptedIds: number[] = [];
  const queue = new AudioChunkQueue<number>({
    maxPending: 50,
    process: async ({ item }) => {
      // Macrotask delay keeps the backlog full during the synchronous burst.
      await new Promise((r) => setTimeout(r, 0));
      processed.add(item);
    },
  });

  let accepted = 0;
  let rejected = 0;
  for (let i = 0; i < 2000; i++) {
    const result = queue.enqueue(i);
    if (result.accepted) {
      accepted += 1;
      acceptedIds.push(i);
    } else {
      rejected += 1;
      assert.equal(result.error, "Audio chunk queue is full");
    }
  }

  assert.ok(rejected > 0, "burst beyond maxPending should produce rejections");
  assert.ok(accepted > 0);
  assert.ok(queue.pending <= 50, "pending backlog must never exceed maxPending");

  await drainUntilIdle(queue);

  // Every accepted chunk is processed exactly once; rejected chunks never are.
  assert.equal(processed.size, accepted);
  for (const id of acceptedIds)
    assert.ok(processed.has(id), `accepted chunk ${id} was not processed`);
});

test("survives a high rate of failing chunks without stalling the queue", async () => {
  const processed: number[] = [];
  let errorCount = 0;
  const queue = new AudioChunkQueue<number>({
    maxPending: 10_000,
    process: async ({ item }) => {
      await Promise.resolve();
      if (item % 3 === 0) throw new Error(`stt failure for ${item}`);
      processed.push(item);
    },
    onError: () => {
      errorCount += 1;
    },
  });

  const total = 3000;
  for (let i = 0; i < total; i++) queue.enqueue(i);

  await drainUntilIdle(queue);

  const expectedFailures = Math.floor((total - 1) / 3) + 1; // multiples of 3 in [0, total)
  assert.equal(errorCount, expectedFailures);
  assert.equal(processed.length, total - expectedFailures);
  // Successful chunks remain in FIFO order despite interleaved failures.
  for (let i = 1; i < processed.length; i++) {
    assert.ok(processed[i] > processed[i - 1], "successful chunks must stay ordered");
  }
});

test("resolves a large batch within a generous time budget", async () => {
  const queue = new AudioChunkQueue<number>({
    maxPending: 20_000,
    process: async () => {
      await Promise.resolve();
    },
  });

  const start = Date.now();
  for (let i = 0; i < 10_000; i++) queue.enqueue(i);
  await drainUntilIdle(queue);
  const elapsedMs = Date.now() - start;

  assert.equal(queue.pending, 0);
  assert.equal(queue.isProcessing, false);
  // Loose ceiling: purely guards against pathological blow-ups, not perf tuning.
  assert.ok(elapsedMs < 15_000, `draining 10k chunks took too long: ${elapsedMs}ms`);
});
