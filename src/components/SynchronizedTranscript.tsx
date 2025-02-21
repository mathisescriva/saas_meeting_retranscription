import React, { useEffect, useState } from 'react';
import { Box, Typography } from '@mui/material';

interface Word {
  text: string;
  start: number;
  end: number;
  confidence: number;
}

interface Utterance {
  speaker: string;
  text: string;
  start: number;
  end: number;
  words?: Word[];
}

interface SynchronizedTranscriptProps {
  utterances: Utterance[];
  currentTime: number;
}

const SynchronizedTranscript: React.FC<SynchronizedTranscriptProps> = ({
  utterances,
  currentTime,
}) => {
  const [activeWordIndex, setActiveWordIndex] = useState<number | null>(null);

  useEffect(() => {
    // Trouver le mot actif en fonction du temps actuel
    let foundActiveWord = false;
    
    for (const utterance of utterances) {
      if (utterance.words) {
        for (let i = 0; i < utterance.words.length; i++) {
          const word = utterance.words[i];
          if (currentTime * 1000 >= word.start && currentTime * 1000 <= word.end) {
            setActiveWordIndex(i);
            foundActiveWord = true;
            break;
          }
        }
      }
      if (foundActiveWord) break;
    }

    if (!foundActiveWord) {
      setActiveWordIndex(null);
    }
  }, [currentTime, utterances]);

  return (
    <Box sx={{ mt: 2 }}>
      {utterances.map((utterance, utteranceIndex) => (
        <Box
          key={utteranceIndex}
          sx={{
            display: 'flex',
            mb: 2,
            gap: 2,
          }}
        >
          <Box
            sx={{
              width: 4,
              flexShrink: 0,
              bgcolor: `speaker.${parseInt(utterance.speaker.slice(-1)) % 8}`,
              borderRadius: 1,
            }}
          />
          <Box>
            <Typography
              variant="subtitle2"
              sx={{ color: 'text.secondary', mb: 0.5 }}
            >
              {utterance.speaker}
            </Typography>
            <Typography variant="body1">
              {utterance.words?.map((word, wordIndex) => (
                <Box
                  key={wordIndex}
                  component="span"
                  sx={{
                    display: 'inline-block',
                    backgroundColor:
                      utteranceIndex === Math.floor(activeWordIndex! / (utterance.words?.length || 1)) &&
                      wordIndex === activeWordIndex! % (utterance.words?.length || 1)
                        ? 'rgba(25, 118, 210, 0.12)'
                        : 'transparent',
                    borderRadius: 0.5,
                    transition: 'background-color 0.2s',
                    px: 0.5,
                  }}
                >
                  {word.text}{' '}
                </Box>
              ))}
            </Typography>
          </Box>
        </Box>
      ))}
    </Box>
  );
};

export default SynchronizedTranscript;
