# ParcIT — Guide d'installation (100 % gratuit)

Ce guide t'emmène de zéro à une application en ligne, fonctionnelle, sans rien payer.
Compte environ 20 à 30 minutes la première fois.

## Ce que tu vas créer
1. Un compte **Supabase** (la base de données) — gratuit
2. Un compte **GitHub** (pour héberger le code) — gratuit
3. Un compte **Netlify** (pour mettre l'application en ligne) — gratuit

---

## Étape 1 — Créer la base de données (Supabase)

1. Va sur https://supabase.com et crée un compte gratuit.
2. Clique sur **New project**. Donne-lui un nom (ex: "parcit"), choisis un mot de passe pour la base (garde-le de côté), et attends 1 à 2 minutes que le projet se crée.
3. Une fois dans le projet, va dans le menu **SQL Editor** (à gauche), clique sur **New query**.
4. Ouvre le fichier `supabase-schema.sql` de ce dossier, copie tout son contenu, colle-le dans l'éditeur, puis clique sur **Run**.
   → Ça crée toutes les tables (équipements, personnes, lieux, affectations...) et ajoute quelques données d'exemple.
5. Va dans **Project Settings** (icône en bas à gauche) > **API**.
   - Copie la valeur **Project URL**
   - Copie la valeur **anon public** (une longue clé)

## Étape 2 — Créer ton compte utilisateur (pour te connecter à l'app)

1. Toujours dans Supabase, va dans **Authentication** > **Users**.
2. Clique sur **Add user** > **Create new user**.
3. Renseigne ton email et un mot de passe. Décoche "Send confirmation email" si l'option apparaît (pas nécessaire ici).
4. Fais pareil pour chaque membre de l'équipe technique qui doit avoir un accès.

## Étape 3 — Configurer l'application

1. Ouvre le fichier `config.js` de ce dossier avec un éditeur de texte simple (Bloc-notes, TextEdit...).
2. Remplace :
   - `COLLE_ICI_TON_PROJECT_URL` par le **Project URL** copié à l'étape 1
   - `COLLE_ICI_TA_CLE_ANON_PUBLIC` par la clé **anon public** copiée à l'étape 1
3. Enregistre le fichier.

## Étape 4 — Mettre le code sur GitHub

1. Crée un compte sur https://github.com si tu n'en as pas.
2. Clique sur **New repository**, nomme-le "parcit", laisse-le en **Public** ou **Private**, clique sur **Create repository**.
3. Sur la page qui s'affiche, clique sur **uploading an existing file**, puis glisse-dépose tous les fichiers de ce dossier (y compris le dossier `.github`).
4. Clique sur **Commit changes**.

## Étape 5 — Mettre l'application en ligne (Netlify)

1. Va sur https://netlify.com et crée un compte gratuit (tu peux te connecter directement avec ton compte GitHub).
2. Clique sur **Add new site** > **Import an existing project**.
3. Choisis **GitHub**, autorise l'accès, puis sélectionne ton dépôt "parcit".
4. Laisse les réglages par défaut (pas de commande de build nécessaire) et clique sur **Deploy**.
5. Après une minute, Netlify te donne une adresse du type `https://parcit-xyz.netlify.app` — c'est ton application, accessible depuis n'importe quel navigateur, PC ou téléphone.

## Étape 6 — Activer la sécurité anti-pause

1. Sur GitHub, ouvre ton dépôt "parcit", va dans **Settings** > **Secrets and variables** > **Actions**.
2. Clique sur **New repository secret** et ajoute :
   - Nom : `SUPABASE_URL` → valeur : ton Project URL
   - Nom : `SUPABASE_ANON_KEY` → valeur : ta clé anon public
3. C'est terminé : chaque jour à 6h, GitHub va automatiquement "réveiller" ta base de données, sans que tu aies rien à faire.

---

## Ce que fait déjà ce prototype
- Connexion sécurisée (comptes créés dans Supabase)
- Tableau de bord avec les chiffres clés du parc
- Liste du matériel, recherche, ajout d'un nouvel équipement
- Fiche détaillée par équipement, avec QR code généré automatiquement
- Changement de statut (en service, en panne, en stock...)
- Affectation à une personne et un lieu
- Impression d'étiquette au format 60 × 40 mm
- Scan d'un QR code directement depuis la caméra du téléphone ou du PC

## Ce qu'on ajoutera dans les prochaines versions
- Maintenance (déclarer/suivre des pannes)
- Inventaire (campagnes de recensement)
- Rapports et exports
- Gestion des consommables par quantité
- Administration (gestion des lieux, catégories)

On peut construire chacun de ces écrans un par un, exactement comme pour la maquette — dis-moi simplement lequel tu veux en premier.

## Si quelque chose ne fonctionne pas
- Écran blanc ou erreur au login → vérifie que `config.js` contient bien tes vraies valeurs Supabase (pas les textes "COLLE_ICI...").
- "Connexion refusée" → vérifie que l'utilisateur a bien été créé dans Supabase > Authentication > Users.
- La caméra ne s'active pas au scan → autorise l'accès caméra dans les réglages du navigateur, et vérifie que l'adresse commence bien par `https://` (obligatoire pour la caméra, ce que Netlify fournit automatiquement).
