import { pgTable, serial, integer, text, timestamp, real, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { managersTable } from "./managers";

export const trainingsTable = pgTable("trainings", {
  id: serial("id").primaryKey(),
  manager_id: integer("manager_id").notNull().references(() => managersTable.id),
  difficulty: text("difficulty").notNull(), // easy, medium, hard
  property_type: text("property_type").notNull(), // apartment, house, random
  client_profile_json: jsonb("client_profile_json"),
  status: text("status").notNull().default("active"), // active, completed
  started_at: timestamp("started_at").defaultNow().notNull(),
  completed_at: timestamp("completed_at"),
  overall_score: real("overall_score"),
  final_report_json: jsonb("final_report_json"),
});

export const insertTrainingSchema = createInsertSchema(trainingsTable).omit({ id: true, started_at: true, status: true });
export type InsertTraining = z.infer<typeof insertTrainingSchema>;
export type Training = typeof trainingsTable.$inferSelect;
