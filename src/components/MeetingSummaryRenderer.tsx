import React from 'react';
import {
  Box,
  Typography,
  Paper,
  TableContainer,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  Stack,
  CircularProgress
} from '@mui/material';
import {
  People as PeopleIcon,
  Person as PersonIcon,
  Summarize as SummarizeIcon,
  Assignment as AssignmentIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  MenuBook as MenuBookIcon
} from '@mui/icons-material';

interface MeetingSummaryRendererProps {
  summaryText: string | null;
  isLoading?: boolean;
}

const MeetingSummaryRenderer: React.FC<MeetingSummaryRendererProps> = ({ summaryText, isLoading = false }) => {
  if (isLoading) {
    return (
      <Box display="flex" flexDirection="column" alignItems="center" p={2}>
        <CircularProgress />
        <Typography variant="body1" sx={{ mt: 2 }}>
          Le résumé est en cours de génération...
        </Typography>
      </Box>
    );
  }

  if (!summaryText) {
    return (
      <Box display="flex" flexDirection="column" alignItems="center" p={2}>
        <Typography variant="body1">
          Aucun résumé disponible. Vous pouvez générer un résumé en cliquant sur le bouton "Générer un résumé".
        </Typography>
      </Box>
    );
  }

  // Fonction pour analyser une ligne et extraire les participants
  const parseParticipants = (line: string) => {
    // Rechercher les formats possibles comme "👥 **Participants** : Nom1, Nom2"
    const participantsRegex = /[-#]?\s*(?:👥|🧑‍💼)?\s*\*\*Participants\*\*\s*(?::|\s)\s*(.+)/i;
    const match = line.match(participantsRegex);
    
    if (match && match[1]) {
      return match[1].split(',').map(p => p.trim());
    }
    return null;
  };

  // Fonction améliorée pour détecter et analyser n'importe quel format de tableau markdown
  const parseMarkdownTable = (content: string) => {
    // Identifier une table markdown avec des barres |
    const lines = content.split('\n').filter(line => line.trim() !== '');
    
    // Détecter si nous avons des lignes qui contiennent des barres verticales (|)
    const tableLines = lines.filter(line => line.includes('|'));
    if (tableLines.length < 2) return null; // Pas assez de lignes pour un tableau
    
    // Extraire les en-têtes de la première ligne qui contient des barres verticales
    let headers = tableLines[0].split('|')
      .map(h => h.trim())
      .filter(h => h !== '');
      
    // Si les en-têtes sont vides ou manquants, utiliser des en-têtes génériques
    if (headers.length === 0) {
      headers = ['Colonne 1', 'Colonne 2'];
    }
    
    // Déterminer où commencent les données (après l'en-tête et la ligne de séparation si elle existe)
    let dataStartIndex = 1;
    // Vérifier si la deuxième ligne est une ligne de séparation (contient des tirets)
    if (tableLines.length > 1 && tableLines[1].replace(/[^-|]/g, '') === tableLines[1]) {
      dataStartIndex = 2;
    }
    
    // Extraire les données des lignes
    const rows = [];
    for (let i = dataStartIndex; i < tableLines.length; i++) {
      const rowData = tableLines[i].split('|')
        .map(cell => cell.trim())
        .filter(cell => cell !== '');
      
      // S'assurer que chaque ligne a le même nombre de colonnes que les en-têtes
      // en ajoutant des cellules vides si nécessaire
      while (rowData.length < headers.length) {
        rowData.push('');
      }
      
      if (rowData.length > 0) {
        rows.push(rowData);
      }
    }
    
    console.log('Table parsed:', { headers, rows, tableLines });
    return { headers, rows };
  };

  // Les sections que nous allons construire
  const renderedSections = [];

  // Parcourir les lignes pour identifier les sections spéciales
  const lines = summaryText.split('\n');
  
  // Détecter et formater le titre principal de la réunion
  if (lines.length > 0 && lines[0].match(/^#\s+[\p{Emoji}\p{Emoji_Presentation}\p{Emoji_Modifier_Base}\p{Emoji_Modifier}\p{Emoji_Component}]*\s*Réunion/ui)) {
    // Extraire le titre principal
    const mainTitle = lines[0].replace(/^#\s+/, '');
    renderedSections.push(
      <Box key="meeting-title" sx={{ mb: 3, borderBottom: '1px solid #eee', pb: 2 }}>
        <Typography variant="h4" component="h1" fontWeight="bold">
          {mainTitle}
        </Typography>
      </Box>
    );
    // Supprimer le titre traité des lignes à analyser
    lines.shift();
  }
  
  let currentSection = null;
  let sectionContent: string[] = [];
  let sectionType: string | null = null;

  // Fonction pour rendre le texte markdown (italique, gras, etc.)
  const renderMarkdownText = (text: string) => {
    // Gestion du gras avec **texte**
    let renderedText = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    
    // Gestion des titres avec #### (sous-sections)
    if (text.match(/^#### (.+)$/)) {
      const titleText = text.replace(/^#### (.+)$/, '$1');
      return (
        <Typography variant="h6" sx={{ fontWeight: 600, mt: 2, mb: 1 }}>
          {renderMarkdownText(titleText)}
        </Typography>
      );
    }
    
    // Gestion des titres avec ### (sections principales)
    if (text.match(/^### (.+)$/)) {
      const titleText = text.replace(/^### (.+)$/, '$1');
      return (
        <Typography variant="h5" sx={{ fontWeight: 700, mt: 3, mb: 2, color: 'primary.main' }}>
          {renderMarkdownText(titleText)}
        </Typography>
      );
    }
    
    // Gestion des lignes commençant par un tiret
    if (text.match(/^- /)) {
      const lineContent = text.replace(/^- /, '');
      return (
        <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 1 }}>
          <Box component="span" sx={{ mr: 1, mt: 0.5 }}>•</Box>
          <Typography variant="body1">
            <span dangerouslySetInnerHTML={{ __html: lineContent.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>') }} />
          </Typography>
        </Box>
      );
    }
    
    // Convertir en JSX avec dangerouslySetInnerHTML pour le texte normal
    if (renderedText !== text) {
      return <span dangerouslySetInnerHTML={{ __html: renderedText }} />;
    }
    
    return text;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Détection des titres avec #### (sous-sections)
    if (line.match(/^####\s+/)) {
      // Traiter la section précédente si elle existe
      if (sectionType && sectionContent.length > 0) {
        if (sectionType === 'other') {
          renderedSections.push(
            <Box key={`section-${renderedSections.length}`} sx={{ mb: 3 }}>
              <Typography variant="body1" sx={{ whiteSpace: 'pre-line' }}>
                {sectionContent.join('\n')}
              </Typography>
            </Box>
          );
        }
        sectionContent = [];
      }

      // Extraire le texte du titre (sans les ####)
      const title = line.replace(/^####\s+/, '');
      
      // Initialiser la nouvelle section 
      sectionType = 'subtitle';
      currentSection = line;

      // Extraire les éléments sous ce titre
      const contentItems = [];
      let j = i + 1;
      while (j < lines.length && !lines[j].match(/^####/) && !lines[j].match(/^###/) && !lines[j].match(/^---/)) {
        if (lines[j].trim() !== '') {
          contentItems.push(lines[j].trim());
        }
        j++;
      }
      i = j - 1; // Mettre à jour l'index
      
      // Ajouter la section avec le titre formaté
      renderedSections.push(
        <Box key={`subtitle-${renderedSections.length}`} sx={{ mb: 3 }}>
          <Typography variant="h6" component="h3" fontWeight="600" sx={{ mb: 1.5 }}>
            {title}
          </Typography>
          
          {contentItems.length > 0 && (
            <Box sx={{ pl: 2 }}>
              {contentItems.map((item, index) => {
                // Vérifier si c'est un élément avec tiret
                if (item.match(/^-\s*/)) {
                  return (
                    <Box key={`item-${index}`} sx={{ display: 'flex', mb: 1 }}>
                      <Box component="span" sx={{ mr: 1 }}>•</Box>
                      <Typography variant="body1">
                        <span dangerouslySetInnerHTML={{ __html: item.replace(/^-\s*/, '').replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>') }} />
                      </Typography>
                    </Box>
                  );
                } else {
                  return <Typography key={`item-${index}`} sx={{ mb: 1 }}>{renderMarkdownText(item)}</Typography>;
                }
              })}
            </Box>
          )}
        </Box>
      );
    }
    // Détection des titres avec ### (Points clés)
    else if (line.match(/^###\s+/)) {
      // Traiter la section précédente si elle existe
      if (sectionType && sectionContent.length > 0) {
        if (sectionType === 'other') {
          renderedSections.push(
            <Box key={`section-${renderedSections.length}`} sx={{ mb: 3 }}>
              <Typography variant="body1" sx={{ whiteSpace: 'pre-line' }}>
                {sectionContent.join('\n')}
              </Typography>
            </Box>
          );
        }
        sectionContent = [];
      }

      // Extraire le texte du titre (sans les ###)
      const title = line.replace(/^###\s+/, '');
      
      // Initialiser la nouvelle section 
      sectionType = 'title';
      currentSection = line;

      // Extraire les éléments sous ce titre
      const contentItems = [];
      let j = i + 1;
      while (j < lines.length && !lines[j].match(/^#[#]?/) && !lines[j].match(/^---/)) {
        if (lines[j].trim() !== '') {
          contentItems.push(lines[j].trim());
        }
        j++;
      }
      i = j - 1; // Mettre à jour l'index
      
      // Ajouter la section avec le titre formaté
      renderedSections.push(
        <Box key={`title-${renderedSections.length}`} sx={{ mb: 3 }}>
          <Typography variant="h5" component="h2" fontWeight="700" color="primary.main" sx={{ mb: 2 }}>
            {title}
          </Typography>
          
          {contentItems.length > 0 && (
            <Paper elevation={1} sx={{ p: 2 }}>
              {contentItems.map((item, index) => {
                // Vérifier si c'est un élément numéroté
                const isNumbered = item.match(/^\d+\.\s*/);
                if (isNumbered) {
                  return (
                    <Typography key={`item-${index}`} sx={{ mb: 1, display: 'flex', alignItems: 'center' }}>
                      <strong style={{ marginRight: '8px' }}>{isNumbered[0]}</strong>
                      <span>{renderMarkdownText(item.replace(/^\d+\.\s*/, ''))}</span>
                    </Typography>
                  );
                } else if (item.match(/^-\s*/)) {
                  // Élément avec puces
                  return (
                    <Typography key={`item-${index}`} sx={{ mb: 1, pl: 2 }}>
                      • {renderMarkdownText(item.replace(/^-\s*/, ''))}
                    </Typography>
                  );
                } else {
                  // Texte simple
                  return <Typography key={`item-${index}`} sx={{ mb: 1 }}>{renderMarkdownText(item)}</Typography>;
                }
              })}
            </Paper>
          )}
        </Box>
      );
    }
    // Détection des titres principaux avec un seul #
    else if (line.match(/^#\s+[^#][\p{Emoji}\p{Emoji_Presentation}\p{Emoji_Modifier_Base}\p{Emoji_Modifier}\p{Emoji_Component}]*.*$/ui) && !line.match(/^#\s*Réunion/ui)) {
      // Traiter la section précédente si elle existe
      if (sectionType && sectionContent.length > 0) {
        if (sectionType === 'other') {
          renderedSections.push(
            <Box key={`section-${renderedSections.length}`} sx={{ mb: 3 }}>
              <Typography variant="body1" sx={{ whiteSpace: 'pre-line' }}>
                {sectionContent.join('\n')}
              </Typography>
            </Box>
          );
        }
        sectionContent = [];
      }

      // Extraire le texte du titre (sans le #)
      const title = line.replace(/^#\s+/, '');
      
      // Initialiser la nouvelle section 
      sectionType = 'title';
      currentSection = line;

      // Extraire les éléments sous ce titre
      const contentItems = [];
      let j = i + 1;
      while (j < lines.length && !lines[j].match(/^#[#]?/) && !lines[j].match(/^---/)) {
        if (lines[j].trim() !== '') {
          contentItems.push(lines[j].trim());
        }
        j++;
      }
      i = j - 1; // Mettre à jour l'index
      
      // Ajouter la section avec le titre formaté
      renderedSections.push(
        <Box key={`title-${renderedSections.length}`} sx={{ mb: 3 }}>
          <Typography variant="h4" component="h1" fontWeight="bold" color="primary.main" sx={{ mb: 2 }}>
            {title}
          </Typography>
          
          {contentItems.length > 0 && (
            <Paper elevation={1} sx={{ p: 2 }}>
              {contentItems.map((item, index) => {
                // Vérifier si c'est un élément numéroté
                const isNumbered = item.match(/^\d+\.\s*/);
                if (isNumbered) {
                  return (
                    <Typography key={`item-${index}`} sx={{ mb: 1, display: 'flex', alignItems: 'center' }}>
                      <strong style={{ marginRight: '8px' }}>{isNumbered[0]}</strong>
                      <span>{renderMarkdownText(item.replace(/^\d+\.\s*/, ''))}</span>
                    </Typography>
                  );
                } else if (item.match(/^-\s*/)) {
                  // Élément avec puces
                  return (
                    <Typography key={`item-${index}`} sx={{ mb: 1, pl: 2 }}>
                      • {renderMarkdownText(item.replace(/^-\s*/, ''))}
                    </Typography>
                  );
                } else {
                  // Texte simple
                  return <Typography key={`item-${index}`} sx={{ mb: 1 }}>{renderMarkdownText(item)}</Typography>;
                }
              })}
            </Paper>
          )}
        </Box>
      );
    }
    // Détection des sous-titres génériques
    else if (line.match(/^##\s+[\p{Emoji}\p{Emoji_Presentation}\p{Emoji_Modifier_Base}\p{Emoji_Modifier}\p{Emoji_Component}]*.*$/ui) && !line.match(/^##\s*[📆🗳✅⚠️💨📘👥🧠].*$/ui)) {
      // Traiter la section précédente si elle existe
      if (sectionType && sectionContent.length > 0) {
        if (sectionType === 'other') {
          renderedSections.push(
            <Box key={`section-${renderedSections.length}`} sx={{ mb: 3 }}>
              <Typography variant="body1" sx={{ whiteSpace: 'pre-line' }}>
                {sectionContent.join('\n')}
              </Typography>
            </Box>
          );
        }
        sectionContent = [];
      }

      // Extraire le texte du sous-titre (sans les ##)
      const subTitle = line.replace(/^##\s+/, '');
      
      // Initialiser la nouvelle section générique
      sectionType = 'subtitle';
      currentSection = line;

      // Extraire les éléments sous ce sous-titre
      const contentItems = [];
      let j = i + 1;
      while (j < lines.length && !lines[j].match(/^##/) && !lines[j].match(/^---/)) {
        if (lines[j].trim() !== '') {
          contentItems.push(lines[j].trim());
        }
        j++;
      }
      i = j - 1; // Mettre à jour l'index
      
      // Vérifier si la section contient un tableau markdown (lignes avec |)
      const hasTable = contentItems.some(item => item.includes('|'));
      
      // Ajouter la section avec le sous-titre formaté
      renderedSections.push(
        <Box key={`subtitle-${renderedSections.length}`} sx={{ mb: 3 }}>
          <Typography variant="h5" component="h2" fontWeight="500" color="primary.main" sx={{ mb: 2 }}>
            {subTitle}
          </Typography>
          
          {hasTable ? (
            // Formater comme un tableau
            (() => {
              const tableData = parseMarkdownTable(contentItems.join('\n'));
              
              if (tableData && tableData.headers.length > 0 && tableData.rows.length > 0) {
                return (
                  <TableContainer component={Paper} sx={{ mb: 2 }}>
                    <Table>
                      <TableHead>
                        <TableRow>
                          {tableData.headers.map((header, index) => (
                            <TableCell key={`header-${index}`}>{header}</TableCell>
                          ))}
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {tableData.rows.map((row, rowIndex) => (
                          <TableRow key={`row-${rowIndex}`}>
                            {row.map((cell, cellIndex) => (
                              <TableCell key={`cell-${rowIndex}-${cellIndex}`}>{cell}</TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                );
              } else {
                // Fallback en cas de problème avec le tableau
                return (
                  <Paper elevation={1} sx={{ p: 2 }}>
                    <Typography variant="body1" sx={{ whiteSpace: 'pre-line' }}>
                      {contentItems.join('\n')}
                    </Typography>
                  </Paper>
                );
              }
            })()
          ) : contentItems.length > 0 && (
            // Contenu normal sans tableau
            <Paper elevation={1} sx={{ p: 2 }}>
              {contentItems.map((item, index) => {
                // Vérifier si c'est un élément numéroté
                const isNumbered = item.match(/^\d+\.\s*/);
                if (isNumbered) {
                  return (
                    <Typography key={`item-${index}`} sx={{ mb: 1, display: 'flex', alignItems: 'center' }}>
                      <strong style={{ marginRight: '8px' }}>{isNumbered[0]}</strong>
                      <span>{renderMarkdownText(item.replace(/^\d+\.\s*/, ''))}</span>
                    </Typography>
                  );
                } else if (item.match(/^-\s*/)) {
                  // Élément avec puces
                  return (
                    <Typography key={`item-${index}`} sx={{ mb: 1, pl: 2 }}>
                      • {renderMarkdownText(item.replace(/^-\s*/, ''))}
                    </Typography>
                  );
                } else {
                  // Texte simple avec formatage markdown
                  return <Typography key={`item-${index}`} sx={{ mb: 1 }}>{renderMarkdownText(item)}</Typography>;
                }
              })}
            </Paper>
          )}
        </Box>
      );
    }
    // Détection de l'ordre du jour
    else if (line.match(/##\s*📆.*(?:Ordre|Agenda)/i)) {
      // Traiter la section précédente si elle existe
      if (sectionType && sectionContent.length > 0) {
        if (sectionType === 'other') {
          renderedSections.push(
            <Box key={`section-${renderedSections.length}`} sx={{ mb: 3 }}>
              <Typography variant="body1" sx={{ whiteSpace: 'pre-line' }}>
                {sectionContent.join('\n')}
              </Typography>
            </Box>
          );
        }
        sectionContent = [];
      }

      // Initialiser la nouvelle section
      sectionType = 'agenda';
      currentSection = line;

      // Collecter les éléments de l'ordre du jour
      const agendaItems = [];
      let j = i + 1;
      while (j < lines.length && !lines[j].match(/^##/) && !lines[j].match(/^---/)) {
        if (lines[j].trim() !== '') {
          agendaItems.push(lines[j].trim());
        }
        j++;
      }
      i = j - 1; // Mettre à jour l'index

      // Ajouter la section formatée
      renderedSections.push(
        <Box key={`agenda-${renderedSections.length}`} sx={{ mb: 3 }}>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
            <AssignmentIcon color="primary" />
            <Typography variant="h6">Ordre du jour</Typography>
          </Stack>
          <Paper elevation={1} sx={{ p: 2 }}>
            <Box component="ol" sx={{ pl: 2 }}>
              {agendaItems.map((item, index) => {
                // Retirer les numéros et les emojis du début de la ligne
                const cleanItem = item.replace(/^\d+\.\s*[\p{Emoji}\p{Emoji_Presentation}\p{Emoji_Modifier_Base}\p{Emoji_Modifier}\p{Emoji_Component}]+\s*/u, '');
                return (
                  <Typography component="li" key={`agenda-item-${index}`} sx={{ mb: 1 }}>
                    {cleanItem}
                  </Typography>
                );
              })}
            </Box>
          </Paper>
        </Box>
      );
    }
    // Détection des décisions prises
    else if (line.match(/##\s*🗳.*(?:Décisions|Votes)/i) || line.match(/##\s*✅.*(?:Décisions|Décidé)/i)) {
      // Traiter la section précédente si elle existe
      if (sectionType && sectionContent.length > 0) {
        if (sectionType === 'other') {
          renderedSections.push(
            <Box key={`section-${renderedSections.length}`} sx={{ mb: 3 }}>
              <Typography variant="body1" sx={{ whiteSpace: 'pre-line' }}>
                {sectionContent.join('\n')}
              </Typography>
            </Box>
          );
        }
        sectionContent = [];
      }

      // Initialiser la nouvelle section
      sectionType = 'decisions';
      currentSection = line;

      // Collecter les décisions
      const decisions = [];
      let j = i + 1;
      while (j < lines.length && !lines[j].match(/^##/) && !lines[j].match(/^---/)) {
        if (lines[j].trim() !== '') {
          decisions.push(lines[j].trim());
        }
        j++;
      }
      i = j - 1; // Mettre à jour l'index

      // Ajouter la section formatée
      renderedSections.push(
        <Box key={`decisions-${renderedSections.length}`} sx={{ mb: 3 }}>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
            <CheckCircleIcon color="success" />
            <Typography variant="h6">Décisions prises</Typography>
          </Stack>
          <Paper elevation={1} sx={{ p: 2 }}>
            <Box component="ul" sx={{ pl: 2 }}>
              {decisions.map((decision, index) => (
                <Typography component="li" key={`decision-${index}`} sx={{ mb: 1 }}>
                  {decision.replace(/^[-\*]\s*/, '')}
                </Typography>
              ))}
            </Box>
          </Paper>
        </Box>
      );
    }
    // Détection des points de vigilance
    else if (line.match(/##\s*⚠️.*(?:Points|Vigilance|Attention)/i) || line.match(/##\s*🚨.*(?:Alerte|Warning)/i)) {
      // Traiter la section précédente si elle existe
      if (sectionType && sectionContent.length > 0) {
        if (sectionType === 'other') {
          renderedSections.push(
            <Box key={`section-${renderedSections.length}`} sx={{ mb: 3 }}>
              <Typography variant="body1" sx={{ whiteSpace: 'pre-line' }}>
                {sectionContent.join('\n')}
              </Typography>
            </Box>
          );
        }
        sectionContent = [];
      }

      // Initialiser la nouvelle section
      sectionType = 'warnings';
      currentSection = line;

      // Collecter les points de vigilance
      const warnings = [];
      let j = i + 1;
      while (j < lines.length && !lines[j].match(/^##/) && !lines[j].match(/^---/)) {
        if (lines[j].trim() !== '') {
          warnings.push(lines[j].trim());
        }
        j++;
      }
      i = j - 1; // Mettre à jour l'index

      // Ajouter la section formatée
      renderedSections.push(
        <Box key={`warnings-${renderedSections.length}`} sx={{ mb: 3 }}>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
            <WarningIcon color="warning" />
            <Typography variant="h6">Points de vigilance</Typography>
          </Stack>
          <Paper elevation={1} sx={{ p: 2, backgroundColor: '#fff9c4' }}>
            <Box component="ul" sx={{ pl: 2 }}>
              {warnings.map((warning, index) => (
                <Typography component="li" key={`warning-${index}`} sx={{ mb: 1 }}>
                  {warning.replace(/^[-\*]\s*[\p{Emoji}\p{Emoji_Presentation}\p{Emoji_Modifier_Base}\p{Emoji_Modifier}\p{Emoji_Component}]+\s*/u, '')}
                </Typography>
              ))}
            </Box>
          </Paper>
        </Box>
      );
    }
    // Détection des ressources mentionnées
    else if (line.match(/##\s*📘.*(?:Ressources|Documents)/i) || line.match(/##\s*📚.*(?:Refs|Références)/i)) {
      // Traiter la section précédente si elle existe
      if (sectionType && sectionContent.length > 0) {
        if (sectionType === 'other') {
          renderedSections.push(
            <Box key={`section-${renderedSections.length}`} sx={{ mb: 3 }}>
              <Typography variant="body1" sx={{ whiteSpace: 'pre-line' }}>
                {sectionContent.join('\n')}
              </Typography>
            </Box>
          );
        }
        sectionContent = [];
      }

      // Initialiser la nouvelle section
      sectionType = 'resources';
      currentSection = line;

      // Collecter les ressources
      const resources = [];
      let j = i + 1;
      while (j < lines.length && !lines[j].match(/^##/) && !lines[j].match(/^---/)) {
        if (lines[j].trim() !== '') {
          resources.push(lines[j].trim());
        }
        j++;
      }
      i = j - 1; // Mettre à jour l'index

      // Ajouter la section formatée
      renderedSections.push(
        <Box key={`resources-${renderedSections.length}`} sx={{ mb: 3 }}>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
            <MenuBookIcon color="primary" />
            <Typography variant="h6">Ressources mentionnées</Typography>
          </Stack>
          <Paper elevation={1} sx={{ p: 2 }}>
            <Box component="ul" sx={{ pl: 2 }}>
              {resources.map((resource, index) => (
                <Typography component="li" key={`resource-${index}`} sx={{ mb: 1 }}>
                  {resource.replace(/^[-\*]\s*/, '')}
                </Typography>
              ))}
            </Box>
          </Paper>
        </Box>
      );
    }
    // Nouvelle section: détection des participants
    else if (line.match(/[-#]\s*👥.*Participants/i) || line.match(/[-#]\s*🧑‍💼.*Participants/i)) {
      // Traiter la section précédente si elle existe
      if (sectionType && sectionContent.length > 0) {
        if (sectionType === 'other') {
          renderedSections.push(
            <Box key={`section-${renderedSections.length}`} sx={{ mb: 3 }}>
              <Typography variant="body1" sx={{ whiteSpace: 'pre-line' }}>
                {sectionContent.join('\n')}
              </Typography>
            </Box>
          );
        }
        sectionContent = [];
      }

      // Initialiser la nouvelle section
      sectionType = 'participants';
      currentSection = line;

      // Extraire les participants
      const participants = parseParticipants(line);
      if (participants && participants.length > 0) {
        renderedSections.push(
          <Box key={`participants-${renderedSections.length}`} sx={{ mb: 3 }}>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
              <PeopleIcon color="primary" />
              <Typography variant="h6">Participants</Typography>
            </Stack>
            <TableContainer component={Paper} sx={{ mb: 2 }}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Nom</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {participants.map((participant, index) => (
                    <TableRow key={`participant-${index}`}>
                      <TableCell sx={{ display: 'flex', alignItems: 'center' }}>
                        <PersonIcon sx={{ mr: 1, color: 'primary.main' }} />
                        {participant}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        );
      }
    }
    // Nouvelle section: détection du résumé express
    else if (line.match(/##\s*🧠.*Résumé/i) || line.match(/##\s*📝.*Résumé/i)) {
      // Traiter la section précédente
      if (sectionType && sectionContent.length > 0) {
        if (sectionType === 'other') {
          renderedSections.push(
            <Box key={`section-${renderedSections.length}`} sx={{ mb: 3 }}>
              <Typography variant="body1" sx={{ whiteSpace: 'pre-line' }}>
                {sectionContent.join('\n')}
              </Typography>
            </Box>
          );
        }
        sectionContent = [];
      }

      // Initialiser la nouvelle section
      sectionType = 'resume';
      currentSection = line;

      // Collecter le contenu du résumé dans les lignes suivantes
      const resumePoints = [];
      let j = i + 1;
      while (j < lines.length && !lines[j].match(/^##/) && !lines[j].match(/^---/)) {
        if (lines[j].trim() !== '') {
          resumePoints.push(lines[j].trim());
        }
        j++;
      }
      i = j - 1; // Mettre à jour l'index pour éviter la répétition

      // Ajouter la section formatée
      renderedSections.push(
        <Box key={`resume-${renderedSections.length}`} sx={{ mb: 3 }}>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
            <SummarizeIcon color="primary" />
            <Typography variant="h6">Résumé express</Typography>
          </Stack>
          <Paper elevation={1} sx={{ p: 2 }}>
            <Typography variant="body1" sx={{ whiteSpace: 'pre-line' }}>
              {resumePoints.join('\n')}
            </Typography>
          </Paper>
        </Box>
      );
    }
    // Nouvelle section: détection des tâches/actions
    else if (line.match(/##\s*[➡️⏰📋📌⚠️].*(?:Tâches|Actions)/i) || line.match(/##.*📝.*(?:Tâches|Actions)/i) || line.match(/\s*[➡️⏰📋📌⚠️]\s*\*\*(?:Tâches|Actions)/i)) {
      // Traiter la section précédente
      if (sectionType && sectionContent.length > 0) {
        if (sectionType === 'other') {
          renderedSections.push(
            <Box key={`section-${renderedSections.length}`} sx={{ mb: 3 }}>
              <Typography variant="body1" sx={{ whiteSpace: 'pre-line' }}>
                {sectionContent.join('\n')}
              </Typography>
            </Box>
          );
        }
        sectionContent = [];
      }

      // Initialiser la nouvelle section
      sectionType = 'actions';
      currentSection = line;

      // Collecter les lignes suivantes qui pourraient contenir le tableau
      const actionLines = [];
      let j = i + 1;
      while (j < lines.length && !lines[j].match(/^##/) && !lines[j].match(/^---/)) {
        if (lines[j].trim() !== '') {
          actionLines.push(lines[j]);
        }
        j++;
      }
      i = j - 1; // Mettre à jour l'index

      // Parser le tableau si présent
      if (actionLines.some(line => line.includes('|'))) {
        console.log('Table d\'actions détectée:', actionLines.join('\n'));
        const tableData = parseMarkdownTable(actionLines.join('\n'));
        
        // Log pour débogage
        console.log('Données de tableau extraites:', tableData);

        if (tableData && tableData.headers.length > 0 && tableData.rows.length > 0) {
          renderedSections.push(
            <Box key={`actions-${renderedSections.length}`} sx={{ mb: 3 }}>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                <AssignmentIcon color="primary" />
                <Typography variant="h6">Tâches & actions à suivre</Typography>
              </Stack>
              <TableContainer component={Paper}>
                <Table>
                  <TableHead>
                    <TableRow>
                      {tableData.headers.map((header, index) => (
                        <TableCell key={`header-${index}`}>{header}</TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {tableData.rows.map((row, rowIndex) => (
                      <TableRow key={`row-${rowIndex}`}>
                        {row.map((cell, cellIndex) => (
                          <TableCell key={`cell-${rowIndex}-${cellIndex}`}>{cell}</TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          );
        } else {
          // Si le parsing du tableau a échoué, afficher le contenu brut
          renderedSections.push(
            <Box key={`actions-${renderedSections.length}`} sx={{ mb: 3 }}>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                <AssignmentIcon color="primary" />
                <Typography variant="h6">Tâches & actions à suivre</Typography>
              </Stack>
              <Typography variant="body1" sx={{ whiteSpace: 'pre-line' }}>
                {actionLines.join('\n')}
              </Typography>
            </Box>
          );
        }
      } else {
        // Pas de format tableau détecté
        renderedSections.push(
          <Box key={`actions-${renderedSections.length}`} sx={{ mb: 3 }}>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
              <AssignmentIcon color="primary" />
              <Typography variant="h6">Tâches & actions à suivre</Typography>
            </Stack>
            <Typography variant="body1" sx={{ whiteSpace: 'pre-line' }}>
              {actionLines.join('\n')}
            </Typography>
          </Box>
        );
      }
    }
    // Ligne de séparation
    else if (line.match(/^---/)) {
      // Traiter la section précédente
      if (sectionType && sectionContent.length > 0) {
        if (sectionType === 'other') {
          renderedSections.push(
            <Box key={`section-${renderedSections.length}`} sx={{ mb: 3 }}>
              <Typography variant="body1" sx={{ whiteSpace: 'pre-line' }}>
                {sectionContent.join('\n')}
              </Typography>
            </Box>
          );
        }
        sectionContent = [];
      }
      sectionType = null;
    }
    // Nouvelle section avec un titre markdown
    else if (line.match(/^#/)) {
      // Traiter la section précédente
      if (sectionType && sectionContent.length > 0) {
        if (sectionType === 'other') {
          renderedSections.push(
            <Box key={`section-${renderedSections.length}`} sx={{ mb: 3 }}>
              <Typography variant="body1" sx={{ whiteSpace: 'pre-line' }}>
                {sectionContent.join('\n')}
              </Typography>
            </Box>
          );
        }
        sectionContent = [];
      }

      // Initialiser une nouvelle section générique
      sectionType = 'other';
      sectionContent.push(line);
    }
    // Contenu standard, ajouter à la section en cours
    else {
      if (!sectionType) {
        sectionType = 'other';
      }
      sectionContent.push(line);
    }
  }

  // Traiter la dernière section si elle existe
  if (sectionType === 'other' && sectionContent.length > 0) {
    renderedSections.push(
      <Box key={`section-${renderedSections.length}`} sx={{ mb: 3 }}>
        <Typography variant="body1" sx={{ whiteSpace: 'pre-line' }}>
          {sectionContent.join('\n')}
        </Typography>
      </Box>
    );
  }

  // Si aucune section spéciale n'a été détectée, afficher le texte brut
  if (renderedSections.length === 0) {
    renderedSections.push(
      <Box key="raw-summary" sx={{ mb: 3 }}>
        <Typography variant="body1" sx={{ whiteSpace: 'pre-line' }}>
          {summaryText}
        </Typography>
      </Box>
    );
  }

  return (
    <Box p={2}>
      {renderedSections}
    </Box>
  );
};

export default MeetingSummaryRenderer;
