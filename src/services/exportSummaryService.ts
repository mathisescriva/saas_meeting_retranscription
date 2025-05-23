import { saveAs } from 'file-saver';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
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
  console.log('Début de l\'exportation du compte rendu au format PDF:', {
    summaryTextLength: summaryText.length,
    meetingName,
    meetingDate
  });

  try {
    // Convertir le Markdown en HTML pour une meilleure mise en forme
    const converter = new showdown.Converter();
    const htmlContent = converter.makeHtml(summaryText);
    
    // Créer un élément temporaire pour parser le HTML
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlContent;
    
    // Créer un nouveau document PDF
    const doc = new jsPDF();
    
    // Ajouter le titre
    doc.setFontSize(18);
    doc.text('Compte rendu - ' + meetingName, 105, 20, { align: 'center' });
    
    // Ajouter la date
    doc.setFontSize(12);
    doc.setTextColor(100, 100, 100);
    doc.text('Date: ' + meetingDate, 105, 30, { align: 'center' });
    
    // Réinitialiser la couleur du texte
    doc.setTextColor(0, 0, 0);
    
    // Extraire et formater le contenu du HTML
    const paragraphs: string[] = [];
    
    // Parcourir les éléments du HTML et les ajouter au tableau de paragraphes
    Array.from(tempDiv.children).forEach(element => {
      if (element.tagName === 'H1') {
        paragraphs.push('# ' + element.textContent);
      } else if (element.tagName === 'H2') {
        paragraphs.push('## ' + element.textContent);
      } else if (element.tagName === 'H3') {
        paragraphs.push('### ' + element.textContent);
      } else if (element.tagName === 'P') {
        paragraphs.push(element.textContent || '');
      } else if (element.tagName === 'UL') {
        Array.from(element.children).forEach(li => {
          paragraphs.push('• ' + li.textContent);
        });
      } else if (element.tagName === 'OL') {
        Array.from(element.children).forEach((li, index) => {
          paragraphs.push(`${index + 1}. ${li.textContent}`);
        });
      }
    });
    
    // Ajouter le contenu au PDF
    doc.setFontSize(11);
    let yPosition = 40;
    
    paragraphs.forEach(paragraph => {
      if (paragraph.startsWith('#')) {
        // C'est un titre
        const level = paragraph.match(/^#+/)?.[0].length || 1;
        const text = paragraph.replace(/^#+\s*/, '');
        
        // Ajuster la taille de la police en fonction du niveau de titre
        if (level === 1) {
          doc.setFontSize(16);
          doc.setFont('helvetica', 'bold');
        } else if (level === 2) {
          doc.setFontSize(14);
          doc.setFont('helvetica', 'bold');
        } else {
          doc.setFontSize(12);
          doc.setFont('helvetica', 'bold');
        }
        
        // Ajouter une marge avant les titres
        yPosition += 5;
        
        // Vérifier si nous devons ajouter une nouvelle page
        if (yPosition > 270) {
          doc.addPage();
          yPosition = 20;
        }
        
        doc.text(text, 10, yPosition);
        yPosition += 7;
        
        // Réinitialiser la police
        doc.setFontSize(11);
        doc.setFont('helvetica', 'normal');
      } else if (paragraph.startsWith('•') || paragraph.match(/^\d+\./)) {
        // C'est un élément de liste
        const lines = doc.splitTextToSize(paragraph, 180);
        
        // Vérifier si nous devons ajouter une nouvelle page
        if (yPosition + (lines.length * 7) > 280) {
          doc.addPage();
          yPosition = 20;
        }
        
        doc.text(lines, 15, yPosition);
        yPosition += lines.length * 7;
      } else {
        // C'est un paragraphe normal
        const lines = doc.splitTextToSize(paragraph, 190);
        
        // Vérifier si nous devons ajouter une nouvelle page
        if (yPosition + (lines.length * 7) > 280) {
          doc.addPage();
          yPosition = 20;
        }
        
        doc.text(lines, 10, yPosition);
        yPosition += lines.length * 7;
      }
      
      // Ajouter un petit espace entre les paragraphes
      yPosition += 3;
    });
    
    // Générer un nom de fichier basé sur le nom de la réunion et la date
    const fileName = `Compte_rendu_${meetingName.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`;
    
    // Télécharger le fichier
    console.log('Téléchargement du fichier PDF:', fileName);
    doc.save(fileName);
    
    console.log('Exportation PDF terminée avec succès');
  } catch (error) {
    console.error('Erreur lors de l\'exportation du compte rendu en PDF:', error);
    throw error;
  }
}

/**
 * Exporte un compte rendu au format Markdown
 * @param summaryText Le texte du compte rendu (format Markdown)
 * @param meetingName Le nom de la réunion
 * @param meetingDate La date de la réunion
 */
export async function exportSummaryToMarkdown(
  summaryText: string,
  meetingName: string,
  meetingDate: string
): Promise<void> {
  console.log('Début de l\'exportation du compte rendu au format Markdown:', {
    summaryTextLength: summaryText.length,
    meetingName,
    meetingDate
  });

  try {
    // Créer le contenu Markdown avec un en-tête
    const markdownContent = `# Compte rendu - ${meetingName}\n\nDate: ${meetingDate}\n\n${summaryText}`;
    
    // Créer un blob pour le téléchargement
    const blob = new Blob([markdownContent], { type: 'text/markdown;charset=utf-8' });
    
    // Générer un nom de fichier basé sur le nom de la réunion et la date
    const fileName = `Compte_rendu_${meetingName.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().slice(0, 10)}.md`;
    
    // Télécharger le fichier
    console.log('Téléchargement du fichier Markdown:', fileName);
    saveAs(blob, fileName);
    
    console.log('Exportation Markdown terminée avec succès');
  } catch (error) {
    console.error('Erreur lors de l\'exportation du compte rendu en Markdown:', error);
    throw error;
  }
}
