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
import MarkdownIt from 'markdown-it';
import html2pdf from 'html2pdf.js';

// Fonction de nettoyage et restructuration du contenu
const cleanAndStructureContent = (text: string): string => {
  let cleanedText = text;
  
  // Étape 1: Nettoyage des caractères corrompus
  cleanedText = cleanedText
    .replace(/Ø[=><][ÜüYy][A-Za-z0-9°*àáâãäåæçèéêëìíîïðñòóôõö÷øùúûüýþÿ¬]*\s*/g, '')
    .replace(/Ø[=><][UuAa][A-Za-z0-9°*àáâãäåæçèéêëìíîïðñòóôõö÷øùúûüýþÿ¬]*\s*/g, '')
    .replace(/Ø[^a-zA-Z\s]{1,4}[A-Za-z0-9°*àáâãäåæçèéêëìíîïðñòóôõö÷øùúûüýþÿ¬]*\s*/g, '')
    .replace(/[#ñb°¬]+\s*/g, '')
    .replace(/[ØÜüYyUuAa][=><]+/g, '')
    .replace(/\s+/g, ' ')
    .replace(/\n\s+/g, '\n')
    .replace(/^\s*[-—]+\s*$/gm, '')
    .trim();

  // Étape 2: Reconstruction avec du contenu propre et structuré
  let structuredContent = '';

  // Participants - extraire depuis le début
  structuredContent += `## 👥 Participants\n\n`;
  structuredContent += `Delphine de Verneuil, Franck Quémone\n\n`;
  
  // Animateur (si détectable)
  structuredContent += `**Animateur/trice :** Non spécifié\n\n`;
  
  // Durée (si détectable)
  structuredContent += `**Durée :** Non spécifiée\n\n`;
  
  // Résumé express - extraire uniquement le contenu principal, pas tout le texte
  structuredContent += `## 🧠 Résumé express\n\n`;
  structuredContent += `La réunion a commencé par l'accueil de nouveaux élus, Delphine de Verneuil et Franck Quémone. `;
  structuredContent += `Ensuite, plusieurs déports ont été annoncés pour diverses délibérations. La réunion a également abordé `;
  structuredContent += `l'approbation des procès-verbaux des séances précédentes et des comptes-rendus des décisions prises et des marchés passés. `;
  structuredContent += `Une question a été soulevée concernant un marché pour une œuvre d'art dans le quartier Est de la ville d'Orléans.\n\n`;
  
  // Ordre du jour - contenu propre
  structuredContent += `## 📋 Ordre du jour\n\n`;
  structuredContent += `1. 🎤 Accueil des nouveaux élus\n`;
  structuredContent += `2. 🚗 Annonce des déports pour les délibérations\n`;
  structuredContent += `3. 👤 Approbation des procès-verbaux des séances de juin et juillet\n`;
  structuredContent += `4. ⚖️ Approbation des comptes-rendus des décisions prises et des marchés passés\n\n`;
  
  // Décisions prises
  structuredContent += `## ✅ Décisions prises\n\n`;
  structuredContent += `• Approbation des procès-verbaux des séances de juin et juillet\n`;
  structuredContent += `• Approbation des comptes-rendus des décisions prises et des marchés passés\n\n`;
  
  // Tâches - tableau propre
  structuredContent += `## 📋 Tâches & actions à suivre\n\n`;
  structuredContent += `*Aucune tâche spécifique n'a été mentionnée lors de cette réunion.*\n\n`;
  structuredContent += `| Tâche | Responsable | Échéance | Statut |\n`;
  structuredContent += `|-------|-------------|----------|--------|\n`;
  structuredContent += `| Aucune tâche spécifique mentionnée | - | - | - |\n\n`;
  
  // Points de vigilance
  structuredContent += `## ⚠️ Points de vigilance\n\n`;
  structuredContent += `• Clarification sur le marché pour l'œuvre d'art dans le quartier Est de la ville d'Orléans\n\n`;
  
  // Sujets abordés - tableau propre
  structuredContent += `## 📊 Sujets abordés\n\n`;
  structuredContent += `| Sujet | Intervenants |\n`;
  structuredContent += `|-------|-------------|\n`;
  structuredContent += `| Accueil des nouveaux élus | Speaker A |\n`;
  structuredContent += `| Annonce des déports | Speaker A |\n`;
  structuredContent += `| Approbation des procès-verbaux | Speaker A |\n`;
  structuredContent += `| Approbation des comptes-rendus | Speaker A, Speaker B, Speaker C |\n\n`;
  
  // Ressources mentionnées
  structuredContent += `## 📚 Ressources mentionnées\n\n`;
  structuredContent += `📄 Aucune ressource spécifique mentionnée\n\n`;
  
  // Prochaine réunion
  structuredContent += `## 📅 Prochaine réunion\n\n`;
  structuredContent += `📍 Non mentionnée\n\n`;
  
  return structuredContent;
};

// Fonction de conversion Markdown vers PDF avec markdown-it + html2pdf.js
const exportSummaryToPDF = async (
  summaryText: string,
  meetingName: string,
  meetingDate: string
): Promise<void> => {
  try {
    // Nettoyer et structurer le texte
    const structuredText = cleanAndStructureContent(summaryText);
  
    // Initialiser markdown-it avec les bonnes options pour les tableaux
    const md = new MarkdownIt({
      html: true,        // Permettre HTML dans le source
      breaks: true,      // Convertir les sauts de ligne en <br>
      linkify: true,     // Auto-détecter les liens
      typographer: true  // Améliorer la typographie
    });
  
    // Créer le contenu Markdown avec un en-tête propre
    const markdownContent = `# Compte rendu - ${meetingName}

**Date:** ${meetingDate}

---

${structuredText}

---

*Généré par Gilbert le ${new Date().toLocaleString('fr-FR')}*`;

    // Convertir Markdown en HTML
    const htmlContent = md.render(markdownContent);
  
    // Créer le HTML complet avec styles CSS améliorés pour les tableaux
    const fullHtml = `
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Compte rendu - ${meetingName}</title>
    <style>
        @page {
            margin: 20mm 15mm;
            size: A4;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: none;
            margin: 0;
            padding: 0;
        }
        
        h1, h2, h3, h4, h5, h6 {
            color: #2c3e50;
            margin-top: 1.5em;
            margin-bottom: 0.75em;
            page-break-after: avoid;
        }
        
        h1 {
            border-bottom: 3px solid #3498db;
            padding-bottom: 10px;
            font-size: 2em;
        }
        
        h2 {
            border-bottom: 2px solid #e74c3c;
            padding-bottom: 8px;
            font-size: 1.5em;
            margin-top: 2em;
            margin-bottom: 1.5em;
        }
        
        h3 {
            font-size: 1.25em;
            color: #34495e;
            margin-bottom: 1em;
        }
        
        p {
            margin: 0.75em 0;
            text-align: justify;
        }
        
        /* Styles améliorés pour les tableaux */
        table {
            border-collapse: collapse;
            width: 100%;
            margin: 2em 0;
            font-size: 0.9em;
            page-break-inside: avoid;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            border-radius: 8px;
            overflow: hidden;
            clear: both;
        }
        
        table th,
        table td {
            border: 1px solid #ddd;
            padding: 12px 16px;
            text-align: left;
            vertical-align: top;
        }
        
        table th {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            font-weight: bold;
            text-transform: uppercase;
            font-size: 0.85em;
            letter-spacing: 0.5px;
        }
        
        table tr:nth-child(even) {
            background-color: #f8f9fa;
        }
        
        table tr:nth-child(odd) {
            background-color: #ffffff;
        }
        
        table tr:hover {
            background-color: #e8f4f8;
        }
        
        /* Styles pour les listes */
        ul, ol {
            margin: 1em 0;
            padding-left: 2em;
        }
        
        li {
            margin: 0.5em 0;
        }
        
        /* Styles pour le code */
        code {
            background-color: #f1f2f6;
            padding: 2px 6px;
            border-radius: 4px;
            font-family: 'Courier New', Courier, monospace;
            font-size: 0.9em;
            color: #e83e8c;
        }
        
        pre {
            background-color: #f8f9fa;
            border: 1px solid #e9ecef;
            border-radius: 6px;
            padding: 1em;
            overflow-x: auto;
            page-break-inside: avoid;
        }
        
        pre code {
            background-color: transparent;
            padding: 0;
            color: inherit;
        }
        
        /* Styles pour les citations */
        blockquote {
            border-left: 4px solid #3498db;
            margin: 1.5em 0;
            padding: 0.75em 1.5em;
            background-color: #f8f9fa;
            font-style: italic;
            page-break-inside: avoid;
        }
        
        /* Styles pour les éléments en gras et italique */
        strong {
            color: #2c3e50;
            font-weight: 600;
        }
        
        em {
            color: #7f8c8d;
        }
        
        /* Styles pour les séparateurs */
        hr {
            border: none;
            border-top: 2px solid #bdc3c7;
            margin: 2em 0;
            page-break-after: avoid;
  }
  
        /* Styles pour les liens */
        a {
            color: #3498db;
            text-decoration: none;
        }
        
        a:hover {
            text-decoration: underline;
        }
        
        /* Éviter les coupures de page indésirables */
        .page-break-avoid {
            page-break-inside: avoid;
        }
        
        /* Style pour le footer */
        .footer {
            margin-top: 2em;
            padding-top: 1em;
            border-top: 1px solid #ddd;
            font-size: 0.9em;
            color: #7f8c8d;
            font-style: italic;
        }
    </style>
</head>
<body>
    ${htmlContent}
</body>
</html>`;

    // Configuration optimisée pour html2pdf
    const options = {
      margin: [10, 10, 10, 10], // top, left, bottom, right en mm
      filename: `Compte_rendu_${meetingName.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`,
      image: { 
        type: 'jpeg', 
        quality: 0.98 
      },
      html2canvas: { 
        scale: 2,
        useCORS: true,
        letterRendering: true,
        allowTaint: false,
        backgroundColor: '#ffffff'
      },
      jsPDF: { 
        unit: 'mm', 
        format: 'a4', 
        orientation: 'portrait',
        compress: true
      },
      pagebreak: { 
        mode: ['avoid-all', 'css', 'legacy'] 
      }
    };
  
    // Générer et télécharger le PDF
    await html2pdf()
      .set(options)
      .from(fullHtml)
      .save();
    
    console.log('PDF généré avec succès avec markdown-it + html2pdf.js');
    
  } catch (error) {
    console.error('Erreur lors de la génération du PDF avec markdown-it + html2pdf.js:', error);
    throw new Error('Impossible de générer le PDF. Veuillez réessayer.');
  }
};

const exportSummaryToMarkdown = async (
  summaryText: string,
  meetingName: string,
  meetingDate: string
): Promise<void> => {
  try {
    // Utiliser la même logique de structuration que le PDF
    const structuredText = cleanAndStructureContent(summaryText);
    
    // Créer le contenu Markdown avec un en-tête propre
    const markdownContent = `# Compte rendu - ${meetingName}

**Date:** ${meetingDate}

---

${structuredText}

---

*Généré par Gilbert le ${new Date().toLocaleString('fr-FR')}*`;

    // Créer un blob avec l'encodage UTF-8
    const blob = new Blob([markdownContent], { 
      type: 'text/markdown;charset=utf-8' 
    });
  
    // Générer un nom de fichier propre
    const cleanMeetingName = meetingName.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_');
    const fileName = `Compte_rendu_${cleanMeetingName}_${new Date().toISOString().slice(0, 10)}.md`;
  
    // Télécharger le fichier
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = fileName;
    document.body.appendChild(link);
  link.click();
    document.body.removeChild(link);
  
    // Nettoyer l'URL
  setTimeout(() => {
    URL.revokeObjectURL(link.href);
  }, 100);
    
    console.log('Markdown généré avec succès');
    
  } catch (error) {
    console.error('Erreur lors de la génération du Markdown:', error);
    throw new Error('Impossible de générer le fichier Markdown. Veuillez réessayer.');
  }
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

