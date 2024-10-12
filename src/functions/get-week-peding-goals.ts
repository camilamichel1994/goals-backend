import dayjs from "dayjs";
import { db } from "../db";
import { goalCompletions, goals } from "../db/schema";
import { count, lte, eq, and, gte, sql } from "drizzle-orm";

export async function getWeekPendingGoals() {
  const lastDayOfWeek = dayjs().endOf("week").toDate();
  const firstDayOfWeek = dayjs().endOf("week").toDate();

  const goalCreateUpToWeek = db.$with("goals_create_up_to_week").as(
    db
      .select({
        id: goals.id,
        title: goals.title,
        desiredWeeklyFrequency: goals.desiredWeeklyFrequency,
      })
      .from(goals)
      .where(lte(goals.createdAt, lastDayOfWeek))
  );

  const goalCompletionCounts = db.$with("goal_completion_counts").as(
    db
      .select({
        goalId: goalCompletions.goalId,
        completionCount: count(goalCompletions.id).as("completionCount"),
      })
      .from(goalCompletions)
      .where(
        and(
          gte(goalCompletions.createdAt, firstDayOfWeek),
          lte(goalCompletions.createdAt, lastDayOfWeek)
        )
      )
      .groupBy(goalCompletions.goalId)
  );

  const pendingGoals = await db
    .with(goalCreateUpToWeek, goalCompletionCounts)
    .select({
      id: goalCreateUpToWeek.id,
      title: goalCreateUpToWeek.title,
      desiredWeeklyFrequency: goalCreateUpToWeek.desiredWeeklyFrequency,
      completionCount: sql/*SQL*/ `
      COALESCE(${goalCompletionCounts.completionCount}, 0)
      `.mapWith(Number),
    })
    .from(goalCreateUpToWeek)
    .leftJoin(
      goalCompletionCounts,
      eq(goalCompletionCounts.goalId, goalCreateUpToWeek.id)
    );

  return { pendingGoals };
}
