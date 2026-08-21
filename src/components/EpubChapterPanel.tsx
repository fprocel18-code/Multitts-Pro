import React, { useState, useRef } from "react";
import {
  BookOpen,
  UploadCloud,
  ChevronRight,
  ChevronLeft,
  ListOrdered,
  X,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  FileText,
  Sparkles,
  AlertCircle,
  Loader2,
  File,
  Layers,
  Search,
  CheckSquare,
  Square,
  ArrowRight,
  SlidersHorizontal
} from "lucide-react";
import { parseEpubFile } from "../utils/epubParser";
import { parsePdfFile } from "../utils/pdfParser";

export interface DocumentChapter {
  id: string;
  title: string;
  text: string;
  index: number;
  startPage?: number;
  endPage?: number;
  level?: number;
}

export interface LoadedDocument {
  type: "epub" | "pdf";
  title: string;
  author: string;
  totalPages?: number;
  chapters: DocumentChapter[];
  hasEmbeddedOutline?: boolean;
  fileName: string;
}

interface EpubChapterPanelProps {
  onSelectChapterText: (text: string, chapterTitle: string, bookTitle: string) => void;
  currentText: string;
  onChapterFinished?: () => void;
}

export default function EpubChapterPanel({
  onSelectChapterText,
  currentText,
}: EpubChapterPanelProps) {
  const [doc, setDoc] = useState<LoadedDocument | null>(null);
  const [selectedChapterIndex, setSelectedChapterIndex] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadingStatus, setLoadingStatus] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [isSchemeOpen, setIsSchemeOpen] = useState<boolean>(true);
  const [searchFilter, setSearchFilter] = useState<string>("");
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Multi-chapter selection states
  const [isMultiSelectMode, setIsMultiSelectMode] = useState<boolean>(false);
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);
  const [rangeStart, setRangeStart] = useState<number>(1);
  const [rangeEnd, setRangeEnd] = useState<number>(2);
  const [includeChapterHeaders, setIncludeChapterHeaders] = useState<boolean>(true);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processFile(file);
  };

  const combineAndLoadChapters = (
    document: LoadedDocument,
    indices: number[],
    withHeaders = includeChapterHeaders
  ) => {
    if (indices.length === 0) return;
    const sorted = Array.from(new Set(indices)).sort((a, b) => a - b);

    if (sorted.length === 1) {
      const singleChap = document.chapters[sorted[0]];
      if (singleChap) {
        setSelectedChapterIndex(sorted[0]);
        onSelectChapterText(singleChap.text, singleChap.title, document.title);
      }
      return;
    }

    const combinedChunks: string[] = [];
    for (const idx of sorted) {
      const chap = document.chapters[idx];
      if (!chap) continue;
      if (withHeaders) {
        combinedChunks.push(`=== ${chap.title.toUpperCase()} ===\n\n${chap.text.trim()}`);
      } else {
        combinedChunks.push(chap.text.trim());
      }
    }

    const combinedText = combinedChunks.join("\n\n\n");
    const firstIdx = sorted[0] + 1;
    const lastIdx = sorted[sorted.length - 1] + 1;
    const summaryTitle = `Capítulos ${firstIdx}-${lastIdx} (${sorted.length} caps)`;

    setSelectedChapterIndex(sorted[0]);
    onSelectChapterText(combinedText, summaryTitle, document.title);
  };

  const processFile = async (file: File) => {
    const fileNameLower = file.name.toLowerCase();
    const isEpub = fileNameLower.endsWith(".epub");
    const isPdf = fileNameLower.endsWith(".pdf");

    if (!isEpub && !isPdf) {
      setError("Formato no soportado. Por favor selecciona un archivo .epub o .pdf");
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      let loadedDoc: LoadedDocument;

      if (isEpub) {
        setLoadingStatus("Leyendo estructura y capítulos del EPUB...");
        const parsedEpub = await parseEpubFile(file);
        
        loadedDoc = {
          type: "epub",
          title: parsedEpub.title,
          author: parsedEpub.author,
          chapters: parsedEpub.chapters.map((chap) => ({
            id: chap.id,
            title: chap.title,
            text: chap.text,
            index: chap.index,
          })),
          fileName: file.name,
        };
      } else {
        setLoadingStatus("Extrayendo páginas y esquema de capítulos del PDF...");
        const parsedPdf = await parsePdfFile(file);

        loadedDoc = {
          type: "pdf",
          title: parsedPdf.title,
          author: parsedPdf.author,
          totalPages: parsedPdf.totalPages,
          hasEmbeddedOutline: parsedPdf.hasEmbeddedOutline,
          chapters: parsedPdf.chapters.map((chap) => ({
            id: chap.id,
            title: chap.title,
            text: chap.text,
            index: chap.index,
            startPage: chap.startPage,
            endPage: chap.endPage,
            level: chap.level,
          })),
          fileName: file.name,
        };
      }

      setDoc(loadedDoc);
      setSelectedChapterIndex(0);
      setIsSchemeOpen(true);

      const totalCaps = loadedDoc.chapters.length;
      setRangeStart(1);
      setRangeEnd(Math.min(3, totalCaps > 0 ? totalCaps : 1));

      if (isMultiSelectMode) {
        // In multi-select mode, start completely clean/unselected so the user chooses manually
        setSelectedIndices([]);
      } else {
        setSelectedIndices([0]);
        if (loadedDoc.chapters.length > 0) {
          const firstChap = loadedDoc.chapters[0];
          onSelectChapterText(firstChap.text, firstChap.title, loadedDoc.title);
        }
      }
    } catch (err: any) {
      console.error("Error al procesar el documento:", err);
      setError(err.message || "Error al procesar el archivo seleccionado.");
    } finally {
      setIsLoading(false);
      setLoadingStatus("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      await processFile(files[0]);
    }
  };

  const handleSelectChapter = (index: number) => {
    if (!doc || index < 0 || index >= doc.chapters.length) return;

    if (isMultiSelectMode) {
      toggleChapterSelection(index);
    } else {
      setSelectedChapterIndex(index);
      setSelectedIndices([index]);
      const chapter = doc.chapters[index];
      onSelectChapterText(chapter.text, chapter.title, doc.title);
    }
  };

  const toggleChapterSelection = (index: number) => {
    if (!doc) return;
    let newIndices: number[];
    if (selectedIndices.includes(index)) {
      newIndices = selectedIndices.filter((i) => i !== index);
    } else {
      newIndices = [...selectedIndices, index].sort((a, b) => a - b);
    }
    setSelectedIndices(newIndices);
    if (newIndices.length > 0) {
      combineAndLoadChapters(doc, newIndices);
    }
  };

  const handleSelectAll = () => {
    if (!doc) return;
    const all = doc.chapters.map((_, i) => i);
    setSelectedIndices(all);
    combineAndLoadChapters(doc, all);
  };

  const handleDeselectAll = () => {
    if (!doc) return;
    setSelectedIndices([]);
  };

  const handleApplyRange = () => {
    if (!doc) return;
    const start = Math.max(1, Math.min(rangeStart, doc.chapters.length)) - 1;
    const end = Math.max(1, Math.min(rangeEnd, doc.chapters.length)) - 1;
    const min = Math.min(start, end);
    const max = Math.max(start, end);

    const rangeArr: number[] = [];
    for (let i = min; i <= max; i++) {
      rangeArr.push(i);
    }
    setSelectedIndices(rangeArr);
    combineAndLoadChapters(doc, rangeArr);
  };

  const handleNextChapter = () => {
    if (!doc) return;
    if (selectedChapterIndex < doc.chapters.length - 1) {
      handleSelectChapter(selectedChapterIndex + 1);
    }
  };

  const handlePrevChapter = () => {
    if (!doc) return;
    if (selectedChapterIndex > 0) {
      handleSelectChapter(selectedChapterIndex - 1);
    }
  };

  const handleCloseDocument = () => {
    setDoc(null);
    setSelectedChapterIndex(0);
    setSelectedIndices([0]);
    setError(null);
  };

  const activeChapter = doc?.chapters[selectedChapterIndex];

  // Calculate selected metrics
  const selectedChaptersTotalWords = doc
    ? selectedIndices.reduce((acc, idx) => {
        const chap = doc.chapters[idx];
        if (!chap) return acc;
        const count = chap.text.split(/\s+/).filter(Boolean).length;
        return acc + count;
      }, 0)
    : 0;

  // Filtered chapters for scheme search
  const filteredChapters = doc?.chapters.filter((chap) => {
    const query = searchFilter.toLowerCase();
    const matchesTitle = chap.title.toLowerCase().includes(query);
    const matchesNumber = `capitulo ${chap.index + 1}`.includes(query) || `cap. ${chap.index + 1}`.includes(query);
    const matchesPage = chap.startPage ? `pag ${chap.startPage}`.includes(query) || `pagina ${chap.startPage}`.includes(query) : false;
    return matchesTitle || matchesNumber || matchesPage;
  });

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`w-full bg-slate-950/70 rounded-2xl border transition-all p-4 space-y-3 shadow-xl ${
        isDragging
          ? "border-sky-400 bg-sky-950/30 ring-2 ring-sky-400/40"
          : "border-sky-500/20 shadow-sky-950/20"
      }`}
    >
      {/* Upload & Title Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
        <div className="flex items-center gap-3">
          <div
            className={`p-2.5 rounded-xl border ${
              doc?.type === "pdf"
                ? "bg-rose-500/20 border-rose-500/30 text-rose-400"
                : "bg-gradient-to-br from-sky-500/20 to-indigo-500/20 border-sky-500/30 text-sky-400"
            }`}
          >
            {doc?.type === "pdf" ? <File className="w-5 h-5" /> : <BookOpen className="w-5 h-5" />}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-semibold text-sm text-slate-100 flex items-center gap-1.5">
                Carga de Libros y Documentos
              </h3>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/20">
                  EPUB
                </span>
                <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20">
                  PDF
                </span>
                <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                  Esquema de Capítulos
                </span>
              </div>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {doc
                ? `${doc.title} ${doc.author && doc.author !== "Autor desconocido" ? `— ${doc.author}` : ""} ${
                    doc.type === "pdf" && doc.totalPages ? `(${doc.totalPages} páginas)` : ""
                  }`
                : "Arrastra o sube un archivo EPUB o PDF para extraer automáticamente su índice y capítulos"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".epub,.pdf,application/epub+zip,application/pdf"
            className="hidden"
          />

          {!doc ? (
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading}
              className="w-full sm:w-auto px-4 py-2 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-500 hover:from-sky-400 hover:to-indigo-400 text-slate-950 font-semibold text-xs transition-all shadow-md shadow-sky-500/20 flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{loadingStatus || "Procesando archivo..."}</span>
                </>
              ) : (
                <>
                  <UploadCloud className="w-4 h-4" />
                  <span>Subir EPUB o PDF</span>
                </>
              )}
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isLoading}
                className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 text-xs text-slate-300 hover:text-white transition-all flex items-center gap-1.5 cursor-pointer"
                title="Cambiar archivo EPUB o PDF"
              >
                <UploadCloud className="w-3.5 h-3.5 text-sky-400" />
                <span>Cambiar Documento</span>
              </button>
              <button
                onClick={handleCloseDocument}
                className="p-1.5 rounded-lg bg-slate-900/80 hover:bg-red-500/20 text-slate-400 hover:text-red-400 border border-slate-800 transition-colors cursor-pointer"
                title="Cerrar documento actual"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Multi-Chapter Checkbox Selector Bar */}
      <div className="p-2.5 rounded-xl bg-gradient-to-r from-slate-900/90 via-sky-950/20 to-indigo-950/20 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shadow-sm">
        <label className="flex items-center gap-2.5 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={isMultiSelectMode}
            onChange={(e) => {
              const checked = e.target.checked;
              setIsMultiSelectMode(checked);
              if (checked) {
                setIsSchemeOpen(true);
                // When entering multi-select mode, start completely unselected so the user can pick manually
                setSelectedIndices([]);
              } else {
                setSelectedIndices([selectedChapterIndex]);
                if (doc && doc.chapters[selectedChapterIndex]) {
                  const chap = doc.chapters[selectedChapterIndex];
                  onSelectChapterText(chap.text, chap.title, doc.title);
                }
              }
            }}
            className="w-4 h-4 rounded border-slate-700 text-sky-500 focus:ring-sky-500/30 bg-slate-950 cursor-pointer accent-sky-500 shrink-0"
          />
          <div className="flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-sky-400" />
            <span className="text-xs font-semibold text-slate-100">
              Cargar múltiples capítulos a la vez en el editor
            </span>
          </div>
        </label>
        <span className="text-[11px] text-slate-400 sm:text-right">
          {isMultiSelectMode
            ? "Modo activo: Marca manualmente los capítulos que desees unir"
            : "Marca esta casilla para seleccionar y unir varios capítulos al cargarlos"}
        </span>
      </div>

      {/* Error display */}
      {error && (
        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-center gap-2 animate-in fade-in">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Active Document Controls & Chapter Index View */}
      {doc && (
        <div className="space-y-3 pt-1">
          {/* Active Chapter Status & Quick Controls */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-900/60 p-3 rounded-xl border border-slate-800/80">
            <div className="flex items-center gap-2.5 min-w-0">
              <span
                className={`shrink-0 text-xs font-mono px-2 py-0.5 rounded font-medium ${
                  isMultiSelectMode
                    ? selectedIndices.length > 0
                      ? "bg-sky-500/20 text-sky-300 border border-sky-500/30"
                      : "bg-slate-800 text-slate-400 border border-slate-700"
                    : doc.type === "pdf"
                    ? "bg-rose-500/10 text-rose-300 border border-rose-500/20"
                    : "bg-indigo-500/10 text-indigo-300 border border-indigo-500/20"
                }`}
              >
                {isMultiSelectMode
                  ? `${selectedIndices.length} ${selectedIndices.length === 1 ? "Cap. marcado" : "Caps. marcados"}`
                  : `${doc.type.toUpperCase()} • Cap. ${selectedChapterIndex + 1} de ${doc.chapters.length}`}
              </span>
              <h4 className="text-xs font-semibold text-slate-200 truncate" title={activeChapter?.title}>
                {isMultiSelectMode
                  ? selectedIndices.length > 0
                    ? `Capítulos a unir: ${selectedIndices.map((i) => i + 1).join(", ")}`
                    : "Ningún capítulo seleccionado aún (marca las casillas abajo)"
                  : activeChapter?.title}
              </h4>
            </div>

            <div className="flex items-center gap-2 justify-between sm:justify-end shrink-0">
              {/* Prev / Next Navigation for single mode */}
              {!isMultiSelectMode && (
                <div className="flex items-center gap-1">
                  <button
                    onClick={handlePrevChapter}
                    disabled={selectedChapterIndex === 0}
                    className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-30 disabled:pointer-events-none text-xs flex items-center gap-1 transition-all cursor-pointer"
                    title="Capítulo Anterior"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    Anterior
                  </button>
                  <button
                    onClick={handleNextChapter}
                    disabled={selectedChapterIndex === doc.chapters.length - 1}
                    className="px-2.5 py-1 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 border border-sky-500/30 text-sky-300 disabled:opacity-30 disabled:pointer-events-none text-xs flex items-center gap-1 transition-all font-medium cursor-pointer"
                    title="Siguiente Capítulo"
                  >
                    Siguiente
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Toggle Scheme Dropdown */}
              <button
                onClick={() => setIsSchemeOpen(!isSchemeOpen)}
                className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <ListOrdered className="w-3.5 h-3.5 text-sky-400" />
                <span>Esquema ({doc.chapters.length})</span>
                {isSchemeOpen ? (
                  <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                )}
              </button>
            </div>
          </div>

          {/* Chapter Scheme / Index Tree Drawer */}
          {isSchemeOpen && (
            <div className="bg-slate-900/90 rounded-xl border border-slate-800 p-3 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
              
              {/* Header & Search */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-2 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <ListOrdered className="w-4 h-4 text-sky-400" />
                    Índice de Capítulos ({doc.chapters.length})
                  </span>
                  {doc.type === "pdf" && (
                    <span className="text-[10px] font-mono text-slate-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                      {doc.hasEmbeddedOutline ? "Esquema original del PDF" : "Esquema generado"}
                    </span>
                  )}
                </div>
                <div className="relative w-full sm:w-56">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-slate-500" />
                  <input
                    type="text"
                    placeholder="Buscar capítulo o pág..."
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    className="w-full bg-slate-950 text-xs text-slate-200 placeholder:text-slate-600 pl-8 pr-2.5 py-1 rounded-lg border border-slate-800 focus:outline-none focus:border-sky-500/50"
                  />
                </div>
              </div>

              {/* Multi-Selection Control Toolbar (when in Multi-select mode) */}
              {isMultiSelectMode && (
                <div className="p-3 bg-slate-950/80 rounded-xl border border-sky-500/30 space-y-2.5 shadow-inner">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleSelectAll}
                        className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors flex items-center gap-1 cursor-pointer"
                      >
                        <CheckSquare className="w-3.5 h-3.5 text-sky-400" />
                        <span>Seleccionar todos</span>
                      </button>
                      <button
                        onClick={handleDeselectAll}
                        className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 text-xs transition-colors cursor-pointer"
                      >
                        <span>Limpiar</span>
                      </button>
                    </div>

                    <div className="flex items-center gap-2 text-xs">
                      <label className="flex items-center gap-1.5 cursor-pointer text-slate-300 text-[11px] select-none">
                        <input
                          type="checkbox"
                          checked={includeChapterHeaders}
                          onChange={(e) => {
                            const val = e.target.checked;
                            setIncludeChapterHeaders(val);
                            if (doc) combineAndLoadChapters(doc, selectedIndices, val);
                          }}
                          className="w-3.5 h-3.5 rounded border-slate-700 text-sky-500 bg-slate-900 cursor-pointer accent-sky-500"
                        />
                        <span>Incluir títulos (=== Cap ===)</span>
                      </label>
                    </div>
                  </div>

                  {/* Range selection row */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-800/80">
                    <div className="flex items-center gap-2 text-xs text-slate-300">
                      <span className="text-slate-400 text-[11px]">Rango rápido:</span>
                      <span className="text-[11px]">Del Cap.</span>
                      <input
                        type="number"
                        min={1}
                        max={doc.chapters.length}
                        value={rangeStart}
                        onChange={(e) => setRangeStart(parseInt(e.target.value, 10) || 1)}
                        className="w-12 bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-xs text-center text-white focus:outline-none focus:border-sky-500"
                      />
                      <span className="text-[11px]">al</span>
                      <input
                        type="number"
                        min={1}
                        max={doc.chapters.length}
                        value={rangeEnd}
                        onChange={(e) => setRangeEnd(parseInt(e.target.value, 10) || 1)}
                        className="w-12 bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-xs text-center text-white focus:outline-none focus:border-sky-500"
                      />
                      <button
                        onClick={handleApplyRange}
                        className="px-2.5 py-0.5 rounded bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/30 text-xs font-semibold transition-all cursor-pointer"
                      >
                        Seleccionar Rango
                      </button>
                    </div>

                    <div className="text-xs font-mono text-sky-400 bg-sky-950/40 border border-sky-500/20 px-2.5 py-1 rounded-lg">
                      {selectedIndices.length} de {doc.chapters.length} caps. • ~{selectedChaptersTotalWords.toLocaleString()} palabras
                    </div>
                  </div>
                </div>
              )}

              {/* Chapter Items List */}
              <div className="max-h-64 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                {filteredChapters && filteredChapters.length > 0 ? (
                  filteredChapters.map((chap) => {
                    const isMultiSelected = selectedIndices.includes(chap.index);
                    const isSingleActive = chap.index === selectedChapterIndex;
                    const wordCount = chap.text.split(/\s+/).filter(Boolean).length;
                    const indentLevel = chap.level && chap.level > 0 ? Math.min(chap.level * 12, 36) : 0;

                    return (
                      <button
                        key={`chapter-row-${chap.index}-${chap.id}`}
                        onClick={() => handleSelectChapter(chap.index)}
                        style={{ paddingLeft: indentLevel > 0 ? `${indentLevel + 12}px` : "12px" }}
                        className={`w-full text-left py-2 pr-3 rounded-lg text-xs transition-all flex items-center justify-between gap-2 group cursor-pointer ${
                          isMultiSelectMode
                            ? isMultiSelected
                              ? "bg-sky-500/20 text-sky-100 border border-sky-500/40 font-medium shadow-sm"
                              : "bg-slate-950/40 hover:bg-slate-800/80 text-slate-400 hover:text-slate-200 border border-transparent"
                            : isSingleActive
                            ? "bg-sky-500/20 text-sky-200 border border-sky-500/40 font-medium"
                            : "bg-slate-950/40 hover:bg-slate-800/80 text-slate-300 border border-transparent"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          {/* Checkbox icon for multi-select, number badge for single */}
                          {isMultiSelectMode ? (
                            <div className="shrink-0 text-sky-400">
                              {isMultiSelected ? (
                                <CheckSquare className="w-4 h-4 text-sky-400" />
                              ) : (
                                <Square className="w-4 h-4 text-slate-600 group-hover:text-slate-400" />
                              )}
                            </div>
                          ) : (
                            <span
                              className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-mono shrink-0 ${
                                isSingleActive
                                  ? "bg-sky-500 text-slate-950 font-bold"
                                  : "bg-slate-800 text-slate-400 group-hover:bg-slate-700"
                              }`}
                            >
                              {chap.index + 1}
                            </span>
                          )}

                          <span className="truncate">
                            <span className="font-mono text-[11px] text-slate-500 mr-1.5">
                              Cap. {chap.index + 1}:
                            </span>
                            {chap.title}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {chap.startPage !== undefined && (
                            <span className="text-[10px] font-mono text-slate-400 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800/80">
                              {chap.startPage === chap.endPage ? `Pág. ${chap.startPage}` : `Págs. ${chap.startPage}-${chap.endPage}`}
                            </span>
                          )}
                          <span className="text-[10px] font-mono text-slate-500">
                            {wordCount.toLocaleString()} pal.
                          </span>
                          {!isMultiSelectMode && (
                            isSingleActive ? (
                              <CheckCircle2 className="w-3.5 h-3.5 text-sky-400" />
                            ) : (
                              <span className="text-[10px] text-sky-400 opacity-0 group-hover:opacity-100 transition-opacity">
                                Cargar →
                              </span>
                            )
                          )}
                        </div>
                      </button>
                    );
                  })
                ) : (
                  <p className="text-xs text-slate-500 text-center py-4">
                    No se encontraron capítulos con la búsqueda.
                  </p>
                )}
              </div>

              {/* Direct Action button for multi-select */}
              {isMultiSelectMode && (
                <div className="pt-2 border-t border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                  <div className="text-xs text-slate-400">
                    {selectedIndices.length === 0 ? (
                      <span className="text-amber-400/90 font-medium">
                        Selecciona uno o más capítulos arriba para cargarlos al editor.
                      </span>
                    ) : (
                      <span>
                        <strong className="text-white">{selectedIndices.length}</strong> {selectedIndices.length === 1 ? "capítulo seleccionado" : "capítulos seleccionados"} (~{selectedChaptersTotalWords.toLocaleString()} palabras).
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => combineAndLoadChapters(doc, selectedIndices)}
                    disabled={selectedIndices.length === 0}
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-500 hover:from-sky-400 hover:to-indigo-400 text-slate-950 font-bold text-xs shadow-md shadow-sky-500/20 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:pointer-events-none disabled:cursor-not-allowed"
                  >
                    <span>
                      {selectedIndices.length === 0
                        ? "Selecciona capítulos"
                        : `Cargar ${selectedIndices.length} ${selectedIndices.length === 1 ? "capítulo" : "capítulos"} al Editor`}
                    </span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Quick Banner for Next Chapter (Single Mode) */}
          {!isMultiSelectMode && selectedChapterIndex < doc.chapters.length - 1 && (
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-xs">
              <div className="flex items-center gap-2 min-w-0">
                <Sparkles className="w-3.5 h-3.5 text-indigo-400 shrink-0 animate-pulse" />
                <span className="text-indigo-200 truncate">
                  Siguiente capítulo listo: <strong className="text-white">{doc.chapters[selectedChapterIndex + 1].title}</strong>
                </span>
              </div>
              <button
                onClick={handleNextChapter}
                className="px-2.5 py-1 rounded-lg bg-indigo-500 hover:bg-indigo-400 text-slate-950 font-semibold shrink-0 transition-all flex items-center gap-1 active:scale-95 cursor-pointer"
              >
                Cargar siguiente
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
