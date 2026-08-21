/**
 * Utilities for formatting and extracting appropriate names for
 * Debates, Podcasts, and General synthesized audio recordings.
 */

/**
 * Extracts a topic summary from raw text/dialogue.
 */
export function extractTopicFromContent(text: string): string {
  if (!text || !text.trim()) return "";

  const lines = text.split("\n");
  for (const rawLine of lines) {
    let line = rawLine.trim();
    if (!line) continue;

    // Check for chapter headers like "=== Capítulo 1: El Reino de los Cielos ===" or "Capítulo 1: ..."
    const chapterMatch = line.match(/^={0,4}\s*(?:Capítulo|Cap\.|Tema)\s*\d*\s*[:\-–—]?\s*(.*?)\s*={0,4}$/i);
    if (chapterMatch && chapterMatch[1]?.trim()) {
      return cleanTopicString(chapterMatch[1].trim());
    }

    // Strip dialogue tags {{@dlg1}} and pauses {{@~500}}
    line = line.replace(/\{\{@dlg\d+\}\}/gi, "").replace(/\{\{@\~\d+\}\}/gi, "").trim();

    // Strip speaker names at start like "Gerardo:", "Jorge:"
    line = line.replace(/^(?:Gerardo|Jorge|Juan|Rosa|[A-Za-zÁÉÍÓÚáéíóúñÑ]+)\s*[:\-–—]\s*/i, "").trim();

    if (line.length > 5) {
      // Return first 50 chars as topic
      const clean = cleanTopicString(line);
      if (clean.length > 50) {
        return clean.slice(0, 50).trim() + "...";
      }
      return clean;
    }
  }

  return "";
}

/**
 * Removes surrounding quotes, unwanted symbols, and trims whitespace.
 */
function cleanTopicString(str: string): string {
  return str
    .replace(/^["'«»“”`]+|["'«»“”`]+$/g, "")
    .replace(/[^\w\s\u00C0-\u024F\-\,\.\?]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Formats a Debate title.
 * Always ensures the name starts with "Debate - <Topic>" or "Debate: <Topic>" as requested:
 * "cuando sea el caso de un debate siempre aparecerá primero la palabra debate y luego de qué se trata el debate"
 */
export function formatDebateTitle(rawTopic: string): string {
  const trimmed = rawTopic.trim();
  if (!trimmed) {
    return "Debate - Tema Principal";
  }

  // Remove leading "debate" variations e.g. "Debate sobre el libre albedrío", "Debate:", "Debate -"
  let cleanTopic = trimmed;
  const debatePrefixRegex = /^debate\s*(?:sobre|acerca\s+de|de|entre|respecto\s+a|en\s+torno\s+a)?\s*[:\-–—]?\s*/i;
  
  if (debatePrefixRegex.test(cleanTopic)) {
    const afterPrefix = cleanTopic.replace(debatePrefixRegex, "").trim();
    if (afterPrefix) {
      cleanTopic = afterPrefix;
    }
  }

  // Capitalize the first letter of the topic
  if (cleanTopic.length > 0) {
    cleanTopic = cleanTopic.charAt(0).toUpperCase() + cleanTopic.slice(1);
  }

  return `Debate - ${cleanTopic}`;
}

/**
 * Formats a Podcast title.
 * Ensures the name is appropriate, starting with "Podcast - <Topic>".
 */
export function formatPodcastTitle(rawTopic: string): string {
  const trimmed = rawTopic.trim();
  if (!trimmed) {
    return "Podcast - Enseñanza y Reflexión";
  }

  // Remove leading "podcast" variations
  let cleanTopic = trimmed;
  const podcastPrefixRegex = /^podcast\s*(?:jw|enseñanza|sobre|acerca\s+de|de|respecto\s+a)?\s*[:\-–—]?\s*/i;

  if (podcastPrefixRegex.test(cleanTopic)) {
    const afterPrefix = cleanTopic.replace(podcastPrefixRegex, "").trim();
    if (afterPrefix) {
      cleanTopic = afterPrefix;
    }
  }

  if (cleanTopic.length > 0) {
    cleanTopic = cleanTopic.charAt(0).toUpperCase() + cleanTopic.slice(1);
  }

  return `Podcast - ${cleanTopic}`;
}

/**
 * Sanitizes a file name for downloading (safe across Windows, macOS, Linux).
 */
export function sanitizeFileName(name: string, fallback = "Audio_TTS"): string {
  if (!name || !name.trim()) return fallback;

  let cleaned = name.trim();

  // Strip trailing .mp3 if present so we can append cleanly
  if (cleaned.toLowerCase().endsWith(".mp3")) {
    cleaned = cleaned.slice(0, -4).trim();
  }

  // Replace invalid filename characters \ / : * ? " < > |
  cleaned = cleaned.replace(/[\\/:*?"<>|]/g, "-");
  
  // Collapse multiple spaces or dashes
  cleaned = cleaned.replace(/\s+/g, " ").replace(/-+/g, "-").trim();

  // Remove leading/trailing dots or dashes
  cleaned = cleaned.replace(/^[.\-_]+|[.\-_]+$/g, "").trim();

  return cleaned || fallback;
}
