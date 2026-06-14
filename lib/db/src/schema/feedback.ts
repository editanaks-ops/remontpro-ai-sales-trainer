import { pgTable, serial, integer, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { trainingsTable } from "./trainings";
import { messagesTable } from "./messages";

export const feedbackTable = pgTable("feedback", {
  id: serial("id").primaryKey(),
  training_id: integer("training_id").notNull().references(() => trainingsTable.id),
  manager_message_id: integer("manager_message_id").notNull().references(() => messagesTable.id),
  feedback_json: jsonb("feedback_json").notNull(),
  created_at: timestamp("created_at").defaultNow().notNull(),
});

export const insertFeedbackSchema = createInsertSchema(feedbackTable).omit({ id: true, created_at: true });
export type InsertFeedback = z.infer<typeof insertFeedbackSchema>;
export type Feedback = typeof feedbackTable.$inferSelect;
