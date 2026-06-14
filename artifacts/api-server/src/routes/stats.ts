import { Router } from "express";
import { db } from "@workspace/db";
import { managersTable, trainingsTable } from "@workspace/db";
import { eq, sql, desc, and, gte, lte } from "drizzle-orm";
import { GetStatsDetailedQueryParams } from "@workspace/api-zod";

const router = Router();

// GET /api/stats/overview
router.get("/stats/overview", async (req, res) => {
  try {
    const [overview] = await db
      .select({
        total_managers: sql<number>`(select count(*)::int from ${managersTable})`,
        total_trainings: sql<number>`count(${trainingsTable.id})::int`,
        completed_trainings: sql<number>`count(${trainingsTable.id}) filter (where ${trainingsTable.status} = 'completed')::int`,
        avg_overall_score: sql<number | null>`avg(${trainingsTable.overall_score}) filter (where ${trainingsTable.status} = 'completed')`,
      })
      .from(trainingsTable);

    // Avg objections and closing from final_report_json
    const completedRows = await db
      .select({ final_report_json: trainingsTable.final_report_json })
      .from(trainingsTable)
      .where(eq(trainingsTable.status, "completed"));

    let objSum = 0, objCount = 0, closeSum = 0, closeCount = 0;
    for (const row of completedRows) {
      const report = row.final_report_json as { scores?: Record<string, { score: number }> } | null;
      if (report?.scores?.objections) {
        objSum += report.scores.objections.score;
        objCount++;
      }
      if (report?.scores?.closing) {
        closeSum += report.scores.closing.score;
        closeCount++;
      }
    }

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
      .orderBy(desc(trainingsTable.started_at))
      .limit(10);

    res.json({
      total_managers: overview?.total_managers ?? 0,
      total_trainings: overview?.total_trainings ?? 0,
      completed_trainings: overview?.completed_trainings ?? 0,
      avg_overall_score: overview?.avg_overall_score ?? null,
      avg_objections_score: objCount > 0 ? objSum / objCount : null,
      avg_closing_score: closeCount > 0 ? closeSum / closeCount : null,
      recent_trainings: recentTrainings,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get stats overview");
    res.status(500).json({ error: "Ошибка при получении статистики" });
  }
});

// GET /api/stats/detailed
router.get("/stats/detailed", async (req, res) => {
  const parsed = GetStatsDetailedQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Некорректные параметры" });
    return;
  }

  const { managerId, difficulty, dateFrom, dateTo } = parsed.data;

  try {
    const conditions = [eq(trainingsTable.status, "completed")];
    if (managerId) conditions.push(eq(trainingsTable.manager_id, managerId));
    if (difficulty) conditions.push(eq(trainingsTable.difficulty, difficulty));
    if (dateFrom) conditions.push(gte(trainingsTable.started_at, new Date(dateFrom)));
    if (dateTo) conditions.push(lte(trainingsTable.started_at, new Date(dateTo)));

    const whereClause = conditions.length === 1 ? conditions[0] : and(...conditions);

    const [totals] = await db
      .select({
        total_trainings: sql<number>`count(*)::int`,
        avg_overall_score: sql<number | null>`avg(${trainingsTable.overall_score})`,
      })
      .from(trainingsTable)
      .where(whereClause);

    // Manager ranking
    const managerRanking = await db
      .select({
        manager_id: trainingsTable.manager_id,
        manager_name: managersTable.name,
        avg_score: sql<number | null>`avg(${trainingsTable.overall_score})`,
        completed_count: sql<number>`count(*)::int`,
      })
      .from(trainingsTable)
      .leftJoin(managersTable, eq(trainingsTable.manager_id, managersTable.id))
      .where(whereClause)
      .groupBy(trainingsTable.manager_id, managersTable.name)
      .orderBy(desc(sql`avg(${trainingsTable.overall_score})`));

    // Score trend - group by date
    const trendRows = await db
      .select({
        date: sql<string>`date_trunc('day', ${trainingsTable.completed_at})::date::text`,
        avg_score: sql<number>`avg(${trainingsTable.overall_score})`,
        count: sql<number>`count(*)::int`,
      })
      .from(trainingsTable)
      .where(whereClause)
      .groupBy(sql`date_trunc('day', ${trainingsTable.completed_at})`)
      .orderBy(sql`date_trunc('day', ${trainingsTable.completed_at})`);

    // Avg scores by criterion and common problems
    const completedRows = await db
      .select({ final_report_json: trainingsTable.final_report_json })
      .from(trainingsTable)
      .where(whereClause);

    const criterionTotals: Record<string, { sum: number; count: number }> = {};
    const problemFreq: Record<string, number> = {};

    for (const row of completedRows) {
      const report = row.final_report_json as {
        scores?: Record<string, { score: number }>;
        problems?: string[];
      } | null;
      if (report?.scores) {
        for (const [k, v] of Object.entries(report.scores)) {
          if (!criterionTotals[k]) criterionTotals[k] = { sum: 0, count: 0 };
          criterionTotals[k].sum += v.score;
          criterionTotals[k].count++;
        }
      }
      if (report?.problems) {
        for (const p of report.problems) {
          problemFreq[p] = (problemFreq[p] || 0) + 1;
        }
      }
    }

    const avg_scores_by_criterion: Record<string, number | null> = {};
    for (const [k, v] of Object.entries(criterionTotals)) {
      avg_scores_by_criterion[k] = v.count > 0 ? v.sum / v.count : null;
    }

    const common_problems = Object.entries(problemFreq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([p]) => p);

    res.json({
      total_trainings: totals?.total_trainings ?? 0,
      avg_overall_score: totals?.avg_overall_score ?? null,
      avg_scores_by_criterion,
      manager_ranking: managerRanking,
      score_trend: trendRows,
      common_problems,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get detailed stats");
    res.status(500).json({ error: "Ошибка при получении детальной статистики" });
  }
});

export default router;
