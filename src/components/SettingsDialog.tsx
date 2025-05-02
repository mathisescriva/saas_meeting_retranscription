import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  FormControl,
  FormControlLabel,
  FormGroup,
  Select,
  MenuItem,
  Switch,
  Divider,
  IconButton,
  SelectChangeEvent,
  Link,
  Paper,
  Grid,
  useTheme,
  alpha
} from '@mui/material';
import {
  Close as CloseIcon,
  Language as LanguageIcon,
  Psychology as PsychologyIcon,
  RecordVoiceOver as RecordVoiceOverIcon,
  Insights as InsightsIcon,
  ContactSupport as ContactSupportIcon
} from '@mui/icons-material';

interface SettingsDialogProps {
  open: boolean;
  onClose: () => void;
}

const SettingsDialog: React.FC<SettingsDialogProps> = ({ open, onClose }) => {
  const theme = useTheme();
  
  // États pour les différents paramètres
  const [language, setLanguage] = useState<string>('auto');
  const [summaryType, setSummaryType] = useState<string>('auto');
  const [speakerRecognition, setSpeakerRecognition] = useState<boolean>(true);
  
  // Gestionnaires d'événements
  const handleLanguageChange = (event: SelectChangeEvent) => {
    setLanguage(event.target.value);
  };
  
  const handleSummaryTypeChange = (event: SelectChangeEvent) => {
    setSummaryType(event.target.value);
  };
  
  const handleSpeakerRecognitionChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    // Si l'utilisateur tente de désactiver la reconnaissance des locuteurs, on ne change pas l'état
    // mais on affiche un message pour contacter l'équipe Lexia France
    if (!event.target.checked) {
      handleContactSupport();
    } else {
      setSpeakerRecognition(true);
    }
  };
  
  const handleContactSupport = () => {
    window.open('mailto:contact@lexiapro.fr?subject=Demande%20d%27information%20-%20Gilbert', '_blank');
  };
  
  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2,
          overflow: 'hidden'
        }
      }}
    >
      <DialogTitle sx={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        borderBottom: '1px solid',
        borderColor: 'divider',
        pb: 2
      }}>
        <Typography variant="h6">Paramètres</Typography>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      
      <DialogContent sx={{ py: 3 }}>
        <Grid container spacing={3}>
          {/* Langue */}
          <Grid item xs={12}>
            <Paper 
              elevation={0} 
              sx={{ 
                p: 2, 
                borderRadius: 2, 
                border: '1px solid',
                borderColor: 'divider'
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <LanguageIcon sx={{ color: theme.palette.primary.main, mr: 1 }} />
                <Typography variant="h6">Langue</Typography>
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Sélectionnez la langue principale pour la transcription. Le mode automatique détecte la langue parlée.
              </Typography>
              <FormControl fullWidth size="small">
                <Select
                  value={language}
                  onChange={handleLanguageChange}
                >
                  <MenuItem value="auto">Automatique (recommandé)</MenuItem>
                  <MenuItem value="fr">Français</MenuItem>
                  <MenuItem value="en">Anglais</MenuItem>
                  <MenuItem value="es">Espagnol</MenuItem>
                  <MenuItem value="de">Allemand</MenuItem>
                  <MenuItem value="it">Italien</MenuItem>
                </Select>
              </FormControl>
            </Paper>
          </Grid>
          
          {/* Smart Summaries */}
          <Grid item xs={12}>
            <Paper 
              elevation={0} 
              sx={{ 
                p: 2, 
                borderRadius: 2, 
                border: '1px solid',
                borderColor: 'divider'
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <PsychologyIcon sx={{ color: theme.palette.primary.main, mr: 1 }} />
                <Typography variant="h6">Smart Summaries</Typography>
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Choisissez le type de résumé généré pour vos réunions.
              </Typography>
              <FormControl fullWidth size="small">
                <Select
                  value={summaryType}
                  onChange={handleSummaryTypeChange}
                >
                  <MenuItem value="auto">Automatique</MenuItem>
                  <MenuItem value="custom">Sur-mesure (Premium)</MenuItem>
                </Select>
              </FormControl>
              {summaryType === 'custom' && (
                <Box sx={{ 
                  mt: 2, 
                  p: 2, 
                  bgcolor: alpha(theme.palette.primary.main, 0.05),
                  borderRadius: 1,
                  border: '1px dashed',
                  borderColor: alpha(theme.palette.primary.main, 0.3)
                }}>
                  <Typography variant="body2">
                    Les résumés sur-mesure sont disponibles avec un abonnement premium. 
                    <Link 
                      component="button"
                      variant="body2"
                      onClick={handleContactSupport}
                      sx={{ ml: 1 }}
                    >
                      Contacter l'équipe Lexia France
                    </Link>
                  </Typography>
                </Box>
              )}
            </Paper>
          </Grid>
          
          {/* Speaker Recognition */}
          <Grid item xs={12}>
            <Paper 
              elevation={0} 
              sx={{ 
                p: 2, 
                borderRadius: 2, 
                border: '1px solid',
                borderColor: 'divider'
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <RecordVoiceOverIcon sx={{ color: theme.palette.primary.main, mr: 1 }} />
                <Typography variant="h6">Reconnaissance des locuteurs</Typography>
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Activez ou désactivez la reconnaissance automatique des différents locuteurs dans vos transcriptions.
              </Typography>
              <FormControlLabel
                control={
                  <Switch 
                    checked={speakerRecognition}
                    onChange={handleSpeakerRecognitionChange}
                    color="primary"
                  />
                }
                label="Activée"
              />
              <Box sx={{ 
                mt: 2, 
                p: 2, 
                bgcolor: alpha(theme.palette.primary.main, 0.05),
                borderRadius: 1,
                border: '1px dashed',
                borderColor: alpha(theme.palette.primary.main, 0.3)
              }}>
                <Typography variant="body2">
                  La reconnaissance des locuteurs est une fonctionnalité essentielle. Pour toute demande spécifique,
                  <Link 
                    component="button"
                    variant="body2"
                    onClick={handleContactSupport}
                    sx={{ ml: 1 }}
                  >
                    contactez l'équipe Lexia France
                  </Link>
                </Typography>
              </Box>
            </Paper>
          </Grid>
          
          {/* Sentiment Analysis */}
          <Grid item xs={12}>
            <Paper 
              elevation={0} 
              sx={{ 
                p: 2, 
                borderRadius: 2, 
                border: '1px solid',
                borderColor: 'divider'
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <InsightsIcon sx={{ color: theme.palette.primary.main, mr: 1 }} />
                <Typography variant="h6">Analyse des sentiments</Typography>
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                L'analyse des sentiments permet de détecter le ton et l'engagement des participants pendant la réunion.
              </Typography>
              <Box sx={{ 
                p: 2, 
                bgcolor: alpha(theme.palette.primary.main, 0.05),
                borderRadius: 1,
                border: '1px dashed',
                borderColor: alpha(theme.palette.primary.main, 0.3),
                display: 'flex',
                alignItems: 'center'
              }}>
                <ContactSupportIcon sx={{ color: theme.palette.primary.main, mr: 1 }} />
                <Typography variant="body2">
                  Cette fonctionnalité est disponible sur demande. 
                  <Link 
                    component="button"
                    variant="body2"
                    onClick={handleContactSupport}
                    sx={{ ml: 1 }}
                  >
                    Contacter l'équipe Lexia France
                  </Link>
                </Typography>
              </Box>
            </Paper>
          </Grid>
        </Grid>
      </DialogContent>
      
      <DialogActions sx={{ px: 3, py: 2, borderTop: '1px solid', borderColor: 'divider' }}>
        <Button onClick={onClose} color="inherit">Annuler</Button>
        <Button 
          onClick={onClose} 
          variant="contained" 
          color="primary"
        >
          Enregistrer
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default SettingsDialog; 