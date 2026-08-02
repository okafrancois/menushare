"use client";

import { ArrowLeft, ArrowRight, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { authClient } from "@/lib/auth-client";

type Step = "email" | "otp";
type SocialProvider = "google" | "apple";

const socialEnabled = {
  google: process.env.NEXT_PUBLIC_GOOGLE_OAUTH_ENABLED === "true",
  apple: process.env.NEXT_PUBLIC_APPLE_OAUTH_ENABLED === "true",
};

function messageForAuthError(code?: string) {
  if (code === "TOO_MANY_ATTEMPTS") {
    return "Trop de tentatives. Demandez un nouveau code.";
  }
  if (code === "INVALID_OTP" || code === "OTP_EXPIRED") {
    return "Ce code est incorrect ou a expiré.";
  }
  return "La connexion n’a pas abouti. Réessayez dans un instant.";
}

export function SignInCard() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const startSocial = async (provider: SocialProvider) => {
    setError(null);
    if (!socialEnabled[provider]) {
      setError(
        `La connexion ${provider === "google" ? "Google" : "Apple"} sera active dès que ses identifiants OAuth seront configurés.`,
      );
      return;
    }

    setPending(provider);
    const { error: authError } = await authClient.signIn.social({
      provider,
      callbackURL: `${window.location.origin}/onboarding`,
    });
    if (authError) {
      setError(messageForAuthError(authError.code));
      setPending(null);
    }
  };

  const requestCode = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setPending("email");

    const { error: authError } = await authClient.emailOtp.sendVerificationOtp({
      email: email.trim().toLowerCase(),
      type: "sign-in",
    });

    setPending(null);
    if (authError) {
      setError(messageForAuthError(authError.code));
      return;
    }
    setStep("otp");
  };

  const verifyCode = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setPending("otp");

    const { error: authError } = await authClient.signIn.emailOtp({
      email: email.trim().toLowerCase(),
      otp,
    });

    setPending(null);
    if (authError) {
      setError(messageForAuthError(authError.code));
      return;
    }
    router.push("/onboarding");
  };

  return (
    <div className="auth-card">
      <span className="eyebrow">Espace restaurateur</span>
      <h2 className="serif">
        {step === "email" ? "Bienvenue." : "Vérifiez votre boîte mail."}
      </h2>
      <p>
        {step === "email"
          ? "Connexion et inscription utilisent le même écran. Aucun mot de passe à retenir."
          : `Nous avons envoyé un code à 6 chiffres à ${email}.`}
      </p>

      {step === "email" ? (
        <>
          <div className="auth-methods">
            <button
              className="social-button"
              type="button"
              onClick={() => startSocial("google")}
              disabled={pending !== null}
            >
              <span className="social-icon">G</span>
              <span>Continuer avec Google</span>
              {pending === "google" ? (
                <LoaderCircle className="animate-spin" size={17} />
              ) : (
                <ArrowRight size={17} />
              )}
            </button>
            <button
              className="social-button"
              type="button"
              onClick={() => startSocial("apple")}
              disabled={pending !== null}
            >
              <span className="social-icon">●</span>
              <span>Continuer avec Apple</span>
              {pending === "apple" ? (
                <LoaderCircle className="animate-spin" size={17} />
              ) : (
                <ArrowRight size={17} />
              )}
            </button>
          </div>

          <div className="divider">ou par email</div>

          <form onSubmit={requestCode}>
            <div className="form-group">
              <label htmlFor="email">Adresse email</label>
              <input
                className="input"
                id="email"
                type="email"
                autoComplete="email"
                placeholder="vous@restaurant.fr"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <button
              className="button button-primary button-block"
              type="submit"
              disabled={pending !== null}
            >
              {pending === "email" ? (
                <LoaderCircle className="animate-spin" size={17} />
              ) : null}
              Recevoir mon code
            </button>
          </form>
        </>
      ) : (
        <form onSubmit={verifyCode}>
          <button
            className="back-button"
            type="button"
            onClick={() => {
              setStep("email");
              setOtp("");
              setError(null);
            }}
          >
            <ArrowLeft size={15} /> Changer d’adresse
          </button>
          <div className="form-group">
            <label htmlFor="otp">Code de connexion</label>
            <input
              className="input otp-input"
              id="otp"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              placeholder="000000"
              value={otp}
              onChange={(event) =>
                setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))
              }
              required
              autoFocus
            />
          </div>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <button
            className="button button-primary button-block"
            type="submit"
            disabled={pending !== null || otp.length !== 6}
          >
            {pending === "otp" ? (
              <LoaderCircle className="animate-spin" size={17} />
            ) : null}
            Me connecter
          </button>
          <button
            className="back-button button-block"
            type="button"
            onClick={requestCode}
            disabled={pending !== null}
          >
            Renvoyer un code
          </button>
        </form>
      )}

      <p className="form-note">
        En continuant, vous acceptez les conditions d’utilisation et la
        politique de confidentialité de MenuShare.
      </p>
    </div>
  );
}
