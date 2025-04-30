import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { saveAs } from 'file-saver';
import * as showdown from 'showdown';

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
