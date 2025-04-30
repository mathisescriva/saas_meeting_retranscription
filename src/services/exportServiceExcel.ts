import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

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
 * Exporte la liste d'actions au format Excel (.xlsx)
 * @param summaryText Le texte du compte rendu (format Markdown)
 * @param meetingName Le nom de la réunion
 * @param meetingDate La date de la réunion
 */
export async function exportActionsToExcel(
  summaryText: string,
  meetingName: string,
  meetingDate: string
): Promise<void> {
  console.log('Début de la fonction exportActionsToExcel avec:', {
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
    
    // Créer un classeur Excel
    const workbook = XLSX.utils.book_new();
    
    // Ajouter des métadonnées
    workbook.Props = {
      Title: `Actions - ${meetingName}`,
      Subject: `Actions de la réunion du ${meetingDate}`,
      Author: "Meeting Transcriber",
      CreatedDate: new Date()
    };
    
    // Préparer les données pour Excel
    const worksheetData = [
      // En-têtes
      ['Description de l\'action', 'Assigné à', 'Date limite', 'Statut']
    ];
    
    // Ajouter les actions
    actions.forEach(action => {
      worksheetData.push([
        action.description,
        action.assignee || '',
        action.dueDate || '',
        action.status || 'À faire'
      ]);
    });
    
    // Créer une feuille de calcul
    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
    
    // Définir la largeur des colonnes
    const columnWidths = [
      { wch: 50 }, // Description
      { wch: 20 }, // Assigné à
      { wch: 15 }, // Date limite
      { wch: 15 }  // Statut
    ];
    worksheet['!cols'] = columnWidths;
    
    // Ajouter la feuille au classeur
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Actions');
    
    // Générer un nom de fichier basé sur le nom de la réunion et la date
    const fileName = `Actions_${meetingName.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().slice(0, 10)}.xlsx`;
    
    // Générer le fichier Excel
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    
    // Télécharger le fichier
    console.log('Téléchargement du fichier Excel:', fileName);
    saveAs(blob, fileName);
    console.log('Fichier Excel téléchargé avec succès');
    
    return Promise.resolve();
  } catch (error) {
    console.error('Erreur lors de l\'exportation des actions:', error);
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
