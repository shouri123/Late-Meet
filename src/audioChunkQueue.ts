export interface AudioChunkQueueItem<T> {
  id: number;
  item: T;
}

export interface AudioChunkQueueResult {
  accepted: boolean;
  id?: number;
  pending: number;
  error?: string;
}

interface AudioChunkQueueOptions<T> {
  maxPending: number;
  process: (entry: AudioChunkQueueItem<T>) => Promise<void>;
  onError?: (error: unknown, entry: AudioChunkQueueItem<T>) => void | Promise<void>;
}

export class AudioChunkQueue<T> {
  private readonly maxPending: number;
  private readonly process: AudioChunkQueueOptions<T>["process"];
  private readonly onError?: AudioChunkQueueOptions<T>["onError"];
  private pendingItems: AudioChunkQueueItem<T>[] = [];
  private processing = false;
  private nextId = 1;

  constructor(options: AudioChunkQueueOptions<T>) {
    this.maxPending = Math.max(1, options.maxPending);
    this.process = options.process;
    this.onError = options.onError;
  }

  get pending() {
    return this.pendingItems.length;
  }

  get isProcessing() {
    return this.processing;
  }

  enqueue(item: T): AudioChunkQueueResult {
    if (this.pendingItems.length >= this.maxPending) {
      return {
        accepted: false,
        pending: this.pendingItems.length,
        error: "Audio chunk queue is full",
      };
    }

    const entry = {
      id: this.nextId,
      item,
    };
    this.nextId += 1;

    this.pendingItems.push(entry);
    void this.drain();

    return {
      accepted: true,
      id: entry.id,
      pending: this.pendingItems.length,
    };
  }

  clear() {
    this.pendingItems = [];
  }

  private async drain() {
    if (this.processing) return;

    this.processing = true;

    try {
      while (this.pendingItems.length > 0) {
        const entry = this.pendingItems.shift();
        if (!entry) continue;

        try {
          await this.process(entry);
        } catch (err) {
          await this.onError?.(err, entry);
        }
      }
    } finally {
      this.processing = false;
    }
  }
}
