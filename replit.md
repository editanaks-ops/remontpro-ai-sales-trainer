# РемонтPRO — AI-тренер отдела продаж

B2B Back Office AI-сервис для внутреннего обучения менеджеров строительной компании по продажам услуг ремонта квартир и домов.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — запуск API сервера (port 8080)
- `pnpm --filter @workspace/remontpro run dev` — запуск фронтенда (port 20349)
- `pnpm run typecheck` — полная проверка типов
- `pnpm run build` — typecheck + сборка всех пакетов
- `pnpm --filter @workspace/api-spec run codegen` — регенерация API хуков и Zod схем
- `pnpm --filter @workspace/db run push` — применение изменений схемы БД (только dev)
- Required env: `DATABASE_URL` — Postgres connection string, `OPENROUTER_API_KEY` — ключ OpenRouter API

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite + Tailwind CSS + shadcn/ui + wouter
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- AI: OpenRouter API (модель из OPENROUTER_MODEL или meta-llama/llama-3.3-70b-instruct:free)
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `lib/api-spec/openapi.yaml` — единственный источник правды для API контрактов
- `lib/db/src/schema/` — схемы БД: managers.ts, trainings.ts, messages.ts, feedback.ts
- `artifacts/api-server/src/routes/` — маршруты API: managers, trainings, admin, stats
- `artifacts/api-server/src/lib/openrouter.ts` — клиент OpenRouter с JSON retry
- `artifacts/api-server/src/lib/session.ts` — in-memory сессии (cookie-based)
- `artifacts/remontpro/src/pages/` — страницы: ManagerSelect, TrainingApp, AdminLogin, AdminPanel

## Architecture decisions

- **Сессии через cookie**: для admin-авторизации используется in-memory Map + httpOnly cookie (не JWT), для простоты демо
- **OpenRouter через backend**: API ключ никогда не передаётся в браузер — все вызовы AI только через сервер
- **JSON retry**: если AI возвращает некорректный JSON — автоматически повторяет запрос с инструкцией вернуть только JSON
- **Скрытый профиль клиента**: хранится в БД в client_profile_json, в API возвращается только при завершённой тренировке
- **Модель**: по умолчанию meta-llama/llama-3.3-70b-instruct:free, можно переопределить через OPENROUTER_MODEL

## Product

- Менеджер выбирает свой профиль из 5 карточек и входит в тренажёр
- Создаёт тренировку (сложность + тип объекта), получает первое сообщение AI-клиента
- Ведёт диалог, после каждого сообщения получает рекомендации тренера в правой колонке
- По завершении получает оценку по 7 критериям (1-10) и итоговый разбор
- Администратор (admin / 123) видит статистику, список менеджеров, все тренировки

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- После изменения маршрутов API нужно пересобрать api-server: `pnpm --filter @workspace/api-server run build`
- После изменения openapi.yaml нужно запустить codegen: `pnpm --filter @workspace/api-spec run codegen`
- Orval требует entity-shaped имена для схем запросов (не CreateXBody, а XInput) — иначе TS2308
- OpenRouter free модели могут возвращать текст вокруг JSON — openrouter.ts обрабатывает это

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
