import { EventEmitter } from 'events';
import type { Response, Request } from 'express';

interface ConnectedClient {
  res: Response;
  userId?: string;
  tenantId?: string | null;
  isSuperAdmin?: boolean;
}

interface PatientSseClient {
  res: Response;
  appointmentIds: Set<string>;
}

class RealtimeNotificationService extends EventEmitter {
  private clients: Set<ConnectedClient> = new Set();
  private patientClients: Set<PatientSseClient> = new Set();

  constructor() {
    super();
    this.setMaxListeners(100);
    
    // Heartbeat to keep SSE alive (15s to keep Render/Cloudflare proxy connection active)
    setInterval(() => {
      this.sendHeartbeat();
    }, 15000);
  }

  private normalizeTenantId(val?: string | null): string | null {
    if (!val) return null;
    const trimmed = String(val).trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  public addClient(req: Request, res: Response) {
    const user = (req as any).user;
    const tenantId = this.normalizeTenantId(user?.tenantId);
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
      userId: user?.userId || user?.id,
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

  public addPatientClient(req: Request, res: Response, appointmentIds: string[]) {
    const cleanIds = new Set(
      appointmentIds
        .map((id) => String(id || '').trim())
        .filter((id) => id.length >= 8)
        .slice(0, 50)
    );

    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
      'Access-Control-Allow-Origin': '*'
    });
    res.write('retry: 10000\n\n');
    res.write(': patient-connected\n\n');

    const client: PatientSseClient = {
      res,
      appointmentIds: cleanIds,
    };

    this.patientClients.add(client);

    const cleanup = () => {
      this.patientClients.delete(client);
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
    for (const pClient of this.patientClients) {
      try {
        if (pClient.res.writable && !pClient.res.destroyed) {
          pClient.res.write(data);
        } else {
          this.patientClients.delete(pClient);
        }
      } catch (err) {
        this.patientClients.delete(pClient);
      }
    }
  }

  public hasClientsForTenant(tenantId?: string | null): boolean {
    const target = this.normalizeTenantId(tenantId);
    for (const client of this.clients) {
      if (this.normalizeTenantId(client.tenantId) === target) {
        return true;
      }
    }
    return false;
  }

  public emitBookingCreated(payload: any) {
    this.emit('BOOKING_CREATED', payload);
    const bookingTenantId = this.normalizeTenantId(payload?.tenantId);
    const normalizedPayload = { ...payload, tenantId: bookingTenantId };
    const data = `event: BOOKING_CREATED\ndata: ${JSON.stringify(normalizedPayload)}\n\n`;

    for (const client of this.clients) {
      try {
        if (!client.res.writable || client.res.destroyed) {
          this.clients.delete(client);
          continue;
        }

        // STRICT TENANT ISOLATION LOGIC:
        // Client receives notifications ONLY when client.tenantId === bookingTenantId.
        const clientTenantId = this.normalizeTenantId(client.tenantId);
        if (clientTenantId !== bookingTenantId) {
          continue;
        }

        client.res.write(data);
      } catch (err) {
        this.clients.delete(client);
      }
    }
  }

  public emitBookingUpdated(payload: any) {
    this.emit('BOOKING_UPDATED', payload);
    const bookingTenantId = this.normalizeTenantId(payload?.tenantId);
    const normalizedPayload = { ...payload, tenantId: bookingTenantId };
    const data = `event: BOOKING_UPDATED\ndata: ${JSON.stringify(normalizedPayload)}\n\n`;

    for (const client of this.clients) {
      try {
        if (!client.res.writable || client.res.destroyed) {
          this.clients.delete(client);
          continue;
        }

        const clientTenantId = this.normalizeTenantId(client.tenantId);
        if (clientTenantId !== bookingTenantId) {
          continue;
        }

        client.res.write(data);
      } catch (err) {
        this.clients.delete(client);
      }
    }
  }

  public emitPatientAppointmentCompleted(payload: any) {
    this.emit('APPOINTMENT_COMPLETED', payload);
    const targetAptId = payload?.id ? String(payload.id).trim() : '';
    if (!targetAptId) return;

    const data = `event: APPOINTMENT_COMPLETED\ndata: ${JSON.stringify(payload)}\n\n`;
    for (const client of this.patientClients) {
      try {
        if (!client.res.writable || client.res.destroyed) {
          this.patientClients.delete(client);
          continue;
        }
        if (!client.appointmentIds.has(targetAptId)) {
          continue;
        }
        client.res.write(data);
      } catch (err) {
        this.patientClients.delete(client);
      }
    }
  }
}

export const realtimeNotification = new RealtimeNotificationService();
