import { convexBetterAuthNextJs } from "@convex-dev/better-auth/nextjs";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
const convexSiteUrl = process.env.NEXT_PUBLIC_CONVEX_SITE_URL;

export const authServer =
  convexUrl && convexSiteUrl
    ? convexBetterAuthNextJs({ convexUrl, convexSiteUrl })
    : null;
