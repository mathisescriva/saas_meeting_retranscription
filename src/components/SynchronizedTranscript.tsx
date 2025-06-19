import React, { useEffect, useState } from 'react';
import { Box, Typography, IconButton, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Button, CircularProgress, alpha, useTheme } from '@mui/material';
import { Edit as EditIcon, Save as SaveIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { getSpeakers, updateSpeakerName, deleteSpeakerName, updateTranscriptWithCustomNames, Speaker } from '../services/speakerService';
import Notification from './Notification';

interface Word {
  text: string;
  start: number;
  end: number;
  confidence: number;
}

interface Utterance {
  speaker: string;
  text: string;
  start: number;
  end: number;
  words?: Word[];
}

interface SynchronizedTranscriptProps {
  utterances: Utterance[];
  currentTime: number;
  meetingId?: string;
}

const SynchronizedTranscript: React.FC<SynchronizedTranscriptProps> = ({
  utterances,
  currentTime,
  meetingId,
}) => {
  const theme = useTheme();
  const [activeWordIndex, setActiveWordIndex] = useState<number | null>(null);
  
  // États pour l'édition des noms de locuteurs
  const [editSpeakerDialogOpen, setEditSpeakerDialogOpen] = useState(false);
  const [currentSpeaker, setCurrentSpeaker] = useState<{id: string, name: string}>({ id: '', name: '' });
  const [customSpeakers, setCustomSpeakers] = useState<Speaker[]>([]);
  // Utiliser _ pour indiquer qu'on utilise seulement la fonction setter
  const [, setIsLoadingSpeakers] = useState(false);
  const [isUpdatingTranscript, setIsUpdatingTranscript] = useState(false);
  const [notification, setNotification] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'info' | 'warning' | 'error';
  }>({ open: false, message: '', severity: 'info' });
  
  // Charger les noms personnalisés des locuteurs
  useEffect(() => {
    if (meetingId) {
      loadSpeakers();
    }
  }, [meetingId]);

  // Charger les locuteurs personnalisés depuis l'API
  const loadSpeakers = async () => {
    if (!meetingId) return;
    
    setIsLoadingSpeakers(true);
    try {
      const speakers = await getSpeakers(meetingId);
      setCustomSpeakers(speakers);
    } catch (error) {
      console.error("Erreur lors du chargement des noms de locuteurs:", error);
      setNotification({
        open: true,
        message: "Impossible de charger les noms personnalisés des locuteurs",
        severity: 'error'
      });
    } finally {
      setIsLoadingSpeakers(false);
    }
  };

  // Ouvrir le dialogue d'édition pour un locuteur
  const handleEditSpeaker = (speakerId: string, speakerName: string) => {
    setCurrentSpeaker({ id: speakerId, name: speakerName });
    setEditSpeakerDialogOpen(true);
  };

  // Sauvegarder les modifications du nom de locuteur
  const handleSaveSpeakerName = async () => {
    if (!meetingId || !currentSpeaker.id) return;
    
    try {
      await updateSpeakerName(meetingId, currentSpeaker.id, currentSpeaker.name);
      
      // Mettre à jour la liste locale
      setCustomSpeakers(prev => {
        const existingIndex = prev.findIndex(s => s.id === currentSpeaker.id);
        if (existingIndex >= 0) {
          const updated = [...prev];
          updated[existingIndex] = { ...updated[existingIndex], name: currentSpeaker.name };
          return updated;
        } else {
          return [...prev, { id: currentSpeaker.id, name: currentSpeaker.name }];
        }
      });
      
      setEditSpeakerDialogOpen(false);
      setNotification({
        open: true,
        message: "Nom du locuteur mis à jour avec succès",
        severity: 'success'
      });
    } catch (error) {
      console.error("Erreur lors de la mise à jour du nom:", error);
      setNotification({
        open: true,
        message: "Erreur lors de la mise à jour du nom du locuteur",
        severity: 'error'
      });
    }
  };

  // Rétablir le nom par défaut du locuteur
  const handleResetSpeakerName = async () => {
    if (!meetingId || !currentSpeaker.id) return;
    
    try {
      await deleteSpeakerName(meetingId, currentSpeaker.id);
      
      // Mettre à jour la liste locale
      setCustomSpeakers(prev => prev.filter(s => s.id !== currentSpeaker.id));
      
      setEditSpeakerDialogOpen(false);
      setNotification({
        open: true,
        message: "Nom du locuteur réinitialisé",
        severity: 'success'
      });
    } catch (error) {
      console.error("Erreur lors de la réinitialisation du nom:", error);
      setNotification({
        open: true,
        message: "Erreur lors de la réinitialisation du nom du locuteur",
        severity: 'error'
      });
    }
  };

  // Mettre à jour la transcription avec les noms personnalisés
  const handleUpdateTranscript = async () => {
    if (!meetingId) return;
    
    setIsUpdatingTranscript(true);
    try {
      await updateTranscriptWithCustomNames(meetingId);
      
      setNotification({
        open: true,
        message: "Transcription mise à jour avec les noms personnalisés",
        severity: 'success'
      });
      
      // Recharger la page pour afficher les changements
      window.location.reload();
    } catch (error) {
      console.error("Erreur lors de la mise à jour de la transcription:", error);
      setNotification({
        open: true,
        message: "Erreur lors de la mise à jour de la transcription",
        severity: 'error'
      });
    } finally {
      setIsUpdatingTranscript(false);
    }
  };

  useEffect(() => {
    // Trouver le mot actif en fonction du temps actuel
    let foundActiveWord = false;
    
    for (const utterance of utterances) {
      if (utterance.words) {
        for (let i = 0; i < utterance.words.length; i++) {
          const word = utterance.words[i];
          if (currentTime * 1000 >= word.start && currentTime * 1000 <= word.end) {
            setActiveWordIndex(i);
            foundActiveWord = true;
            break;
          }
        }
      }
      if (foundActiveWord) break;
    }

    if (!foundActiveWord) {
      setActiveWordIndex(null);
    }
  }, [currentTime, utterances]);

  return (
    <Box sx={{ mt: 2 }}>
      {/* Bouton pour mettre à jour la transcription avec les noms personnalisés */}
      {meetingId && customSpeakers.length > 0 && (
        <Button
          variant="contained"
          color="primary"
          startIcon={isUpdatingTranscript ? <CircularProgress size={20} color="inherit" /> : <SaveIcon />}
          onClick={handleUpdateTranscript}
          disabled={isUpdatingTranscript}
          sx={{ mb: 2 }}
        >
          {isUpdatingTranscript ? 'Mise à jour...' : 'Mettre à jour la transcription avec les noms personnalisés'}
        </Button>
      )}
      
      {utterances.map((utterance, utteranceIndex) => (
        <Box
          key={utteranceIndex}
          sx={{
            display: 'flex',
            mb: 2,
            gap: 2,
          }}
        >
          <Box
            sx={{
              width: 4,
              flexShrink: 0,
              bgcolor: `speaker.${parseInt(utterance.speaker.slice(-1)) % 8}`,
              borderRadius: 1,
            }}
          />
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
              <Typography
                variant="subtitle2"
                sx={{
                  color: 'text.secondary',
                  backgroundColor: meetingId && customSpeakers.some(s => s.id === utterance.speaker) ? 
                    alpha(theme.palette.success.light, 0.1) : 'transparent',
                  px: 1,
                  py: 0.5,
                  borderRadius: 1,
                }}
              >
                {/* Afficher le nom personnalisé s'il existe, sinon le nom par défaut */}
                {(() => {
                  const customSpeaker = customSpeakers.find(s => s.id === utterance.speaker);
                  console.log('Speaker match:', utterance.speaker, customSpeaker);
                  return meetingId && customSpeaker ? customSpeaker.name : utterance.speaker;
                })()} 
              </Typography>
              
              {/* Bouton d'édition du nom */}
              {meetingId && (
                <IconButton 
                  size="small"
                  aria-label="edit"
                  onClick={() => {
                    // Récupérer le nom personnalisé s'il existe, sinon utiliser l'ID
                    const existingCustomName = customSpeakers.find(s => s.id === utterance.speaker)?.name || utterance.speaker;
                    console.log('Editing speaker:', utterance.speaker, 'with current name:', existingCustomName);
                    handleEditSpeaker(utterance.speaker, existingCustomName);
                  }}
                  sx={{ ml: 1 }}
                >
                  <EditIcon fontSize="small" />
                </IconButton>
              )}
            </Box>
            <Typography variant="body1">
              {utterance.words?.map((word, wordIndex) => (
                <Box
                  key={wordIndex}
                  component="span"
                  sx={{
                    display: 'inline-block',
                    backgroundColor:
                      utteranceIndex === Math.floor(activeWordIndex! / (utterance.words?.length || 1)) &&
                      wordIndex === activeWordIndex! % (utterance.words?.length || 1)
                        ? 'rgba(25, 118, 210, 0.12)'
                        : 'transparent',
                    borderRadius: 0.5,
                    transition: 'background-color 0.2s',
                    px: 0.5,
                  }}
                >
                  {word.text}{' '}
                </Box>
              ))}
            </Typography>
          </Box>
        </Box>
      ))}
      
      {/* Dialog pour l'édition des noms de locuteurs */}
      <Dialog open={editSpeakerDialogOpen} onClose={() => setEditSpeakerDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Modifier le nom du locuteur</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Nom du locuteur"
            type="text"
            fullWidth
            variant="outlined"
            value={currentSpeaker.name}
            onChange={(e) => setCurrentSpeaker(prev => ({ ...prev, name: e.target.value }))}
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={handleResetSpeakerName} 
            color="error" 
            startIcon={<DeleteIcon />}
          >
            Réinitialiser
          </Button>
          <Button onClick={() => setEditSpeakerDialogOpen(false)} color="inherit">
            Annuler
          </Button>
          <Button 
            onClick={handleSaveSpeakerName} 
            color="primary" 
            variant="contained" 
            startIcon={<SaveIcon />}
            disabled={!currentSpeaker.name.trim()}
          >
            Enregistrer
          </Button>
        </DialogActions>
      </Dialog>

      <Notification
        open={notification.open}
        message={notification.message}
        severity={notification.severity}
        onClose={() => setNotification(prev => ({ ...prev, open: false }))}
      />
    </Box>
  );
};

export default SynchronizedTranscript;
