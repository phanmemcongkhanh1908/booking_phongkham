import { EventEmitter } from 'events';
import type { Response, Request } from 'express';

class RealtimeNotificationService extends EventEmitter {
  private clients: Set<Response> = new Set();

  constructor() {
    super();
    this.setMaxListeners(100);
    
    // Heartbeat to keep SSE alive
    setInterval(() => {
      this.sendHeartbeat();
    }, 30000);
  }

  public addClient(req: Request, res: Response) {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    });
    res.write('retry: 10000\n\n');

    this.clients.add(res);
    
    const cleanup = () => {
      this.clients.delete(res);
    };

    req.on('close', cleanup);
    req.on('error', cleanup);
    res.on('close', cleanup);
    res.on('error', cleanup);
  }

  private sendHeartbeat() {
    const data = `data: {"type": "HEARTBEAT"}\n\n`;
    for (const client of this.clients) {
      if (client.writable) {
        client.write(data);
      } else {
        this.clients.delete(client);
      }
    }
  }

  public emitBookingCreated(payload: any) {
    this.emit('BOOKING_CREATED', payload);
    const data = `event: BOOKING_CREATED\ndata: ${JSON.stringify(payload)}\n\n`;
    for (const client of this.clients) {
      if (client.writable) {
        client.write(data);
      } else {
        this.clients.delete(client);
      }
    }
  }
}

export const realtimeNotification = new RealtimeNotificationService();
