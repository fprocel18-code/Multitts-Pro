export interface Voice {
  code: string;
  name: string;
  country: string;
  gender: "male" | "female";
  locale: string;
  fullName: string;
}

export interface HistoryItem {
  id: string;
  title?: string;
  text: string;
  voiceCode: string;
  voiceName: string;
  country: string;
  gender: "male" | "female";
  timestamp: number;
  audioUrl: string;
  rate: number;
  pitch: number;
}

// Helper to split text into clean sentences
export function splitIntoSentences(text: string): string[] {
  if (!text) return [];
  const lines = text.split(/\n+/);
  const result: string[] = [];
  
  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine) continue;
    
    // Split line by sentence endings (. ! ? ¿ ¡)
    const parts = trimmedLine.split(/(?<=[.!?¿¡])\s+/);
    for (const part of parts) {
      const p = part.trim();
      if (p) {
        result.push(p);
      }
    }
  }
  return result;
}

// Helper to split text into chunks of at most maxChunkSize characters, keeping sentences intact
export function splitIntoChunks(text: string, maxChunkSize = 4500): string[] {
  const sentences = splitIntoSentences(text);
  const chunks: string[] = [];
  let currentChunk = "";

  for (const sentence of sentences) {
    if (sentence.length > maxChunkSize) {
      // Single sentence is longer than the max size, we must force-split it by words
      if (currentChunk.trim()) {
        chunks.push(currentChunk.trim());
        currentChunk = "";
      }
      
      const words = sentence.split(/\s+/);
      let wordChunk = "";
      for (const word of words) {
        if ((wordChunk + " " + word).length > maxChunkSize) {
          if (wordChunk.trim()) {
            chunks.push(wordChunk.trim());
          }
          wordChunk = word;
        } else {
          wordChunk = wordChunk ? wordChunk + " " + word : word;
        }
      }
      if (wordChunk.trim()) {
        currentChunk = wordChunk;
      }
    } else {
      if ((currentChunk + " " + sentence).length > maxChunkSize) {
        if (currentChunk.trim()) {
          chunks.push(currentChunk.trim());
        }
        currentChunk = sentence;
      } else {
        currentChunk = currentChunk ? currentChunk + " " + sentence : sentence;
      }
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

