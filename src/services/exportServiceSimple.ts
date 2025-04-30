import { saveAs } from 'file-saver';

/**
 * Exporte un compte rendu au format Word (.docx) en utilisant une conversion HTML
 * @param summaryText Le texte du compte rendu (format Markdown)
 * @param meetingName Le nom de la réunion
 * @param meetingDate La date de la réunion
 */
export async function exportSummaryToWord(
  summaryText: string,
  meetingName: string,
  meetingDate: string
): Promise<void> {
  console.log('Début de la fonction exportSummaryToWord (version simple) avec:', {
    summaryTextLength: summaryText.length,
    meetingName,
    meetingDate
  });

  try {
    // Convertir le Markdown en HTML simple
    const htmlContent = markdownToHtml(summaryText);
    
    // Créer un document HTML complet avec styles
    const fullHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Compte rendu - ${meetingName}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 40px; }
          h1 { text-align: center; color: #333; }
          h2 { color: #444; margin-top: 20px; }
          h3 { color: #555; }
          p { line-height: 1.5; }
          .meeting-header { text-align: center; margin-bottom: 30px; }
          .meeting-date { text-align: center; color: #666; margin-bottom: 30px; }
          ul, ol { margin-left: 20px; }
          li { margin-bottom: 5px; }
        </style>
      </head>
      <body>
        <div class="meeting-header">
          <h1>Compte rendu - ${meetingName}</h1>
          <div class="meeting-date">Date: ${meetingDate}</div>
        </div>
        <div class="content">
          ${htmlContent}
        </div>
      </body>
      </html>
    `;
    
    // Créer un blob pour le téléchargement
    const blob = new Blob([fullHtml], { type: 'text/html;charset=utf-8' });
    
    // Générer un nom de fichier basé sur le nom de la réunion et la date
    const fileName = `${meetingName.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().slice(0, 10)}.html`;
    
    // Télécharger le fichier
    console.log('Téléchargement du fichier HTML:', fileName);
    saveAs(blob, fileName);
    console.log('Fichier HTML téléchargé avec succès');
    
    // Afficher un message d'instruction pour l'utilisateur
    alert(
      "Le compte rendu a été exporté au format HTML. \n\n" +
      "Pour le convertir en Word: \n" +
      "1. Ouvrez le fichier HTML dans votre navigateur \n" +
      "2. Utilisez la fonction 'Imprimer' (Ctrl+P ou Cmd+P) \n" +
      "3. Choisissez 'Enregistrer en PDF' ou 'Microsoft Print to PDF' \n" +
      "4. Ouvrez le PDF dans Word ou utilisez un convertisseur en ligne\n\n" +
      "Ou simplement, ouvrez-le directement dans Word qui peut importer des fichiers HTML."
    );
    
    return Promise.resolve();
  } catch (error) {
    console.error('Erreur lors de l\'exportation du compte rendu:', error);
    return Promise.reject(error);
  }
}

/**
 * Convertit le texte Markdown en HTML
 * @param markdown Texte au format Markdown
 * @returns HTML généré
 */
function markdownToHtml(markdown: string): string {
  // Fonction simplifiée de conversion Markdown -> HTML
  let html = markdown;
  
  // Titres
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  
  // Paragraphes
  html = html.replace(/^(?!<h|<ul|<ol|<li|<blockquote|<pre|<table)(.+)$/gm, '<p>$1</p>');
  
  // Listes
  html = html.replace(/^\* (.+)$/gm, '<li>$1</li>');
  html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
  html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');
  
  // Entourer les listes avec ul/ol
  html = html.replace(/(<li>.+<\/li>\n)+/g, '<ul>$&</ul>');
  
  // Gras et italique
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  html = html.replace(/_(.+?)_/g, '<em>$1</em>');
  
  // Liens
  html = html.replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>');
  
  // Nettoyer les balises p imbriquées
  html = html.replace(/<p><h(\d)>/g, '<h$1>');
  html = html.replace(/<\/h(\d)><\/p>/g, '</h$1>');
  
  return html;
}
