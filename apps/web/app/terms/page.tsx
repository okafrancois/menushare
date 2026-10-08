import Link from "next/link";
import type { Metadata } from "next";
import { Brand } from "@/components/brand";
export const metadata: Metadata = {
  title: "Conditions d’utilisation du prototype",
};
export default function TermsPage() {
  return (
    <main className="utility-page">
      <Brand />
      <h1>Utiliser le prototype MenuShare</h1>
      <p>
        MenuShare permet de préparer une carte, de la publier et de la partager
        par QR code. Cette version est un prototype en cours d’évolution,
        proposé sans paiement dans l’application.
      </p>
      <h2>Votre carte et vos contenus</h2>
      <p>
        Vous gardez la maîtrise de vos contenus. Publiez uniquement des textes,
        images et vidéos que vous avez le droit d’utiliser. Vérifiez les prix,
        disponibilités et informations sur les allergènes avant publication. Les
        témoignages saisis sont présentés comme des extraits fournis par
        l’établissement.
      </p>
      <h2>Publication et commandes</h2>
      <p>
        Les clients voient votre dernière publication. Les ruptures et la
        suggestion du jour changent en direct. La sélection du client est un
        pense-bête : MenuShare ne transmet pas de commande et n’encaisse aucun
        paiement.
      </p>
      <h2>Conserver ou retirer vos données</h2>
      <p>
        Vous pouvez exporter votre carte, mettre votre établissement hors ligne
        ou l’archiver. La suppression du compte est définitive. Conservez une
        copie de vos contenus importants pendant les essais.
      </p>
      <h2>Aide</h2>
      <p>
        Les fonctionnalités et modalités du prototype peuvent évoluer. Pour une
        difficulté d’utilisation, consultez{" "}
        <Link href="/help">l’aide et les informations de contact</Link>.
      </p>
      <p>
        <Link href="/privacy">
          Consulter les informations de confidentialité
        </Link>
      </p>
    </main>
  );
}
