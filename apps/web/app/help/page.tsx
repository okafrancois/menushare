import Link from "next/link";
import type { Metadata } from "next";
import { Brand } from "@/components/brand";
export const metadata: Metadata = { title: "Aide et prise en main" };
const questions = [
  [
    "Comment mettre ma première carte en ligne ?",
    "Créez une catégorie dans Carte, puis ajoutez vos plats et leurs prix. Renseignez les allergènes et vos informations pratiques. Ouvrez l’aperçu du brouillon, puis cliquez sur Publier. Enfin, ouvrez Établissement → QR codes et scannez le QR avec un autre téléphone.",
  ],
  [
    "Pourquoi mes modifications ne sont-elles pas visibles ?",
    "Enregistrer met à jour votre brouillon. Publier rend ces changements visibles aux clients. Les ruptures et la suggestion du jour sont les seules modifications appliquées immédiatement.",
  ],
  [
    "Mon QR reste-t-il valable si je modifie la carte ?",
    "Oui, les QR restent valables après chaque publication et après un changement d’adresse du menu. En revanche, une carte mise hors ligne, archivée ou supprimée n’est plus visible.",
  ],
  [
    "Comment retrouver une ancienne carte ?",
    "Ouvrez Historique depuis Carte. Les dix dernières publications peuvent être restaurées dans le brouillon. Prévisualisez le résultat avant de republier.",
  ],
  [
    "Comment importer mes plats ?",
    "Dans Carte → Importer et exporter, téléchargez le modèle CSV puis remplissez une ligne par plat. Les colonnes sont catégorie, nom, prix et description. Les prix sont en euros ; utilisez des guillemets autour des valeurs contenant une virgule. L’import ajoute des plats au brouillon.",
  ],
  [
    "Que faire si une photo ne passe pas ?",
    "Les photos JPEG, PNG et WebP volumineuses sont redimensionnées automatiquement. Pour un format non reconnu comme HEIC sur certains appareils, exportez la photo en JPEG. Attendez la fin de l’envoi avant de fermer la fiche.",
  ],
  [
    "Ma sélection envoie-t-elle une commande en cuisine ?",
    "Non. Elle sert de pense-bête, que vous pouvez montrer au serveur ou partager avec votre table. Aucune commande ni aucun paiement n’est transmis.",
  ],
  [
    "Que se passe-t-il en mode démo ?",
    "Les données sont enregistrées uniquement dans ce navigateur. Un lien de démo modifié ne partage pas vos changements avec un autre appareil. Exportez votre carte pour conserver vos essais.",
  ],
  [
    "Comment choisir les allergènes ?",
    "Sur chaque fiche plat, indiquez les allergènes connus ou confirmez explicitement l’absence d’allergènes majeurs. Un champ non renseigné reste inconnu et le plat est masqué lorsque le client filtre un allergène. Les informations doivent être vérifiées par l’établissement.",
  ],
];
export default function HelpPage() {
  const email = process.env.NEXT_PUBLIC_SUPPORT_EMAIL;
  return (
    <main className="utility-page">
      <Brand />
      <h1>Besoin d’un coup de main ?</h1>
      <p>
        Les repères pour préparer votre carte et l’utiliser pendant le service.
      </p>
      <div className="pro-utility-links">
        <Link href="/dashboard">Ouvrir mon espace</Link>
        <Link href="/menu/nonna-lydie">Explorer un exemple</Link>
      </div>
      {questions.map(([title, body]) => (
        <details className="help-question" key={title}>
          <summary>{title}</summary>
          <p>{body}</p>
        </details>
      ))}
      <h2>Un problème persiste ?</h2>
      <p>
        Notez la page concernée, le nom de l’établissement et les étapes qui ont
        précédé le problème. Ne communiquez jamais votre code de connexion.
      </p>
      {email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? (
        <a href={`mailto:${email}?subject=Aide%20MenuShare`}>
          Contacter l’équipe MenuShare
        </a>
      ) : (
        <p>
          Transmettez ces informations à la personne qui vous a donné accès au
          prototype.
        </p>
      )}
      <div className="pro-utility-links">
        <Link href="/privacy">Confidentialité</Link>
        <Link href="/terms">Conditions d’utilisation</Link>
      </div>
    </main>
  );
}
