import { Router } from "express";
import { db } from "../../db/index.js";
import { patients } from "../../db/schema.js";
import { eq, desc } from "drizzle-orm";
import { requireAuth } from "../../core/middleware.js";

const patientsRouter = Router();

patientsRouter.get("/", requireAuth, async (req, res, next) => {
  try {
    const allPatients = await db
      .select()
      .from(patients)
      .orderBy(desc(patients.updatedAt));
    res.json({ success: true, data: allPatients });
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
        debt: parseInt(req.body.debt) ?? 0,
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

export default patientsRouter;
