# Velo Globe

Application web **100 % locale** pour visualiser, explorer et analyser mes sorties à vélo sur un **globe 3D interactif**, à la manière de Google Earth.

Toutes les données restent sur mon ordinateur : pas de compte, pas de cloud, pas de statistiques d'usage. Les seules connexions sortantes sont les tuiles de la carte (OpenStreetMap) et, si je l'active, la récupération de mes propres activités depuis Garmin Connect.

> **Projet vibecodé.** Ce projet a été entièrement développé en « vibe coding » avec l'aide de [Claude](https://claude.ai) (Anthropic)
## Fonctionnalités

- **Globe 3D** (CesiumJS) : rotation, zoom, bascule 3D / 2D, tous les parcours tracés sur la carte, une couleur par année, filtrage par année, clic sur un tracé pour voir la fiche de la sortie.
- **Import** de fichiers **GPX** et **FIT** par glisser-déposer, avec détection des doublons (hash du fichier, puis heure de départ et distance).
- **Historique** : recherche, tri (date, distance, durée), filtres par année et mois, fiche détaillée, renommage, commentaires, suppression.
- **Statistiques** : totaux (année, mois, semaine), records, vitesse moyenne, dénivelé, graphiques par semaine / mois / année, comparaison cumulée entre années.
- **Sauvegarde et restauration** : archive `.zip` contenant la base et les fichiers d'origine, avec sauvegarde de sécurité automatique avant toute restauration.
- **Synchronisation Garmin** via l'API personnelle officielle de Garmin Connect (accès en lecture seule à mes propres activités).

## Technologies

| Rôle | Choix |
|---|---|
| Application | Next.js (App Router), React, TypeScript |
| Style | Tailwind CSS |
| Globe | CesiumJS |
| Base de données | SQLite (`better-sqlite3`) |
| Lecture des fichiers | `@garmin/fitsdk` (FIT), `fast-xml-parser` (GPX) |
| Graphiques | Recharts |

## Prérequis

- **Node.js 20.9 ou plus récent** (Node 22 recommandé)
- npm
- Un navigateur récent

## Installation et lancement

```bash
git clone https://github.com/Xiteryus/velo-globe.git
cd velo-globe
npm install
npm run dev
```

Puis ouvrir <http://localhost:3000>.

`npm install` copie automatiquement les fichiers statiques de Cesium dans `public/cesium`. Le serveur de développement écoute uniquement sur `127.0.0.1` : l'application n'est pas accessible depuis le reste du réseau.

Pour une exécution plus rapide au quotidien :

```bash
npm run build
npm run start -- -H 127.0.0.1
```

## Premiers pas

1. Aller dans **Importation** et déposer des fichiers `.gpx` ou `.fit`, par exemple ceux de l'export en masse de son compte Garmin.
2. Retrouver les parcours sur le **Globe**, dans l'**Historique** et les **Statistiques**.

## Connexion Garmin (optionnelle)

L'application utilise la **Personal API** officielle de Garmin Connect, qui donne accès à mes propres données en lecture seule.

1. Sur le site Garmin Connect, ouvrir les paramètres, puis la section *Personal API*, et créer une clé.
2. La clé n'est affichée qu'une seule fois : la copier tout de suite.
3. Dans l'application, aller dans **Paramètres**, coller la clé, puis cliquer sur *Enregistrer*.
4. Utiliser *Tester la connexion*, puis *Synchroniser les nouveautés* ou *Importer tout l'historique*.

La clé est stockée localement dans `data/secrets/` (permissions restreintes) et n'est jamais renvoyée au navigateur. Elle expire au bout de la durée choisie à sa création : il faudra alors en créer une nouvelle. Une synchronisation automatique est tentée à l'ouverture de l'application, au plus une fois toutes les 6 heures.

Les sorties sans tracé GPS (home-trainer, par exemple) et les autres sports sont ignorés.

## Où sont mes données ?

Tout est dans le dossier `data/` à la racine du projet, qui est exclu de Git :

```
data/
├── velo.db          # base SQLite
├── activities/      # fichiers GPX / FIT d'origine
├── backups/         # sauvegardes .zip
└── secrets/         # clé Garmin
```

Pour sauvegarder : page **Paramètres**, puis *Créer une sauvegarde*. Pour tout déplacer sur une autre machine : restaurer une sauvegarde depuis cette même page.

## Structure du projet

```
src/
├── app/            # pages (globe, stats, historique, import, paramètres) et routes API
├── components/     # globe Cesium, barre latérale, section Garmin
└── lib/            # base de données, parseurs GPX/FIT, géométrie, stats, sauvegarde, Garmin
scripts/            # script de copie des fichiers Cesium
```

## Limites connues

- Pas de relief 3D : il nécessiterait un compte Cesium ion, ce que j'ai volontairement évité. Les tracés sont posés sur l'ellipsoïde.
- Le fond de carte utilise les tuiles OpenStreetMap standard, assombries : à utiliser avec modération, conformément à la [politique d'utilisation des tuiles OSM](https://operations.osmfoundation.org/policies/tiles/).
- Le fond de carte et l'API Garmin nécessitent une connexion Internet.
- Pas de tests automatisés pour l'instant.
- L'application est pensée pour **un seul utilisateur en local** : aucune authentification, ne pas l'exposer sur Internet.

## Idées pour la suite

- Rendu optimisé pour des milliers de parcours
- Relief 3D (avec un jeton Cesium ion optionnel)
- Cartes de chaleur des routes les plus fréquentées
- Fiche détaillée avec profil d'altitude et courbes de vitesse / fréquence cardiaque

## Crédits

- Fond de carte : © contributeurs [OpenStreetMap](https://www.openstreetmap.org/copyright)
- Globe : [CesiumJS](https://cesium.com/platform/cesiumjs/)
- Développé avec Claude (Anthropic)
