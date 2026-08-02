# MenuShare

MenuShare est un SaaS mobile-first permettant aux restaurants, bars, traiteurs
et food-trucks de composer un menu riche en médias, de le publier sur une URL
unique et de le partager par QR code.

## MVP implémenté

- Authentification sans mot de passe : Google, Apple ou code email à 6 chiffres.
- Création d'un établissement et d'un menu structuré en catégories et plats.
- Images et vidéos externes uniquement : YouTube et Vimeo pour le MVP.
- Aperçu mobile et page publique `/<slug>`.
- Publication par snapshot afin de séparer brouillon et version en ligne.
- Personnalisation par logo, couverture, couleur dominante et vidéo de couverture.
- URL partageable, QR code SVG téléchargeable et interface publique responsive.
- CRUD complet, réordre, disponibilité, suppression et galeries d’images.

## Stack

Le dépôt suit l'architecture d'Eventflow : Bun, Turborepo, Next.js App Router,
React, Tailwind CSS, Convex et Better Auth.

## Démarrage

```bash
cp .env.example .env.local
bun install
bun run dev:web
```

L'interface fonctionne immédiatement en mode démo persistant dans le navigateur.
Les schémas et mutations Convex couvrent les établissements, slugs uniques,
menus, médias, stockage d’images et snapshots publiés. Pour brancher une instance
réelle, créer un déploiement Convex puis renseigner `NEXT_PUBLIC_CONVEX_URL`,
`NEXT_PUBLIC_CONVEX_SITE_URL` et les variables serveur listées dans
`.env.example`.

### Connexion Google

Callback local :

```text
http://localhost:3000/api/auth/callback/google
```

### Connexion Apple

`APPLE_CLIENT_ID` correspond au Services ID web. `APPLE_CLIENT_SECRET` est le
JWT client secret Apple, à régénérer avant son expiration.

### Code email

Les codes sont envoyés via Resend. Ils comportent 6 chiffres, expirent après
10 minutes et autorisent 5 tentatives.

## Commandes

```bash
bun run dev:web       # Next.js sur http://localhost:3000
bun run dev:backend   # Convex dev
bun run check-types
bun run test
bun run test:e2e
bun run build
```

La suite actuelle comprend 15 tests unitaires et 7 scénarios E2E Chromium sur
les pages publiques et privées, dont un contrôle mobile à 390 × 844.
