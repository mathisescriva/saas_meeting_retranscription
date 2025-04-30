import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';

/**
 * Exporte un compte rendu au format Word (.docx)
 * @param summaryText Le texte du compte rendu (format Markdown)
 * @param meetingName Le nom de la réunion
 * @param meetingDate La date de la réunion
 */
export async function exportSummaryToWord(
  summaryText: string,
  meetingName: string,
  meetingDate: string
): Promise<void> {
  console.log('Début de la fonction exportSummaryToWord avec:', {
    summaryTextLength: summaryText.length,
    meetingName,
    meetingDate
  });

  // Ajouter un en-tête avec le nom de la réunion
  const headerParagraphs = [
    new Paragraph({
      text: `Compte rendu - ${meetingName}`,
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.CENTER,
    }),
    new Paragraph({
      text: `Date: ${meetingDate}`,
      alignment: AlignmentType.CENTER,
    }),
    new Paragraph({
      text: '',
    }),
  ];

  // Convertir le texte Markdown en paragraphes Word
  // Note: Cette conversion est simplifiée et ne gère pas tous les éléments Markdown
  const contentParagraphs = convertMarkdownToDocxParagraphs(summaryText);

  // Créer un nouveau document avec notre contenu
  const doc = new Document({
    sections: [{
      properties: {},
      children: [...headerParagraphs, ...contentParagraphs],
    }],
  });

  console.log('Génération du document Word...');
  // Générer le document Word
  const buffer = await Packer.toBuffer(doc);
  console.log('Document Word généré avec succès, taille du buffer:', buffer.byteLength);

  // Télécharger le fichier
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });

  // Générer un nom de fichier basé sur le nom de la réunion et la date
  const fileName = `${meetingName.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().slice(0, 10)}.docx`;

  console.log('Téléchargement du fichier:', fileName);
  // Télécharger le fichier
  try {
    saveAs(blob, fileName);
    console.log('Fichier téléchargé avec succès');
  } catch (error) {
    console.error('Erreur lors du téléchargement du fichier:', error);
    throw error;
  }
}

/**
 * Convertit un texte Markdown en paragraphes pour le document Word
 * @param markdownText Le texte au format Markdown
 * @returns Un tableau de paragraphes Word
 */
function convertMarkdownToDocxParagraphs(markdownText: string): Paragraph[] {
  const paragraphs: Paragraph[] = [];
  const lines = markdownText.split('\n');

  let currentList: string[] = [];
  let inList = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Ignorer les lignes vides
    if (line === '') {
      // Si nous étions dans une liste, ajouter la liste actuelle et réinitialiser
      if (inList && currentList.length > 0) {
        // Ajouter chaque élément de la liste comme un paragraphe avec une puce
        currentList.forEach((item) => {
          paragraphs.push(
            new Paragraph({
              text: `• ${item}`,
              indent: {
                left: 720, // 0.5 inch
              },
            })
          );
        });
        currentList = [];
        inList = false;
      }
      // Ajouter un paragraphe vide pour les sauts de ligne
      paragraphs.push(new Paragraph({ text: '' }));
      continue;
    }

    // Titres
    if (line.startsWith('# ')) {
      paragraphs.push(
        new Paragraph({
          text: line.substring(2),
          heading: HeadingLevel.HEADING_1,
        })
      );
    } else if (line.startsWith('## ')) {
      paragraphs.push(
        new Paragraph({
          text: line.substring(3),
          heading: HeadingLevel.HEADING_2,
        })
      );
    } else if (line.startsWith('### ')) {
      paragraphs.push(
        new Paragraph({
          text: line.substring(4),
          heading: HeadingLevel.HEADING_3,
        })
      );
    }
    // Éléments de liste
    else if (line.startsWith('- ') || line.startsWith('* ')) {
      inList = true;
      currentList.push(line.substring(2));
    }
    // Texte normal
    else {
      // Si nous étions dans une liste, ajouter la liste actuelle et réinitialiser
      if (inList && currentList.length > 0) {
        // Ajouter chaque élément de la liste comme un paragraphe avec une puce
        currentList.forEach((item) => {
          paragraphs.push(
            new Paragraph({
              text: `• ${item}`,
              indent: {
                left: 720, // 0.5 inch
              },
            })
          );
        });
        currentList = [];
        inList = false;
      }

      // Traiter le texte en gras et italique
      const textRuns: TextRun[] = [];
      let currentText = '';
      let isBold = false;
      let isItalic = false;

      for (let j = 0; j < line.length; j++) {
        if (line[j] === '*' && line[j + 1] === '*') {
          // Ajouter le texte accumulé jusqu'à présent
          if (currentText) {
            textRuns.push(
              new TextRun({
                text: currentText,
                bold: isBold,
                italics: isItalic,
              })
            );
            currentText = '';
          }
          // Basculer l'état du gras
          isBold = !isBold;
          j++; // Sauter le deuxième *
        } else if (line[j] === '*') {
          // Ajouter le texte accumulé jusqu'à présent
          if (currentText) {
            textRuns.push(
              new TextRun({
                text: currentText,
                bold: isBold,
                italics: isItalic,
              })
            );
            currentText = '';
          }
          // Basculer l'état de l'italique
          isItalic = !isItalic;
        } else {
          currentText += line[j];
        }
      }

      // Ajouter le dernier morceau de texte
      if (currentText) {
        textRuns.push(
          new TextRun({
            text: currentText,
            bold: isBold,
            italics: isItalic,
          })
        );
      }

      // Si nous avons des TextRuns, les utiliser, sinon utiliser le texte brut
      if (textRuns.length > 0) {
        paragraphs.push(new Paragraph({ children: textRuns }));
      } else {
        paragraphs.push(new Paragraph({ text: line }));
      }
    }
  }

  // Traiter la dernière liste si elle existe
  if (inList && currentList.length > 0) {
    currentList.forEach((item) => {
      paragraphs.push(
        new Paragraph({
          text: `• ${item}`,
          indent: {
            left: 720, // 0.5 inch
          },
        })
      );
    });
  }

  return paragraphs;
}
