# Guide d'intégration API pour Gilbert

Ce document détaille comment utiliser l'API backend depuis le frontend de l'application Gilbert.

## Points d'entrée API

Toutes les requêtes API doivent être envoyées à `http://localhost:8000` (en développement).

## 1. Authentification

### Inscription

```javascript
// Exemple avec apiClient
import apiClient from './services/apiClient';

const register = async (email, password, fullName) => {
  try {
    const userData = await apiClient.post('/auth/register', {
      email,
      password,
      full_name: fullName
    }, false, false); // Sans authentification
    localStorage.setItem('auth_token', userData.access_token);
    return userData;
  } catch (error) {
    console.error('Registration error:', error);
    throw error;
  }
};
```

### Connexion

```javascript
// Exemple avec apiClient
import apiClient from './services/apiClient';

const login = async (email, password) => {
  try {
    const userData = await apiClient.post('/auth/login/json', {
      email,
      password
    }, false, false); // Sans authentification
    localStorage.setItem('auth_token', userData.access_token);
    return userData;
  } catch (error) {
    console.error('Login error:', error);
    throw error;
  }
};
```

### Vérification de l'Authentification

```javascript
// Exemple avec apiClient
import apiClient from './services/apiClient';

const checkAuthStatus = async () => {
  try {
    const userData = await apiClient.get('/auth/me');
    return userData;
  } catch (error) {
    console.error('Auth check error:', error);
    throw error;
  }
};
```

## 2. Gestion des Réunions

### Récupérer toutes les réunions

```javascript
// Exemple avec apiClient
import apiClient from './services/apiClient';

const getAllMeetings = async () => {
  try {
    return await apiClient.get('/meetings/');
  } catch (error) {
    console.error('Error fetching meetings:', error);
    throw error;
  }
};
```

### Récupérer une réunion spécifique

```javascript
// Exemple avec apiClient
import apiClient from './services/apiClient';

const getMeeting = async (meetingId) => {
  try {
    return await apiClient.get(`/meetings/${meetingId}`);
  } catch (error) {
    console.error(`Error fetching meeting ${meetingId}:`, error);
    throw error;
  }
};
```

### Uploader un fichier audio

```javascript
// Exemple avec apiClient
import apiClient from './services/apiClient';

const uploadAudio = async (file, title, options = {}) => {
  try {
    const formData = new FormData();
    formData.append('file', file);
    
    let url = `/meetings/upload?title=${encodeURIComponent(title)}`;
    
    // Ajouter des options supplémentaires
    if (options.speakers) {
      url += `&speakers=${options.speakers}`;
    }
    if (options.language) {
      url += `&language=${encodeURIComponent(options.language)}`;
    }
    if (options.format) {
      url += `&format=${encodeURIComponent(options.format)}`;
    }
    
    return await apiClient.post(url, formData, true); // true pour multipart/form-data
  } catch (error) {
    console.error('Error uploading audio:', error);
    throw error;
  }
};
```

### Récupérer une transcription

```javascript
// Exemple avec apiClient
import apiClient from './services/apiClient';

const getTranscript = async (meetingId) => {
  try {
    return await apiClient.get(`/meetings/${meetingId}/transcript`);
  } catch (error) {
    console.error(`Error fetching transcript for meeting ${meetingId}:`, error);
    throw error;
  }
};
```

### Relancer une transcription

```javascript
// Exemple avec apiClient
import apiClient from './services/apiClient';

const retryTranscription = async (meetingId, options = {}) => {
  try {
    let url = `/meetings/${meetingId}/transcribe`;
    
    // Ajouter des options supplémentaires
    const queryParams = [];
    if (options.speakers) {
      queryParams.push(`speakers=${options.speakers}`);
    }
    if (options.language) {
      queryParams.push(`language=${encodeURIComponent(options.language)}`);
    }
    if (options.format) {
      queryParams.push(`format=${encodeURIComponent(options.format)}`);
    }
    
    if (queryParams.length > 0) {
      url += `?${queryParams.join('&')}`;
    }
    
    return await apiClient.post(url);
  } catch (error) {
    console.error(`Error retrying transcription for meeting ${meetingId}:`, error);
    throw error;
  }
};
```

### Mettre à jour une réunion

```javascript
// Exemple avec apiClient
import apiClient from './services/apiClient';

const updateMeeting = async (meetingId, updates) => {
  try {
    return await apiClient.put(`/meetings/${meetingId}`, updates);
  } catch (error) {
    console.error(`Error updating meeting ${meetingId}:`, error);
    throw error;
  }
};
```

### Supprimer une réunion

```javascript
// Exemple avec apiClient
import apiClient from './services/apiClient';

const deleteMeeting = async (meetingId) => {
  try {
    await apiClient.delete(`/meetings/${meetingId}`);
  } catch (error) {
    console.error(`Error deleting meeting ${meetingId}:`, error);
    throw error;
  }
};
```

## 3. Structure des Données

### Objet Meeting (selon la documentation API)

```typescript
interface Meeting {
  id: string;
  user_id: string;
  title: string;
  file_url: string;
  transcript_text: string | null;
  transcript_status: 'pending' | 'processing' | 'completed' | 'error';
  created_at: string;
}
```

### Objet Transcript

```typescript
interface TranscriptResponse {
  transcript_text: string;
  transcript_status: 'pending' | 'processing' | 'completed' | 'error';
  meeting_id: string;
  utterances?: Array<{
    speaker: string;
    text: string;
    start: number;
    end: number;
  }>;
}
```

## 4. Suivi du Statut de Transcription

La transcription se déroule en arrière-plan et peut prendre du temps. Il est important de mettre en place un système de vérification périodique pour suivre l'état d'avancement :

```javascript
// Vérification périodique du statut d'une transcription
const pollTranscriptionStatus = (meetingId, onUpdate, interval = 5000) => {
  const timer = setInterval(async () => {
    try {
      const meeting = await getMeeting(meetingId);
      
      onUpdate(meeting);
      
      if (meeting.transcript_status === 'completed' || meeting.transcript_status === 'error') {
        clearInterval(timer);
      }
    } catch (error) {
      console.error(`Error polling status for meeting ${meetingId}:`, error);
      clearInterval(timer);
    }
  }, interval);
  
  return () => clearInterval(timer); // Function to stop polling
};
```

## 5. Gestion des Erreurs

Les erreurs d'API suivent généralement ce format :

```javascript
{
  detail: "Message d'erreur détaillé"
}
```

Il est recommandé d'implémenter une gestion centralisée des erreurs :

```javascript
const handleApiError = (error) => {
  if (error.response) {
    // L'API a répondu avec un statut d'erreur
    const status = error.response.status;
    const errorData = error.response.data;
    
    if (status === 401) {
      // Non authentifié - rediriger vers la page de connexion
      localStorage.removeItem('auth_token');
      // Redirection vers la page de login
    } else if (status === 404) {
      // Ressource non trouvée
      console.error('Resource not found:', errorData);
    } else {
      // Autres erreurs
      console.error('API error:', status, errorData);
    }
    
    return errorData.detail || 'Une erreur est survenue';
  } else if (error.request) {
    // Pas de réponse du serveur
    console.error('No response from server:', error.request);
    return 'Pas de réponse du serveur. Vérifiez votre connexion internet.';
  } else {
    // Erreur lors de la configuration de la requête
    console.error('Request setup error:', error.message);
    return 'Erreur lors de la configuration de la requête.';
  }
};
```

## Conseils de Débbogage

1. Vérifiez toujours que le backend est en cours d'exécution à l'adresse correcte
2. Confirmez que les jetons d'authentification sont correctement stockés et envoyés
3. Examinez les logs du serveur pour les erreurs côté backend
4. Utilisez les outils de développement du navigateur pour inspecter les requêtes réseau
5. Assurez-vous que les formats de fichiers audio sont compatibles avec le backend

## Points Importants

1. **Authentification** : Toutes les requêtes (sauf login/register) nécessitent un token d'authentification
2. **Format des URLs** : Attention au format exact des URLs (avec ou sans slash final)
3. **Gestion des Erreurs** : Implémentez une gestion robuste des erreurs pour une meilleure expérience utilisateur
4. **Polling** : Pour les opérations longues comme la transcription, utilisez le polling pour suivre l'avancement
