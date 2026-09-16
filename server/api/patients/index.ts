import { Router } from "express";
import { db } from "../../db/index.js";
import { patients } from "../../db/schema.js";
import { eq, desc, like, or, gt, and } from "drizzle-orm";
import { sendPatientDocument } from "../../core/telegram.js";
import { requireAuth } from "../../core/middleware.js";

const patientsRouter = Router();

patientsRouter.get("/", requireAuth, async (req, res, next) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = (page - 1) * limit;
    const search = req.query.search as string || '';
    const filter = req.query.filter as string || 'all';

    const conditions = [];
    if (search) {
       conditions.push(or(
         like(patients.fullName, `%${search}%`),
         like(patients.phone, `%${search}%`)
       ));
    }
    if (filter === 'debt') {
       conditions.push(gt(patients.debt, 0));
    }
    // For 'has_docs', we might need to check json if it's stored as JSON string. We can skip it here and just let client filter if needed, or check like '%documents%'.
    if (filter === 'has_docs') {
       conditions.push(like(patients.notes, '%"documents":[%{%]%'));
    }

    const allPatients = await db
      .select()
      .from(patients)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(patients.updatedAt))
      .limit(limit)
      .offset(offset);

    const countQuery = await db.select({ id: patients.id }).from(patients).where(conditions.length > 0 ? and(...conditions) : undefined);
    const total = countQuery.length;

    res.json({ 
      success: true, 
      data: allPatients,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    next(error);
  }
});

patientsRouter.post("/", requireAuth, async (req, res, next) => {
  try {
    const newPatient = await db.insert(patients).values({
      fullName: req.body.fullName,
      phone: req.body.phone,
      dob: req.body.dob,
      gender: req.body.gender,
      notes: req.body.notes,
    }).returning();
    res.json({ success: true, data: newPatient[0] });
  } catch (error) {
    next(error);
  }
});

patientsRouter.get("/:id", requireAuth, async (req, res, next) => {
  try {
    const pt = await db
      .select()
      .from(patients)
      .where(eq(patients.id, req.params.id))
      .limit(1);
    if (pt.length === 0) {
      return res.status(404).json({ success: false, error: { message: "Patient not found" } });
    }
    res.json({ success: true, data: pt[0] });
  } catch (error) {
    next(error);
  }
});

patientsRouter.put("/:id", requireAuth, async (req, res, next) => {
  try {
    const updated = await db
      .update(patients)
      .set({
        fullName: req.body.fullName,
        phone: req.body.phone,
        dob: req.body.dob,
        gender: req.body.gender,
        debt: Number(req.body.debt) || 0,
        allergies: req.body.allergies,
        lastXRayDate: req.body.lastXRayDate,
        notes: req.body.notes,
        updatedAt: new Date(),
      })
      .where(eq(patients.id, req.params.id))
      .returning();
    res.json({ success: true, data: updated[0] });
  } catch (error) {
    next(error);
  }
});


patientsRouter.post("/:id/send-document", requireAuth, async (req, res, next) => {
  try {
    const pt = await db.select().from(patients).where(eq(patients.id, req.params.id)).limit(1);
    if (pt.length === 0) {
      return res.status(404).json({ success: false, error: { message: "Patient not found" } });
    }
    
    // Allow updating telegramId on the fly
    const telegramId = req.body.telegramId || pt[0].telegramId;
    
    if (req.body.telegramId && req.body.telegramId !== pt[0].telegramId) {
      await db.update(patients).set({ telegramId: req.body.telegramId }).where(eq(patients.id, req.params.id));
    }

    if (!telegramId) {
      return res.status(400).json({ success: false, error: { message: "Bệnh nhân chưa có thông tin Telegram" } });
    }

    const { base64Data, filename, caption } = req.body;
    if (!base64Data) {
      return res.status(400).json({ success: false, error: { message: "Missing base64Data" } });
    }

    const base64Content = base64Data.split(';base64,').pop();
    const buffer = Buffer.from(base64Content, 'base64');

    const result = await sendPatientDocument(telegramId, buffer, filename || 'document.png', caption);
    if (result) {
      res.json({ success: true, message: "Gửi tài liệu qua Telegram thành công" });
    } else {
      res.status(500).json({ success: false, error: { message: "Không thể gửi tin nhắn qua Telegram, vui lòng thử lại sau" } });
    }
  } catch (error) {
    next(error);
  }
});

export default patientsRouter;
