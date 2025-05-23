import { saveAs } from 'file-saver';

/**
 * Exporte un compte rendu au format Word (.docx) en utilisant une conversion HTML
 * @param summaryText Le texte du compte rendu (format Markdown)
 * @param meetingName Le nom de la ru00e9union
 * @param meetingDate La date de la ru00e9union
 */
export async function exportSummaryToWord(
  summaryText: string,
  meetingName: string,
  meetingDate: string
): Promise<void> {
  console.log('Du00e9but de la fonction exportSummaryToWord (version directe) avec:', {
    summaryTextLength: summaryText.length,
    meetingName,
    meetingDate
  });

  try {
    // Cru00e9er un u00e9lu00e9ment <a> pour le tu00e9lu00e9chargement
    const link = document.createElement('a');
    
    // Convertir le Markdown en texte riche pour Word
    const richText = markdownToRichText(summaryText);
    
    // Cru00e9er le contenu du document Word au format XML
    const wordXml = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' 
            xmlns:w='urn:schemas-microsoft-com:office:word' 
            xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
        <meta charset="utf-8">
        <title>Compte rendu - ${meetingName}</title>
        <!--[if gte mso 9]>
        <xml>
          <w:WordDocument>
            <w:View>Print</w:View>
            <w:Zoom>100</w:Zoom>
            <w:DoNotOptimizeForBrowser/>
          </w:WordDocument>
        </xml>
        <![endif]-->
        <style>
          @page {
            size: 21cm 29.7cm;
            margin: 2cm;
          }
          body {
            font-family: 'Calibri', sans-serif;
            font-size: 11pt;
            line-height: 1.5;
          }
          h1 { font-size: 16pt; text-align: center; color: #333; }
          h2 { font-size: 14pt; color: #444; margin-top: 12pt; }
          h3 { font-size: 12pt; color: #555; }
          p { margin-bottom: 10pt; }
          .meeting-header { text-align: center; margin-bottom: 20pt; }
          .meeting-date { text-align: center; color: #666; margin-bottom: 20pt; }
          ul, ol { margin-left: 20pt; }
          li { margin-bottom: 5pt; }
        </style>
      </head>
      <body>
        <div class="meeting-header">
          <h1>Compte rendu - ${meetingName}</h1>
          <div class="meeting-date">Date: ${meetingDate}</div>
        </div>
        <div class="content">
          ${richText}
        </div>
      </body>
      </html>
    `;
    
    // Cru00e9er un blob pour le tu00e9lu00e9chargement
    const blob = new Blob([wordXml], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document;charset=utf-8' });
    
    // Gu00e9nu00e9rer un nom de fichier basu00e9 sur le nom de la ru00e9union et la date
    const fileName = `${meetingName.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().slice(0, 10)}.docx`;
    
    // Tu00e9lu00e9charger le fichier
    console.log('Tu00e9lu00e9chargement du fichier Word:', fileName);
    
    // Cru00e9er une URL pour le blob
    const url = URL.createObjectURL(blob);
    
    // Utiliser saveAs pour tu00e9lu00e9charger le fichier
    saveAs(blob, fileName);
    
    // Nettoyer
    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, 100);
    
    console.log('Fichier Word tu00e9lu00e9chargu00e9 avec succu00e8s');
    return Promise.resolve();
  } catch (error) {
    console.error('Erreur lors de l\'exportation du compte rendu:', error);
    return Promise.reject(error);
  }
}

/**
 * Convertit le texte Markdown en texte riche pour Word
 * @param markdown Texte au format Markdown
 * @returns HTML riche compatible avec Word
 */
function markdownToRichText(markdown: string): string {
  // Fonction simplifiu00e9e de conversion Markdown -> HTML riche pour Word
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
  html = html.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
  html = html.replace(/\*(.+?)\*/g, '<i>$1</i>');
  html = html.replace(/_(.+?)_/g, '<i>$1</i>');
  
  // Liens
  html = html.replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>');
  
  // Nettoyer les balises p imbriquu00e9es
  html = html.replace(/<p><h(\d)>/g, '<h$1>');
  html = html.replace(/<\/h(\d)><\/p>/g, '</h$1>');
  
  // Remplacer les sauts de ligne simples par des <br>
  html = html.replace(/\n/g, '<br>');
  
  return html;
}
