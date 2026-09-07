import { ServerSpeechEngine } from './ServerSpeechEngine';

export interface TTSQueueItem {
  id: string;
  text: string;
  audioUrl?: string;
}

class TTSQueueManagerClass {
  private queue: TTSQueueItem[] = [];
  private isProcessing = false;

  public enqueue(id: string, text: string, audioUrl?: string) {
    // Dedup in queue
    if (this.queue.some(i => i.id === id)) return;
    
    this.queue.push({ id, text, audioUrl });
    this.processNext();
  }

  private async processNext() {
    if (this.isProcessing) return;
    if (this.queue.length === 0) return;

    this.isProcessing = true;
    const item = this.queue.shift();

    if (item) {
      try {
        await ServerSpeechEngine.speak(item.text, item.audioUrl);
      } catch (e) {
        console.error("Queue TTS error:", e);
      }
    }

    this.isProcessing = false;
    this.processNext(); // Process next immediately
  }

  public clear() {
    this.queue = [];
    ServerSpeechEngine.cancel();
    this.isProcessing = false;
  }
}

export const TTSQueueManager = new TTSQueueManagerClass();
