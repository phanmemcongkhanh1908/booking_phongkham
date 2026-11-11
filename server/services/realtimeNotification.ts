import { EventEmitter } from 'events';
import type { Response, Request } from 'express';

interface ConnectedClient {
  res: Response;
  userId?: string;
  tenantId?: string | null;
  isSuperAdmin?: boolean;
}

class RealtimeNotificationService extends EventEmitter {
  private clients: Set<ConnectedClient> = new Set();

  constructor() {
    super();
    this.setMaxListeners(100);
    
    // Heartbeat to keep SSE alive (15s to keep Render/Cloudflare proxy connection active)
    setInterval(() => {
      this.sendHeartbeat();
    }, 15000);
  }

  public addClient(req: Request, res: Response) {
    const user = (req as any).user;
    const tenantId = user?.tenantId || null;
    const isSuperAdmin = !tenantId;

    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
      'Access-Control-Allow-Origin': '*'
    });
    res.write('retry: 15000\n\n');
    res.write(': connected\n\n');

    const client: ConnectedClient = {
      res,
      userId: user?.id,
      tenantId,
      isSuperAdmin
    };

    this.clients.add(client);
    
    const cleanup = () => {
      this.clients.delete(client);
    };

    req.on('close', cleanup);
    req.on('error', cleanup);
    res.on('close', cleanup);
    res.on('error', cleanup);
  }

  private sendHeartbeat() {
    const data = `data: {"type": "HEARTBEAT"}\n\n`;
    for (const client of this.clients) {
      try {
        if (client.res.writable && !client.res.destroyed) {
          client.res.write(data);
        } else {
          this.clients.delete(client);
        }
      } catch (err) {
        this.clients.delete(client);
      }
    }
  }

  public emitBookingCreated(payload: any) {
    this.emit('BOOKING_CREATED', payload);
    const data = `event: BOOKING_CREATED\ndata: ${JSON.stringify(payload)}\n\n`;
    const bookingTenantId = payload?.tenantId || null;

    for (const client of this.clients) {
      try {
        if (!client.res.writable || client.res.destroyed) {
          this.clients.delete(client);
          continue;
        }

        // TENANT ISOLATION LOGIC:
        // 1. If appointment belongs to a private clinic tenant (bookingTenantId is set):
        //    ONLY send to admins of that exact tenant clinic!
        //    Admin tổng (Super admin) and other clinics MUST NOT receive private clinic alerts.
        // 2. If appointment has no tenantId (default root platform booking):
        //    Only send to root platform admins (!client.tenantId).
        if (bookingTenantId) {
          if (client.tenantId !== bookingTenantId) {
            continue; // Skip non-matching tenants and super admin
          }
        } else {
          if (client.tenantId) {
            continue; // Skip private clinic tenants for root-level bookings
          }
        }

        client.res.write(data);
      } catch (err) {
        this.clients.delete(client);
      }
    }
  }
}

export const realtimeNotification = new RealtimeNotificationService();
