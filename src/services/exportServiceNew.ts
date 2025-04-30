import { saveAs } from 'file-saver';
import * as htmlDocx from 'html-docx-js';
import * as showdown from 'showdown';

/**
 * Exporte un compte rendu au format Word (.docx) en utilisant une conversion Markdown -> HTML -> DOCX
 * @param summaryText Le texte du compte rendu (format Markdown)
 * @param meetingName Le nom de la réunion
 * @param meetingDate La date de la réunion
 */
export async function exportSummaryToWord(
  summaryText: string,
  meetingName: string,
  meetingDate: string
): Promise<void> {
  console.log('Début de la fonction exportSummaryToWord (nouvelle version) avec:', {
    summaryTextLength: summaryText.length,
    meetingName,
    meetingDate
  });

  try {
    // Convertir le Markdown en HTML
    const converter = new showdown.Converter({
      tables: true,
      tasklists: true,
      strikethrough: true
    });
    
    // Ajouter un style CSS pour le document
    const css = `
      <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        h1 { text-align: center; color: #333; }
        h2 { color: #444; margin-top: 20px; }
        h3 { color: #555; }
        p { line-height: 1.5; }
        .meeting-header { text-align: center; margin-bottom: 30px; }
        .meeting-date { text-align: center; color: #666; margin-bottom: 30px; }
      </style>
    `;
    
    // Créer l'en-tête du document
    const header = `
      <div class="meeting-header">
        <h1>Compte rendu - ${meetingName}</h1>
        <div class="meeting-date">Date: ${meetingDate}</div>
      </div>
    `;
    
    // Convertir le contenu Markdown en HTML
    const contentHtml = converter.makeHtml(summaryText);
    
    // Assembler le document HTML complet
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Compte rendu - ${meetingName}</title>
        ${css}
      </head>
      <body>
        ${header}
        ${contentHtml}
      </body>
      </html>
    `;
    
    console.log('HTML généré avec succès, longueur:', htmlContent.length);
    
    // Convertir HTML en DOCX
    const docxContent = htmlDocx.asBlob(htmlContent);
    console.log('Document Word généré avec succès');
    
    // Générer un nom de fichier basé sur le nom de la réunion et la date
    const fileName = `${meetingName.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().slice(0, 10)}.docx`;
    
    // Télécharger le fichier
    console.log('Téléchargement du fichier:', fileName);
    // Convertir le résultat en Blob si nécessaire
    const blob = new Blob([docxContent as BlobPart], { 
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' 
    });
    saveAs(blob, fileName);
    console.log('Fichier téléchargé avec succès');
    
    return Promise.resolve();
  } catch (error) {
    console.error('Erreur lors de l\'exportation du compte rendu:', error);
    return Promise.reject(error);
  }
}
