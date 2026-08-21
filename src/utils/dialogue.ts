import { Voice, splitIntoChunks } from "../types";

export interface DialogueVoiceMapping {
  tag: string; // e.g. "{{@dlg1}}"
  tagNumber: number; // e.g. 1
  voice: Voice;
}

/**
 * Builds mapping of dialogue tags ({{@dlg1}}, {{@dlg2}}, etc.) to available voices.
 * Rules:
 * - {{@dlg1}} -> Jorge (es-MX-JorgeNeural or name matches "jorge")
 * - {{@dlg2}} -> Alvaro (es-ES-AlvaroNeural or name matches "alvaro")
 * - {{@dlg3}} -> Dalia (es-MX-DaliaNeural or name matches "dalia")
 * - {{@dlg4}}, {{@dlg5}}... -> remaining voices sequentially
 */
export function buildDialogueVoiceMappings(voices: Voice[], defaultVoice: Voice | null): Map<string, Voice> {
  const map = new Map<string, Voice>();
  
  if (!voices || voices.length === 0) {
    if (defaultVoice) {
      map.set("{{@dlg1}}", defaultVoice);
      map.set("{{@dlg2}}", defaultVoice);
      map.set("{{@dlg3}}", defaultVoice);
    }
    return map;
  }

  // Find specifically requested voices:
  // {{@dlg1}} -> Jorge (es-MX-JorgeNeural or name matches "jorge")
  // {{@dlg2}} -> Alvaro (es-ES-AlvaroNeural or name matches "alvaro")
  // {{@dlg3}} -> Dalia (es-MX-DaliaNeural or name matches "dalia")
  const jorge = voices.find(v => v.code === "es-MX-JorgeNeural" || v.name.toLowerCase().includes("jorge")) || voices[0];
  const alvaro = voices.find(v => v.code === "es-ES-AlvaroNeural" || v.name.toLowerCase().includes("alvaro")) || voices[1] || voices[0];
  const dalia = voices.find(v => v.code === "es-MX-DaliaNeural" || v.name.toLowerCase().includes("dalia")) || voices[2] || voices[0];

  map.set("{{@dlg1}}", jorge);
  map.set("{{@dlg2}}", alvaro);
  map.set("{{@dlg3}}", dalia);

  // Other voices excluding the assigned ones or sequentially
  const assignedCodes = new Set([jorge.code, alvaro.code, dalia.code]);
  const remainingVoices = voices.filter(v => !assignedCodes.has(v.code));

  // If there are remaining voices, assign dlg4, dlg5, etc.
  const pool = remainingVoices.length > 0 ? remainingVoices : voices;

  // Map dlg4 up to dlg30
  for (let i = 4; i <= 30; i++) {
    const poolIdx = (i - 4) % pool.length;
    map.set(`{{@dlg${i}}}`, pool[poolIdx]);
  }

  return map;
}

/**
 * Builds a reverse mapping of voice codes (e.g. "es-MX-JorgeNeural") to their assigned dialogue tag (e.g. "{{@dlg1}}").
 */
export function buildVoiceToTagMap(voices: Voice[]): Map<string, string> {
  const tagMap = buildDialogueVoiceMappings(voices, null);
  const voiceToTag = new Map<string, string>();

  tagMap.forEach((voice, tag) => {
    if (voice && !voiceToTag.has(voice.code)) {
      voiceToTag.set(voice.code, tag);
    }
  });

  return voiceToTag;
}

/**
 * Utility to strip all {{@dlgN}} tags and pause tags {{@~MS}} from text for clean text display.
 */
export function cleanDialogueTags(text: string): string {
  return text
    .replace(/\{\{\@dlg\d+\}\}/gi, "")
    .replace(/\{\{\@\~\d+\}\}/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Utility to sanitize text by removing:
 * - Anything inside parentheses (...)
 * - Special symbols (@ # $ & * / € £ ¥ ^ < > \ ¶ |)
 * - Emojis
 * while protecting dialogue tags {{@dlgN}} and pause tags {{@~MS}}.
 */
export function sanitizeTextForCleanReading(text: string): string {
  if (!text) return "";

  // 1. Temporarily protect dialogue tags {{@dlgN}} and pause tags {{@~MS}}
  const dlgTags: string[] = [];
  const pauseTags: string[] = [];

  let protectedText = text
    .replace(/\{\{\@dlg(\d+)\}\}/gi, (_, num) => {
      dlgTags.push(`{{@dlg${num}}}`);
      return `___DLG_TAG_HOLD_${dlgTags.length - 1}___`;
    })
    .replace(/\{\{\@\~(\d+)\}\}/gi, (_, ms) => {
      pauseTags.push(`{{@~${ms}}}`);
      return `___PAUSE_TAG_HOLD_${pauseTags.length - 1}___`;
    });

  // 2. Remove all content within parentheses
  protectedText = protectedText.replace(/\([^)]*\)/g, " ");

  // 3. Remove specified symbols: @ # $ & * / € £ ¥ ^ < > \ ¶ |
  protectedText = protectedText.replace(/[@#$&*\/€£¥^<>\x5C¶|]/g, " ");

  // 4. Remove emojis using Unicode extended pictographic regex
  try {
    protectedText = protectedText.replace(/\p{Extended_Pictographic}/gu, " ");
  } catch (e) {
    // Fallback regex for older runtimes
    protectedText = protectedText.replace(/[\u{1F300}-\u{1F9FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E6}-\u{1F1FF}\u{1F900}-\u{1F9FF}\u{1FA70}-\u{1FAFF}\u{200D}\u{FE0F}]/gu, " ");
  }

  // 5. Restore protected dialogue tags and pause tags
  protectedText = protectedText
    .replace(/___DLG_TAG_HOLD_(\d+)___/g, (_, idx) => dlgTags[parseInt(idx, 10)] || "")
    .replace(/___PAUSE_TAG_HOLD_(\d+)___/g, (_, idx) => pauseTags[parseInt(idx, 10)] || "");

  // 6. Clean up extra spaces
  return protectedText.replace(/\s+/g, " ").trim();
}

export interface DialogueChunk {
  index: number;
  text: string;
  voice: Voice;
  tag: string | null;
  startSentence: number;
  endSentence: number;
  count: number;
}

/**
 * Splits raw input text into dialogue-aware sentence chunks.
 */
export function parseDialogueChunks(
  text: string,
  voices: Voice[],
  defaultVoice: Voice | null,
  sentencesPerChunk: number = 2,
  omitParenthesesAndSymbols: boolean = true
): DialogueChunk[] {
  if (!text.trim()) return [];

  const textToProcess = omitParenthesesAndSymbols ? sanitizeTextForCleanReading(text) : text;
  if (!textToProcess.trim()) return [];

  const mappings = buildDialogueVoiceMappings(voices, defaultVoice);
  const fallbackVoice = defaultVoice || voices[0] || { 
    code: "es-MX-JorgeNeural", 
    name: "Jorge", 
    country: "México", 
    gender: "male", 
    locale: "es-MX", 
    fullName: "Jorge (México)" 
  };

  const tagRegex = /\{\{\@dlg(\d+)\}\}/i;
  const lines = textToProcess.split(/\n+/);
  
  interface RawSentenceWithVoice {
    rawText: string;
    cleanText: string;
    ttsText: string;
    voice: Voice;
    tag: string | null;
  }

  const parsedSentences: RawSentenceWithVoice[] = [];
  let currentTag: string | null = null;
  let currentVoice: Voice = fallbackVoice;

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine) continue;

    // Tokenize line by dialogue tags
    const tokens = trimmedLine.split(/(\{\{\@dlg\d+\}\})/i);

    for (const token of tokens) {
      if (!token) continue;

      const tagMatch = token.match(tagRegex);
      if (tagMatch) {
        const fullTag = tagMatch[0].toLowerCase();
        currentTag = fullTag;
        if (mappings.has(fullTag)) {
          currentVoice = mappings.get(fullTag)!;
        }
        continue;
      }

      // Token is standard text, split by sentence punctuation (. ! ? …)
      const sentenceParts = token.split(/(?<=[.!?…])\s+/);
      for (const part of sentenceParts) {
        const cleanPart = cleanDialogueTags(part);
        const ttsPart = part.replace(/\{\{\@dlg\d+\}\}/gi, "").replace(/\s+/g, " ").trim();
        if (cleanPart || ttsPart) {
          parsedSentences.push({
            rawText: part.trim(),
            cleanText: cleanPart,
            ttsText: ttsPart,
            voice: currentVoice,
            tag: currentTag,
          });
        }
      }
    }
  }

  if (parsedSentences.length === 0) return [];

  // Group sentences into chunks based on sentencesPerChunk,
  // BUT break chunk whenever tag or voice changes!
  const chunks: DialogueChunk[] = [];
  let currentGroup: RawSentenceWithVoice[] = [];
  let groupStartNum = 1;

  for (let i = 0; i < parsedSentences.length; i++) {
    const s = parsedSentences[i];

    if (currentGroup.length === 0) {
      currentGroup.push(s);
      groupStartNum = i + 1;
    } else {
      const sameTag = currentGroup[0].tag === s.tag;
      const sameVoice = currentGroup[0].voice.code === s.voice.code;
      if (sameTag && sameVoice && currentGroup.length < sentencesPerChunk) {
        currentGroup.push(s);
      } else {
        chunks.push({
          index: chunks.length,
          text: currentGroup.map(item => item.ttsText).join(" "),
          voice: currentGroup[0].voice,
          tag: currentGroup[0].tag,
          startSentence: groupStartNum,
          endSentence: groupStartNum + currentGroup.length - 1,
          count: currentGroup.length,
        });

        currentGroup = [s];
        groupStartNum = i + 1;
      }
    }
  }

  if (currentGroup.length > 0) {
    chunks.push({
      index: chunks.length,
      text: currentGroup.map(item => item.ttsText).join(" "),
      voice: currentGroup[0].voice,
      tag: currentGroup[0].tag,
      startSentence: groupStartNum,
      endSentence: groupStartNum + currentGroup.length - 1,
      count: currentGroup.length,
    });
  }

  return chunks;
}

export interface DialogueSegmentForSynthesis {
  text: string;
  voiceCode: string;
  voiceName: string;
}

/**
 * Parses raw text into dialogue segments grouped by voice for full synthesis / concatenation.
 * Stitches continuous sentences of the same voice together while ensuring clean tag removal.
 */
export function parseDialogueSegmentsForSynthesis(
  text: string,
  voices: Voice[],
  defaultVoice: Voice | null,
  omitParenthesesAndSymbols: boolean = true
): DialogueSegmentForSynthesis[] {
  if (!text.trim()) return [];

  // Split into sentence chunks with a sentence limit per chunk (50) to group same voice
  const chunks = parseDialogueChunks(text, voices, defaultVoice, 50, omitParenthesesAndSymbols);

  const segments: DialogueSegmentForSynthesis[] = [];

  for (const chunk of chunks) {
    if (!chunk.text.trim()) continue;

    // Even if a chunk is huge (e.g., 20,000+ characters), split into safe sub-chunks of max 3500 chars
    const safeSubChunks = splitIntoChunks(chunk.text, 3500);

    for (const subText of safeSubChunks) {
      if (!subText.trim()) continue;

      if (segments.length > 0) {
        const last = segments[segments.length - 1];
        // If voice is the same and combined length is under 3500 characters, merge
        if (last.voiceCode === chunk.voice.code && (last.text.length + subText.length) < 3500) {
          last.text = (last.text + " " + subText).trim();
          continue;
        }
      }

      segments.push({
        text: subText,
        voiceCode: chunk.voice.code,
        voiceName: chunk.voice.name,
      });
    }
  }

  return segments;
}
