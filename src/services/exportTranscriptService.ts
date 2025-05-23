import { saveAs } from 'file-saver';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import * as showdown from 'showdown';

/**
 * Interface pour les segments de transcription
 */
interface TranscriptSegment {
  speaker: string;
  text: string;
  timestamp?: string;
}

/**
 * Exporte une transcription au format Word (.docx)
 * @param transcriptSegments Les segments de la transcription
 * @param meetingName Le nom de la réunion
 * @param meetingDate La date de la réunion
 */
export async function exportTranscriptToWord(
  transcriptSegments: TranscriptSegment[],
  meetingName: string,
  meetingDate: string
): Promise<void> {
  console.log('Début de l\'exportation de la transcription au format Word:', {
    segmentsCount: transcriptSegments.length,
    meetingName,
    meetingDate
  });

  try {
    // Créer un élément <a> pour le téléchargement
    const link = document.createElement('a');
    
    // Convertir les segments en texte riche pour Word
    let richText = '';
    
    transcriptSegments.forEach(segment => {
      richText += `<p><strong>${segment.speaker}</strong>${segment.timestamp ? ` <span style="color: #666; font-size: 9pt;">(${segment.timestamp})</span>` : ''}: ${segment.text}</p>`;
    });
    
    // Créer le contenu du document Word au format XML
    const wordXml = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' 
            xmlns:w='urn:schemas-microsoft-com:office:word' 
            xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
        <meta charset="utf-8">
        <title>Transcription - ${meetingName}</title>
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
        </style>
      </head>
      <body>
        <div class="meeting-header">
          <h1>Transcription - ${meetingName}</h1>
          <div class="meeting-date">Date: ${meetingDate}</div>
        </div>
        <div class="content">
          ${richText}
        </div>
      </body>
      </html>
    `;
    
    // Créer un blob avec le type MIME correct pour Word
    const blob = new Blob([wordXml], { type: 'application/msword' });
    
    // Générer un nom de fichier basé sur le nom de la réunion et la date
    const fileName = `Transcription_${meetingName.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().slice(0, 10)}.doc`;
    
    // Télécharger le fichier
    console.log('Téléchargement du fichier Word:', fileName);
    
    // Créer une URL pour le blob
    const url = URL.createObjectURL(blob);
    
    // Configurer le lien de téléchargement
    link.href = url;
    link.download = fileName;
    link.style.display = 'none';
    
    // Ajouter le lien au document et cliquer dessus
    document.body.appendChild(link);
    link.click();
    
    // Nettoyer
    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, 100);
    
    return Promise.resolve();
  } catch (error) {
    console.error('Erreur lors de l\'exportation de la transcription en Word:', error);
    return Promise.reject(error);
  }
}

/**
 * Exporte une transcription au format PDF
 * @param transcriptSegments Les segments de la transcription
 * @param meetingName Le nom de la réunion
 * @param meetingDate La date de la réunion
 */
export async function exportTranscriptToPDF(
  transcriptSegments: TranscriptSegment[],
  meetingName: string,
  meetingDate: string
): Promise<void> {
  console.log('Début de l\'exportation de la transcription au format PDF:', {
    segmentsCount: transcriptSegments.length,
    meetingName,
    meetingDate
  });

  try {
    // Créer un nouveau document PDF
    const doc = new jsPDF();
    
    // Ajouter un titre
    doc.setFontSize(18);
    doc.setTextColor(33, 33, 33);
    doc.text('Transcription', doc.internal.pageSize.getWidth() / 2, 20, { align: 'center' });
    
    // Ajouter le nom de la réunion
    doc.setFontSize(14);
    doc.text(meetingName, doc.internal.pageSize.getWidth() / 2, 30, { align: 'center' });
    
    // Ajouter la date
    doc.setFontSize(12);
    doc.setTextColor(100, 100, 100);
    doc.text(`Date: ${meetingDate}`, doc.internal.pageSize.getWidth() / 2, 40, { align: 'center' });
    
    // Ajouter le contenu de la transcription
    doc.setFontSize(11);
    doc.setTextColor(0, 0, 0);
    
    let yPosition = 60;
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;
    const textWidth = pageWidth - 2 * margin;
    
    transcriptSegments.forEach(segment => {
      // Ajouter le nom du locuteur
      doc.setFont(undefined, 'bold');
      let speakerText = segment.speaker;
      if (segment.timestamp) {
        speakerText += ` (${segment.timestamp})`;
      }
      speakerText += ':';
      
      // Vérifier si on a besoin d'une nouvelle page
      if (yPosition > doc.internal.pageSize.getHeight() - 20) {
        doc.addPage();
        yPosition = 20;
      }
      
      doc.text(speakerText, margin, yPosition);
      yPosition += 7;
      
      // Ajouter le texte du locuteur
      doc.setFont(undefined, 'normal');
      
      // Diviser le texte en lignes pour qu'il rentre dans la page
      const textLines = doc.splitTextToSize(segment.text, textWidth);
      
      // Vérifier si on a besoin d'une nouvelle page
      if (yPosition + textLines.length * 7 > doc.internal.pageSize.getHeight() - 20) {
        doc.addPage();
        yPosition = 20;
      }
      
      doc.text(textLines, margin, yPosition);
      yPosition += textLines.length * 7 + 10; // Ajouter un espace après chaque segment
    });
    
    // Générer un nom de fichier
    const fileName = `Transcription_${meetingName.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`;
    
    // Télécharger le fichier
    doc.save(fileName);
    
    return Promise.resolve();
  } catch (error) {
    console.error('Erreur lors de l\'exportation de la transcription en PDF:', error);
    return Promise.reject(error);
  }
}

/**
 * Exporte une transcription au format Markdown
 * @param transcriptSegments Les segments de la transcription
 * @param meetingName Le nom de la réunion
 * @param meetingDate La date de la réunion
 */
export async function exportTranscriptToMarkdown(
  transcriptSegments: TranscriptSegment[],
  meetingName: string,
  meetingDate: string
): Promise<void> {
  console.log('Début de l\'exportation de la transcription au format Markdown:', {
    segmentsCount: transcriptSegments.length,
    meetingName,
    meetingDate
  });

  try {
    // Créer le contenu Markdown
    let markdownContent = `# Transcription - ${meetingName}\n\n`;
    markdownContent += `Date: ${meetingDate}\n\n`;
    markdownContent += `---\n\n`;
    
    // Ajouter chaque segment de transcription
    transcriptSegments.forEach(segment => {
      const timestamp = segment.timestamp ? ` (${segment.timestamp})` : '';
      markdownContent += `**${segment.speaker}${timestamp}:** ${segment.text}\n\n`;
    });
    
    // Créer un blob pour le téléchargement
    const blob = new Blob([markdownContent], { type: 'text/markdown;charset=utf-8' });
    
    // Générer un nom de fichier
    const fileName = `Transcription_${meetingName.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().slice(0, 10)}.md`;
    
    // Télécharger le fichier
    saveAs(blob, fileName);
    
    return Promise.resolve();
  } catch (error) {
    console.error('Erreur lors de l\'exportation de la transcription en Markdown:', error);
    return Promise.reject(error);
  }
}
