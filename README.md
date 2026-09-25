# EduEval AI

Une plateforme full-stack permettant aux enseignants de créer, publier et corriger des évaluations/exercices, avec un accès étudiant simplifié par code — sans compte requis.

**Application en ligne :** https://miralamana.github.io/EduEval-AI/

## Fonctionnalités

**Côté enseignant**
- Créer des évaluations manuellement, les générer par IA (Groq/Llama 3.3), ou les importer depuis un PDF
- Publication instantanée avec un code d'accès unique (régénérable à tout moment, avec confirmation)
- Suivre les soumissions par évaluation : qui a répondu, quand, et avec quel statut
- Correction : les QCM sont notés automatiquement ; les réponses ouvertes peuvent être corrigées manuellement ou avec l'aide de l'IA, toujours modifiables par l'enseignant avant la publication des résultats
- Télécharger les fichiers envoyés par les étudiants pour les questions de type dépôt de fichier
- Suivre des statistiques en direct par évaluation

**Côté étudiant**
- Aucun compte nécessaire — rejoindre avec un nom, un email et le code d'accès
- Passer l'évaluation avec une barre de progression et une sauvegarde automatique par réponse
- Suivi d'intégrité intégré (détection de sortie d'onglet, soumission automatique en cas de dépassement de temps ou de sorties répétées)
- Recevoir un email dès que l'enseignant publie les résultats

## Stack technique

| Couche | Technologies |
|---|---|
| Frontend | React 19, Vite, Tailwind CSS, shadcn/ui, React Router 7 |
| Backend | Express 5, Prisma ORM |
| Base de données | PostgreSQL (Neon, serverless) |
| Authentification | JWT (7 jours) via header `Authorization`, stocké en `localStorage` côté navigateur (pas de cookies — voir ci-dessous pour le compromis de sécurité) |
| IA | API Groq (Llama 3.3 70B) pour la génération d'évaluations et la correction assistée |
| Email | Resend, pour les notifications de publication des résultats |
| Déploiement | GitHub Pages (frontend) · Render (backend) · Neon (base de données) |

## Choix d'architecture

- **Authentification cross-domaine** : le frontend et le backend sont déployés sur deux domaines totalement différents (GitHub Pages / Render). Les sessions par cookie ne survivent pas de façon fiable à cette configuration — Safari bloque les cookies tiers par défaut — donc l'authentification repose sur un token Bearer délivré à la connexion/inscription et attaché automatiquement via un intercepteur Axios.
  - **Compromis de sécurité connu** : ce token est conservé en `localStorage`, donc lisible par tout script exécuté sur la page. Une faille XSS *n'importe où* dans l'application permettrait de le voler et de prendre le contrôle du compte enseignant pour toute la durée de validité du token (7 jours). Le vecteur identifié à ce jour (aperçu HTML des fichiers Word/Excel déposés par les étudiants) est neutralisé par une sanitisation côté backend, mais le risque de fond demeure : toute nouvelle utilisation de `dangerouslySetInnerHTML` ou d'un contenu utilisateur non échappé doit être traitée comme critique. Voir `AUDIT.md`.
- **Routage SPA sur hébergement statique** : GitHub Pages ne permet aucune réécriture d'URL côté serveur, donc les routes côté client (`/evaluations/:id`, liens profonds, rafraîchissements) sont gérées via l'astuce classique de redirection 404→index, combinée à une configuration du routeur consciente du sous-répertoire du projet.
- **Intégrité de la correction** : un étudiant ne voit sa note immédiatement que si l'évaluation entière est auto-corrigeable (QCM pur). Toute évaluation contenant des questions ouvertes nécessite une revue explicite de l'enseignant et une action volontaire de "publication des résultats" avant que l'étudiant ne soit notifié.
- **CI/CD** : un workflow GitHub Actions construit et déploie le frontend sur GitHub Pages à chaque push sur `main`.

## Lancer le projet en local

```bash
# Backend
cd backend
npm install
cp .env.example .env   # renseigner DATABASE_URL, JWT_SECRET, GROQ_API_KEY, RESEND_API_KEY
npx prisma generate
npx prisma migrate deploy
node server.js

# Frontend
cd frontend
npm install
cp .env.example .env   # VITE_API_URL=http://localhost:3000
npm run dev
```
