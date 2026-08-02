# MenuShare

MenuShare est un SaaS mobile-first permettant aux restaurants, bars, traiteurs
et food-trucks de composer un menu riche en médias, de le publier sur une URL
unique et de le partager par QR code.

## MVP implémenté

- Authentification sans mot de passe : Google, Apple ou code email à 6 chiffres.
- Onboarding avec création du premier établissement, puis gestion d’un nombre
  illimité d’établissements depuis le même compte.
- Images et vidéos externes uniquement : YouTube et Vimeo pour le MVP.
- Aperçu mobile et page publique `/menu/<slug>` ; les anciennes URLs `/<slug>`
  sont redirigées automatiquement.
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

## Production

- Application : <https://menushare.vercel.app>
- Convex : `bright-coyote-805`
- Google Cloud : projet `menushare-504319`
- Apple : App ID `com.okatech.menushare`, Services ID
  `com.okatech.menushare.web`
- Resend : clé limitée à l'envoi et domaine actuellement vérifié
  `tontine.okacode.com`

Vercel utilise `apps/web` comme répertoire racine. Les secrets OAuth et Resend
restent exclusivement dans les variables d'environnement Convex ; Vercel ne
reçoit que les URLs publiques et les indicateurs d'activation des boutons.

### Connexion Google

Callback OAuth (développement ou production : utiliser l'URL `.convex.site` du
déploiement ciblé) :

```text
https://bright-coyote-805.convex.site/api/auth/callback/google
```

### Connexion Apple

`APPLE_CLIENT_ID` correspond au Services ID web. `APPLE_CLIENT_SECRET` est le
JWT client secret Apple, à régénérer avant son expiration.

Callback Apple de production :

```text
https://bright-coyote-805.convex.site/api/auth/callback/apple
```

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

La suite actuelle comprend 19 tests unitaires et 8 scénarios E2E Chromium sur
les pages publiques et privées, dont un contrôle mobile à 390 × 844.
