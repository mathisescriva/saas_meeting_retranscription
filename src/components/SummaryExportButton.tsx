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
  // Créer un document PDF directement avec jsPDF
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  // Configurer la police et les marges
  doc.setFont('helvetica', 'normal');
  const margin = 20; // marge en mm
  const pageWidth = 210 - (margin * 2); // largeur utile sur une page A4
  
  // Ajouter le titre
  doc.setFontSize(22);
  doc.text(meetingName, margin, margin);
  
  // Ajouter la date
  doc.setFontSize(12);
  doc.text(`Date: ${meetingDate}`, margin, margin + 10);
  
  // Préparer le texte du compte rendu
  // Nettoyer le texte pour éviter les problèmes d'affichage
  // Remplacer les caractères spéciaux par des équivalents lisibles
  const cleanText = summaryText
    .replace(/Ø=ÜA/g, 'Réunion')
    .replace(/Ø=Üe/g, 'Participants')
    .replace(/Ø=YR/g, 'Durée estimée')
    .replace(/Ø>Yà/g, 'Résumé express')
    .replace(/Ø=YÂb/g, 'Ordre du jour')
    .replace(/Ø=Üá/g, 'Point 1')
    .replace(/Ø=Ü°/g, 'Point 2')
    .replace(/Ø=Üd/g, 'Point 3')
    .replace(/Ø=Y/g, 'Actions')
    .replace(/Ø=Ü°/g, 'Décision')
    .replace(/Ø=Üe/g, 'Décision')
    .replace(/Ø=Ül/g, 'Tâche')
    .replace(/Ø=Üd/g, 'Responsable');

  // Ajouter le contenu du compte rendu avec retour à la ligne automatique
  doc.setFontSize(11);
  const textLines = doc.splitTextToSize(cleanText, pageWidth);
  
  // Position de départ pour le texte
  let yPos = margin + 20;
  
  // Ajouter les lignes de texte avec gestion des sauts de page
  const linesPerPage = 45; // approximation du nombre de lignes par page
  let currentPage = 1;
  
  for (let i = 0; i < textLines.length; i++) {
    // Vérifier si nous avons besoin d'une nouvelle page
    if (i > 0 && i % linesPerPage === 0) {
      doc.addPage();
      currentPage++;
      yPos = margin; // Réinitialiser la position Y pour la nouvelle page
    }
    
    // Ajouter la ligne de texte
    doc.text(textLines[i], margin, yPos);
    yPos += 5; // Espacement entre les lignes
  }
  
  // Générer un nom de fichier basé sur le nom de la réunion et la date
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
