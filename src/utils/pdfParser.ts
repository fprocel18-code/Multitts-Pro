import * as pdfjsLib from "pdfjs-dist";

// Configure worker for pdfjs-dist
try {
  // Use cloudflare CDN or unpkg fallback if bundler worker isn't loaded
  if (typeof window !== "undefined") {
    // Attempt local or fallback CDN worker matching the pdfjs-dist version
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version || "4.10.38"}/pdf.worker.min.mjs`;
  }
} catch (e) {
  console.warn("Could not set PDF worker source:", e);
}

export interface PdfChapter {
  id: string;
  title: string;
  text: string;
  index: number;
  startPage: number;
  endPage: number;
  level?: number;
}

export interface PdfBook {
  title: string;
  author: string;
  totalPages: number;
  chapters: PdfChapter[];
  hasEmbeddedOutline: boolean;
}

interface OutlineNode {
  title: string;
  dest: any;
  items?: OutlineNode[];
}

/**
 * Resolves a PDF destination to a 1-based page number
 */
async function resolvePageNumber(doc: any, dest: any): Promise<number | null> {
  try {
    let explicitDest = dest;
    if (typeof dest === "string") {
      explicitDest = await doc.getDestination(dest);
    }

    if (Array.isArray(explicitDest) && explicitDest.length > 0) {
      const destRef = explicitDest[0];
      if (destRef && typeof destRef === "object") {
        const pageIndex = await doc.getPageIndex(destRef);
        return pageIndex + 1; // 1-based
      }
    } else if (typeof explicitDest === "number") {
      return explicitDest + 1;
    }
  } catch (err) {
    console.warn("Could not resolve PDF destination to page number:", err);
  }
  return null;
}

/**
 * Extracts clean, human-readable text from a single PDF page
 */
async function extractPageText(page: any): Promise<string> {
  const textContent = await page.getTextContent();
  if (!textContent || !textContent.items || textContent.items.length === 0) {
    return "";
  }

  let pageText = "";
  let lastY: number | null = null;

  for (const item of textContent.items as any[]) {
    const str = item.str || "";
    if (!str && !item.hasEOL) continue;

    // Detect new lines based on Y coordinate change
    const transform = item.transform;
    const currentY = transform && transform.length >= 6 ? transform[5] : null;

    if (lastY !== null && currentY !== null && Math.abs(currentY - lastY) > 8) {
      pageText += "\n";
    } else if (pageText.length > 0 && !pageText.endsWith("\n") && !pageText.endsWith(" ")) {
      pageText += " ";
    }

    pageText += str;
    if (item.hasEOL) {
      pageText += "\n";
    }

    lastY = currentY;
  }

  // Clean up excessive whitespace but preserve paragraph breaks
  return pageText
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Main parser function for PDF files
 */
export async function parsePdfFile(file: File): Promise<PdfBook> {
  const arrayBuffer = await file.arrayBuffer();

  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(arrayBuffer),
    cMapUrl: "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/cmaps/",
    cMapPacked: true,
  });

  const doc = await loadingTask.promise;
  const numPages = doc.numPages;

  if (numPages === 0) {
    throw new Error("El archivo PDF no contiene páginas legibles.");
  }

  // 1. Extract Metadata
  let bookTitle = file.name.replace(/\.pdf$/i, "");
  let bookAuthor = "Autor desconocido";

  try {
    const meta = await doc.getMetadata();
    const info = meta?.info as any;
    if (info) {
      if (info.Title && info.Title.trim().length > 1) {
        bookTitle = info.Title.trim();
      }
      if (info.Author && info.Author.trim().length > 1) {
        bookAuthor = info.Author.trim();
      }
    }
  } catch (err) {
    console.warn("No se pudieron leer los metadatos del PDF:", err);
  }

  // 2. Extract Text from all pages
  const pageTexts: { pageNum: number; text: string }[] = [];
  for (let p = 1; p <= numPages; p++) {
    const page = await doc.getPage(p);
    const text = await extractPageText(page);
    pageTexts.push({ pageNum: p, text });
  }

  // 3. Try Extracting Embedded Outline (TOC / Bookmarks)
  let rawOutline: OutlineNode[] | null = null;
  try {
    rawOutline = (await doc.getOutline()) as OutlineNode[] | null;
  } catch (err) {
    console.warn("No se pudo obtener el esquema (outline) del PDF:", err);
  }

  interface FlatOutlineItem {
    title: string;
    pageNum: number;
    level: number;
  }

  const flattenedOutline: FlatOutlineItem[] = [];

  if (rawOutline && rawOutline.length > 0) {
    const traverseOutline = async (nodes: OutlineNode[], currentLevel = 0) => {
      for (const node of nodes) {
        if (node.title && node.dest) {
          const pageNum = await resolvePageNumber(doc, node.dest);
          if (pageNum && pageNum >= 1 && pageNum <= numPages) {
            flattenedOutline.push({
              title: node.title.trim(),
              pageNum,
              level: currentLevel,
            });
          }
        }
        if (node.items && node.items.length > 0) {
          await traverseOutline(node.items, currentLevel + 1);
        }
      }
    };

    await traverseOutline(rawOutline);
  }

  const chapters: PdfChapter[] = [];

  if (flattenedOutline.length > 0) {
    // Sort outline entries by page number
    flattenedOutline.sort((a, b) => a.pageNum - b.pageNum);

    // Filter duplicates on identical page or clean up
    const distinctOutline: FlatOutlineItem[] = [];
    for (const item of flattenedOutline) {
      const existing = distinctOutline.find((x) => x.pageNum === item.pageNum && x.title === item.title);
      if (!existing) {
        distinctOutline.push(item);
      }
    }

    // Build chapters based on outline entries
    for (let i = 0; i < distinctOutline.length; i++) {
      const current = distinctOutline[i];
      const startPage = current.pageNum;
      const endPage = i < distinctOutline.length - 1 ? Math.max(startPage, distinctOutline[i + 1].pageNum - 1) : numPages;

      // Concatenate text for this range of pages
      const chapterPages = pageTexts.filter((p) => p.pageNum >= startPage && p.pageNum <= endPage);
      const chapterText = chapterPages
        .map((p) => `[Página ${p.pageNum}]\n${p.text}`)
        .filter((t) => t.trim().length > 0)
        .join("\n\n");

      chapters.push({
        id: `pdf-chap-${i + 1}`,
        title: current.title || `Capítulo ${i + 1}`,
        text: chapterText || `(Sin texto reconocible en páginas ${startPage}-${endPage})`,
        index: i,
        startPage,
        endPage,
        level: current.level,
      });
    }
  }

  // 4. Fallback: If no outline or outline yielded no valid chapters, detect headings or chunk pages
  if (chapters.length === 0) {
    // Attempt auto-detection of chapter titles in pages
    const detectedHeadings: { pageNum: number; title: string }[] = [];

    const headingRegex = /^(?:cap[ií]tulo|cap\.|tema|secci[oó]n|parte|unidad|lecci[oó]n|m[oó]dulo)\s+([0-9ivxlcdm]+[\s:.-]*[^\n]{0,80})/i;

    pageTexts.forEach(({ pageNum, text }) => {
      const firstLines = text.split("\n").slice(0, 4);
      for (const line of firstLines) {
        const trimmed = line.trim();
        const match = trimmed.match(headingRegex);
        if (match) {
          detectedHeadings.push({
            pageNum,
            title: trimmed.length > 80 ? trimmed.substring(0, 80) + "..." : trimmed,
          });
          break;
        }
      }
    });

    if (detectedHeadings.length > 1) {
      // Build chapters from detected headings
      for (let i = 0; i < detectedHeadings.length; i++) {
        const current = detectedHeadings[i];
        const startPage = current.pageNum;
        const endPage = i < detectedHeadings.length - 1 ? Math.max(startPage, detectedHeadings[i + 1].pageNum - 1) : numPages;

        const chapterPages = pageTexts.filter((p) => p.pageNum >= startPage && p.pageNum <= endPage);
        const chapterText = chapterPages
          .map((p) => `[Página ${p.pageNum}]\n${p.text}`)
          .join("\n\n");

        chapters.push({
          id: `pdf-detected-${i + 1}`,
          title: current.title,
          text: chapterText,
          index: i,
          startPage,
          endPage,
        });
      }
    } else {
      // Page grouping strategy
      // If <= 10 pages: 1 chapter per page
      // If > 10 pages: group in 3 to 5 pages blocks
      const groupSize = numPages <= 10 ? 1 : numPages <= 30 ? 3 : 5;
      let chapIndex = 0;

      for (let start = 1; start <= numPages; start += groupSize) {
        const end = Math.min(start + groupSize - 1, numPages);
        const chapterPages = pageTexts.filter((p) => p.pageNum >= start && p.pageNum <= end);
        const chapterText = chapterPages
          .map((p) => `[Página ${p.pageNum}]\n${p.text}`)
          .join("\n\n");

        const pageLabel = start === end ? `Página ${start}` : `Páginas ${start} a ${end}`;
        
        // Find a first meaningful snippet for subtitle if available
        const firstPageText = chapterPages[0]?.text || "";
        const snippet = firstPageText.split("\n")[0]?.slice(0, 45).trim();
        const fullTitle = snippet ? `${pageLabel} — ${snippet}` : pageLabel;

        chapters.push({
          id: `pdf-group-${chapIndex + 1}`,
          title: fullTitle,
          text: chapterText,
          index: chapIndex,
          startPage: start,
          endPage: end,
        });

        chapIndex++;
      }
    }
  }

  return {
    title: bookTitle,
    author: bookAuthor,
    totalPages: numPages,
    chapters,
    hasEmbeddedOutline: (rawOutline && rawOutline.length > 0) || false,
  };
}
