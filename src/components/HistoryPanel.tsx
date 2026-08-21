import { HistoryItem } from "../types";
import { COUNTRY_FLAGS } from "./VoiceSelector";
import { History, Play, Pause, Trash2, Download, Copy, RefreshCw, Swords, Radio, Sparkles } from "lucide-react";
import { sanitizeFileName } from "../utils/titleUtils";

interface HistoryPanelProps {
  history: HistoryItem[];
  currentlyPlayingId: string | null;
  onPlayHistory: (item: HistoryItem) => void;
  onPauseHistory: () => void;
  onDeleteHistory: (id: string) => void;
  onLoadText: (text: string) => void;
  onClearAll: () => void;
}

export default function HistoryPanel({
  history,
  currentlyPlayingId,
  onPlayHistory,
  onPauseHistory,
  onDeleteHistory,
  onLoadText,
  onClearAll,
}: HistoryPanelProps) {
  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="bg-slate-900/40 rounded-2xl border border-slate-800/60 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <History className="w-5 h-5 text-sky-500" />
          <h3 className="font-semibold text-sm text-slate-200 uppercase tracking-wider">
            Historial de Lectura ({history.length})
          </h3>
        </div>
        {history.length > 0 && (
          <button
            onClick={onClearAll}
            className="text-[11px] font-medium text-slate-500 hover:text-red-400 transition-colors flex items-center gap-1 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Limpiar todo
          </button>
        )}
      </div>

      {history.length === 0 ? (
        <div className="py-12 text-center rounded-xl bg-slate-950/20 border border-dashed border-slate-800/60 text-slate-500">
          <History className="w-8 h-8 mx-auto mb-2 opacity-20" />
          <p className="text-sm">El historial está vacío</p>
          <p className="text-xs text-slate-600 mt-1">Genera lecturas para verlas aquí</p>
        </div>
      ) : (
        <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1 custom-scrollbar">
          {history.map((item) => {
            const isPlaying = currentlyPlayingId === item.id;
            const flag = COUNTRY_FLAGS[item.country] || "🏳️";
            const isDebate = item.title?.toLowerCase().startsWith("debate") || (item.text.includes("{{@dlg1}}") && item.text.includes("{{@dlg2}}"));
            const isPodcast = item.title?.toLowerCase().startsWith("podcast") || item.text.includes("{{@dlg3}}");
            const downloadFileName = sanitizeFileName(item.title || `LectorTTS_${item.voiceName}_${item.id}`, "Audio_TTS");

            return (
              <div
                key={item.id}
                className={`p-3.5 rounded-xl border transition-all ${
                  isPlaying
                    ? "bg-sky-500/5 border-sky-500/30"
                    : "bg-slate-950/40 border-slate-800/60 hover:border-slate-700/80"
                }`}
              >
                {/* Title and Category Tag if available */}
                {item.title && (
                  <div className="flex items-center gap-2 mb-2">
                    {isDebate ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        <Swords className="w-3 h-3" /> DEBATE
                      </span>
                    ) : isPodcast ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-purple-500/20 text-purple-300 border border-purple-500/30">
                        <Radio className="w-3 h-3" /> PODCAST
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-sky-500/20 text-sky-300 border border-sky-500/30">
                        <Sparkles className="w-3 h-3" /> AUDIO
                      </span>
                    )}
                    <h4 className="text-xs font-semibold text-slate-200 truncate" title={item.title}>
                      {item.title}
                    </h4>
                  </div>
                )}

                {/* Text Line */}
                <p className="text-sm text-slate-300 line-clamp-2 leading-relaxed mb-3">
                  "{item.text}"
                </p>

                {/* Meta details & Actions Row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2.5 border-t border-slate-800/40 text-xs">
                  {/* Voice details */}
                  <div className="flex flex-wrap items-center gap-2 text-slate-400">
                    <span className="text-lg">{flag}</span>
                    <span className="font-semibold text-slate-300">{item.voiceName}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-900/80 text-slate-500">
                      Voz {item.gender === "male" ? "Masc" : "Fem"}
                    </span>
                    <span className="text-slate-600">•</span>
                    <span className="text-slate-500">Vel: {item.rate}x</span>
                    <span className="text-slate-600">•</span>
                    <span className="text-slate-500">Tono: {item.pitch > 0 ? `+${item.pitch}` : item.pitch}Hz</span>
                    <span className="text-slate-600 sm:inline hidden">•</span>
                    <span className="text-slate-500 sm:inline hidden">{formatTime(item.timestamp)}</span>
                  </div>

                  {/* Play & action buttons */}
                  <div className="flex items-center gap-1.5 self-end sm:self-auto">
                    {/* Re-load text to editor */}
                    <button
                      onClick={() => onLoadText(item.text)}
                      title="Cargar texto en el editor"
                      className="p-1.5 rounded-lg bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800 transition-colors cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>

                    {/* Copy text */}
                    <button
                      onClick={() => handleCopy(item.text)}
                      title="Copiar texto"
                      className="p-1.5 rounded-lg bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800 transition-colors cursor-pointer"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>

                    {/* Download Audio with appropriate file name */}
                    <a
                      href={item.audioUrl}
                      download={`${downloadFileName}.mp3`}
                      title={`Descargar: ${downloadFileName}.mp3`}
                      className="p-1.5 rounded-lg bg-slate-900 text-slate-400 hover:text-emerald-400 border border-slate-800 transition-colors cursor-pointer flex items-center"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </a>

                    {/* Delete item */}
                    <button
                      onClick={() => onDeleteHistory(item.id)}
                      title="Eliminar del historial"
                      className="p-1.5 rounded-lg bg-slate-900 text-slate-400 hover:text-red-400 border border-slate-800 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>

                    {/* Play/Pause */}
                    <button
                      onClick={() => (isPlaying ? onPauseHistory() : onPlayHistory(item))}
                      className={`ml-1.5 px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5 transition-all text-xs cursor-pointer ${
                        isPlaying
                          ? "bg-amber-500 text-slate-950 hover:bg-amber-400"
                          : "bg-sky-500 text-slate-950 hover:bg-sky-400"
                      }`}
                    >
                      {isPlaying ? (
                        <>
                          <Pause className="w-3 h-3 stroke-[2.5px]" />
                          Pausar
                        </>
                      ) : (
                        <>
                          <Play className="w-3 h-3 stroke-[2.5px] fill-current" />
                          Escuchar
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
