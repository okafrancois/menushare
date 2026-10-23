# Déploiement MenuShare

État de publication D3, 23 octobre 2026. Hébergements Vercel et Convex Cloud
conservés. Aucune migration, modification d'environnement distant ou de runtime.

## Cibles et accès

- Git : `https://github.com/okafrancois/menushare`, remote `origin`, branche
  de production `main`. Source avant chantier :
  `4330b75fe8eb584d46523c7de221ce5b3a6edcdf`.
- Vercel : projet `menushare`, ID `prj_OrHygOmat3UivtjZo5AxxB2aPrjE`, équipe
  `team_9YCBsOZvFmJ30VJfRQFIlMAd`, slug `okafrancois-projects`.
  Domaine : <https://menushare.vercel.app>. Intégration GitHub
  `okafrancois/menushare`, branche `main` ; racine `apps/web`, Next.js,
  Node `24.x`. Commandes build/install automatiques, sans surcharge.
- Profil Vercel privé valide du compte `okafrancois` :
  `/Users/bernyitoutou/.config/flow/vercel-cli/auth.json`.
  La liaison locale `.vercel/project.json` contient des IDs historiques obsolètes ;
  ne pas l'utiliser pour publier. Le profil global `ntsagui` ne convient pas.
- Convex production : `bright-coyote-805`, API
  <https://bright-coyote-805.convex.cloud>, authentification/actions
  <https://bright-coyote-805.convex.site>.
  Clé privée : `packages/backend/.env.production.local`.
- Convex développement : `brilliant-alligator-280`, sélection privée
  `packages/backend/.env.local`. Ne pas déployer sur cette cible.
- Autres accès privés : `~/.convex/config.json`, `~/.config/gh/hosts.yml`.
  Ne jamais afficher les secrets, les passer en arguments ou les ajouter à Git.
- Aucune application iOS présente ou publication App Store prévue.

## Prévalidation approuvée D2

Sur les vingt fichiers de code approuvés, sans les travaux tiers :

- Backend : suite complète, 10 fichiers, **142 tests réussis**, aucun échec.
- Web : suite complète, 12 fichiers, **77 tests réussis**, aucun échec.
- Types backend et web : réussis ; installation figée et `git diff --check` : réussis.
- Build de production Next `16.2.0` : réussi, 23 pages statiques, Node `24.19.0`,
  Bun `1.3.14`. Aucun serveur de développement lancé.

Preuves :
`/Users/bernyitoutou/Developer/output/convex-storage-rollout-2026-10-23/deployment/preflight/menushare.json`
et `preflight/menushare-logs/d2-*.log` sous le même dossier `deployment`.
Les vingt fichiers restent identiques à D2 ; seule cette documentation est
actualisée en D3. Ces corrections documentaires ne nécessitent pas de rebuild.
Les 68 fichiers tiers de `apps/web/scripts/`, `data/` et `design/` sont exclus.

Variables publiques existantes utilisées par le build :

```text
NEXT_PUBLIC_SITE_URL=https://menushare.vercel.app
NEXT_PUBLIC_CONVEX_URL=https://bright-coyote-805.convex.cloud
NEXT_PUBLIC_CONVEX_SITE_URL=https://bright-coyote-805.convex.site
NEXT_PUBLIC_GOOGLE_OAUTH_ENABLED=false
NEXT_PUBLIC_APPLE_OAUTH_ENABLED=false
```

## Compatibilité et limites

Runtime mesuré par GET `/version` : `20261020T233710Z-b5493411835c`.
L'[API officielle StorageWriter](https://docs.convex.dev/api/interfaces/server.StorageWriter)
et l'[implémentation native du 10 octobre](https://github.com/get-convex/convex-backend/commit/cecf1de0986b3dbe6e1ba1ed1d9a7154e9916391)
étayent le support des lectures dans les mutations avant cette version Cloud.
Le SHA exact du binaire Cloud n'est pas public ; SDK et émulateur ne le prouvent pas.

Une query native de métriques, sans lecture métier ni écriture, a mesuré en
production **10 fichiers / 16 Mio** disponibles par transaction, contre au plus
**2 fichiers / 4 Mio** pour l'adoption d'apparence. Voir
`preflight/menushare-logs/d2-runtime-metrics.json`.
Le correctif local `convex-test` n'émule pas ces budgets. Un contrôle distant
synthétique doit rapporter son périmètre exact ; il ne prouve pas un parcours
client authentifié. La reconnaissance de format n'est ni un décodeur de pixels
ni un assainissement SVG. `fileClaims` gouverne l'adoption sans attester
l'identité du déposant initial d'un upload direct non référencé.

## Procédure de publication

1. Recontrôler HEAD/index, fetch `origin/main`, comparer les vingt empreintes D2
   et les 68 fichiers tiers. Créer sur `main` un commit conventional limité aux
   vingt fichiers approuvés et à `DEPLOIEMENT.md`, sans `git add` global.
2. Déployer uniquement Convex production depuis une copie propre de ce commit,
   sans copier les fichiers privés. Depuis `packages/backend` :

   ```bash
   python3 /Users/bernyitoutou/Developer/output/convex-storage-rollout-2026-10-23/validation_gate.py -- ./node_modules/.bin/convex deploy --env-file /Users/bernyitoutou/Developer/menushare/packages/backend/.env.production.local --codegen disable --typecheck disable -y
   ```

   Le SDK résolu doit être `1.48.0` et les types déjà validés sur la même source.
   Vérifier la sélection explicite `prod:bright-coyote-805` avant de lancer.
   Attendre la validation du schéma et les backfills ; contrôler les sysqueries
   admin `_system/frontend/indexes` et `_system/frontend/getSchemas`.
   Nouveaux index attendus : `venues.by_logoStorageId`,
   `venues.by_coverImageStorageId`, `fileClaims.by_storageId`,
   `dailySpecials.by_imageStorageId`, `pendingFileDeletions.by_storageId`.
3. Après réussite backend/indexes, `git push origin main` déclenche **une**
   publication Git Vercel ; ne pas publier simultanément par CLI.
   Vérifier par API avec les IDs et le profil privés ci-dessus : SHA exact,
   état `READY`, alias de production et réglages existants conservés.
4. Vérifier HTTPS `/`, `/sign-in`, `/help`, backend `/version`, JWKS
   `/api/auth/convex/jwks` et l'URL Convex embarquée dans les chunks JS.
   `/api/auth/.well-known/openid-configuration` était déjà en `404` ; ce n'est
   pas la sonde bloquante. Aucun compte utilisateur ni effet externe fabriqué.

Le compte rendu final et les logs expurgés sont conservés hors dépôt :
`/Users/bernyitoutou/Developer/output/convex-storage-rollout-2026-10-23/deployment/releases/menushare.json`
et `releases/menushare-logs/`. Ils contiennent le SHA, les identifiants de
publication et les preuves effectives. Une actualisation documentaire après
publication peut rester locale afin d'éviter une deuxième publication Git inutile.

## Retour arrière et points ouverts

- Ancienne production web prête : `dpl_8ajooNsCYg4qYJnqcmVuJgssF1TT`,
  <https://menushare-pjm6nekjz-okafrancois-projects.vercel.app>.
- Pour un retour arrière ciblé, coordonner d'abord backend et web ; redéployer
  les fonctions depuis un commit propre compatible puis revenir au frontend
  précédent. Ne pas supprimer les fichiers, tables ou claims créés en production.
- Aucun export de données personnelles ou changement de sauvegarde dans ce
  chantier. La configuration de sauvegardes Convex Cloud hors fournisseur n'a
  pas été auditée ; elle reste à documenter. Les avertissements de sauvegarde
  propres aux VM Dokploy ne décrivent pas cet hébergement Cloud.
- Pas de connexion/adoption client authentifiée validée par les seules sondes
  publiques. Aucun test métier réel ou envoi email/push/IA n'est autorisé ici.
