import React, { useState, useCallback } from 'react';
import { useLocation, Navigate } from 'react-router-dom';
import Notification from './Notification';
import {
  Box,
  Paper,
  Typography,
  List,
  ListItem,
  ListItemText,
  IconButton,
  Divider,
  Button,
  Stack,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  useTheme,
  alpha,
} from '@mui/material';
import {
  Edit as EditIcon,
  Save as SaveIcon,
  Description as DescriptionIcon,
  Business as BusinessIcon,
  Code as CodeIcon,
  Assignment as AssignmentIcon,
} from '@mui/icons-material';

interface Utterance {
  speaker: string;
  text: string;
  start: number;
  end: number;
}

interface Report {
  type: 'general' | 'commercial' | 'technical' | 'custom';
  title: string;
  content: string;
}

const TranscriptionEditor: React.FC = () => {
  const theme = useTheme();
  const location = useLocation();
  const transcription = location.state?.transcription;
  
  const [notification, setNotification] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'info' | 'warning';
  }>({ open: false, message: '', severity: 'info' });

  const [reports, setReports] = useState<Report[]>([]);
  const [isCustomReportDialogOpen, setIsCustomReportDialogOpen] = useState(false);
  const [customReportTitle, setCustomReportTitle] = useState('');
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);

  const generateReport = useCallback(async (type: 'general' | 'commercial' | 'technical' | 'custom') => {
    if (!transcription?.text) {
      setNotification({
        open: true,
        message: 'No transcription text available to generate report',
        severity: 'error'
      });
      return;
    }

    try {
      let title = '';
      switch (type) {
        case 'general':
          title = 'Compte rendu général';
          break;
        case 'commercial':
          title = 'Compte rendu business';
          break;
        case 'technical':
          title = 'Compte rendu technique';
          break;
        case 'custom':
          title = customReportTitle || 'Compte rendu personnalisé';
          break;
      }

      // Simulate report generation (replace with actual API call later)
      const newReport: Report = {
        type,
        title,
        content: `Rapport généré pour la transcription:\n\nPoints clés:\n1. Point 1\n2. Point 2\n3. Point 3`
      };

      setReports(prev => [...prev, newReport]);
      setSelectedReport(newReport);
      setNotification({
        open: true,
        message: 'Rapport généré avec succès',
        severity: 'success'
      });

      if (type === 'custom') {
        setIsCustomReportDialogOpen(false);
        setCustomReportTitle('');
      }
    } catch (error) {
      setNotification({
        open: true,
        message: 'Erreur lors de la génération du rapport',
        severity: 'error'
      });
    }
  }, [transcription?.text, customReportTitle]);

  if (!transcription) {
    return <Navigate to="/" replace />;
  }
  return (
    <Box sx={{ p: 4 }}>
      <Paper sx={{ p: 3, mb: 3 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
          <Typography variant="h5">
            Transcription Editor
          </Typography>
          <Stack direction="row" spacing={1}>
            <Button
              size="small"
              onClick={() => generateReport('general')}
              startIcon={<AssignmentIcon />}
              variant="outlined"
            >
              Compte rendu standard
            </Button>
            <Button
              size="small"
              onClick={() => generateReport('commercial')}
              startIcon={<BusinessIcon />}
              variant="outlined"
            >
              Compte rendu business
            </Button>
            <Button
              size="small"
              onClick={() => generateReport('technical')}
              startIcon={<CodeIcon />}
              variant="outlined"
            >
              Compte rendu technique
            </Button>
          </Stack>
        </Stack>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Duration: {transcription.audio_duration ? Math.round(transcription.audio_duration / 60) : 0} minutes
        </Typography>
        
        <List>
          {transcription.utterances ? (
            transcription.utterances.map((utterance, index) => (
            <React.Fragment key={index}>
              <ListItem
                secondaryAction={
                  <IconButton edge="end" aria-label="edit">
                    <EditIcon />
                  </IconButton>
                }
              >
                <ListItemText
                  primary={
                    <Typography
                      component="span"
                      variant="body1"
                      sx={{ color: 'primary.main', fontWeight: 500 }}
                    >
                      {utterance.speaker}
                    </Typography>
                  }
                  secondary={
                    <Typography
                      component="span"
                      variant="body1"
                      sx={{ display: 'inline', ml: 1 }}
                    >
                      {utterance.text}
                    </Typography>
                  }
                />
              </ListItem>
              {index < transcription.utterances.length - 1 && <Divider />}
            </React.Fragment>
          ))) : (
            <ListItem>
              <ListItemText 
                primary="No utterances available" 
                secondary="The transcription is still being processed or no speakers were detected."
              />
            </ListItem>
          )}
        </List>
      </Paper>

      {reports.length > 0 && (
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Comptes rendus générés
          </Typography>
          <Stack spacing={2}>
            {reports.map((report, index) => (
              <Paper
                key={index}
                sx={{
                  p: 2,
                  bgcolor: report === selectedReport ? alpha(theme.palette.primary.main, 0.05) : 'background.paper',
                  cursor: 'pointer',
                  '&:hover': {
                    bgcolor: alpha(theme.palette.primary.main, 0.05)
                  }
                }}
                onClick={() => setSelectedReport(report)}
              >
                <Typography variant="subtitle1" sx={{ mb: 1, color: 'primary.main' }}>
                  {report.title}
                </Typography>
                <Typography variant="body2" sx={{ whiteSpace: 'pre-line' }}>
                  {report.content}
                </Typography>
              </Paper>
            ))}
          </Stack>
        </Paper>
      )}

      <Dialog
        open={isCustomReportDialogOpen}
        onClose={() => setIsCustomReportDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Créer un compte rendu personnalisé</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Titre du compte rendu"
            fullWidth
            variant="outlined"
            value={customReportTitle}
            onChange={(e) => setCustomReportTitle(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsCustomReportDialogOpen(false)}>
            Annuler
          </Button>
          <Button
            onClick={() => generateReport('custom')}
            variant="contained"
            disabled={!customReportTitle.trim()}
          >
            Générer
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

export default TranscriptionEditor;
