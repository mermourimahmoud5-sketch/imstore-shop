# IMSTORE

Boutique mode premium avec admin pour publier des produits et gestion des commandes.

## Stack
- Node.js
- Express
- HTML / CSS / JavaScript
- Render pour le déploiement

## Installation locale

```bash
npm install
npm start
```

Le serveur nécessite PostgreSQL. Configurez `DATABASE_URL` avant de lancer l’application. Dans PowerShell :

```powershell
$env:DATABASE_URL = "postgresql://UTILISATEUR:MOT_DE_PASSE@HOTE:5432/NOM_BASE"
npm start
```

Puis ouvrir :
- http://localhost:3000
- http://localhost:3000/admin

## Identifiants admin
- Identifiant : admin
- Mot de passe : IMSTORE2026

## Déploiement sur Render
1. Créer une base PostgreSQL sur Render.
2. Dans la page de la base, copier son **Internal Database URL**.
3. Dans les paramètres du Web Service, ajouter `DATABASE_URL` avec cette URL.
4. Relier le dépôt GitHub et déployer le service.

La base PostgreSQL peut entraîner des frais selon l’offre choisie. Ne publiez jamais son URL dans le dépôt GitHub.

## Fichiers principaux
- index.html : boutique publique
- admin.html : interface d’administration
- server.js : backend API + serveur statique connecté à PostgreSQL
- render.yaml : configuration Render

## Notes
La table `products` est créée automatiquement au démarrage. Le site démarre vide pour que l’admin publie les produits lui-même.
