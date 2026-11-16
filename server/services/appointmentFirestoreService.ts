import { adminDb } from "../lib/firebase-admin.js";
import { db } from "../db/index.js";
import { appointments, patients, services, providers, settings, users } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { appContext } from "../core/context.js";

export interface FirestoreAppointmentDoc {
  id: string;
  tenantId: string | null;
  clinicSlug: string | null;
  clinicName: string;
  patientId: string;
  patientName: string;
  patientPhone: string;
  providerId: string | null;
  providerName: string | null;
  serviceId: string | null;
  serviceIds: string[];
  serviceName: string;
  startAt: string;
  endAt: string;
  status: string;
  notes: string | null;
  rating: number | null;
  oneHourReminderSentAt: string | null;
  createdAt: string | null;
  updatedAt: string;
}

let adminDbUnavailable = false;
let firestoreNotFoundUntil = 0;

function isPermissionOrCredentialError(err: any): boolean {
  const msg = String(err?.message || err || "");
  return (
    msg.includes("PERMISSION_DENIED") ||
    msg.includes("UNAUTHENTICATED") ||
    msg.includes("Could not load the default credentials")
  );
}

function isNotFoundDbError(err: any): boolean {
  const msg = String(err?.message || err || "");
  return msg.includes("NOT_FOUND") || err?.code === 5;
}

async function withTimeout<T>(promiseFn: () => Promise<T>, timeoutMs = 2500): Promise<T | null> {
  let timer: NodeJS.Timeout | null = null;
  const timeoutPromise = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), timeoutMs);
  });
  try {
    const res = await Promise.race([promiseFn(), timeoutPromise]);
    if (timer) clearTimeout(timer);
    return res;
  } catch (err) {
    if (timer) clearTimeout(timer);
    throw err;
  }
}

function toIsoOrNull(val: any): string | null {
  if (!val) return null;
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val.toISOString();
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

async function resolveClinicMetaForTenant(
  tenantId: string | null,
  allSettings: any[],
  allUsers: any[]
): Promise<{ clinicSlug: string | null; clinicName: string }> {
  let clinicName = "Nha Khoa Dental Smart";
  let clinicSlug: string | null = null;

  const profileSetting =
    (tenantId
      ? allSettings.find(
          (s: any) =>
            (s.id === "clinicProfile" || s.id === "clinic_profile" || s.key === "clinicProfile" || s.key === "clinic_profile") &&
            s.tenantId === tenantId
        )
      : null) ||
    allSettings.find(
      (s: any) =>
        (s.id === "clinicProfile" || s.id === "clinic_profile") && !s.tenantId
    );

  if (profileSetting && profileSetting.value) {
    const val = typeof profileSetting.value === "string" ? JSON.parse(profileSetting.value) : profileSetting.value;
    if (val?.clinicName || val?.name) clinicName = String(val.clinicName || val.name);
    if (val?.slug) clinicSlug = String(val.slug).trim().toLowerCase();
  }

  if (tenantId) {
    const matchedUser = allUsers.find((u: any) => u.tenantId === tenantId);
    if (matchedUser) {
      if (!clinicSlug && matchedUser.slug) {
        clinicSlug = String(matchedUser.slug).trim().toLowerCase();
      }
      if (clinicName === "Nha Khoa Dental Smart" && matchedUser.clinicName) {
        clinicName = String(matchedUser.clinicName);
      }
    }
    if (!clinicSlug && tenantId.startsWith("tenant_")) {
      const candidate = tenantId.replace(/^tenant_/i, "").trim().toLowerCase();
      if (candidate && candidate.length <= 64 && /^[a-z0-9-]+$/.test(candidate)) {
        clinicSlug = candidate;
      }
    }
  }

  return { clinicSlug, clinicName };
}

function buildFirestoreDoc(
  apt: any,
  patient: any,
  provider: any,
  service: any,
  clinicMeta: { clinicSlug: string | null; clinicName: string }
): FirestoreAppointmentDoc | null {
  const startIso = toIsoOrNull(apt.startAt);
  const endIso = toIsoOrNull(apt.endAt) || startIso;
  if (!apt?.id || !startIso || !endIso) return null;

  const serviceName = String(apt.customServiceName || service?.name || "Khám nha khoa");
  const serviceIds = Array.isArray(apt.serviceIds) && apt.serviceIds.length > 0
    ? apt.serviceIds.map(String)
    : (apt.serviceId ? [String(apt.serviceId)] : []);

  return {
    id: String(apt.id),
    tenantId: apt.tenantId ? String(apt.tenantId) : null,
    clinicSlug: clinicMeta.clinicSlug,
    clinicName: clinicMeta.clinicName,
    patientId: String(apt.patientId || ""),
    patientName: String(apt.bookedForName || patient?.fullName || "Khách hàng"),
    patientPhone: String(patient?.phone || "").replace(/\D/g, ""),
    providerId: apt.providerId ? String(apt.providerId) : null,
    providerName: provider?.name ? String(provider.name) : null,
    serviceId: apt.serviceId ? String(apt.serviceId) : null,
    serviceIds,
    serviceName,
    startAt: startIso,
    endAt: endIso,
    status: String(apt.status || "REQUESTED"),
    notes: apt.notes ? String(apt.notes) : null,
    rating: typeof apt.rating === "number" ? apt.rating : null,
    oneHourReminderSentAt: toIsoOrNull(apt.oneHourReminderSentAt),
    createdAt: toIsoOrNull(apt.createdAt),
    updatedAt: new Date().toISOString(),
  };
}

function canUseAdminFirestore(): boolean {
  return (
    !adminDbUnavailable &&
    Date.now() >= firestoreNotFoundUntil &&
    Boolean(adminDb) &&
    typeof adminDb.collection === "function"
  );
}

function handleFirestoreErr(err: any, context: string) {
  if (isPermissionOrCredentialError(err)) {
    adminDbUnavailable = true;
    console.warn(`[AppointmentFirestore][${context}] Credentials/permission unavailable, switching to local DB fallback:`, err?.message || err);
  } else if (isNotFoundDbError(err)) {
    firestoreNotFoundUntil = Date.now() + 60_000;
    console.warn(`[AppointmentFirestore][${context}] Database not found, pausing Firestore writes for 60s.`);
  } else {
    console.warn(`[AppointmentFirestore][${context}] Error:`, err?.message || err);
  }
}

/**
 * Syncs a single appointment from local store into Firestore `/appointments/{id}`.
 */
export async function syncAppointmentToFirestore(appointmentId: string): Promise<boolean> {
  if (!appointmentId || !canUseAdminFirestore()) return false;

  try {
    let docPayload: FirestoreAppointmentDoc | null = null;
    await appContext.run({ isFullAdmin: true }, async () => {
      const aptRows = await db.select().from(appointments).where(eq(appointments.id, appointmentId)).limit(1);
      if (aptRows.length === 0) return;
      const apt = aptRows[0];

      const [ptRows, provRows, svcRows, allSettings, allUsers] = await Promise.all([
        apt.patientId ? db.select().from(patients).where(eq(patients.id, apt.patientId)).limit(1) : Promise.resolve([]),
        apt.providerId ? db.select().from(providers).where(eq(providers.id, apt.providerId)).limit(1) : Promise.resolve([]),
        apt.serviceId ? db.select().from(services).where(eq(services.id, apt.serviceId)).limit(1) : Promise.resolve([]),
        db.select().from(settings),
        db.select().from(users),
      ]);

      const clinicMeta = await resolveClinicMetaForTenant(apt.tenantId || null, allSettings, allUsers);
      docPayload = buildFirestoreDoc(apt, ptRows[0], provRows[0], svcRows[0], clinicMeta);
    });

    if (!docPayload) return false;
    await withTimeout(
      () => adminDb!.collection("appointments").doc(appointmentId).set(docPayload!, { merge: true }),
      2500
    );
    return true;
  } catch (err: any) {
    handleFirestoreErr(err, "syncAppointmentToFirestore");
    return false;
  }
}

export async function deleteAppointmentFromFirestore(appointmentId: string): Promise<boolean> {
  if (!appointmentId || !canUseAdminFirestore()) return false;
  try {
    await withTimeout(
      () => adminDb!.collection("appointments").doc(appointmentId).delete(),
      2500
    );
    return true;
  } catch (err: any) {
    handleFirestoreErr(err, "deleteAppointmentFromFirestore");
    return false;
  }
}

/**
 * Backfills upcoming CONFIRMED appointments into Firestore so cron reminders querying Firestore
 * always see complete, up-to-date schedule data across restarts or prior seed data.
 */
export async function syncConfirmedAppointmentsToFirestore(): Promise<number> {
  if (!canUseAdminFirestore()) return 0;

  try {
    const docsToSync: FirestoreAppointmentDoc[] = [];
    const cutoffPast = Date.now() - 2 * 60 * 60 * 1000;

    await appContext.run({ isFullAdmin: true }, async () => {
      const [allApts, allPts, allProvs, allSvcs, allSettings, allUsers] = await Promise.all([
        db.select().from(appointments),
        db.select().from(patients),
        db.select().from(providers),
        db.select().from(services),
        db.select().from(settings),
        db.select().from(users),
      ]);

      const ptMap = new Map(allPts.map((p: any) => [String(p.id), p]));
      const provMap = new Map(allProvs.map((p: any) => [String(p.id), p]));
      const svcMap = new Map(allSvcs.map((s: any) => [String(s.id), s]));
      const clinicMetaCache = new Map<string, { clinicSlug: string | null; clinicName: string }>();

      for (const apt of allApts) {
        if (String(apt.status || "").toUpperCase() !== "CONFIRMED") continue;
        const startIso = toIsoOrNull(apt.startAt);
        if (!startIso || new Date(startIso).getTime() < cutoffPast) continue;

        const tKey = apt.tenantId ? String(apt.tenantId) : "__root__";
        let clinicMeta = clinicMetaCache.get(tKey);
        if (!clinicMeta) {
          clinicMeta = await resolveClinicMetaForTenant(apt.tenantId || null, allSettings, allUsers);
          clinicMetaCache.set(tKey, clinicMeta);
        }

        const built = buildFirestoreDoc(
          apt,
          ptMap.get(String(apt.patientId)),
          provMap.get(String(apt.providerId)),
          svcMap.get(String(apt.serviceId)),
          clinicMeta
        );
        if (built) docsToSync.push(built);
      }
    });

    if (docsToSync.length === 0) return 0;

    const batchSize = 400;
    for (let i = 0; i < docsToSync.length; i += batchSize) {
      const chunk = docsToSync.slice(i, i + batchSize);
      const batch = adminDb!.batch();
      for (const docItem of chunk) {
        const ref = adminDb!.collection("appointments").doc(docItem.id);
        batch.set(ref, docItem, { merge: true });
      }
      await withTimeout(() => batch.commit(), 3500);
    }

    return docsToSync.length;
  } catch (err: any) {
    handleFirestoreErr(err, "syncConfirmedAppointmentsToFirestore");
    return 0;
  }
}

/**
 * Fetches CONFIRMED upcoming appointments from Firestore `/appointments` within `[windowStart, windowEnd]`
 * that have not yet received a 1-hour Web Push reminder. Cross-checks local DB to ensure strict idempotency,
 * and falls back safely to local DB if Firestore credentials/network are unavailable.
 */
export async function fetchUpcomingConfirmedAppointmentsFromFirestore(
  windowStart: Date,
  windowEnd: Date
): Promise<{ source: "firestore" | "local_fallback"; items: FirestoreAppointmentDoc[] }> {
  const startMs = windowStart.getTime();
  const endMs = windowEnd.getTime();

  // Build local reconciliation map (to prevent duplicate push notifications across DBs)
  const localSentSet = new Set<string>();
  const localStatusMap = new Map<string, string>();
  const localConfirmedCandidates: FirestoreAppointmentDoc[] = [];

  await appContext.run({ isFullAdmin: true }, async () => {
    const [allApts, allPts, allProvs, allSvcs, allSettings, allUsers] = await Promise.all([
      db.select().from(appointments),
      db.select().from(patients),
      db.select().from(providers),
      db.select().from(services),
      db.select().from(settings),
      db.select().from(users),
    ]);

    const ptMap = new Map(allPts.map((p: any) => [String(p.id), p]));
    const provMap = new Map(allProvs.map((p: any) => [String(p.id), p]));
    const svcMap = new Map(allSvcs.map((s: any) => [String(s.id), s]));

    for (const apt of allApts) {
      const idStr = String(apt.id);
      localStatusMap.set(idStr, String(apt.status || "").toUpperCase());
      if (apt.oneHourReminderSentAt) {
        localSentSet.add(idStr);
        continue;
      }
      if (String(apt.status || "").toUpperCase() !== "CONFIRMED") continue;
      const startIso = toIsoOrNull(apt.startAt);
      if (!startIso) continue;
      const t = new Date(startIso).getTime();
      if (t >= startMs && t <= endMs) {
        const clinicMeta = await resolveClinicMetaForTenant(apt.tenantId || null, allSettings, allUsers);
        const built = buildFirestoreDoc(
          apt,
          ptMap.get(String(apt.patientId)),
          provMap.get(String(apt.providerId)),
          svcMap.get(String(apt.serviceId)),
          clinicMeta
        );
        if (built) localConfirmedCandidates.push(built);
      }
    }
  });

  if (canUseAdminFirestore()) {
    try {
      const snap = await withTimeout(
        () => adminDb!.collection("appointments").where("status", "==", "CONFIRMED").get(),
        3000
      );

      if (snap) {
        const matchedFromFirestore: FirestoreAppointmentDoc[] = [];
        for (const docSnap of snap.docs) {
          const data = docSnap.data() as Partial<FirestoreAppointmentDoc>;
          const id = String(data.id || docSnap.id);
          if (data.oneHourReminderSentAt || localSentSet.has(id)) continue;

          // Skip if cancelled/completed locally before Firestore catchup
          const localStatus = localStatusMap.get(id);
          if (localStatus && localStatus !== "CONFIRMED") continue;

          const startIso = toIsoOrNull(data.startAt);
          if (!startIso) continue;
          const t = new Date(startIso).getTime();
          if (t >= startMs && t <= endMs) {
            matchedFromFirestore.push({
              id,
              tenantId: data.tenantId ?? null,
              clinicSlug: data.clinicSlug ?? null,
              clinicName: data.clinicName || "Nha Khoa Dental Smart",
              patientId: String(data.patientId || ""),
              patientName: String(data.patientName || "Khách hàng"),
              patientPhone: String(data.patientPhone || ""),
              providerId: data.providerId ?? null,
              providerName: data.providerName ?? null,
              serviceId: data.serviceId ?? null,
              serviceIds: Array.isArray(data.serviceIds) ? data.serviceIds : [],
              serviceName: String(data.serviceName || "Khám nha khoa"),
              startAt: startIso,
              endAt: toIsoOrNull(data.endAt) || startIso,
              status: "CONFIRMED",
              notes: data.notes ?? null,
              rating: typeof data.rating === "number" ? data.rating : null,
              oneHourReminderSentAt: null,
              createdAt: toIsoOrNull(data.createdAt),
              updatedAt: toIsoOrNull(data.updatedAt) || new Date().toISOString(),
            });
          }
        }

        return { source: "firestore", items: matchedFromFirestore };
      }
    } catch (err: any) {
      handleFirestoreErr(err, "fetchUpcomingConfirmedAppointmentsFromFirestore");
    }
  }

  return { source: "local_fallback", items: localConfirmedCandidates };
}

/**
 * Stamps `oneHourReminderSentAt` idempotently across both local DB and Firestore `/appointments/{id}`.
 */
export async function markOneHourReminderSent(appointmentId: string, sentAtDate = new Date()): Promise<void> {
  const sentAtIso = sentAtDate.toISOString();

  await appContext.run({ isFullAdmin: true }, async () => {
    try {
      await db
        .update(appointments)
        .set({
          oneHourReminderSentAt: sentAtDate,
          updatedAt: sentAtDate,
        } as any)
        .where(eq(appointments.id, appointmentId));
    } catch (err) {
      console.warn("[AppointmentFirestore] Failed to stamp local oneHourReminderSentAt:", err);
    }
  });

  if (canUseAdminFirestore()) {
    try {
      await withTimeout(
        () =>
          adminDb!
            .collection("appointments")
            .doc(appointmentId)
            .set(
              {
                oneHourReminderSentAt: sentAtIso,
                updatedAt: sentAtIso,
              },
              { merge: true }
            ),
        2500
      );
    } catch (err: any) {
      handleFirestoreErr(err, "markOneHourReminderSent");
    }
  }
}
