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

Puis ouvrir :
- http://localhost:3000
- http://localhost:3000/admin

## Identifiants admin
- Identifiant : admin
- Mot de passe : IMSTORE2026

## Déploiement sur Render
1. Créer un dépôt GitHub.
2. Pousser ce projet sur GitHub.
3. Sur Render : New > Web Service.
4. Relier le dépôt GitHub.
5. Laisser les paramètres par défaut ou utiliser le fichier render.yaml.
6. Déployer.

## Fichiers principaux
- index.html : boutique publique
- admin.html : interface d’administration
- server.js : backend API + serveur statique
- data/products.json : stockage partagé des produits
- render.yaml : configuration Render

## Notes
Le site démarre vide pour que l’admin publie les produits lui-même.
