import { Router } from "express";
import { db } from "@workspace/db";
import { managersTable, trainingsTable, feedbackTable } from "@workspace/db";
import { eq, sql, desc, and } from "drizzle-orm";
import { CreateManagerBody, GetManagerParams, DeleteManagerParams } from "@workspace/api-zod";
import { requireAdmin } from "../lib/session.js";

const router = Router();

// GET /api/managers
router.get("/managers", async (req, res) => {
  try {
    const managers = await db
      .select({
        id: managersTable.id,
        name: managersTable.name,
        created_at: managersTable.created_at,
        training_count: sql<number>`count(${trainingsTable.id})::int`,
        completed_count: sql<number>`count(${trainingsTable.id}) filter (where ${trainingsTable.status} = 'completed')::int`,
        avg_score: sql<number | null>`avg(${trainingsTable.overall_score}) filter (where ${trainingsTable.status} = 'completed')`,
      })
      .from(managersTable)
      .leftJoin(trainingsTable, eq(trainingsTable.manager_id, managersTable.id))
      .groupBy(managersTable.id)
      .orderBy(managersTable.name);

    res.json(managers);
  } catch (err) {
    req.log.error({ err }, "Failed to list managers");
    res.status(500).json({ error: "Ошибка при получении менеджеров" });
  }
});

// POST /api/managers (admin only)
router.post("/managers", requireAdmin, async (req, res) => {
  const parsed = CreateManagerBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Некорректные данные" });
    return;
  }

  try {
    const [manager] = await db
      .insert(managersTable)
      .values({ name: parsed.data.name })
      .returning();
    res.status(201).json({ ...manager, training_count: 0, completed_count: 0, avg_score: null });
  } catch (err) {
    req.log.error({ err }, "Failed to create manager");
    res.status(500).json({ error: "Ошибка при создании менеджера" });
  }
});

// GET /api/managers/:id
router.get("/managers/:id", async (req, res) => {
  const parsed = GetManagerParams.safeParse({ id: parseInt(req.params.id) });
  if (!parsed.success) {
    res.status(400).json({ error: "Некорректный id" });
    return;
  }

  const { id } = parsed.data;

  try {
    const [manager] = await db
      .select({
        id: managersTable.id,
        name: managersTable.name,
        created_at: managersTable.created_at,
        training_count: sql<number>`count(${trainingsTable.id})::int`,
        completed_count: sql<number>`count(${trainingsTable.id}) filter (where ${trainingsTable.status} = 'completed')::int`,
        avg_score: sql<number | null>`avg(${trainingsTable.overall_score}) filter (where ${trainingsTable.status} = 'completed')`,
      })
      .from(managersTable)
      .leftJoin(trainingsTable, eq(trainingsTable.manager_id, managersTable.id))
      .where(eq(managersTable.id, id))
      .groupBy(managersTable.id);

    if (!manager) {
      res.status(404).json({ error: "Менеджер не найден" });
      return;
    }

    // Get recent trainings
    const recentTrainings = await db
      .select({
        id: trainingsTable.id,
        manager_id: trainingsTable.manager_id,
        manager_name: managersTable.name,
        difficulty: trainingsTable.difficulty,
        property_type: trainingsTable.property_type,
        status: trainingsTable.status,
        started_at: trainingsTable.started_at,
        completed_at: trainingsTable.completed_at,
        overall_score: trainingsTable.overall_score,
      })
      .from(trainingsTable)
      .leftJoin(managersTable, eq(trainingsTable.manager_id, managersTable.id))
      .where(eq(trainingsTable.manager_id, id))
      .orderBy(desc(trainingsTable.started_at))
      .limit(5);

    // Compute avg scores per criterion from final_report_json
    const completedTrainings = await db
      .select({ final_report_json: trainingsTable.final_report_json })
      .from(trainingsTable)
      .where(and(eq(trainingsTable.manager_id, id), eq(trainingsTable.status, "completed")));

    const criterionTotals: Record<string, { sum: number; count: number }> = {};
    for (const t of completedTrainings) {
      const report = t.final_report_json as { scores?: Record<string, { score: number }> } | null;
      if (report?.scores) {
        for (const [k, v] of Object.entries(report.scores)) {
          if (!criterionTotals[k]) criterionTotals[k] = { sum: 0, count: 0 };
          criterionTotals[k].sum += v.score;
          criterionTotals[k].count++;
        }
      }
    }
    const avg_scores_by_criterion: Record<string, number | null> = {};
    for (const [k, v] of Object.entries(criterionTotals)) {
      avg_scores_by_criterion[k] = v.count > 0 ? v.sum / v.count : null;
    }

    // Extract typical problems from final reports
    const problemFreq: Record<string, number> = {};
    for (const t of completedTrainings) {
      const report = t.final_report_json as { problems?: string[] } | null;
      if (report?.problems) {
        for (const p of report.problems) {
          problemFreq[p] = (problemFreq[p] || 0) + 1;
        }
      }
    }
    const typical_problems = Object.entries(problemFreq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([p]) => p);

    res.json({
      ...manager,
      avg_scores_by_criterion,
      recent_trainings: recentTrainings,
      typical_problems,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get manager");
    res.status(500).json({ error: "Ошибка при получении менеджера" });
  }
});

// DELETE /api/managers/:id (admin only)
router.delete("/managers/:id", requireAdmin, async (req, res) => {
  const parsed = DeleteManagerParams.safeParse({ id: parseInt(req.params.id) });
  if (!parsed.success) {
    res.status(400).json({ error: "Некорректный id" });
    return;
  }

  const { id } = parsed.data;

  try {
    const [trainingCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(trainingsTable)
      .where(eq(trainingsTable.manager_id, id));

    if (trainingCount && trainingCount.count > 0) {
      res.status(400).json({
        success: false,
        message: `Нельзя удалить менеджера: у него есть ${trainingCount.count} тренировок. Сначала удалите тренировки.`,
      });
      return;
    }

    await db.delete(managersTable).where(eq(managersTable.id, id));
    res.json({ success: true, message: "Менеджер удалён" });
  } catch (err) {
    req.log.error({ err }, "Failed to delete manager");
    res.status(500).json({ error: "Ошибка при удалении менеджера" });
  }
});

export default router;
