import { createClient, type GenericCtx } from "@convex-dev/better-auth";
import { convex, crossDomain } from "@convex-dev/better-auth/plugins";
import { betterAuth } from "better-auth/minimal";
import { emailOTP } from "better-auth/plugins";
import type { DataModelFromSchemaDefinition } from "convex/server";

import { components } from "../api";
import authConfig from "../auth.config";
import schema from "../schema";

type DataModel = DataModelFromSchemaDefinition<typeof schema>;

// `componentsGeneric()` keeps the starter usable before the first Convex
// codegen. Convex replaces this loose component reference with generated
// types as soon as `convex dev` is configured.
export const authComponent = createClient<DataModel>(
  components.betterAuth as any,
);

function socialProviders() {
  const providers: Record<
    string,
    { clientId: string; clientSecret: string }
  > = {};

  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    providers.google = {
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    };
  }

  if (process.env.APPLE_CLIENT_ID && process.env.APPLE_CLIENT_SECRET) {
    providers.apple = {
      clientId: process.env.APPLE_CLIENT_ID,
      clientSecret: process.env.APPLE_CLIENT_SECRET,
    };
  }

  return providers;
}

async function sendOtpEmail(email: string, otp: string) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.AUTH_FROM_EMAIL;
  if (!apiKey || !from) {
    throw new Error("Email OTP is not configured");
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [email],
      subject: `${otp} — votre code MenuShare`,
      html: `
        <div style="font-family:Arial,sans-serif;color:#241f1b;max-width:520px;margin:auto;padding:32px">
          <p style="color:#76263c;font-size:12px;text-transform:uppercase;letter-spacing:.12em">MenuShare</p>
          <h1 style="font-family:Georgia,serif;font-weight:500">Votre code de connexion</h1>
          <p style="font-size:32px;letter-spacing:.25em;font-weight:700">${otp}</p>
          <p style="color:#72685f">Ce code expire dans 10 minutes. Si vous n’avez pas demandé cette connexion, ignorez cet email.</p>
        </div>
      `,
    }),
  });

  if (!response.ok) {
    throw new Error(`Resend rejected OTP email: ${response.status}`);
  }
}

export const createAuth = (ctx: GenericCtx<DataModel>) => {
  const siteUrl = process.env.SITE_URL ?? "http://localhost:3000";

  return betterAuth({
    database: authComponent.adapter(ctx),
    baseURL: process.env.CONVEX_SITE_URL,
    trustedOrigins: [
      siteUrl,
      process.env.CONVEX_SITE_URL,
      "https://appleid.apple.com",
    ].filter((value): value is string => Boolean(value)),
    emailAndPassword: { enabled: false },
    socialProviders: socialProviders(),
    user: { deleteUser: { enabled: true } },
    plugins: [
      convex({ authConfig, jwksRotateOnTokenGenerationError: true }),
      crossDomain({ siteUrl }),
      emailOTP({
        otpLength: 6,
        expiresIn: 10 * 60,
        allowedAttempts: 5,
        storeOTP: "hashed",
        async sendVerificationOTP({ email, otp, type }) {
          if (type !== "sign-in") return;
          await sendOtpEmail(email, otp);
        },
      }),
    ],
  });
};
