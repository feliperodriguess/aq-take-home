import { sql } from "drizzle-orm"
import { integer, jsonb, pgEnum, pgTable, real, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core"

export const turnRoleEnum = pgEnum("turn_role", ["assistant", "candidate"])
export const sessionStatusEnum = pgEnum("session_status", ["active", "completed", "abandoned"])

export const jobs = pgTable("jobs", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  shortDescription: text("short_description").notNull(),
  longDescription: text("long_description").notNull(),
  // Reference to a question pack file by slug. Packs live in src/data/question-packs/.
  // Stored by slug (not FK) so designers can iterate on JSON without DB changes.
  questionPackSlug: text("question_pack_slug").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
})

export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  jobId: uuid("job_id")
    .notNull()
    .references(() => jobs.id, { onDelete: "restrict" }),
  status: sessionStatusEnum("status").notNull().default("active"),
  startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
  endedAt: timestamp("ended_at", { withTimezone: true }),
})

export const turns = pgTable(
  "turns",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    // Monotonic order within the session. Use integer index (0,1,2,...).
    // The unique composite below acts as the lock against double-submits.
    index: integer("index").notNull(),
    role: turnRoleEnum("role").notNull(),
    text: text("text").notNull(),
    // For assistant turns: { signals, packItemId, rationale, isFollowUp, modelOutput }.
    // For candidate turns: { durationSec, mimeType } (optional).
    meta: jsonb("meta"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("turns_session_index_idx").on(t.sessionId, t.index)],
)

export const evaluations = pgTable("evaluations", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: uuid("session_id")
    .notNull()
    .unique()
    .references(() => sessions.id, { onDelete: "cascade" }),
  overallScore: real("overall_score").notNull(),
  payload: jsonb("payload").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
})

// Inferred row types — the rest of the app imports these instead of typing rows by hand.
export type Job = typeof jobs.$inferSelect
export type NewJob = typeof jobs.$inferInsert
export type Session = typeof sessions.$inferSelect
export type NewSession = typeof sessions.$inferInsert
export type Turn = typeof turns.$inferSelect
export type NewTurn = typeof turns.$inferInsert
export type EvaluationRow = typeof evaluations.$inferSelect
export type NewEvaluationRow = typeof evaluations.$inferInsert
