const ASSEMBLY_AI_API_KEY = '3419005ee6924e08a14235043cabcd4e';
const ASSEMBLY_AI_API_URL = 'https://api.assemblyai.com/v2';

interface TranscriptionResponse {
  id: string;
  status: 'queued' | 'processing' | 'completed' | 'error';
  text?: string;
  audio_duration?: number;
  speaker_labels?: boolean;
  speakers_expected?: number;
  confidence?: number;
  error?: string;
}

export async function uploadAudio(audioFile: File): Promise<string> {
  const formData = new FormData();
  formData.append('audio', audioFile);

  const response = await fetch(`${ASSEMBLY_AI_API_URL}/upload`, {
    method: 'POST',
    headers: {
      'authorization': ASSEMBLY_AI_API_KEY
    },
    body: formData
  });

  if (!response.ok) {
    throw new Error('Failed to upload audio file');
  }

  const { upload_url } = await response.json();
  return upload_url;
}

export async function startTranscription(audioUrl: string): Promise<string> {
  const response = await fetch(`${ASSEMBLY_AI_API_URL}/transcript`, {
    method: 'POST',
    headers: {
      'authorization': ASSEMBLY_AI_API_KEY,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      audio_url: audioUrl,
      speaker_labels: true
    })
  });

  if (!response.ok) {
    throw new Error('Failed to start transcription');
  }

  const { id } = await response.json();
  return id;
}

export async function getTranscriptionStatus(transcriptId: string): Promise<TranscriptionResponse> {
  const response = await fetch(`${ASSEMBLY_AI_API_URL}/transcript/${transcriptId}`, {
    headers: {
      'authorization': ASSEMBLY_AI_API_KEY,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to get transcription status');
  }

  return response.json();
}

export async function transcribeAudio(file: File): Promise<TranscriptionResponse> {
  try {
    // Upload the audio file
    const uploadUrl = await uploadAudio(file);
    console.log('Audio uploaded successfully');

    // Start the transcription
    const transcriptId = await startTranscription(uploadUrl);
    console.log('Transcription started', transcriptId);

    // Poll for completion
    let result: TranscriptionResponse;
    do {
      await new Promise(resolve => setTimeout(resolve, 3000)); // Wait 3 seconds between polls
      result = await getTranscriptionStatus(transcriptId);
      console.log('Transcription status:', result.status);
    } while (result.status === 'queued' || result.status === 'processing');

    if (result.status === 'error') {
      throw new Error(result.error || 'Transcription failed');
    }

    return result;
  } catch (error) {
    console.error('Transcription error:', error);
    throw error;
  }
}
