import JSZip from "jszip";

export interface EpubChapter {
  id: string;
  title: string;
  href: string;
  filePath: string;
  text: string;
  index: number;
}

export interface EpubBook {
  title: string;
  author: string;
  chapters: EpubChapter[];
  coverUrl?: string;
}

export async function parseEpubFile(file: File): Promise<EpubBook> {
  const zip = await JSZip.loadAsync(file);

  // 1. Locate container.xml
  const containerFile = zip.file("META-INF/container.xml");
  if (!containerFile) {
    throw new Error("El archivo EPUB es inválido (no se encontró META-INF/container.xml).");
  }

  const containerXmlStr = await containerFile.async("text");
  const xmlParser = new DOMParser();
  const containerDoc = xmlParser.parseFromString(containerXmlStr, "text/xml");
  const rootfileEl = containerDoc.querySelector("rootfile");
  const opfPath = rootfileEl?.getAttribute("full-path");

  if (!opfPath) {
    throw new Error("No se pudo localizar la ruta del archivo OPF en el paquete EPUB.");
  }

  const opfFile = zip.file(opfPath);
  if (!opfFile) {
    throw new Error(`No se encontró el archivo OPF en la ruta: ${opfPath}`);
  }

  // Directory of the OPF file (e.g. "OEBPS/" or "EPUB/")
  const opfDir = opfPath.includes("/") ? opfPath.substring(0, opfPath.lastIndexOf("/") + 1) : "";

  const opfXmlStr = await opfFile.async("text");
  const opfDoc = xmlParser.parseFromString(opfXmlStr, "text/xml");

  // Extract Metadata
  const titleEl = opfDoc.querySelector("title") || opfDoc.getElementsByTagNameNS("*", "title")[0];
  const creatorEl = opfDoc.querySelector("creator") || opfDoc.getElementsByTagNameNS("*", "creator")[0];

  const bookTitle = titleEl?.textContent?.trim() || file.name.replace(/\.epub$/i, "");
  const bookAuthor = creatorEl?.textContent?.trim() || "Autor desconocido";

  // Manifest mapping
  const manifestMap = new Map<string, { href: string; mediaType: string; properties?: string }>();
  const manifestItems = opfDoc.querySelectorAll("manifest > item, item");
  manifestItems.forEach((item) => {
    const id = item.getAttribute("id");
    const href = item.getAttribute("href");
    const mediaType = item.getAttribute("media-type");
    const properties = item.getAttribute("properties");
    if (id && href) {
      manifestMap.set(id, { href, mediaType: mediaType || "", properties: properties || "" });
    }
  });

  // Spine order
  const spineItemRefs = opfDoc.querySelectorAll("spine > itemref, itemref");
  const spineIds: string[] = [];
  spineItemRefs.forEach((itemref) => {
    const idref = itemref.getAttribute("idref");
    if (idref) {
      spineIds.push(idref);
    }
  });

  // Check TOC (ncx or nav)
  let ncxHref: string | null = null;
  const spineEl = opfDoc.querySelector("spine");
  const ncxId = spineEl?.getAttribute("toc");
  if (ncxId && manifestMap.has(ncxId)) {
    ncxHref = manifestMap.get(ncxId)!.href;
  } else {
    // Look for ncx media-type
    manifestMap.forEach((val) => {
      if (val.mediaType === "application/x-dtbncx+xml") {
        ncxHref = val.href;
      }
    });
  }

  // Helper to resolve relative zip paths
  const resolveZipPath = (baseDir: string, relativePath: string): string => {
    const cleanPath = relativePath.split("#")[0].split("?")[0];
    const combined = baseDir + cleanPath;
    const parts = combined.split("/");
    const stack: string[] = [];
    for (const part of parts) {
      if (part === "" || part === ".") continue;
      if (part === "..") {
        stack.pop();
      } else {
        stack.push(part);
      }
    }
    return stack.join("/");
  };

  // Helper to extract clean text from HTML
  const extractTextFromHtml = (htmlContent: string): { title: string; text: string } => {
    const doc = xmlParser.parseFromString(htmlContent, "text/html");
    // Remove script, style, head, svg, noscript
    doc.querySelectorAll("script, style, head, svg, noscript").forEach((el) => el.remove());

    // Extract title if present
    const h1 = doc.querySelector("h1, h2, h3, title");
    const extractedTitle = h1?.textContent?.trim() || "";

    // Convert block elements to newlines
    const blockTags = ["p", "div", "h1", "h2", "h3", "h4", "h5", "h6", "li", "section", "article", "blockquote", "br"];
    blockTags.forEach((tag) => {
      doc.querySelectorAll(tag).forEach((el) => {
        el.before(document.createTextNode("\n\n"));
        el.after(document.createTextNode("\n\n"));
      });
    });

    const rawText = doc.body ? doc.body.textContent || "" : doc.textContent || "";
    const cleanLines = rawText
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    return {
      title: extractedTitle,
      text: cleanLines.join("\n\n")
    };
  };

  // TOC Entries
  interface TocEntry {
    title: string;
    href: string;
  }
  const tocEntries: TocEntry[] = [];

  if (ncxHref) {
    const fullNcxPath = resolveZipPath(opfDir, ncxHref);
    const ncxFile = zip.file(fullNcxPath);
    if (ncxFile) {
      const ncxXmlStr = await ncxFile.async("text");
      const ncxDoc = xmlParser.parseFromString(ncxXmlStr, "text/xml");
      const navPoints = ncxDoc.querySelectorAll("navPoint");
      navPoints.forEach((np) => {
        const textEl = np.querySelector("navLabel > text, text");
        const contentEl = np.querySelector("content");
        const t = textEl?.textContent?.trim();
        const src = contentEl?.getAttribute("src");
        if (t && src) {
          tocEntries.push({ title: t, href: src });
        }
      });
    }
  }

  // Map spine items to chapters
  const chapters: EpubChapter[] = [];
  let chapterIndex = 0;

  for (const spineId of spineIds) {
    const item = manifestMap.get(spineId);
    if (!item || !item.href) continue;

    const fullPath = resolveZipPath(opfDir, item.href);
    const zipFile = zip.file(fullPath);
    if (!zipFile) continue;

    const htmlContent = await zipFile.async("text");
    const { title: inlineTitle, text } = extractTextFromHtml(htmlContent);

    // Skip if text is empty or negligible (e.g. cover/blank pages without text)
    if (!text || text.trim().length < 5) continue;

    // Try finding title from TOC entries matching this href, or inline title, or fallback
    const matchingToc = tocEntries.find((e) => e.href.includes(item.href) || item.href.includes(e.href));
    const chapterTitle = matchingToc?.title || inlineTitle || `Capítulo ${chapterIndex + 1}`;

    chapters.push({
      id: `epub-chap-${chapterIndex}-${spineId}`,
      title: chapterTitle,
      href: item.href,
      filePath: fullPath,
      text,
      index: chapterIndex
    });

    chapterIndex++;
  }

  if (chapters.length === 0) {
    throw new Error("No se pudo extraer contenido de texto legible del archivo EPUB.");
  }

  return {
    title: bookTitle,
    author: bookAuthor,
    chapters
  };
}
