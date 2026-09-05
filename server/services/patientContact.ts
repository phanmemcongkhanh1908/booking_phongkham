import { db } from "../db/index.js";
import { patients, appointments, settings } from "../db/schema.js";
import { eq } from "drizzle-orm";

export interface PatientContactInfo {
  email?: string;
  telegramId?: string;
}

// In-memory or settings table cache for patient contacts
async function getContactsMap(): Promise<Record<string, PatientContactInfo>> {
  try {
    const res = await db.select().from(settings).where(eq(settings.id, "patientContacts")).limit(1);
    if (res.length > 0 && typeof res[0].value === "object" && res[0].value !== null) {
      return res[0].value as Record<string, PatientContactInfo>;
    }
  } catch (err) {
    console.error("Error reading patientContacts setting:", err);
  }
  return {};
}

async function saveContactsMap(map: Record<string, PatientContactInfo>) {
  try {
    await db.insert(settings)
      .values({ id: "patientContacts", value: map })
      .onConflictDoUpdate({ target: settings.id, set: { value: map, updatedAt: new Date() } });
  } catch (err) {
    console.error("Error saving patientContacts setting:", err);
  }
}

export async function getPatientContact(patientId: string, phone?: string): Promise<PatientContactInfo> {
  const map = await getContactsMap();
  const fromMap = map[patientId] || (phone ? map[phone] : undefined) || {};

  // Also query patient record
  let dbTelegramId = fromMap.telegramId;
  let dbEmail = fromMap.email;

  try {
    const p = await db.select().from(patients).where(eq(patients.id, patientId)).limit(1);
    if (p.length > 0) {
      if (!dbTelegramId && p[0].telegramId) {
        dbTelegramId = p[0].telegramId;
      }
      if (!dbEmail && p[0].notes) {
        // Extract email from notes if present like [Email: ...]
        const match = p[0].notes.match(/(?:Email|email):\s*([^\s,;]+@[^\s,;]+)/);
        if (match) {
          dbEmail = match[1].trim();
        }
      }
    }
  } catch (e) {
    console.error("Error querying patient for contact:", e);
  }

  return {
    email: dbEmail,
    telegramId: dbTelegramId
  };
}

export async function savePatientContact(
  patientId: string, 
  phone: string, 
  contact: PatientContactInfo
) {
  const map = await getContactsMap();
  const current = map[patientId] || map[phone] || {};

  const updated: PatientContactInfo = {
    email: contact.email || current.email,
    telegramId: contact.telegramId || current.telegramId,
  };

  map[patientId] = updated;
  if (phone) {
    map[phone] = updated;
  }
  await saveContactsMap(map);

  // If telegramId is provided, also persist in patients.telegram_id
  try {
    if (contact.telegramId) {
      await db.update(patients)
        .set({ telegramId: contact.telegramId, updatedAt: new Date() })
        .where(eq(patients.id, patientId));
    }
    
    // Also if email is provided, ensure it's tagged in patient notes for redundancy
    if (contact.email) {
      const p = await db.select().from(patients).where(eq(patients.id, patientId)).limit(1);
      if (p.length > 0) {
        const existingNotes = p[0].notes || "";
        if (!existingNotes.includes(contact.email)) {
          const newNotes = existingNotes 
            ? `${existingNotes}\n[Email: ${contact.email}]` 
            : `[Email: ${contact.email}]`;
          await db.update(patients)
            .set({ notes: newNotes, updatedAt: new Date() })
            .where(eq(patients.id, patientId));
        }
      }
    }
  } catch (e) {
    console.error("Error updating patient contact in DB:", e);
  }

  return updated;
}
