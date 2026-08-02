import { ArrowRight, Play, QrCode } from "lucide-react";
import Link from "next/link";

import { Brand } from "@/components/brand";

export default function HomePage() {
  return (
    <>
      <header className="site-header">
        <div className="container site-header-inner">
          <Brand />
          <nav className="header-nav" aria-label="Navigation principale">
            <Link className="button" href="/nonna-lydie">
              Voir la démo
            </Link>
            <Link className="button button-primary" href="/sign-in">
              Commencer <ArrowRight size={16} />
            </Link>
          </nav>
        </div>
      </header>

      <main className="landing-hero">
        <div className="container landing-grid">
          <section className="landing-copy">
            <span className="eyebrow">Créer · publier · scanner</span>
            <h1 className="serif">
              Votre menu prend <em>vie.</em>
            </h1>
            <p>
              Transformez vos plats en une expérience visuelle, publiez-la sur
              votre URL et posez le QR code directement sur la table.
            </p>
            <div className="landing-actions">
              <Link className="button button-primary" href="/sign-in">
                Créer mon menu <ArrowRight size={16} />
              </Link>
              <Link className="button" href="/nonna-lydie">
                <Play size={15} /> Explorer la démo
              </Link>
            </div>
            <div className="landing-points">
              <span>Sans mot de passe</span>
              <span>YouTube &amp; Vimeo</span>
              <span>QR code inclus</span>
            </div>
          </section>

          <aside className="landing-visual" aria-label="Aperçu du menu mobile">
            <div className="phone">
              <div className="phone-hero">
                <span className="play-button">
                  <Play fill="currentColor" size={22} />
                </span>
              </div>
              <div className="phone-body">
                <span className="eyebrow">Trattoria · Bordeaux</span>
                <h2 className="serif">Nonna Lydie</h2>
                <p>
                  Pâtes fraîches maison, sauces mijotées, produits d’Italie.
                </p>
                <div className="chips">
                  <span className="chip">Antipasti</span>
                  <span className="chip">Primi</span>
                  <span className="chip">Dolci</span>
                </div>
                <div className="mini-item">
                  <span className="mini-item-art" />
                  <strong>Burrata Pugliese</strong>
                  <span>14 €</span>
                </div>
                <div className="mini-item">
                  <span className="mini-item-art" />
                  <strong>Tagliatelle</strong>
                  <span>24 €</span>
                </div>
              </div>
            </div>
            <div
              className="landing-points"
              style={{ justifyContent: "center" }}
            >
              <QrCode size={16} /> URL unique + QR prêt à imprimer
            </div>
          </aside>
        </div>
      </main>
    </>
  );
}
