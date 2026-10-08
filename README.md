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

## Expérience mobile

**Menu client** (`/menu/<slug>`) : en-tête compact qui affiche « Table N » après
le scan d’un QR de table (`?t=N`), ou l’itinéraire, l’appel et les horaires
quand on arrive par un lien direct ; onglets de catégories collants ; filtres
végétarien, sans gluten et 14 allergènes (un plat aux allergènes non renseignés
est masqué) ; recherche sans accents ; « Ma sélection », pense-bête de la table
gardé 12 h sur l’appareil, partageable par lien (`?sel=`) et affichable en grand
pour le serveur ; mode sombre automatique.

**App restaurateur** (`/dashboard`) : quatre onglets (Service, Carte, Stats,
Établissement) et une barre « modifications en attente » qui liste ce que la
publication changera. Les ruptures de stock et la suggestion du jour sont
appliquées en direct, hors brouillon : la carte en salle change immédiatement,
et un cron remet les plats en stock chaque nuit (désactivable).

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

Les boutons Google et Apple sont affichés uniquement si
`NEXT_PUBLIC_GOOGLE_OAUTH_ENABLED` et `NEXT_PUBLIC_APPLE_OAUTH_ENABLED` valent
respectivement `true`. Une valeur `false` ou une variable absente masque le
bouton concerné. Ces variables sont intégrées au JavaScript lors du build :
après les avoir modifiées dans Vercel pour l'environnement ciblé, lancer un
nouveau déploiement pour appliquer les valeurs.

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
bun run dev:backend   # Convex dev (régénère aussi convex/_generated)
bun run check-types
bun run test
bun run test:e2e      # démarre Next.js sur le port 3100 (E2E_PORT pour changer)
bun run build
```

La suite comprend 68 tests unitaires côté web, 81 tests Convex (convex-test) et
15 scénarios E2E Chromium sur les pages publiques et privées, dont plusieurs
parcours mobiles à 390 × 844.
