import React, { useState } from 'react';
import {
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Tooltip,
  CircularProgress
} from '@mui/material';
import {
  FileDownload as FileDownloadIcon,
  PictureAsPdf as PictureAsPdfIcon,
  Description as DescriptionIcon,
  Code as CodeIcon
} from '@mui/icons-material';
import { 
  exportTranscriptToPDF, 
  exportTranscriptToWord, 
  exportTranscriptToMarkdown 
} from '../services/exportTranscriptService';

interface TranscriptExportButtonProps {
  transcript: Array<{speaker: string; text: string; timestamp?: string}> | null;
  meetingId: string | null;
  meetingName: string;
  meetingDate: string;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
}

const TranscriptExportButton: React.FC<TranscriptExportButtonProps> = ({
  transcript,
  meetingId,
  meetingName,
  meetingDate,
  onSuccess,
  onError
}) => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [loading, setLoading] = useState<string | null>(null); // 'pdf', 'word', 'markdown' ou null

  const handleOpenMenu = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleCloseMenu = () => {
    setAnchorEl(null);
  };

  const handleExport = async (format: 'pdf' | 'word' | 'markdown') => {
    if (!transcript || !meetingId) {
      onError('La transcription n\'est pas disponible pour l\'exportation');
      handleCloseMenu();
      return;
    }

    setLoading(format);

    try {
      switch (format) {
        case 'pdf':
          await exportTranscriptToPDF(transcript, meetingName, meetingDate);
          onSuccess('La transcription a été exportée au format PDF');
          break;
        case 'word':
          await exportTranscriptToWord(transcript, meetingName, meetingDate);
          onSuccess('La transcription a été exportée au format Word');
          break;
        case 'markdown':
          await exportTranscriptToMarkdown(transcript, meetingName, meetingDate);
          onSuccess('La transcription a été exportée au format Markdown');
          break;
      }
    } catch (error) {
      console.error(`Erreur lors de l'exportation de la transcription en ${format}:`, error);
      onError(`Erreur lors de l'exportation: ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
    } finally {
      setLoading(null);
      handleCloseMenu();
    }
  };

  // Ne pas afficher le bouton si la transcription n'est pas disponible
  if (!transcript || transcript.length === 0) {
    return null;
  }

  return (
    <>
      <Tooltip title="Exporter la transcription">
        <IconButton 
          onClick={handleOpenMenu}
          sx={{ mr: 1 }}
          color="primary"
        >
          <FileDownloadIcon />
        </IconButton>
      </Tooltip>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleCloseMenu}
        sx={{ 
          '& .MuiPaper-root': { 
            borderRadius: 2,
            boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
            mt: 1
          } 
        }}
      >
        <MenuItem 
          onClick={() => handleExport('pdf')}
          disabled={loading !== null}
          sx={{ 
            py: 1.5,
            display: 'flex',
            alignItems: 'center',
            '&:hover': { bgcolor: 'rgba(59, 130, 246, 0.08)' }
          }}
        >
          <ListItemIcon>
            {loading === 'pdf' ? (
              <CircularProgress size={20} />
            ) : (
              <PictureAsPdfIcon sx={{ color: '#e53935' }} />
            )}
          </ListItemIcon>
          <ListItemText primary="Exporter en PDF" />
        </MenuItem>
        <MenuItem 
          onClick={() => handleExport('word')}
          disabled={loading !== null}
          sx={{ 
            py: 1.5,
            display: 'flex',
            alignItems: 'center',
            '&:hover': { bgcolor: 'rgba(59, 130, 246, 0.08)' }
          }}
        >
          <ListItemIcon>
            {loading === 'word' ? (
              <CircularProgress size={20} />
            ) : (
              <DescriptionIcon sx={{ color: '#1565c0' }} />
            )}
          </ListItemIcon>
          <ListItemText primary="Exporter en Word" />
        </MenuItem>
        <MenuItem 
          onClick={() => handleExport('markdown')}
          disabled={loading !== null}
          sx={{ 
            py: 1.5,
            display: 'flex',
            alignItems: 'center',
            '&:hover': { bgcolor: 'rgba(59, 130, 246, 0.08)' }
          }}
        >
          <ListItemIcon>
            {loading === 'markdown' ? (
              <CircularProgress size={20} />
            ) : (
              <CodeIcon sx={{ color: '#424242' }} />
            )}
          </ListItemIcon>
          <ListItemText primary="Exporter en Markdown" />
        </MenuItem>
      </Menu>
    </>
  );
};

export default TranscriptExportButton;
