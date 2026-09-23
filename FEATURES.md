# EurekAI — Liste des fonctionnalités

> Premier jet, établi à partir du code existant (`apps/client`, `apps/server`,
> `apps/shared`). EurekAI est une application de génération d'images (et vidéos)
> par IA, organisée par projets et par prompts, construite sur Dagda v1.

---

## 1. Modèle de données

| Entité | Description |
|---|---|
| `users` | Utilisateur (uid Google, nom affiché, activé / non activé) |
| `projects` | Regroupe des prompts autour d'un thème. Épinglable, verrouillable, vignette |
| `prompts` | Prompt positif / négatif, dimensions, durée (vidéos), modèle, prompt parent (héritage), ordre |
| `pictures` | Instance d'un prompt avec une graine (seed) donnée : statut, note, pièce jointe |
| `attachments` | Données binaires (base64) de l'image ou de la vidéo |
| `seeds` | Graines préférées mémorisées par projet |
| `sources` | Images sources uploadées par projet, réutilisables comme entrée d'un prompt |

Types métier : `ComputationStatus` (NONE / PENDING / COMPUTING / DONE / ERROR /
ACCEPTED / REJECTED), `PictureType` (IMAGE / VIDEO), `Score` (0 à 4 étoiles).

Contextes de chargement : `users`, `projects`, `project` (un projet complet),
`pending` (images en attente de génération).

## 2. Gestion des projets

- Création d'un projet (nom + dimensions par défaut).
- Renommage, suppression d'un projet.
- Épinglage (`pinned`) : les projets épinglés apparaissent en premier.
- Archivage implicite : projets épinglés / actifs / archivés dans trois sections.
- Verrouillage d'un projet (`lockable`) — projets sensibles masqués derrière le verrou.
- Vignette de projet : choix d'une image générée comme illustration.
- Recherche / filtrage des projets par nom (champ de saisie incrémental).

## 3. Gestion des prompts

- Éditeur de prompt : prompt positif, prompt négatif, largeur, hauteur, durée, graine, modèle.
- Sélection du modèle parmi ceux découverts sur les back-ends (liste rafraîchissable).
- Sélection du ratio d'image, proposé en fonction de la taille native du modèle.
- Champs paramétrés par le modèle sélectionné : le prompt négatif est masqué si le
  workflow ne l'exploite pas, la durée n'est proposée que si le workflow l'expose
  (bornes, pas, valeur par défaut et unité déclarés par le workflow).
- Images sources par projet : upload de plusieurs images attachées au projet
  (panneau dédié), réutilisables par n'importe quel prompt du projet. Un prompt
  sélectionne au plus une image source. Le sélecteur n'est proposé que si le
  workflow l'exploite (`image` dans le manifest) et la sélection devient alors
  obligatoire pour soumettre le prompt.
- Héritage de prompt (`parentId`) : dérivation d'un prompt existant.
- Ordre d'affichage des prompts (`orderIndex`), affichés du plus récent au plus ancien.
- Demande de génération de N images pour un prompt.
- Suppression d'un prompt et de ses images.

## 4. Génération d'images

- Boucle de génération côté serveur (`Generator`) : dépilage toutes les secondes des images `PENDING`.
- Marquage immédiat en `COMPUTING` pour éviter les doubles générations.
- Tri de la file par modèle (limite les changements de modèle) puis par ancienneté.
- Verrou par back-end (`getLock`) : sérialisation des générations sur une même machine.
- Sauvegarde de l'image en pièce jointe + mise à jour du statut de l'image.
- Correction des dimensions a posteriori si le back-end a révisé la taille.
- Remise à `ERROR` au démarrage du serveur des images restées en `COMPUTING`.
- Notification temps réel du nombre d'images en cours de génération (`generating`).
- Notification push (Web Push) quand la file est vide, avec le nombre d'images générées et en
  erreur : envoyée par le serveur via le service de push du navigateur, elle arrive même
  application fermée (Android, iOS avec l'application ajoutée à l'écran d'accueil, desktop).
  Abonnements stockés dans `pushSubscriptions`, oubliés quand le service de push les refuse.
  À défaut de push (clés absentes, navigateur non abonné), la page ouverte affiche elle-même
  la notification.
- Support des vidéos (le même pipeline produit un `PictureType.VIDEO`).

### Back-ends de génération supportés

| Back-end | Détails |
|---|---|
| ComfyUI | Templates de workflows (`.zip` dans `workflows/`), options déclarées dans le `manifest.json`, pool de connexions |
| Automatic1111 | Découverte automatique des modèles installés (SD, SDXL, Flux) |

- Découverte automatique des modèles disponibles au démarrage + rafraîchissement à la demande.
- Wake-on-LAN : script optionnel pour réveiller la machine de génération (`*_WOL_SCRIPT`).
- Configuration entièrement par variables d'environnement.

## 5. Consultation et tri des images

### Page « Images »
- Affichage des images d'un projet, groupées par prompt ou par graine.
- Densité d'affichage réglable (nombre d'images par ligne).
- Filtres sur le statut des images (en attente, acceptées, rejetées, à évaluer…).
- Panneau d'édition de prompt affiché contextuellement.
- Actions par image : accepter, rejeter, supprimer, définir comme vignette de projet,
  mémoriser la graine, dériver un nouveau prompt.

### Page « Quick » (tri rapide)
- Affichage plein écran d'une image à la fois, à évaluer.
- Acceptation / rejet au clavier ou par superposition tactile.
- Enchaînement automatique sur l'image suivante.

### Page « Stars » (notation)
- Notation par comparaison : l'image à noter est confrontée aux références de chaque niveau.
- Images et vidéos (lues en boucle, sans son).
- Attribution d'une note de 1 à 4 étoiles, au clavier (y compris disposition AZERTY).
- Le média noté bascule dans l'aperçu de son niveau sans être retéléchargé, puis laisse la
  place à sa vignette dès qu'elle est disponible.
- Les médias qui ne sont plus affichés sont déchargés (vidéos mises en pause et vidées) pour
  que la mémoire n'augmente pas au fil des notations.
- Retour automatique à la page images quand la file est vide.

## 6. Interface générale

- Application web mono-page en web components, Bootstrap 5.
- PWA installable (manifest, icônes, icône maskable).
- Navigation par onglets : Projets / Images / Quick / Stars / Maintenance.
- Indicateur d'état de synchronisation (téléchargement / envoi / cache obsolète).
- Verrou global de l'application avec verrouillage automatique après inactivité.
- Route dédiée pour servir les pièces jointes (`/attachment/:id`), avec cache HTTP 1 jour
  et type MIME adapté (`image/png` ou `video/mp4`).
- Les pièces jointes sont partagées (une image générée peut servir de source à un autre
  projet, ou de vignette). Le client ne les supprime jamais lui-même : le serveur efface
  celles que plus rien ne référence après chaque transaction contenant une suppression.

## 7. Page Maintenance

- Date de démarrage et durée de fonctionnement du serveur.
- Liste des erreurs non capturées côté serveur.
- Bouton de déclenchement d'une erreur de test.
- Activation et test des notifications : permission, abonnement push et envoi d'une
  notification de test par le serveur, avec le message d'erreur en cas d'échec.

## 8. Authentification & administration

- Connexion via Google OAuth2 (Passport).
- Création automatique du compte au premier login, **désactivé par défaut**.
- Accès conditionné à l'activation manuelle du compte en base (liste blanche).
- Mode `NO_AUTH` explicite pour le développement local.
- Le manifest, les icônes (`/assets/`) et le service worker (`/sw.js`) sont servis sans
  connexion : le navigateur les télécharge sans cookie de session.

## 9. Déploiement

- Dockerfile + `docker-compose.yml` (application + PostgreSQL).
- Base PostgreSQL, scripts de migration SQL manuels dans `apps/sql/`.
- Notifications push : clés VAPID dans `PUSH_PUBLIC` / `PUSH_PRIVATE` (une paire est générée
  et affichée dans les logs au démarrage si elles manquent, push désactivé en attendant) et
  contact optionnel dans `PUSH_SUBJECT` (`mailto:` ou `https:`, `BASE_URL` par défaut). Les
  clés ne doivent plus changer ensuite : les abonnements y sont liés.
- Intégration continue GitHub Actions.

---

## Pistes / à revoir lors de la migration

- Le stockage des images en base64 en base de données ne passe pas à l'échelle
  → envisager un stockage fichier ou objet.
- Les migrations SQL manuelles sont à remplacer par un mécanisme versionné.
- Le rafraîchissement complet de pages entières est coûteux
  → tirer parti du rendu incrémental des composants Dagda v2.
- Pas de gestion de rôles : tout utilisateur activé a tous les droits.
