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
  Code as CodeIcon,
} from '@mui/icons-material';
import { 
  exportSummaryToWord,
} from '../services/exportServiceDirect';
import jsPDF from 'jspdf';

// Importation temporaire des fonctions d'exportation PDF et Markdown
// Ces fonctions seront implu00e9mentu00e9es dans un service su00e9paru00e9 plus tard
const exportSummaryToPDF = async (
  summaryText: string,
  meetingName: string,
  meetingDate: string
): Promise<void> => {
  // Créer un document PDF
  const doc = new jsPDF();
  
  // Ajouter le titre
  doc.setFontSize(18);
  doc.text(meetingName, 20, 20);
  
  // Ajouter la date
  doc.setFontSize(12);
  doc.text(`Date: ${meetingDate}`, 20, 30);
  
  // Remplacer les caractères spéciaux
  let processedText = summaryText;
  
  // Tableau de remplacements
  const replacements = [
    { search: 'Ø=ÜA', replace: 'Réunion' },
    { search: 'Ø=Üe', replace: 'Participants' },
    { search: 'Ø=YR', replace: 'Durée estimée' },
    { search: 'Ø>Yà', replace: 'Résumé express' },
    { search: 'Ø=YÂb', replace: 'Ordre du jour' },
    { search: 'Ø=Üá', replace: 'Point 1' },
    { search: 'Ø=Ü°', replace: 'Point 2' },
    { search: 'Ø=Üd', replace: 'Point 3' },
    { search: 'Ø=Y', replace: 'Actions' },
    { search: 'Ø=Ül', replace: 'Tâche' },
    { search: '#ñb', replace: 'Point 4' },
    { search: '---', replace: ' ' }
  ];
  
  // Appliquer les remplacements
  for (const item of replacements) {
    processedText = processedText.split(item.search).join(item.replace);
  }
  
  // Ajouter le contenu avec retour à la ligne automatique
  doc.setFontSize(11);
  const textLines = doc.splitTextToSize(processedText, 170);
  doc.text(textLines, 20, 40);
  
  // Générer un nom de fichier
  const fileName = `Compte_rendu_${meetingName.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`;
  
  // Télécharger le PDF
  doc.save(fileName);
};

const exportSummaryToMarkdown = async (
  summaryText: string,
  meetingName: string,
  meetingDate: string
): Promise<void> => {
  // Cru00e9er un blob pour le tu00e9lu00e9chargement avec le contenu du compte rendu en markdown
  const markdownContent = `# ${meetingName}

Date: ${meetingDate}

${summaryText}`;
  const blob = new Blob([markdownContent], { type: 'text/markdown' });
  
  // Gu00e9nu00e9rer un nom de fichier basu00e9 sur le nom de la ru00e9union et la date
  const fileName = `Compte_rendu_${meetingName.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().slice(0, 10)}.md`;
  
  // Tu00e9lu00e9charger le fichier
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = fileName;
  link.click();
  
  // Nettoyer
  setTimeout(() => {
    URL.revokeObjectURL(link.href);
  }, 100);
};

interface SummaryExportButtonProps {
  summaryText: string | null;
  meetingId: string | null;
  meetingName: string;
  meetingDate: string;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
}

const SummaryExportButton: React.FC<SummaryExportButtonProps> = ({
  summaryText,
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
    if (!summaryText || !meetingId) {
      onError('Le compte rendu n\'est pas disponible pour l\'exportation');
      handleCloseMenu();
      return;
    }

    setLoading(format);

    try {
      switch (format) {
        case 'pdf':
          await exportSummaryToPDF(summaryText, meetingName, meetingDate);
          onSuccess('Le compte rendu a été exporté au format PDF');
          break;
        case 'word':
          await exportSummaryToWord(summaryText, meetingName, meetingDate);
          onSuccess('Le compte rendu a été exporté au format Word');
          break;
        case 'markdown':
          await exportSummaryToMarkdown(summaryText, meetingName, meetingDate);
          onSuccess('Le compte rendu a été exporté au format Markdown');
          break;
      }
    } catch (error) {
      console.error(`Erreur lors de l'exportation du compte rendu en ${format}:`, error);
      onError(`Erreur lors de l'exportation: ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
    } finally {
      setLoading(null);
      handleCloseMenu();
    }
  };

  // Ne pas afficher le bouton si le compte rendu n'est pas disponible
  if (!summaryText || summaryText.trim() === '') {
    return null;
  }

  return (
    <>
      <Tooltip title="Exporter le compte rendu">
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

export default SummaryExportButton;
