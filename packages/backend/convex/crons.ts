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

// Sold-out dishes come back before the next service, except for venues that
// turned automatic restocking off.
crons.cron(
  "restock sold out items",
  "0 3 * * *",
  internal.service.restockAll,
  {},
);

export default crons;
