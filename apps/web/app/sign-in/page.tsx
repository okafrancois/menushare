import { Brand } from "@/components/brand";
import { SignInCard } from "@/components/auth/sign-in-card";

export const metadata = { title: "Connexion" };

export default function SignInPage() {
  return (
    <main className="auth-page">
      <section className="auth-art">
        <Brand />
        <div>
          <h1 className="serif">Un menu vivant commence ici.</h1>
          <p>Créez vos plats, ajoutez vos images ou vos vidéos YouTube/Vimeo, puis publiez votre QR code.</p>
        </div>
        <span className="mono">MOBILE-FIRST · PASSWORDLESS</span>
      </section>
      <section className="auth-main"><SignInCard /></section>
    </main>
  );
}

