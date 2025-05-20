import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { saveAs } from 'file-saver';
import * as showdown from 'showdown';

/**
 * Structure d'une action extraite du compte rendu
 */
interface Action {
  description: string;
  assignee?: string;
  dueDate?: string;
  status?: string;
}

/**
 * Exporte un compte rendu au format PDF
 * @param summaryText Le texte du compte rendu (format Markdown)
 * @param meetingName Le nom de la réunion
 * @param meetingDate La date de la réunion
 */
export async function exportSummaryToPDF(
  summaryText: string,
  meetingName: string,
  meetingDate: string
): Promise<void> {
  console.log('Début de la fonction exportSummaryToPDF avec:', {
    summaryTextLength: summaryText.length,
    meetingName,
    meetingDate
  });

  try {
    // Convertir le Markdown en HTML pour extraction du texte
    const converter = new showdown.Converter({
      tables: true,
      tasklists: true,
      strikethrough: true
    });
    
    const htmlContent = converter.makeHtml(summaryText);
    console.log('HTML généré avec succès, longueur:', htmlContent.length);
    
    // Créer un élément temporaire pour extraire le texte du HTML
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlContent;
    
    // Créer un nouveau document PDF
    const doc = new jsPDF();
    
    // Ajouter un titre
    doc.setFontSize(22);
    doc.setTextColor(44, 62, 80); // Couleur foncée pour le titre
    doc.text('Compte rendu - ' + meetingName, doc.internal.pageSize.getWidth() / 2, 20, { align: 'center' });
    
    // Ajouter la date
    doc.setFontSize(12);
    doc.setTextColor(100, 100, 100); // Gris pour la date
    doc.text('Date: ' + meetingDate, doc.internal.pageSize.getWidth() / 2, 30, { align: 'center' });
    
    // Ajouter une ligne de séparation
    doc.setDrawColor(200, 200, 200);
    doc.line(20, 35, doc.internal.pageSize.getWidth() - 20, 35);
    
    // Extraire le texte du HTML
    const textContent = tempDiv.textContent || tempDiv.innerText || '';
    
    // Découper le texte en paragraphes
    const paragraphs = textContent.split('\n').filter(p => p.trim() !== '');
    
    // Ajouter le contenu du compte rendu
    doc.setFontSize(11);
    doc.setTextColor(60, 60, 60);
    
    let yPosition = 45;
    const lineHeight = 7;
    const maxWidth = doc.internal.pageSize.getWidth() - 40; // Marges de 20 de chaque côté
    
    // Fonction pour ajouter un paragraphe avec retour à la ligne automatique
    const addParagraph = (text: string, y: number): number => {
      const lines = doc.splitTextToSize(text, maxWidth);
      
      for (let i = 0; i < lines.length; i++) {
        // Vérifier si nous avons besoin d'une nouvelle page
        if (y > doc.internal.pageSize.getHeight() - 20) {
          doc.addPage();
          y = 20; // Réinitialiser la position Y pour la nouvelle page
        }
        
        doc.text(lines[i], 20, y);
        y += lineHeight;
      }
      
      return y + 3; // Ajouter un petit espace entre les paragraphes
    };
    
    // Ajouter chaque paragraphe au PDF
    for (const paragraph of paragraphs) {
      yPosition = addParagraph(paragraph, yPosition);
    }
    
    // Générer un nom de fichier basé sur le nom de la réunion et la date
    const fileName = `${meetingName.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`;
    
    // Télécharger le PDF
    console.log('Téléchargement du fichier PDF:', fileName);
    const pdfBlob = doc.output('blob');
    saveAs(pdfBlob, fileName);
    console.log('Fichier PDF téléchargé avec succès');
    
    return Promise.resolve();
  } catch (error) {
    console.error('Erreur lors de l\'exportation du compte rendu en PDF:', error);
    return Promise.reject(error);
  }
}

/**
 * Exporte la liste d'actions au format PDF
 * @param summaryText Le texte du compte rendu (format Markdown)
 * @param meetingName Le nom de la réunion
 * @param meetingDate La date de la réunion
 */
export async function exportActionsToPDF(
  summaryText: string,
  meetingName: string,
  meetingDate: string
): Promise<void> {
  console.log('Début de la fonction exportActionsToPDF avec:', {
    summaryTextLength: summaryText.length,
    meetingName,
    meetingDate
  });

  try {
    // Extraire les actions du compte rendu
    const actions = extractActionsFromSummary(summaryText);
    
    console.log(`${actions.length} actions extraites du compte rendu`);
    
    if (actions.length === 0) {
      throw new Error('Aucune action n\'a été trouvée dans le compte rendu');
    }
    
    // Créer un nouveau document PDF
    const doc = new jsPDF();
    
    // Ajouter un titre
    doc.setFontSize(22);
    doc.setTextColor(44, 62, 80); // Couleur foncée pour le titre
    doc.text('Actions - ' + meetingName, doc.internal.pageSize.getWidth() / 2, 20, { align: 'center' });
    
    // Ajouter la date
    doc.setFontSize(12);
    doc.setTextColor(100, 100, 100); // Gris pour la date
    doc.text('Date: ' + meetingDate, doc.internal.pageSize.getWidth() / 2, 30, { align: 'center' });
    
    // Ajouter une ligne de séparation
    doc.setDrawColor(200, 200, 200);
    doc.line(20, 35, doc.internal.pageSize.getWidth() - 20, 35);
    
    // Préparer les données pour le tableau
    const tableData = actions.map(action => [
      action.description,
      action.assignee || '',
      action.dueDate || '',
      action.status || 'À faire'
    ]);
    
    // Ajouter le tableau des actions
    // Importer correctement autoTable et gérer le flux asynchrone
    return import('jspdf-autotable').then((autoTable) => {
      autoTable.default(doc, {
        startY: 45,
        head: [['Description de l\'action', 'Assigné à', 'Date limite', 'Statut']],
        body: tableData,
        headStyles: {
          fillColor: [66, 139, 202],
          textColor: [255, 255, 255],
          fontStyle: 'bold'
        },
        columnStyles: {
          0: { cellWidth: 'auto' },
          1: { cellWidth: 30 },
          2: { cellWidth: 30 },
          3: { cellWidth: 25 }
        },
        styles: {
          overflow: 'linebreak',
          cellPadding: 4,
          fontSize: 10
        },
        alternateRowStyles: {
          fillColor: [245, 245, 245]
        }
      });
      
      // Ajouter un pied de page
      const pageCount = (doc as any).internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text(`Page ${i} sur ${pageCount} - Généré par Meeting Transcriber`, doc.internal.pageSize.getWidth() / 2, doc.internal.pageSize.getHeight() - 10, { align: 'center' });
      }
      
      // Générer un nom de fichier basé sur le nom de la réunion et la date
      const fileName = `Actions_${meetingName.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`;
      
      // Télécharger le PDF
      console.log('Téléchargement du fichier PDF:', fileName);
      const pdfBlob = doc.output('blob');
      saveAs(pdfBlob, fileName);
      console.log('Fichier PDF téléchargé avec succès');
    });
  } catch (error) {
    console.error('Erreur lors de l\'exportation des actions en PDF:', error);
    return Promise.reject(error);
  }
}

/**
 * Extrait les actions du texte du compte rendu
 * @param summaryText Le texte du compte rendu
 * @returns Liste des actions extraites
 */
function extractActionsFromSummary(summaryText: string): Action[] {
  const actions: Action[] = [];
  
  // Rechercher les sections d'actions
  const actionSectionRegexes = [
    /#+\s*Actions?\s*:?\s*([\s\S]*?)(?=\n#+|$)/gi,  // Format: # Actions
    /#+\s*Tâches?\s*:?\s*([\s\S]*?)(?=\n#+|$)/gi,  // Format: # Tâches
    /#+\s*Points? d'actions?\s*:?\s*([\s\S]*?)(?=\n#+|$)/gi,  // Format: # Points d'action
    /#+\s*To-?Do\s*:?\s*([\s\S]*?)(?=\n#+|$)/gi,  // Format: # ToDo
    /#+\s*Prochaines? étapes?\s*:?\s*([\s\S]*?)(?=\n#+|$)/gi,  // Format: # Prochaines étapes
  ];
  
  // Parcourir toutes les expressions régulières pour trouver des sections d'actions
  for (const regex of actionSectionRegexes) {
    let match;
    while ((match = regex.exec(summaryText)) !== null) {
      const actionSectionContent = match[1].trim();
      
      // Extraire les éléments de liste qui sont des actions
      const actionItems = actionSectionContent.split('\n')
        .filter(line => line.trim().match(/^[-*]|^\d+\./))
        .map(line => line.replace(/^[-*]|^\d+\.\s*/, '').trim());
      
      // Analyser chaque élément d'action
      actionItems.forEach(actionItem => {
        // Essayer d'extraire l'assigné (format: "... @nom" ou "... [nom]")
        let assignee = '';
        const assigneeMatch = actionItem.match(/@([\w\s]+)|\[(.*?)\]/);
        if (assigneeMatch) {
          assignee = (assigneeMatch[1] || assigneeMatch[2]).trim();
          actionItem = actionItem.replace(assigneeMatch[0], '').trim();
        }
        
        // Essayer d'extraire la date limite (format: "... pour le JJ/MM/YYYY" ou "... d'ici le JJ/MM/YYYY")
        let dueDate = '';
        const dueDateMatch = actionItem.match(/(?:pour|d'ici|avant)\s+le\s+(\d{1,2}[/\-]\d{1,2}[/\-]\d{2,4})|(?:pour|d'ici|avant)\s+le\s+(\d{1,2}\s+[a-zéûôêàçèù]+\s+\d{2,4})/);
        if (dueDateMatch) {
          dueDate = (dueDateMatch[1] || dueDateMatch[2]).trim();
          actionItem = actionItem.replace(dueDateMatch[0], '').trim();
        }
        
        // Essayer d'extraire le statut (format: "... [statut]" ou "... (statut)")
        let status = '';
        const statusMatch = actionItem.match(/\[(.*?)\]|\((.*?)\)/);
        if (statusMatch && !assigneeMatch) { // Éviter de confondre avec l'assigné
          status = (statusMatch[1] || statusMatch[2]).trim();
          actionItem = actionItem.replace(statusMatch[0], '').trim();
        }
        
        // Ajouter l'action à la liste
        actions.push({
          description: actionItem,
          assignee,
          dueDate,
          status: status || 'À faire'
        });
      });
    }
  }
  
  // Si aucune section d'action n'a été trouvée, essayer d'extraire les éléments de liste directement
  if (actions.length === 0) {
    const listItemRegex = /^\s*[-*]\s+(.+)$|^\s*\d+\.\s+(.+)$/gm;
    let match;
    while ((match = listItemRegex.exec(summaryText)) !== null) {
      const actionItem = (match[1] || match[2]).trim();
      actions.push({
        description: actionItem,
        status: 'À faire'
      });
    }
  }
  
  return actions;
}
