import { pgTable, uuid, text, varchar, timestamp, boolean, jsonb, integer, date, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const roles = pgTable("roles", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 50 }).notNull().unique(),
  permissions: jsonb("permissions").default([]),
});

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  roleId: uuid("role_id").references(() => roles.id),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const patients = pgTable("patients", {
  id: uuid("id").primaryKey().defaultRandom(),
  fullName: varchar("full_name", { length: 255 }).notNull(),
  phone: varchar("phone", { length: 20 }).notNull().unique(),
  dob: date("dob"),
  gender: varchar("gender", { length: 20 }),
  notes: text("notes"),
  telegramId: varchar("telegram_id", { length: 100 }),
  debt: integer("debt").default(0),
  allergies: text("allergies"),
  lastXRayDate: date("last_xray_date"),
  documents: jsonb("documents").default([]),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => {
  return {
    phoneIdx: index("idx_patients_phone").on(table.phone),
  };
});

export const providers = pgTable("providers", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  specialty: varchar("specialty", { length: 255 }),
  workingHours: jsonb("working_hours"),
  bookingEnabled: boolean("booking_enabled").default(true),
  isActive: boolean("is_active").default(true),
});

export const services = pgTable("services", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  durationMins: integer("duration_mins").notNull(),
  price: integer("price").default(0),
  bufferBefore: integer("buffer_before").default(0),
  bufferAfter: integer("buffer_after").default(0),
  autoConfirm: boolean("auto_confirm").default(true),
  recallIntervalDays: integer("recall_interval_days"),
  isActive: boolean("is_active").default(true),
});

export const providerServices = pgTable("provider_services", {
  id: uuid("id").primaryKey().defaultRandom(),
  providerId: uuid("provider_id").references(() => providers.id).notNull(),
  serviceId: uuid("service_id").references(() => services.id).notNull(),
});

export const resources = pgTable("resources", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  type: varchar("type", { length: 50 }).notNull(), // ROOM | CHAIR | EQUIPMENT
  isActive: boolean("is_active").default(true),
});

export const appointments = pgTable("appointments", {
  id: uuid("id").primaryKey().defaultRandom(),
  patientId: uuid("patient_id").references(() => patients.id).notNull(),
  providerId: uuid("provider_id").references(() => providers.id),
  serviceId: uuid("service_id").references(() => services.id).notNull(),
  chairId: uuid("chair_id").references(() => resources.id),
  roomId: uuid("room_id").references(() => resources.id),
  startAt: timestamp("start_at").notNull(),
  endAt: timestamp("end_at").notNull(),
  status: varchar("status", { length: 50 }).notNull().default("PENDING"), 
  source: varchar("source", { length: 50 }).default("ONLINE"),
  cancelReason: text("cancel_reason"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => {
  return {
    startEndIdx: index("idx_appointments_start_end").on(table.startAt, table.endAt),
    providerIdx: index("idx_appointments_provider").on(table.providerId),
  };
});

export const appointmentHolds = pgTable("appointment_holds", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionToken: varchar("session_token", { length: 255 }).notNull(),
  providerId: uuid("provider_id").references(() => providers.id),
  serviceId: uuid("service_id").references(() => services.id).notNull(),
  chairId: uuid("chair_id").references(() => resources.id),
  roomId: uuid("room_id").references(() => resources.id),
  startAt: timestamp("start_at").notNull(),
  endAt: timestamp("end_at").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
});

export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id),
  action: varchar("action", { length: 100 }).notNull(),
  tableName: varchar("table_name", { length: 100 }).notNull(),
  recordId: uuid("record_id").notNull(),
  beforeData: jsonb("before_data"),
  afterData: jsonb("after_data"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => {
  return {
    createdIdx: index("idx_audit_logs_created").on(table.createdAt),
  };
});

export const waitlist = pgTable("waitlist", {
  id: uuid("id").primaryKey().defaultRandom(),
  patientId: uuid("patient_id").references(() => patients.id).notNull(),
  serviceId: uuid("service_id").references(() => services.id).notNull(),
  providerId: uuid("provider_id").references(() => providers.id),
  preferredDate: date("preferred_date"),
  preferredTime: varchar("preferred_time", { length: 50 }),
  flexibility: varchar("flexibility", { length: 50 }),
  status: varchar("status", { length: 50 }).default("WAITING"), // WAITING, OFFERED, FULFILLED, EXPIRED
  createdAt: timestamp("created_at").defaultNow(),
});

export const patientRecalls = pgTable("patient_recalls", {
  id: uuid("id").primaryKey().defaultRandom(),
  patientId: uuid("patient_id").references(() => patients.id).notNull(),
  serviceId: uuid("service_id").references(() => services.id).notNull(),
  dueDate: date("due_date").notNull(),
  status: varchar("status", { length: 50 }).default("DUE"), // DUE, CONTACTED, BOOKED, COMPLETED, EXPIRED
  createdAt: timestamp("created_at").defaultNow(),
});

export const pushSubscriptions = pgTable("push_subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id),
  patientId: uuid("patient_id").references(() => patients.id),
  endpoint: text("endpoint").notNull(),
  p256dh: varchar("p256dh", { length: 255 }).notNull(),
  auth: varchar("auth", { length: 255 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const settings = pgTable("settings", {
  id: varchar("id", { length: 50 }).primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Relations
export const patientsRelations = relations(patients, ({ many }) => ({
  appointments: many(appointments),
}));

export const appointmentsRelations = relations(appointments, ({ one }) => ({
  patient: one(patients, {
    fields: [appointments.patientId],
    references: [patients.id],
  }),
  provider: one(providers, {
    fields: [appointments.providerId],
    references: [providers.id],
  }),
  service: one(services, {
    fields: [appointments.serviceId],
    references: [services.id],
  }),
}));

