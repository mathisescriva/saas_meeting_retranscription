# Configuration Google OAuth pour Gilbert

Ce document explique comment configurer l'authentification Google OAuth dans l'application Gilbert.

## Configuration côté Backend

Le backend doit implémenter les endpoints suivants :

### 1. Endpoint d'initiation Google OAuth
```
GET http://localhost:8001/auth/google/login
```
- Redirige l'utilisateur vers Google pour l'authentification
- Génère un `state` token pour la sécurité
- Redirige vers Google avec les paramètres appropriés

### 2. Endpoint de callback Google OAuth
```
POST http://localhost:8001/auth/google/callback
Content-Type: application/json

{
  "code": "authorization_code_from_google",
  "state": "state_token_received"
}
```
- Traite le code d'autorisation reçu de Google
- Vérifie le token `state` pour la sécurité
- Échange le code contre un token d'accès Google
- Récupère les informations utilisateur depuis Google
- Crée ou connecte l'utilisateur dans votre système
- Retourne un JWT token pour l'application

### 3. Endpoint d'informations utilisateur Google
```
GET http://localhost:8001/auth/google/me
Authorization: Bearer <jwt_token>
```
- Récupère les informations de l'utilisateur authentifié via Google
- Nécessite un token JWT valide dans l'en-tête Authorization

### 4. Configuration Google Console

1. Allez sur [Google Cloud Console](https://console.cloud.google.com/)
2. Créez un nouveau projet ou sélectionnez un projet existant
3. Activez l'API Google+ ou Google Identity
4. Créez des identifiants OAuth 2.0 :
   - Type d'application : Application Web
   - Origines JavaScript autorisées : 
     - `http://localhost:5173` (développement frontend)
     - `http://localhost:5174` (développement frontend alternatif)
   - URI de redirection autorisés :
     - `http://localhost:8001/auth/google/callback`

## Configuration côté Frontend

Le frontend est déjà configuré avec :

### Composants ajoutés :
- `GoogleCallback.tsx` : Traite le callback OAuth
- Bouton Google dans `AuthForm.tsx`
- Logique de redirection dans `authService.ts`

### Fonctionnalités :
- Bouton "Continuer avec Google" sur la page de connexion
- Bouton "S'inscrire avec Google" sur la page d'inscription
- Gestion automatique du callback OAuth
- Intégration avec le système d'authentification existant

## Variables d'environnement

### Backend (.env)
```env
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REDIRECT_URI=http://localhost:8001/auth/google/callback
```

### Frontend (.env)
```env
VITE_API_URL=http://localhost:8001
VITE_GOOGLE_CLIENT_ID=your_google_client_id
```

## Flux d'authentification

1. **Utilisateur clique sur "Continuer avec Google"**
   - Frontend appelle `initiateGoogleLogin()`
   - Redirection vers `http://localhost:8001/auth/google/login`

2. **Backend traite l'initiation**
   - Génère un `state` token
   - Redirige vers Google OAuth

3. **Utilisateur s'authentifie sur Google**
   - Google redirige vers le callback backend
   - Avec `code` et `state` en paramètres

4. **Backend traite le callback**
   - Vérifie le `state` token
   - Échange le `code` contre un token Google
   - Récupère les infos utilisateur
   - Crée/connecte l'utilisateur
   - Retourne un JWT token pour l'application

5. **Frontend finalise l'authentification**
   - `GoogleCallback` component traite la réponse
   - Stocke le token JWT
   - Redirige vers l'application

## Endpoints disponibles

### Frontend vers Backend
- `GET http://localhost:8001/auth/google/login` - Initie l'authentification
- `POST http://localhost:8001/auth/google/callback` - Traite le callback
- `GET http://localhost:8001/auth/google/me` - Profil utilisateur Google

### Configuration CORS
Assurez-vous que votre backend accepte les requêtes depuis :
- `http://localhost:5173` (Vite dev server)
- `http://localhost:5174` (Vite dev server alternatif)

## Sécurité

- Utilisation du paramètre `state` pour prévenir les attaques CSRF
- Validation côté backend du token Google
- Stockage sécurisé des tokens JWT
- Configuration CORS appropriée pour le développement

## Test

1. Démarrez le backend sur le port 8001 avec les variables d'environnement configurées
2. Démarrez le frontend : `npm run dev`
3. Cliquez sur "Continuer avec Google"
4. Vérifiez que l'authentification fonctionne correctement

## Dépannage

### Erreurs communes :
- **"Invalid redirect URI"** : Vérifiez la configuration dans Google Console
- **"Invalid client ID"** : Vérifiez les variables d'environnement
- **"State mismatch"** : Problème de sécurité, vérifiez l'implémentation backend
- **"CORS error"** : Vérifiez la configuration CORS du backend

### Logs utiles :
- Vérifiez les logs backend pour les erreurs OAuth
- Utilisez les outils de développement du navigateur
- Vérifiez la console JavaScript pour les erreurs frontend
- Vérifiez que le backend est bien démarré sur le port 8001 