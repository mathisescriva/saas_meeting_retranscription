# Meeting Transcriber

Une application moderne pour enregistrer, transcrire et gérer vos réunions.

## Fonctionnalités

### Transcription de réunions
- Enregistrement audio des réunions
- Transcription automatique via API
- Gestion des fichiers audio et des transcriptions
- Vue détaillée des transcriptions

### Gestion du profil utilisateur
- Édition des informations de profil (nom, email)
- Téléchargement et mise à jour de la photo de profil
- Affichage personnalisé avec le nom de l'utilisateur
- La photo de profil est visible dans la barre latérale et utilisée pour l'avatar

## Installation

1. Clonez le dépôt
```bash
git clone https://github.com/mathisescriva/saas_meeting_retranscription.git
cd meeting-transcriber
```

2. Installez les dépendances
```bash
npm install
```

3. Lancez le serveur de développement
```bash
npm run dev
```

## Paramétrage de l'API

Le backend de l'application doit être configuré pour supporter les endpoints suivants:

### Endpoints de profil utilisateur
- `/profile/me` (GET) - Obtenir les informations de profil
- `/profile/update` (PUT) - Mettre à jour le profil utilisateur
- `/profile/upload-picture` (POST) - Télécharger une photo de profil (multipart/form-data)

Pour plus de détails sur les formats de requêtes et réponses, consultez le fichier `API_DOCUMENTATION.md`.
