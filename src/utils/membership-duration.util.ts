import type { DurationUnit } from "@prisma/client";

/**
 * Compute a membership end date from a start date and plan duration.
 * Shared by subscription and payment services so activation semantics never drift.
 */
export function calculateMembershipEndDate(startDate: Date, duration: number, unit: DurationUnit): Date {
  const endDate = new Date(startDate);

  switch (unit) {
    case "DAYS":
      endDate.setDate(endDate.getDate() + duration);
      break;
    case "WEEKS":
      endDate.setDate(endDate.getDate() + duration * 7);
      break;
    case "MONTHS":
      endDate.setMonth(endDate.getMonth() + duration);
      break;
    case "YEARS":
      endDate.setFullYear(endDate.getFullYear() + duration);
      break;
  }

  return endDate;
}
