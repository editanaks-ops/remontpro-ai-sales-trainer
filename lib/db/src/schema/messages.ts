import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { trainingsTable } from "./trainings";

export const messagesTable = pgTable("messages", {
  id: serial("id").primaryKey(),
  training_id: integer("training_id").notNull().references(() => trainingsTable.id),
  role: text("role").notNull(), // manager, client
  content: text("content").notNull(),
  created_at: timestamp("created_at").defaultNow().notNull(),
});

export const insertMessageSchema = createInsertSchema(messagesTable).omit({ id: true, created_at: true });
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Message = typeof messagesTable.$inferSelect;
