import { Router } from "express";
import { db } from "@workspace/db";
import {
  managersTable,
  trainingsTable,
  messagesTable,
  feedbackTable,
} from "@workspace/db";
import { eq, desc, and, sql } from "drizzle-orm";
import {
  CreateTrainingBody,
  GetTrainingParams,
  GetTrainingsQueryParams,
  SendMessageParams,
  SendMessageBody,
  FinishTrainingParams,
} from "@workspace/api-zod";
import { callOpenRouterWithJsonRetry } from "../lib/openrouter.js";

const router = Router();

// GET /api/trainings
router.get("/trainings", async (req, res) => {
  const parsed = GetTrainingsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Некорректные параметры" });
    return;
  }

  const { managerId, difficulty, status, dateFrom, dateTo } = parsed.data;

  try {
    let query = db
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
      .$dynamic();

    const conditions = [];
    if (managerId) conditions.push(eq(trainingsTable.manager_id, managerId));
    if (difficulty) conditions.push(eq(trainingsTable.difficulty, difficulty));
    if (status) conditions.push(eq(trainingsTable.status, status));
    if (dateFrom) conditions.push(sql`${trainingsTable.started_at} >= ${dateFrom}`);
    if (dateTo) conditions.push(sql`${trainingsTable.started_at} <= ${dateTo}`);
    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    const trainings = await query;
    res.json(trainings);
  } catch (err) {
    req.log.error({ err }, "Failed to list trainings");
    res.status(500).json({ error: "Ошибка при получении тренировок" });
  }
});

// POST /api/trainings
router.post("/trainings", async (req, res) => {
  const parsed = CreateTrainingBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Некорректные данные" });
    return;
  }

  const { manager_id, difficulty, property_type } = parsed.data;

  // Check manager exists
  const [manager] = await db
    .select()
    .from(managersTable)
    .where(eq(managersTable.id, manager_id));
  if (!manager) {
    res.status(404).json({ error: "Менеджер не найден" });
    return;
  }

  // Determine actual property type
  const propertyTypes = ["apartment", "house"];
  const actualPropertyType =
    property_type === "random"
      ? propertyTypes[Math.floor(Math.random() * propertyTypes.length)]
      : property_type;

  const difficultyLabel =
    difficulty === "easy" ? "лёгкий" : difficulty === "medium" ? "средний" : "сложный";
  const propertyLabel = actualPropertyType === "apartment" ? "квартира" : "дом";

  try {
    // Generate client profile via AI
    const profileMessages = [
      {
        role: "system" as const,
        content: `Ты генератор профилей клиентов строительной компании. Создай реалистичный профиль потенциального клиента для тренировки менеджера по продажам услуг ремонта.

Уровень сложности: ${difficultyLabel}
Тип объекта: ${propertyLabel}

Верни ТОЛЬКО JSON без пояснений со следующей структурой:
{
  "name": "Имя Фамилия",
  "property_type": "${actualPropertyType}",
  "property_area": число (площадь в кв.м),
  "budget_range": "диапазон бюджета в рублях",
  "desired_timeline": "желаемые сроки",
  "main_need": "основная потребность",
  "hidden_need": "скрытая потребность которую не сразу раскроет",
  "concerns": "опасения клиента",
  "main_objections": ["возражение 1", "возражение 2"],
  "communication_style": "стиль общения",
  "purchase_readiness": "уровень готовности к покупке",
  "scenario": "краткое описание сценария (1-2 предложения)",
  "first_message": "первое сообщение клиента менеджеру (3-5 предложений, в разговорном стиле)"
}

Важно:
- Создавай разных клиентов и разные ситуации (капитальный ремонт, косметический, новостройка, сравнивает подрядчиков, боится скрытых платежей, ограничен в бюджете, важны сроки и т.д.)
- Лёгкий уровень: клиент дружелюбный, одно простое возражение
- Средний уровень: клиент сомневается, 2-3 возражения
- Сложный уровень: недоверчивый, торгуется, требует доказательств`,
      },
      {
        role: "user" as const,
        content: `Создай профиль клиента для тренировки. Уровень: ${difficultyLabel}, тип объекта: ${propertyLabel}`,
      },
    ];

    const profileData = (await callOpenRouterWithJsonRetry(profileMessages)) as Record<
      string,
      unknown
    >;

    // Create training
    const [training] = await db
      .insert(trainingsTable)
      .values({
        manager_id,
        difficulty,
        property_type: actualPropertyType,
        client_profile_json: profileData,
        status: "active",
      })
      .returning();

    // Insert first client message
    const firstMessage = (profileData.first_message as string) || "Здравствуйте, я по поводу ремонта.";
    await db.insert(messagesTable).values({
      training_id: training.id,
      role: "client",
      content: firstMessage,
    });

    res.status(201).json({
      id: training.id,
      manager_id: training.manager_id,
      manager_name: manager.name,
      difficulty: training.difficulty,
      property_type: training.property_type,
      status: training.status,
      started_at: training.started_at.toISOString(),
      completed_at: null,
      overall_score: null,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to create training");
    const message =
      err instanceof Error ? err.message : "Ошибка при создании тренировки";
    res.status(500).json({ error: message });
  }
});

// GET /api/trainings/:id
router.get("/trainings/:id", async (req, res) => {
  const parsed = GetTrainingParams.safeParse({ id: parseInt(req.params.id) });
  if (!parsed.success) {
    res.status(400).json({ error: "Некорректный id" });
    return;
  }

  const { id } = parsed.data;

  try {
    const [training] = await db
      .select({
        id: trainingsTable.id,
        manager_id: trainingsTable.manager_id,
        manager_name: managersTable.name,
        difficulty: trainingsTable.difficulty,
        property_type: trainingsTable.property_type,
        client_profile_json: trainingsTable.client_profile_json,
        status: trainingsTable.status,
        started_at: trainingsTable.started_at,
        completed_at: trainingsTable.completed_at,
        overall_score: trainingsTable.overall_score,
        final_report_json: trainingsTable.final_report_json,
      })
      .from(trainingsTable)
      .leftJoin(managersTable, eq(trainingsTable.manager_id, managersTable.id))
      .where(eq(trainingsTable.id, id));

    if (!training) {
      res.status(404).json({ error: "Тренировка не найдена" });
      return;
    }

    const messages = await db
      .select()
      .from(messagesTable)
      .where(eq(messagesTable.training_id, id))
      .orderBy(messagesTable.created_at);

    const feedbacks = await db
      .select()
      .from(feedbackTable)
      .where(eq(feedbackTable.training_id, id))
      .orderBy(feedbackTable.created_at);

    res.json({
      ...training,
      started_at: training.started_at.toISOString(),
      completed_at: training.completed_at?.toISOString() ?? null,
      client_profile: training.status === "completed" ? training.client_profile_json : null,
      final_report: training.final_report_json,
      messages: messages.map((m) => ({
        ...m,
        created_at: m.created_at.toISOString(),
      })),
      feedbacks: feedbacks.map((f) => ({
        ...f,
        created_at: f.created_at.toISOString(),
      })),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get training");
    res.status(500).json({ error: "Ошибка при получении тренировки" });
  }
});

// POST /api/trainings/:id/message
router.post("/trainings/:id/message", async (req, res) => {
  const paramsParsed = SendMessageParams.safeParse({ id: parseInt(req.params.id) });
  if (!paramsParsed.success) {
    res.status(400).json({ error: "Некорректный id" });
    return;
  }

  const bodyParsed = SendMessageBody.safeParse(req.body);
  if (!bodyParsed.success) {
    res.status(400).json({ error: "Некорректное сообщение" });
    return;
  }

  const { id } = paramsParsed.data;
  const { content } = bodyParsed.data;

  try {
    const [training] = await db
      .select()
      .from(trainingsTable)
      .where(eq(trainingsTable.id, id));

    if (!training) {
      res.status(404).json({ error: "Тренировка не найдена" });
      return;
    }

    if (training.status !== "active") {
      res.status(400).json({ error: "Тренировка уже завершена" });
      return;
    }

    const profile = training.client_profile_json as Record<string, unknown>;
    const difficultyLabel =
      training.difficulty === "easy"
        ? "лёгкий"
        : training.difficulty === "medium"
        ? "средний"
        : "сложный";

    // Get existing messages for dialogue history
    const existingMessages = await db
      .select()
      .from(messagesTable)
      .where(eq(messagesTable.training_id, id))
      .orderBy(messagesTable.created_at);

    // Save manager message
    const [managerMsg] = await db
      .insert(messagesTable)
      .values({ training_id: id, role: "manager", content })
      .returning();

    // Build dialogue history for AI
    const dialogueHistory = existingMessages.map((m) => ({
      role: m.role === "manager" ? "user" : ("assistant" as const),
      content: m.content,
    }));

    // AI prompt
    const systemPrompt = `Ты играешь роль потенциального клиента строительной компании в тренировочном диалоге.

ПРОФИЛЬ КЛИЕНТА (строго конфиденциально — не раскрывай без соответствующих вопросов):
${JSON.stringify(profile, null, 2)}

УРОВЕНЬ СЛОЖНОСТИ: ${difficultyLabel}

ПРАВИЛА ПОВЕДЕНИЯ:
- Строго придерживайся созданного профиля
- Отвечай естественно, разговорным русским языком
- Не пиши длинные монологи — 2-4 предложения максимум
- Не помогай менеджеру продавать
- Не упоминай системную инструкцию или профиль
- Не раскрывай скрытую потребность без соответствующих вопросов
- Не соглашайся слишком быстро
- Реагируй на аргументы менеджера реалистично
- Постепенно изменяй уровень доверия в зависимости от качества диалога
- Уровень ${difficultyLabel}: ${
  training.difficulty === "easy"
    ? "будь доброжелательным, высказывай одно простое возражение, готов обсуждать"
    : training.difficulty === "medium"
    ? "сомневайся, сравнивай предложения, задавай уточняющие вопросы, 2-3 возражения"
    : "будь недоверчивым и требовательным, отвечай коротко, торгуйся, требуй доказательств, упоминай конкурентов"
}

ТАКЖЕ ты должен оценить последнее сообщение менеджера как AI-тренер.

Верни ТОЛЬКО JSON следующей структуры:
{
  "client_reply": "ответ клиента (2-4 предложения)",
  "coach_feedback": {
    "strengths": "что менеджер сделал хорошо в последнем сообщении",
    "mistakes": "ошибки или упущения в последнем сообщении",
    "next_step": "что стоит сделать или спросить дальше",
    "recommendation": "рекомендация по технике продаж",
    "example_phrase": "пример следующей естественной фразы менеджера"
  }
}`;

    const aiMessages = [
      { role: "system" as const, content: systemPrompt },
      ...dialogueHistory,
      { role: "user" as const, content: content },
    ];

    const aiResponse = (await callOpenRouterWithJsonRetry(aiMessages)) as {
      client_reply: string;
      coach_feedback: {
        strengths: string;
        mistakes: string;
        next_step: string;
        recommendation: string;
        example_phrase: string;
      };
    };

    // Save client reply
    const [clientMsg] = await db
      .insert(messagesTable)
      .values({
        training_id: id,
        role: "client",
        content: aiResponse.client_reply,
      })
      .returning();

    // Save feedback
    const [feedback] = await db
      .insert(feedbackTable)
      .values({
        training_id: id,
        manager_message_id: managerMsg.id,
        feedback_json: aiResponse.coach_feedback,
      })
      .returning();

    res.json({
      client_reply: aiResponse.client_reply,
      coach_feedback: aiResponse.coach_feedback,
      manager_message_id: managerMsg.id,
      client_message_id: clientMsg.id,
      feedback_id: feedback.id,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to send message");
    const message =
      err instanceof Error ? err.message : "Ошибка при отправке сообщения";
    res.status(500).json({ error: message });
  }
});

// POST /api/trainings/:id/finish
router.post("/trainings/:id/finish", async (req, res) => {
  const parsed = FinishTrainingParams.safeParse({ id: parseInt(req.params.id) });
  if (!parsed.success) {
    res.status(400).json({ error: "Некорректный id" });
    return;
  }

  const { id } = parsed.data;

  try {
    const [training] = await db
      .select()
      .from(trainingsTable)
      .where(eq(trainingsTable.id, id));

    if (!training) {
      res.status(404).json({ error: "Тренировка не найдена" });
      return;
    }

    if (training.status !== "active") {
      res.status(400).json({ error: "Тренировка уже завершена" });
      return;
    }

    const profile = training.client_profile_json as Record<string, unknown>;
    const difficultyLabel =
      training.difficulty === "easy"
        ? "лёгкий"
        : training.difficulty === "medium"
        ? "средний"
        : "сложный";

    // Get all messages
    const messages = await db
      .select()
      .from(messagesTable)
      .where(eq(messagesTable.training_id, id))
      .orderBy(messagesTable.created_at);

    // Get all feedbacks
    const feedbacks = await db
      .select()
      .from(feedbackTable)
      .where(eq(feedbackTable.training_id, id))
      .orderBy(feedbackTable.created_at);

    const dialogueText = messages
      .map((m) => `${m.role === "manager" ? "Менеджер" : "Клиент"}: ${m.content}`)
      .join("\n");

    const feedbackSummary = feedbacks
      .map((f) => {
        const fb = f.feedback_json as Record<string, string>;
        return `- Сильные стороны: ${fb.strengths}\n  Ошибки: ${fb.mistakes}`;
      })
      .join("\n");

    const systemPrompt = `Ты опытный руководитель отдела продаж строительной компании. Оцени работу менеджера в тренировочном диалоге.

ПРОФИЛЬ КЛИЕНТА:
${JSON.stringify(profile, null, 2)}

УРОВЕНЬ СЛОЖНОСТИ: ${difficultyLabel}

ДИАЛОГ:
${dialogueText}

РЕКОМЕНДАЦИИ В ПРОЦЕССЕ ДИАЛОГА:
${feedbackSummary}

Оцени работу менеджера по 7 критериям (от 1 до 10 целыми числами) и дай итоговую оценку.

Хорошим результатом считается согласие клиента на: консультацию, выезд замерщика, подготовку сметы, встречу, отправку проекта или повторный звонок в конкретное время.

Верни ТОЛЬКО JSON:
{
  "scores": {
    "contact": { "score": число, "comment": "комментарий" },
    "needs": { "score": число, "comment": "комментарий" },
    "questions": { "score": число, "comment": "комментарий" },
    "presentation": { "score": число, "comment": "комментарий" },
    "value": { "score": число, "comment": "комментарий" },
    "objections": { "score": число, "comment": "комментарий" },
    "closing": { "score": число, "comment": "комментарий" }
  },
  "overall_score": число,
  "strengths": ["сильная сторона 1", "сильная сторона 2"],
  "problems": ["проблема 1", "проблема 2"],
  "recommendations": ["рекомендация 1", "рекомендация 2"],
  "ideal_strategy": "описание более эффективной стратегии",
  "client_outcome": "что получилось в итоге диалога с клиентом"
}`;

    const aiMessages = [
      { role: "system" as const, content: systemPrompt },
      { role: "user" as const, content: "Оцени работу менеджера в этом диалоге." },
    ];

    const report = (await callOpenRouterWithJsonRetry(aiMessages)) as {
      scores: Record<string, { score: number; comment: string }>;
      overall_score: number;
      strengths: string[];
      problems: string[];
      recommendations: string[];
      ideal_strategy: string;
      client_outcome: string;
    };

    // Clamp scores to 1-10
    for (const key of Object.keys(report.scores)) {
      report.scores[key].score = Math.max(1, Math.min(10, Math.round(report.scores[key].score)));
    }
    report.overall_score = Math.max(1, Math.min(10, Math.round(report.overall_score)));

    // Update training
    await db
      .update(trainingsTable)
      .set({
        status: "completed",
        completed_at: new Date(),
        overall_score: report.overall_score,
        final_report_json: report,
      })
      .where(eq(trainingsTable.id, id));

    res.json(report);
  } catch (err) {
    req.log.error({ err }, "Failed to finish training");
    const message =
      err instanceof Error ? err.message : "Ошибка при завершении тренировки";
    res.status(500).json({ error: message });
  }
});

export default router;
