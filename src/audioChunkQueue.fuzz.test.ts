import test from "node:test";
import assert from "node:assert/strict";
import fc from "fast-check";
import { AudioChunkQueue } from "./audioChunkQueue.ts";

async function waitForQueueToDrain(queue: AudioChunkQueue<any>, timeoutMs = 5000) {
  const start = Date.now();
  // Dynamically yield the event loop until the queue has completely finished processing all items
  while (queue.pending > 0 || queue.isProcessing) {
    if (Date.now() - start > timeoutMs) {
      throw new Error(
        `Queue drain timeout: pending=${queue.pending}, isProcessing=${queue.isProcessing}, timeoutMs=${timeoutMs}`,
      );
    }
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

test("AudioChunkQueue: property-based fuzz testing of enqueue backlog and FIFO ordering", async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.integer({ min: 1, max: 100 }), // maxPending backlog limit
      fc.array(fc.string()), // arbitrary items to enqueue
      async (maxPending, items) => {
        const processed: string[] = [];
        const queue = new AudioChunkQueue<string>({
          maxPending,
          process: async ({ item }) => {
            processed.push(item);
          },
        });

        // Enqueue all items in sequence and collect results.
        // Since we enqueue synchronously without waiting, the queue capacity is maxPending + 1
        // (1 item actively processing, plus up to maxPending items waiting in the backlog).
        const results = items.map((item) => queue.enqueue(item));
        const limit = maxPending + 1;

        // 1. Verify enqueue assertions for each item
        for (let i = 0; i < items.length; i++) {
          if (i < limit) {
            // Within maxPending + 1 limit: must be accepted
            assert.equal(results[i].accepted, true, `Item at index ${i} should be accepted`);
            assert.equal(typeof results[i].id, "number", "Accepted item must return numeric ID");
          } else {
            // Exceeding limit: must be rejected with full queue error
            assert.equal(
              results[i].accepted,
              false,
              `Item at index ${i} exceeding limit must be rejected`,
            );
            assert.equal(results[i].error, "Audio chunk queue is full");
          }
        }

        // 2. Wait for the queue to drain completely
        await waitForQueueToDrain(queue);

        // 3. Verify that only the accepted items were processed, in exact FIFO order
        const expectedProcessed = items.slice(0, limit);
        assert.deepEqual(
          processed,
          expectedProcessed,
          "Processed items must match accepted items in FIFO order",
        );
      },
    ),
  );
});
