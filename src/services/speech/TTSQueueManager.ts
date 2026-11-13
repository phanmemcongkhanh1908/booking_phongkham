import { ServerSpeechEngine } from './ServerSpeechEngine';

export interface TTSQueueItem {
  id: string;
  title?: string;
  text: string;
  audioUrl?: string;
  playChime?: boolean;
  source?: 'booking' | 'reminder' | 'upcoming' | 'test';
  playEvenIfBroadcastDisabled?: boolean;
}

export interface TTSQueuePlaybackState {
  isPlaying: boolean;
  currentPlayingTitle?: string;
  queueLength: number;
  autoplayBlocked: boolean;
}

type QueueSubscriber = (state: TTSQueuePlaybackState) => void;

class TTSQueueManagerClass {
  private queue: TTSQueueItem[] = [];
  private currentItem: TTSQueueItem | null = null;
  private isProcessing = false;
  private autoplayBlocked = false;
  private subscribers = new Set<QueueSubscriber>();
  private generation = 0;

  public subscribe(cb: QueueSubscriber): () => void {
    this.subscribers.add(cb);
    cb(this.getPlaybackState());
    return () => this.subscribers.delete(cb);
  }

  public getPlaybackState(): TTSQueuePlaybackState {
    return {
      isPlaying: this.isProcessing || this.currentItem !== null,
      currentPlayingTitle: this.currentItem?.title,
      queueLength: this.queue.length,
      autoplayBlocked: this.autoplayBlocked,
    };
  }

  private emitState() {
    const state = this.getPlaybackState();
    this.subscribers.forEach((cb) => {
      try {
        cb(state);
      } catch {}
    });
  }

  /**
   * Enqueues an audio notification strictly into the FIFO queue.
   * Supports both object payload and legacy (id, text, audioUrl) arguments.
   */
  public enqueue(
    itemOrId: TTSQueueItem | string,
    legacyText?: string,
    legacyAudioUrl?: string
  ) {
    const item: TTSQueueItem =
      typeof itemOrId === 'string'
        ? {
            id: itemOrId,
            title: 'Nhắc nhở lịch hẹn',
            text: legacyText || '',
            audioUrl: legacyAudioUrl,
            playChime: true,
            source: 'upcoming',
          }
        : itemOrId;

    if (!item || !item.id || !item.text) return;

    // Deduplicate against both active playing item and queued items
    if (this.currentItem?.id === item.id) return;
    if (this.queue.some((q) => q.id === item.id)) return;

    this.queue.push(item);
    this.emitState();
    void this.processNext();
  }

  private async processNext() {
    if (this.isProcessing) return;
    if (this.queue.length === 0) {
      this.currentItem = null;
      this.emitState();
      return;
    }

    this.isProcessing = true;
    const myGen = this.generation;

    while (this.queue.length > 0 && myGen === this.generation) {
      const item = this.queue.shift() || null;
      if (!item) continue;

      this.currentItem = item;
      this.emitState();

      try {
        const result = await ServerSpeechEngine.speakQueued(item.text, item.audioUrl, {
          playChime: item.playChime !== false,
          generationId: ServerSpeechEngine.getGenerationId(),
        });

        if (result.autoplayBlocked) {
          this.autoplayBlocked = true;
        } else if (result.played) {
          this.autoplayBlocked = false;
        }
      } catch (e) {
        console.error('Queue TTS error:', e);
      }

      if (myGen !== this.generation) {
        break;
      }

      // Clean spacing between consecutive notifications so voices & chimes never clash
      if (this.queue.length > 0) {
        await new Promise((r) => setTimeout(r, 450));
      }
    }

    if (myGen === this.generation) {
      this.currentItem = null;
      this.isProcessing = false;
      this.emitState();
    }
  }

  public clearAutoplayBlocked() {
    this.autoplayBlocked = false;
    this.emitState();
  }

  public clear() {
    this.generation++;
    this.queue = [];
    this.currentItem = null;
    this.isProcessing = false;
    ServerSpeechEngine.cancel();
    this.emitState();
  }
}

export const TTSQueueManager = new TTSQueueManagerClass();
