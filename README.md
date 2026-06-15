# RemontPRO — AI Sales Trainer

A B2B Back Office AI service for training sales managers in renovation companies.

The application simulates realistic conversations with potential clients, provides real-time coaching after every manager response, evaluates sales skills, and stores training results for management analytics.

## Live Demo

[Open RemontPRO](https://ai-asset-manager--editanaks.replit.app)

The application interface is in Russian.

## Demo Access

### Sales trainer

Choose one of the available manager profiles. No password is required.

### Admin panel

* Login: `admin`
* Password: `123`

The credentials are provided for demonstration purposes only.

## Project Purpose

Sales managers need regular practice with different customer types, objections, budgets, and project requirements.

RemontPRO automates role-play training and helps companies:

* reduce the time managers spend conducting manual training sessions;
* provide employees with immediate feedback;
* identify common sales mistakes;
* improve needs discovery and objection handling;
* track employee progress through the admin dashboard.

## Main Features

### Sales Manager Application

* selection of a manager profile;
* creation of a new training session;
* three customer difficulty levels;
* apartment or house renovation scenarios;
* AI-generated customer profiles;
* realistic dialogue with an AI client;
* recommendations after every manager response;
* training history;
* final score from 1 to 10;
* detailed strengths and areas for improvement.

### AI Coach

The AI coach analyses:

* establishment of contact;
* needs discovery;
* quality of questions;
* presentation of the solution;
* value argumentation;
* objection handling;
* closing to the next step;
* overall sales performance.

### Admin Panel

* demo authentication;
* manager list;
* training history;
* individual training details;
* full dialogue review;
* average scores;
* team statistics;
* common employee development areas.

## Technology Stack

### Frontend

* React 19
* TypeScript
* Vite
* Tailwind CSS
* shadcn/ui
* Wouter
* TanStack Query

### Backend

* Node.js
* Express 5
* TypeScript
* Zod validation
* OpenAPI-generated API contracts

### Database

* PostgreSQL
* Drizzle ORM

### Artificial Intelligence

* OpenRouter API
* configurable model through `OPENROUTER_MODEL`
* structured JSON responses
* automatic retry for invalid AI-generated JSON
* AI requests executed only on the backend

## Architecture

The application is divided into two main areas:

* the sales training application;
* the administrative analytics panel.

All training sessions, messages, feedback, scores, and manager information are stored in a shared database.

The hidden AI customer profile is not displayed to the manager during an active training session.

The OpenRouter API key is stored as a server-side environment variable and is never sent to the browser.

## Tested Scenarios

### Scenario 1 — Cosmetic Apartment Renovation

* Manager: Алексей Смирнов
* Difficulty: Medium
* Property type: Apartment
* Result: `10/10`

The AI coach identified an initial context error, evaluated the manager's correction, analysed objection handling, and confirmed successful closing to a specialist visit.

### Scenario 2 — Capital Renovation in an Older Building

* Manager: Дмитрий Орлов
* Difficulty: Medium
* Property type: Apartment
* Result: `9/10`

The scenario included concerns about budget overruns, hidden costs, material quality, guarantees, deadlines, and estimate transparency.

## Environment Variables

Create the following server-side environment variables:

```env
DATABASE_URL=your_postgresql_connection_string
OPENROUTER_API_KEY=your_openrouter_api_key
OPENROUTER_MODEL=your_preferred_model
```

`OPENROUTER_MODEL` is optional.

Never commit API keys or environment files to GitHub.

## Local Development

Install dependencies:

```bash
pnpm install
```

Start the API server:

```bash
pnpm --filter @workspace/api-server run dev
```

Start the frontend:

```bash
pnpm --filter @workspace/remontpro run dev
```

Run type checking:

```bash
pnpm run typecheck
```

Build the project:

```bash
pnpm run build
```

## Project Structure

```text
artifacts/
├── api-server/       Backend API and OpenRouter integration
└── remontpro/        React frontend

lib/
├── api-spec/         OpenAPI specification and generated contracts
└── db/               PostgreSQL schema and Drizzle ORM configuration
```

## Security Notes

* API keys are stored only in environment variables.
* OpenRouter requests are performed only by the backend.
* Admin routes use server-side session validation.
* Database requests use ORM-based queries.
* Input data is validated before processing.

## Author

**Edita Näks Skylstad**

GitHub: [editanaks-ops](https://github.com/editanaks-ops)
