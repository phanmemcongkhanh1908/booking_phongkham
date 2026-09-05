import { Router } from "express";
import { db } from "../../db/index.js";
import { appointments } from "../../db/schema.js";
import { requireAuth, requirePermission } from "../../core/middleware.js";
import { sql, gte, lte, and, eq } from "drizzle-orm";

const analyticsRouter = Router();

analyticsRouter.use(requireAuth);

// [M13] Lấy dữ liệu tổng quan cho Dashboard
analyticsRouter.get("/dashboard", requirePermission("analytics.view"), async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;

    const conditions = [];
    if (startDate) conditions.push(gte(appointments.startAt, new Date(startDate as string)));
    if (endDate) conditions.push(lte(appointments.endAt, new Date(endDate as string)));

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Tính tổng số lượng theo Status
    const statusCounts = await db
      .select({
        status: appointments.status,
        count: sql<number>`count(${appointments.id})`,
      })
      .from(appointments)
      .where(whereClause)
      .groupBy(appointments.status);

    let total = 0;
    const summary: Record<string, number> = {
      CONFIRMED: 0,
      PENDING: 0,
      REQUESTED: 0,
      CHECKED_IN: 0,
      IN_SERVICE: 0,
      COMPLETED: 0,
      CANCEL_PATIENT: 0,
      CANCEL_CLINIC: 0,
      NO_SHOW: 0,
      RESCHEDULED: 0,
    };

    statusCounts.forEach((row) => {
      summary[row.status] = Number(row.count);
      total += Number(row.count);
    });

    const totalCancelled = summary["CANCEL_PATIENT"] + summary["CANCEL_CLINIC"];
    const confirmationRate = total > 0 ? ((summary["CONFIRMED"] + summary["CHECKED_IN"] + summary["IN_SERVICE"] + summary["COMPLETED"]) / total) * 100 : 0;
    const noShowRate = total > 0 ? (summary["NO_SHOW"] / total) * 100 : 0;
    const cancellationRate = total > 0 ? (totalCancelled / total) * 100 : 0;

    res.json({
      success: true,
      data: {
        total,
        statusBreakdown: summary,
        kpi: {
          confirmationRate: confirmationRate.toFixed(1),
          noShowRate: noShowRate.toFixed(1),
          cancellationRate: cancellationRate.toFixed(1),
        }
      },
    });
  } catch (error) {
    next(error);
  }
});

export default analyticsRouter;
