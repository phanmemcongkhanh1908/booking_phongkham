// Shared singleton SSE connection manager for customer-side appointment updates
// Ensures mobile & desktop tabs maintain at most 1 SSE connection for all tracked appointments on this device.

type Listener = (eventType: 'APPOINTMENT_COMPLETED' | 'APPOINTMENT_STATUS_UPDATED', payload: any) => void;

class CustomerRealtimeStreamManager {
  private es: EventSource | null = null;
  private currentIdsKey = '';
  private reconnectTimer: any = null;
  private listeners = new Set<Listener>();
  private subscribersCount = 0;

  public subscribe(ids: string[], listener: Listener): () => void {
    this.listeners.add(listener);
    this.subscribersCount++;
    this.updateIds(ids);

    return () => {
      this.listeners.delete(listener);
      this.subscribersCount = Math.max(0, this.subscribersCount - 1);
      if (this.subscribersCount === 0 || this.listeners.size === 0) {
        this.disconnect();
      }
    };
  }

  public updateIds(ids: string[]) {
    const normalized = Array.from(
      new Set(
        (ids || [])
          .map((id) => String(id || '').trim())
          .filter((id) => id.length >= 8)
      )
    )
      .sort()
      .slice(0, 50);

    const nextKey = normalized.join(',');

    if (!nextKey) {
      this.currentIdsKey = '';
      this.disconnect();
      return;
    }

    if (nextKey === this.currentIdsKey && this.es) {
      return;
    }

    this.currentIdsKey = nextKey;
    this.connect();
  }

  private disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.es) {
      try {
        this.es.close();
      } catch {}
      this.es = null;
    }
  }

  private connect() {
    this.disconnect();
    if (!this.currentIdsKey || this.listeners.size === 0) return;

    try {
      const url = `/api/public/appointments/stream?ids=${encodeURIComponent(this.currentIdsKey)}`;
      const es = new EventSource(url);
      this.es = es;

      es.addEventListener('APPOINTMENT_COMPLETED', (event: any) => {
        try {
          const payload = JSON.parse(event.data);
          this.listeners.forEach((fn) => {
            try {
              fn('APPOINTMENT_COMPLETED', payload);
            } catch {}
          });
        } catch {}
      });

      es.addEventListener('APPOINTMENT_STATUS_UPDATED', (event: any) => {
        try {
          const payload = JSON.parse(event.data);
          this.listeners.forEach((fn) => {
            try {
              fn('APPOINTMENT_STATUS_UPDATED', payload);
            } catch {}
          });
        } catch {}
      });

      es.onerror = () => {
        if (this.es === es) {
          try {
            es.close();
          } catch {}
          this.es = null;
        }
        if (this.listeners.size > 0 && this.currentIdsKey && typeof document !== 'undefined' && document.visibilityState !== 'hidden') {
          this.reconnectTimer = setTimeout(() => {
            this.connect();
          }, 12000);
        }
      };
    } catch {
      if (this.listeners.size > 0 && this.currentIdsKey) {
        this.reconnectTimer = setTimeout(() => {
          this.connect();
        }, 15000);
      }
    }
  }
}

export const customerRealtimeStream = new CustomerRealtimeStreamManager();
