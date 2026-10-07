import { cronJobs } from "convex/server";

import { internal } from "./_generated/api";

const crons = cronJobs();

// Visitor identifiers and raw sessions are short-lived; only anonymous daily
// counters are kept.
crons.cron(
  "purge expired analytics",
  "30 3 * * *",
  internal.analytics.purgeExpired,
  {},
);

export default crons;
