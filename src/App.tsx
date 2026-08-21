import { useState, useEffect, useRef } from "react";
import { 
  Volume2, 
  HelpCircle, 
  Play, 
  Pause, 
  Sparkles, 
  RefreshCw, 
  X, 
  VolumeX, 
  Sliders, 
  FileAudio,
  AlertCircle,
  Mic,
  Radio,
  Loader2,
  CheckCircle2,
  Swords,
  Users
} from "lucide-react";
import { Voice, HistoryItem, splitIntoChunks } from "./types";
import { parseDialogueSegmentsForSynthesis } from "./utils/dialogue";
import { extractTopicFromContent, formatDebateTitle, formatPodcastTitle, sanitizeFileName } from "./utils/titleUtils";
import VoiceSelector from "./components/VoiceSelector";
import HistoryPanel from "./components/HistoryPanel";
import AudioVisualizer from "./components/AudioVisualizer";
import RealTimeReader from "./components/RealTimeReader";
import EpubChapterPanel from "./components/EpubChapterPanel";

export default function App() {
  // Voice & Service States
  const [voices, setVoices] = useState<Voice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<Voice | null>(null);
  const [isLoadingVoices, setIsLoadingVoices] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);

  // Tabs / Reader Modes
  const [activeTab, setActiveTab] = useState<"editor" | "reader">("editor");
  const [isReadingActive, setIsReadingActive] = useState(false);

  // Synthesis Parameters
  const [text, setText] = useState("");
  const [omitParenthesesAndSymbols, setOmitParenthesesAndSymbols] = useState<boolean>(true); // Active by default
  const [rate, setRate] = useState<number>(1.10); // Speed: 0.5x to 2.0x (default 1.10x)
  const [pitch, setPitch] = useState<number>(0); // Pitch shift: -15Hz to +15Hz
  const [volume, setVolume] = useState<number>(0.8); // Client side playback volume
  const [isMuted, setIsMuted] = useState(false);

  // Active Playback States
  const [isPlaying, setIsPlaying] = useState(false);
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [synthesisProgress, setSynthesisProgress] = useState<string | null>(null);
  const [currentAudioUrl, setCurrentAudioUrl] = useState<string | null>(null);
  const [currentlyPlayingId, setCurrentlyPlayingId] = useState<string | null>(null);
  const [customFileName, setCustomFileName] = useState("");

  // Podcast Generation States
  const [isGeneratingPodcast, setIsGeneratingPodcast] = useState(false);
  const [isAnalyzingPodcastTitle, setIsAnalyzingPodcastTitle] = useState(false);
  const [isPodcastModalOpen, setIsPodcastModalOpen] = useState(false);
  const [podcastTitleInput, setPodcastTitleInput] = useState("");
  const [podcastSuccessMsg, setPodcastSuccessMsg] = useState<string | null>(null);

  // Debate Generation States
  const [isGeneratingDebate, setIsGeneratingDebate] = useState(false);
  const [isAnalyzingDebateTitle, setIsAnalyzingDebateTitle] = useState(false);
  const [isDebateModalOpen, setIsDebateModalOpen] = useState(false);
  const [debateTitleInput, setDebateTitleInput] = useState("");
  const [jorgeStanceInput, setJorgeStanceInput] = useState("");
  const [debateSuccessMsg, setDebateSuccessMsg] = useState<string | null>(null);

  // Helper to analyze the text in editor and generate an intelligent title using Gemini AI
  const analyzeTitleWithAI = async (type: "podcast" | "debate") => {
    if (!text.trim()) return null;
    const isDebate = type === "debate";
    if (isDebate) {
      setIsAnalyzingDebateTitle(true);
    } else {
      setIsAnalyzingPodcastTitle(true);
    }

    try {
      const res = await fetch("/api/analyze-title", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, type }),
      });

      const data = await res.json();
      if (res.ok && data.title) {
        if (isDebate) {
          setDebateTitleInput(data.title);
        } else {
          setPodcastTitleInput(data.title);
        }
        return data.title;
      }
    } catch (err) {
      console.warn("No se pudo analizar el título con IA, usando sugerencia heurística:", err);
    } finally {
      if (isDebate) {
        setIsAnalyzingDebateTitle(false);
      } else {
        setIsAnalyzingPodcastTitle(false);
      }
    }
    return null;
  };

  const handleOpenPodcastModal = () => {
    if (!text.trim()) {
      setApiError("Por favor ingresa o pega primero un texto en el editor para generar el podcast.");
      return;
    }
    // Set fallback title initially if empty
    if (!podcastTitleInput) {
      const extracted = extractTopicFromContent(text) || "Enseñanza y Reflexión";
      setPodcastTitleInput(formatPodcastTitle(extracted));
    }
    setIsPodcastModalOpen(true);
    // Automatically analyze editor text with Gemini AI to get an intelligent title
    analyzeTitleWithAI("podcast");
  };

  const handleExecutePodcastGeneration = async () => {
    if (!text.trim()) return;
    setIsGeneratingPodcast(true);
    setApiError(null);
    setPodcastSuccessMsg(null);

    const formattedTitle = formatPodcastTitle(podcastTitleInput.trim() || extractTopicFromContent(text) || "Enseñanza y Reflexión");

    try {
      const res = await fetch("/api/generate-podcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          title: formattedTitle,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Ocurrió un error al generar el podcast con Gemini.");
      }

      if (data.result) {
        setText(data.result);
        setCustomFileName(formattedTitle);
        setIsPodcastModalOpen(false);
        setPodcastSuccessMsg(`¡Podcast generado con éxito! El guion conversacional (${formattedTitle}) entre Gerardo, Juan y Rosa se ha cargado en el editor de texto.`);
      }
    } catch (err: any) {
      console.error("Error al generar podcast:", err);
      setApiError("Error al generar podcast: " + (err.message || err));
    } finally {
      setIsGeneratingPodcast(false);
    }
  };

  const handleOpenDebateModal = () => {
    if (!text.trim()) {
      setApiError("Por favor ingresa o pega primero un texto en el editor para generar el debate.");
      return;
    }
    // Set fallback title initially if empty
    if (!debateTitleInput) {
      const extracted = extractTopicFromContent(text) || "Posturas Opuestas";
      setDebateTitleInput(formatDebateTitle(extracted));
    }
    setIsDebateModalOpen(true);
    // Automatically analyze editor text with Gemini AI to get an intelligent title
    analyzeTitleWithAI("debate");
  };

  const handleExecuteDebateGeneration = async () => {
    if (!text.trim()) return;
    setIsGeneratingDebate(true);
    setApiError(null);
    setDebateSuccessMsg(null);

    const formattedTitle = formatDebateTitle(debateTitleInput.trim() || extractTopicFromContent(text) || "Posturas Opuestas");

    try {
      const res = await fetch("/api/generate-debate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          jorgeStance: jorgeStanceInput.trim(),
          title: formattedTitle,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Ocurrió un error al generar el debate con Gemini.");
      }

      if (data.result) {
        setText(data.result);
        setCustomFileName(formattedTitle);
        setIsDebateModalOpen(false);
        setDebateSuccessMsg(`¡Debate generado con éxito! El diálogo (${formattedTitle}) entre Gerardo y Jorge se ha cargado en el editor de texto.`);
      }
    } catch (err: any) {
      console.error("Error al generar debate:", err);
      setApiError("Error al generar debate: " + (err.message || err));
    } finally {
      setIsGeneratingDebate(false);
    }
  };

  // History & Storage
  const [history, setHistory] = useState<HistoryItem[]>([]);

  // DOM Refs
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Word & Character count
  const charCount = text.length;
  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;

  // 1. Fetch voices list from server on mount
  useEffect(() => {
    async function fetchVoices() {
      try {
        setIsLoadingVoices(true);
        const res = await fetch("/api/voices");
        if (!res.ok) throw new Error("No se pudo obtener la lista de voces del servidor.");
        const data: Voice[] = await res.json();
        setVoices(data);
        
        // Select Jorge from Mexico as default voice
        const defaultVoice = 
          data.find(v => v.code === "es-MX-JorgeNeural") || 
          data.find(v => v.name.toLowerCase().includes("jorge")) ||
          data.find(v => v.code === "es-ES-ElviraNeural") || 
          data[0] || 
          null;
        
        setSelectedVoice(defaultVoice);
        setApiError(null);
      } catch (err: any) {
        console.error("Error fetching voices:", err);
        setApiError("Error de conexión con el servidor backend proxy. Por favor reintenta.");
      } finally {
        setIsLoadingVoices(false);
      }
    }
    fetchVoices();
  }, []);

  // 2. Load History from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem("tts_history");
    if (saved) {
      try {
        // Note: Saved blob URLs won't be valid across page refreshes.
        // We clean up invalid blob URLs from history items but preserve the meta structure.
        const parsed: HistoryItem[] = JSON.parse(saved);
        const cleaned = parsed.map(item => ({
          ...item,
          audioUrl: "" // Clear old stale Blob URLs on refresh, they can be re-generated
        }));
        setHistory(cleaned);
      } catch (e) {
        console.error("Error parsing history:", e);
      }
    }
  }, []);

  // 3. Keep audio volume synced with state
  useEffect(() => {
    if (audioRef.current) {
      try {
        const targetVol = Math.max(0, Math.min(1, isMuted ? 0 : volume));
        audioRef.current.volume = targetVol;
      } catch (e) {}
    }
  }, [volume, isMuted]);

  // Set up audio listeners safely
  const initAudioListeners = (audio: HTMLAudioElement, idToSync: string | null) => {
    audio.onplay = () => {
      setIsPlaying(true);
      if (idToSync) setCurrentlyPlayingId(idToSync);
    };
    audio.onpause = () => {
      setIsPlaying(false);
      setCurrentlyPlayingId(null);
    };
    audio.onended = () => {
      setIsPlaying(false);
      setCurrentlyPlayingId(null);
    };
    audio.onerror = (e) => {
      if (audio.src && audio.src.startsWith("blob:")) {
        console.warn("Audio playback issue:", e);
        setIsPlaying(false);
        setCurrentlyPlayingId(null);
        setApiError("Error de reproducción de audio.");
      }
    };
  };

  // 4. Synthesize current text via API (Multi-voice dialogue aware)
  const handleSynthesize = async () => {
    if (!text.trim()) {
      setApiError("Por favor ingresa un texto para leer.");
      return;
    }
    if (!selectedVoice) {
      setApiError("Por favor selecciona una voz.");
      return;
    }

    try {
      setIsSynthesizing(true);
      setSynthesisProgress("Preparando diálogos...");
      setApiError(null);

      // Pause any ongoing playback first
      if (audioRef.current) {
        audioRef.current.pause();
      }

      // Parse text into voice-specific dialogue segments
      const segments = parseDialogueSegmentsForSynthesis(text, voices, selectedVoice, omitParenthesesAndSymbols);
      if (segments.length === 0) {
        setApiError("El texto a sintetizar no contiene contenido válido.");
        setIsSynthesizing(false);
        return;
      }

      const blobs: Blob[] = [];

      for (let i = 0; i < segments.length; i++) {
        const seg = segments[i];
        if (segments.length > 1) {
          setSynthesisProgress(`Sintetizando voz ${i + 1} de ${segments.length} (${seg.voiceName})...`);
        } else {
          setSynthesisProgress("Generando audio...");
        }

        const response = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: seg.text,
            voice: seg.voiceCode,
            rate,
            pitch,
          }),
        });

        if (!response.ok) {
          const errData = await response.json();
          throw new Error(errData.error || `Error al sintetizar el fragmento ${i + 1} del texto.`);
        }

        const blob = await response.blob();
        blobs.push(blob);
      }

      setSynthesisProgress("Uniendo pistas de audio...");
      // Concatenate the audio blobs directly (valid for MP3 streams)
      const combinedBlob = new Blob(blobs, { type: "audio/mpeg" });
      const audioUrl = URL.createObjectURL(combinedBlob);
      setCurrentAudioUrl(audioUrl);

      // Determine proper descriptive title for history and downloads
      let resolvedTitle = customFileName.trim();
      if (!resolvedTitle) {
        if (text.includes("{{@dlg1}}") && text.includes("{{@dlg2}}")) {
          resolvedTitle = formatDebateTitle(extractTopicFromContent(text) || "Discusión de Diálogos");
        } else if (text.includes("{{@dlg3}}")) {
          resolvedTitle = formatPodcastTitle(extractTopicFromContent(text) || "Enseñanza y Reflexión");
        } else {
          const topic = extractTopicFromContent(text);
          resolvedTitle = topic ? `Lectura - ${topic}` : `Lectura_${selectedVoice.name}_${Date.now()}`;
        }
        setCustomFileName(resolvedTitle);
      }

      // Create a new History item
      const newItem: HistoryItem = {
        id: "history-" + Date.now(),
        title: resolvedTitle,
        text,
        voiceCode: selectedVoice.code,
        voiceName: selectedVoice.name,
        country: selectedVoice.country,
        gender: selectedVoice.gender,
        timestamp: Date.now(),
        audioUrl,
        rate,
        pitch,
      };

      // Add to local history & persist meta in localStorage
      const updatedHistory = [newItem, ...history];
      setHistory(updatedHistory);
      localStorage.setItem("tts_history", JSON.stringify(updatedHistory));

      // Clean up previous player listeners before creating new one
      if (audioRef.current) {
        audioRef.current.onplay = null;
        audioRef.current.onpause = null;
        audioRef.current.onended = null;
        audioRef.current.onerror = null;
        audioRef.current.pause();
      }

      // Trigger instant play
      const audio = new Audio(audioUrl);
      audioRef.current = audio;
      audio.volume = isMuted ? 0 : volume;
      initAudioListeners(audio, newItem.id);
      
      try {
        await audio.play();
      } catch (playErr: any) {
        if (playErr?.name !== "AbortError") {
          console.warn("Playback start notice:", playErr);
        }
      }
    } catch (err: any) {
      console.error("Synthesis error:", err);
      setApiError(err.message || "No se pudo conectar al servicio de síntesis de voz. Reintenta.");
    } finally {
      setIsSynthesizing(false);
      setSynthesisProgress(null);
    }
  };

  // 5. Play / Pause currently loaded audio
  const handleTogglePlayback = () => {
    if (audioRef.current && audioRef.current.src && audioRef.current.src.startsWith("blob:")) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play().catch(err => {
          if (err?.name !== "AbortError") {
            console.warn("Error resuming playback, re-synthesizing:", err);
            handleSynthesize();
          }
        });
      }
    } else {
      // If nothing is loaded, synthesize and play
      handleSynthesize();
    }
  };

  // 6. Play a specific history item
  const handlePlayHistory = async (item: HistoryItem) => {
    try {
      setApiError(null);
      
      // Pause current
      if (audioRef.current) {
        audioRef.current.onplay = null;
        audioRef.current.onpause = null;
        audioRef.current.onended = null;
        audioRef.current.onerror = null;
        audioRef.current.pause();
      }

      // If the item doesn't have a valid active blob URL (e.g. was restored from reload),
      // we dynamically re-synthesize it seamlessly using the dialogue segment method!
      let playUrl = item.audioUrl;
      if (!playUrl) {
        setIsSynthesizing(true);
        setSynthesisProgress("Preparando re-síntesis...");
        
        const itemDefaultVoice = voices.find(v => v.code === item.voiceCode) || selectedVoice;
        const segments = parseDialogueSegmentsForSynthesis(item.text, voices, itemDefaultVoice, omitParenthesesAndSymbols);
        const blobs: Blob[] = [];

        for (let i = 0; i < segments.length; i++) {
          const seg = segments[i];
          if (segments.length > 1) {
            setSynthesisProgress(`Re-generando voz ${i + 1} de ${segments.length} (${seg.voiceName})...`);
          } else {
            setSynthesisProgress("Generando audio...");
          }

          const response = await fetch("/api/tts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              text: seg.text,
              voice: seg.voiceCode,
              rate: item.rate,
              pitch: item.pitch,
            }),
          });

          if (!response.ok) throw new Error(`No se pudo re-sintetizar la parte ${i + 1} del audio.`);
          const blob = await response.blob();
          blobs.push(blob);
        }

        const combinedBlob = new Blob(blobs, { type: "audio/mpeg" });
        playUrl = URL.createObjectURL(combinedBlob);
        
        // Update history item with valid URL so user doesn't hit server again
        const updated = history.map(h => h.id === item.id ? { ...h, audioUrl: playUrl } : h);
        setHistory(updated);
      }

      const audio = new Audio(playUrl);
      audioRef.current = audio;
      audio.volume = isMuted ? 0 : volume;
      initAudioListeners(audio, item.id);
      
      try {
        await audio.play();
      } catch (err: any) {
        if (err?.name !== "AbortError") {
          console.warn("History playback notice:", err);
        }
      }
    } catch (err: any) {
      console.error("History playback error:", err);
      setApiError("No se pudo reproducir este elemento histórico: " + err.message);
    } finally {
      setIsSynthesizing(false);
      setSynthesisProgress(null);
    }
  };

  // 7. Pause any playing history item
  const handlePauseHistory = () => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
  };

  // 8. Delete a history item
  const handleDeleteHistory = (id: string) => {
    const item = history.find(h => h.id === id);
    if (item && item.audioUrl) {
      URL.revokeObjectURL(item.audioUrl); // Clean browser memory leaks
    }
    const filtered = history.filter(h => h.id !== id);
    setHistory(filtered);
    localStorage.setItem("tts_history", JSON.stringify(filtered));

    if (currentlyPlayingId === id) {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      setIsPlaying(false);
      setCurrentlyPlayingId(null);
    }
  };

  // 9. EPUB Chapter Selection Handler
  const handleSelectEpubChapterText = (chapterText: string, chapterTitle: string, bookTitle: string) => {
    setText(chapterText);
    if (chapterTitle && bookTitle) {
      setCustomFileName(`${bookTitle} - ${chapterTitle}`);
    }
  };

  // 9. Clear all history items
  const handleClearAllHistory = () => {
    history.forEach(item => {
      if (item.audioUrl) URL.revokeObjectURL(item.audioUrl);
    });
    setHistory([]);
    localStorage.removeItem("tts_history");

    if (audioRef.current) {
      audioRef.current.pause();
    }
    setIsPlaying(false);
    setCurrentlyPlayingId(null);
  };

  // 10. Load text preset into editor
  const handleLoadText = (newText: string) => {
    setText(newText);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-sky-500/30 selection:text-sky-200">
      
      {/* Visual background gradient accents */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-sky-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-purple-500/5 rounded-full blur-[100px] pointer-events-none" />

      {/* Header Bar */}
      <header className="border-b border-slate-900/80 bg-slate-950/80 backdrop-blur-md sticky top-0 z-40 px-4 py-3 sm:px-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-tr from-sky-600 to-indigo-600 shadow-md shadow-sky-950/40">
              <FileAudio className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                MultiTTS <span className="text-[10px] uppercase font-semibold bg-sky-500/20 text-sky-400 px-1.5 py-0.5 rounded-md border border-sky-500/20">PRO</span>
              </h1>
              <p className="text-[10px] text-slate-400">Lector de Voz Neuronal Hispano</p>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs">
            <div className="sm:flex hidden items-center gap-1.5 text-slate-500">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span>Microsoft Edge Cloud Proxy</span>
            </div>
            <a
              href="https://github.com/vlad-str/msedge-tts"
              target="_blank"
              rel="noopener noreferrer"
              className="text-slate-400 hover:text-white transition-colors"
            >
              Docs
            </a>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 grid grid-cols-1 lg:grid-cols-12 gap-6 relative z-10">
        
        {/* Error Notification Alert */}
        {apiError && (
          <div className="lg:col-span-12 p-4 bg-red-950/40 border border-red-800/60 rounded-xl flex items-start gap-3 text-red-300 text-sm animate-fade-in">
            <AlertCircle className="w-5 h-5 shrink-0 text-red-400" />
            <div className="flex-1">
              <span className="font-semibold">Aviso del Sistema:</span> {apiError}
            </div>
            <button 
              onClick={() => setApiError(null)}
              className="p-1 rounded-md hover:bg-red-900/30 text-red-400 hover:text-red-200 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Podcast Success Alert Banner */}
        {podcastSuccessMsg && (
          <div className="lg:col-span-12 p-4 bg-emerald-950/40 border border-emerald-800/60 rounded-xl flex items-start gap-3 text-emerald-300 text-sm animate-fade-in shadow-lg">
            <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400" />
            <div className="flex-1 leading-relaxed">
              <span className="font-bold text-emerald-200">¡Podcast Generado Exitosamente!</span> {podcastSuccessMsg}
            </div>
            <button 
              onClick={() => setPodcastSuccessMsg(null)}
              className="p-1 rounded-md hover:bg-emerald-900/30 text-emerald-400 hover:text-emerald-200 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Debate Success Alert Banner */}
        {debateSuccessMsg && (
          <div className="lg:col-span-12 p-4 bg-amber-950/40 border border-amber-800/60 rounded-xl flex items-start gap-3 text-amber-300 text-sm animate-fade-in shadow-lg">
            <CheckCircle2 className="w-5 h-5 shrink-0 text-amber-400" />
            <div className="flex-1 leading-relaxed">
              <span className="font-bold text-amber-200">¡Debate Generado Exitosamente!</span> {debateSuccessMsg}
            </div>
            <button 
              onClick={() => setDebateSuccessMsg(null)}
              className="p-1 rounded-md hover:bg-amber-900/30 text-amber-400 hover:text-amber-200 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Left Bento Column (Editor + Speech Tuning Controls + Visualizer) */}
        <section className="lg:col-span-7 flex flex-col gap-6">
          
          {/* Navigation Tabs */}
          <div className="flex bg-slate-900/60 p-1.5 rounded-2xl border border-slate-800/60 shadow-lg">
            <button
              onClick={() => {
                setActiveTab("editor");
                if (isReadingActive) {
                  // If switching back to editor, stop active reading session
                  setIsReadingActive(false);
                }
              }}
              className={`flex-1 py-3 text-xs sm:text-sm font-semibold rounded-xl transition-all flex items-center justify-center gap-2 ${
                activeTab === "editor"
                  ? "bg-gradient-to-r from-sky-500 to-indigo-500 text-slate-950 font-bold shadow-md"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              ✍️ Editor de Texto
            </button>
            <button
              onClick={() => setActiveTab("reader")}
              className={`flex-1 py-3 text-xs sm:text-sm font-semibold rounded-xl transition-all flex items-center justify-center gap-2 ${
                activeTab === "reader"
                  ? "bg-gradient-to-r from-sky-500 to-indigo-500 text-slate-950 font-bold shadow-md"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              🗣️ Lector en Tiempo Real
            </button>
          </div>

          {activeTab === "editor" ? (
            /* Rich Editor Panel */
            <div className="bg-slate-900/40 rounded-2xl border border-slate-800/60 p-5 space-y-4 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-sky-400" />
                  <h2 className="font-semibold text-sm text-slate-200 uppercase tracking-wider">
                    Editor de Texto
                  </h2>
                </div>
                <button
                  onClick={() => setText("")}
                  className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
                >
                  Limpiar Editor
                </button>
              </div>

              {/* EPUB Book Upload & Chapter Index Panel */}
              <EpubChapterPanel
                onSelectChapterText={handleSelectEpubChapterText}
                currentText={text}
              />

              {/* Main Textarea */}
              <div className="relative group">
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Pega o escribe tu texto aquí para comenzar la lectura..."
                  className="w-full h-44 sm:h-52 resize-none bg-slate-950/60 rounded-xl border border-slate-800/80 p-4 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-sky-500/40 focus:border-sky-500 transition-all text-sm leading-relaxed"
                />
                <div className="absolute bottom-3 right-3 text-[10px] text-slate-500 font-mono bg-slate-900/80 px-2 py-0.5 rounded border border-slate-800/60 shadow-sm">
                  {wordCount} palabras | {charCount.toLocaleString()} caracteres <span className="text-emerald-400 font-semibold">(Sin límite)</span>
                </div>
              </div>

              {/* Optional Podcast Generator Action Bar */}
              <div className="bg-gradient-to-r from-purple-950/40 via-indigo-950/30 to-purple-900/30 border border-purple-800/40 rounded-xl p-3.5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shadow-inner">
                <div className="flex items-start sm:items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-purple-500/20 text-purple-300 border border-purple-500/30 shrink-0">
                    <Radio className="w-5 h-5 animate-pulse text-purple-300" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-purple-200 flex flex-wrap items-center gap-1.5">
                      <span>Generar Podcast con IA</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 font-mono font-bold border border-purple-500/30 uppercase tracking-wide">
                        Jw Enseñanza
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                      Transforma opcionalmente el texto pegado en un podcast conversacional con <strong className="text-purple-300 font-semibold">Gerardo ({"{{@dlg1}}"})</strong>, <strong className="text-sky-300 font-semibold">Juan ({"{{@dlg2}}"})</strong> y <strong className="text-emerald-300 font-semibold">Rosa ({"{{@dlg3}}"})</strong>.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleOpenPodcastModal}
                  disabled={isGeneratingPodcast || !text.trim()}
                  className="px-4 py-2.5 rounded-xl font-bold bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 hover:from-purple-500 hover:to-indigo-500 text-white text-xs shadow-md shadow-purple-950/40 hover:shadow-purple-900/60 active:scale-[0.97] transition-all disabled:opacity-40 disabled:pointer-events-none flex items-center justify-center gap-2 shrink-0 border border-purple-400/30 cursor-pointer"
                  title="Genera un guion conversacional extenso de podcast con el formato Jw Enseñanza"
                >
                  <Mic className="w-4 h-4 text-purple-200" />
                  <span>🎙️ Generar Podcast</span>
                </button>
              </div>

              {/* Optional Debate Generator Action Bar */}
              <div className="bg-gradient-to-r from-amber-950/40 via-orange-950/30 to-rose-950/30 border border-amber-800/40 rounded-xl p-3.5 space-y-3 shadow-inner">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                  <div className="flex items-start sm:items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/30 shrink-0">
                      <Swords className="w-5 h-5 text-amber-300 animate-pulse" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-amber-200 flex flex-wrap items-center gap-1.5">
                        <span>Generar Debate con IA</span>
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono font-bold border border-amber-500/30 uppercase tracking-wide">
                          8 Páginas / ~5,000 Palabras
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                        Simula un debate intenso entre <strong className="text-purple-300 font-semibold">Gerardo ({"{{@dlg1}}"})</strong> y <strong className="text-amber-300 font-semibold">Jorge ({"{{@dlg2}}"})</strong> sobre la postura opuesta.
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleOpenDebateModal}
                    disabled={isGeneratingDebate || !text.trim()}
                    className="px-4 py-2.5 rounded-xl font-bold bg-gradient-to-r from-amber-600 via-orange-600 to-rose-600 hover:from-amber-500 hover:to-rose-500 text-white text-xs shadow-md shadow-amber-950/40 hover:shadow-amber-900/60 active:scale-[0.97] transition-all disabled:opacity-40 disabled:pointer-events-none flex items-center justify-center gap-2 shrink-0 border border-amber-400/30 cursor-pointer"
                    title="Genera un guion de debate extenso (~5,000 palabras) entre Gerardo y Jorge"
                  >
                    <Swords className="w-4 h-4 text-amber-100" />
                    <span>⚔️ Generar Debate</span>
                  </button>
                </div>

                {/* Text Box for Jorge's Stance */}
                <div className="pt-2 border-t border-amber-800/30">
                  <label className="block text-[11px] font-semibold text-amber-200/90 mb-1 flex items-center gap-1.5">
                    <span>Postura u objeciones de Jorge en el debate (posición opuesta):</span>
                  </label>
                  <input
                    type="text"
                    value={jorgeStanceInput}
                    onChange={(e) => setJorgeStanceInput(e.target.value)}
                    placeholder="Escribe aquí la postura que defenderá Jorge en el debate..."
                    disabled={isGeneratingDebate}
                    className="w-full bg-slate-950/80 border border-amber-900/50 hover:border-amber-700/60 focus:border-amber-500 text-xs text-slate-100 placeholder:text-slate-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-amber-500/40 transition-all"
                  />
                </div>
              </div>

              {/* Checkbox: Omit Parentheses, Symbols & Emojis */}
              <label className="flex items-center gap-3 cursor-pointer group select-none text-xs bg-slate-950/80 hover:bg-slate-950 border border-slate-800/80 hover:border-slate-700/80 px-3.5 py-2.5 rounded-xl transition-all shadow-sm w-full">
                <input
                  type="checkbox"
                  checked={omitParenthesesAndSymbols}
                  onChange={(e) => setOmitParenthesesAndSymbols(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-700 text-sky-500 focus:ring-sky-500/30 bg-slate-900 cursor-pointer accent-sky-500 shrink-0"
                />
                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                  <span className="font-semibold text-slate-200 group-hover:text-sky-300 transition-colors">
                    Omitir paréntesis, símbolos y emojis
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    (Omite (...) @ # $ & * / € £ ¥ ^ &lt; &gt; \ ¶ | y emojis)
                  </span>
                </div>
              </label>

              {/* Play & Convert Actions Row */}
              <div className="flex flex-col sm:flex-row items-center gap-4 pt-2">
                <button
                  onClick={handleSynthesize}
                  disabled={isSynthesizing || !text.trim() || !selectedVoice}
                  className="w-full sm:w-auto px-5 py-3 rounded-xl font-semibold bg-gradient-to-r from-sky-500 to-indigo-500 text-slate-950 hover:from-sky-400 hover:to-indigo-400 shadow-lg shadow-sky-500/10 hover:shadow-sky-500/20 active:scale-[0.98] transition-all disabled:opacity-40 disabled:pointer-events-none flex items-center justify-center gap-2 text-sm"
                  title="Sintetiza todo el bloque de texto y lo reproduce de manera estándar"
                >
                  {isSynthesizing ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      {synthesisProgress || "Generando audio..."}
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 fill-current" />
                      Sintetizar y Reproducir
                    </>
                  )}
                </button>

                <button
                  onClick={() => setActiveTab("reader")}
                  disabled={!text.trim()}
                  className="w-full sm:w-auto px-5 py-3 rounded-xl font-semibold bg-slate-900 border border-slate-800 hover:bg-slate-800 text-sky-400 hover:text-sky-300 active:scale-[0.98] transition-all disabled:opacity-40 disabled:pointer-events-none flex items-center justify-center gap-2 text-sm"
                  title="Abre la interfaz del lector inteligente con resaltado de palabras y prebúsqueda en tiempo real"
                >
                  🗣️ Iniciar Lector ⚡
                </button>

                <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-start">
                  <button
                    onClick={handleTogglePlayback}
                    disabled={!currentAudioUrl && !text.trim()}
                    className={`p-3 rounded-xl transition-all border ${
                      isPlaying
                        ? "bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20"
                        : "bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800"
                    }`}
                    title={isPlaying ? "Pausar" : "Re-reproducir"}
                  >
                    {isPlaying ? (
                      <Pause className="w-4 h-4 stroke-[2.5px]" />
                    ) : (
                      <Play className="w-4 h-4 stroke-[2.5px] fill-current" />
                    )}
                  </button>

                  {/* Local Volume Slider */}
                  <div className="flex items-center gap-2 bg-slate-950/40 px-3 py-1.5 rounded-xl border border-slate-900 w-full sm:w-auto">
                    <button
                      onClick={() => setIsMuted(!isMuted)}
                      className="text-slate-500 hover:text-slate-300 transition-colors"
                    >
                      {isMuted || volume === 0 ? (
                        <VolumeX className="w-4 h-4 text-red-500" />
                      ) : (
                        <Volume2 className="w-4 h-4 text-sky-500" />
                      )}
                    </button>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={volume}
                      onChange={(e) => {
                        setVolume(parseFloat(e.target.value));
                        if (isMuted) setIsMuted(false);
                      }}
                      className="w-16 sm:w-20 accent-sky-500 h-1 cursor-pointer bg-slate-800 rounded-lg appearance-none"
                    />
                  </div>
                </div>
              </div>

              {/* Download synthesized audio control */}
              <div className="pt-3.5 border-t border-slate-800/50 flex flex-col gap-4">
                {currentAudioUrl && (
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3 bg-slate-950/40 border border-slate-800/40 p-3 rounded-xl">
                    <div className="flex-1">
                      <label className="block text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-1">
                        Nombre del archivo de descarga:
                      </label>
                      <input
                        type="text"
                        placeholder="ej. mi_audio_personalizado"
                        value={customFileName}
                        onChange={(e) => setCustomFileName(e.target.value)}
                        className="w-full bg-slate-900/80 border border-slate-800/80 hover:border-slate-700/80 focus:border-emerald-500/80 text-xs text-slate-100 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-emerald-500/30 transition-all placeholder:text-slate-600"
                      />
                    </div>
                    <div className="text-[10px] text-slate-500 font-mono mt-1 sm:mt-4 shrink-0">
                      .mp3
                    </div>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <p className="text-[11px] text-slate-500 font-medium">
                    {currentAudioUrl ? (
                      <span className="text-emerald-400 font-semibold flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        Audio completo listo para descargar
                      </span>
                    ) : (
                      "Sintetiza tu texto para generar el archivo de audio descargable."
                    )}
                  </p>
                  <button
                    onClick={() => {
                      if (currentAudioUrl) {
                        let finalName = customFileName.trim();
                        if (!finalName) {
                          if (text.includes("{{@dlg1}}") && text.includes("{{@dlg2}}")) {
                            finalName = formatDebateTitle(extractTopicFromContent(text) || "Discusión");
                          } else if (text.includes("{{@dlg3}}")) {
                            finalName = formatPodcastTitle(extractTopicFromContent(text) || "Enseñanza");
                          } else {
                            const topic = extractTopicFromContent(text);
                            finalName = topic ? `Audio - ${topic}` : `AudioSintetizado_${Date.now()}`;
                          }
                        }
                        
                        const safeName = sanitizeFileName(finalName, "Audio_Sintetizado");
                        const link = document.createElement("a");
                        link.href = currentAudioUrl;
                        link.download = `${safeName}.mp3`;
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                      }
                    }}
                    disabled={!currentAudioUrl}
                    className={`w-full sm:w-auto px-5 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 flex items-center justify-center gap-2 border ${
                      currentAudioUrl
                        ? "bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500/20 hover:border-emerald-400/40 shadow-md shadow-emerald-950/20 active:scale-[0.97]"
                        : "bg-slate-950/40 border-slate-850 text-slate-600 cursor-not-allowed"
                    }`}
                    title="Descargar el audio completo generado por el editor"
                  >
                    <FileAudio className="w-4 h-4" />
                    Descargar el audio
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* Immersive Real-Time Teleprompter Queue Reader */
            <RealTimeReader
              text={text}
              voices={voices}
              selectedVoice={selectedVoice}
              rate={rate}
              pitch={pitch}
              volume={volume}
              isMuted={isMuted}
              onSetApiError={setApiError}
              isReadingActive={isReadingActive}
              setIsReadingActive={setIsReadingActive}
              omitParenthesesAndSymbols={omitParenthesesAndSymbols}
              setOmitParenthesesAndSymbols={setOmitParenthesesAndSymbols}
              customFileName={customFileName}
              setCustomFileName={setCustomFileName}
            />
          )}

          {/* Speech Fine-Tuning Controls Panel */}
          <div className="bg-slate-900/40 rounded-2xl border border-slate-800/60 p-5 space-y-5">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-sky-400" />
              <h2 className="font-semibold text-sm text-slate-200 uppercase tracking-wider">
                Ajustes de Prosodia Neuronal
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {/* Speed Slider */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-300">Velocidad de Lectura</span>
                  <span className="font-mono text-sky-400 font-semibold">{rate.toFixed(2)}x</span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="2.0"
                  step="0.1"
                  value={rate}
                  onChange={(e) => setRate(parseFloat(e.target.value))}
                  className="w-full accent-sky-500 h-1.5 cursor-pointer bg-slate-950 rounded-lg appearance-none border border-slate-900"
                />
                <div className="flex justify-between text-[10px] text-slate-600">
                  <span>Lento (0.5x)</span>
                  <button onClick={() => setRate(1.10)} className="hover:text-sky-500 transition-colors">
                    Predeterminado (1.10x)
                  </button>
                  <span>Rápido (2.0x)</span>
                </div>
              </div>

              {/* Pitch Slider */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-300">Tono de Voz</span>
                  <span className="font-mono text-sky-400 font-semibold">
                    {pitch > 0 ? `+${pitch}` : pitch} Hz
                  </span>
                </div>
                <input
                  type="range"
                  min="-15"
                  max="15"
                  step="1"
                  value={pitch}
                  onChange={(e) => setPitch(parseInt(e.target.value))}
                  className="w-full accent-sky-500 h-1.5 cursor-pointer bg-slate-950 rounded-lg appearance-none border border-slate-900"
                />
                <div className="flex justify-between text-[10px] text-slate-600">
                  <span>Grave (-15Hz)</span>
                  <button onClick={() => setPitch(0)} className="hover:text-sky-500 transition-colors">
                    Normal (0Hz)
                  </button>
                  <span>Agudo (+15Hz)</span>
                </div>
              </div>
            </div>
          </div>

          {/* Interactive Dynamic Waves Visualizer */}
          <AudioVisualizer isPlaying={isPlaying || isReadingActive} />
        </section>

        {/* Right Bento Column (Voices Selection panel & Saved History logs) */}
        <section className="lg:col-span-5 flex flex-col gap-6">
          
          {/* Main voices list selection */}
          <div className="h-full">
            {isLoadingVoices ? (
              <div className="h-[400px] bg-slate-900/40 rounded-2xl border border-slate-800/60 flex flex-col justify-center items-center text-slate-500">
                <RefreshCw className="w-8 h-8 animate-spin mb-3 text-sky-500" />
                <p className="text-sm">Cargando catálogo de voces...</p>
                <p className="text-xs text-slate-600 mt-1">Conectando con el servicio Microsoft Cloud</p>
              </div>
            ) : (
              <VoiceSelector
                voices={voices}
                selectedVoice={selectedVoice}
                onSelectVoice={setSelectedVoice}
              />
            )}
          </div>

          {/* History records */}
          <HistoryPanel
            history={history}
            currentlyPlayingId={currentlyPlayingId}
            onPlayHistory={handlePlayHistory}
            onPauseHistory={handlePauseHistory}
            onDeleteHistory={handleDeleteHistory}
            onLoadText={handleLoadText}
            onClearAll={handleClearAllHistory}
          />
        </section>

      </main>

      {/* Footer information bar */}
      <footer className="border-t border-slate-900 py-6 mt-12 bg-slate-950/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-600">
          <p>© 2026 MultiTTS Lector Inteligente. Desarrollado con Microsoft Cognitive Services Proxy.</p>
          <div className="flex items-center gap-4">
            <span>Privacidad local al 100%</span>
            <span>•</span>
            <span>Soporte SSML</span>
          </div>
        </div>
      </footer>

      {/* Podcast Generator Setup Modal */}
      {isPodcastModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-purple-800/60 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 relative overflow-hidden">
            <button
              onClick={() => setIsPodcastModalOpen(false)}
              disabled={isGeneratingPodcast}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3">
              <div className="p-3 bg-purple-500/20 rounded-xl border border-purple-500/30 text-purple-300">
                <Radio className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                  Podcast Jw Enseñanza
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-purple-950 text-purple-300 border border-purple-800">
                    Gemini Flash
                  </span>
                </h3>
                <p className="text-xs text-slate-400">
                  Generación de guion conversacional extenso (~3,000 palabras)
                </p>
              </div>
            </div>

            <div className="space-y-4 text-xs text-slate-300">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-slate-200">
                    Título Inteligente del Podcast:
                  </label>
                  <button
                    type="button"
                    onClick={() => analyzeTitleWithAI("podcast")}
                    disabled={isAnalyzingPodcastTitle || isGeneratingPodcast || !text.trim()}
                    className="text-[11px] font-semibold text-purple-300 hover:text-purple-100 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-purple-950/70 hover:bg-purple-900/80 border border-purple-700/60 shadow-sm transition-all disabled:opacity-40 cursor-pointer active:scale-95"
                    title="Analizar el contenido del editor con IA para generar o actualizar el título inteligente"
                  >
                    {isAnalyzingPodcastTitle ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-300" />
                        <span>Analizando con IA...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5 text-purple-300" />
                        <span>✨ Sugerir con IA</span>
                      </>
                    )}
                  </button>
                </div>
                <div className="relative">
                  <input
                    type="text"
                    value={podcastTitleInput}
                    onChange={(e) => setPodcastTitleInput(e.target.value)}
                    placeholder="ej. Podcast - Descubriendo las promesas del Reino"
                    disabled={isGeneratingPodcast || isAnalyzingPodcastTitle}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all disabled:opacity-70"
                  />
                  {isAnalyzingPodcastTitle && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-purple-400 text-xs font-mono">
                      <Loader2 className="w-4 h-4 animate-spin" />
                    </div>
                  )}
                </div>
                <p className="text-[10px] text-purple-300/80 mt-1 flex items-center gap-1">
                  <span>💡</span> El título se analiza automáticamente con IA examinando el contenido del editor de texto.
                </p>
              </div>

              <div className="bg-slate-950/60 rounded-xl p-3.5 border border-slate-800/80 space-y-2">
                <div className="font-semibold text-purple-300 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" /> Estructura y Voces Asignadas:
                </div>
                <ul className="list-disc list-inside space-y-1 text-[11px] text-slate-400 leading-relaxed">
                  <li><strong>Etiquetas de diálogo:</strong> <code className="text-purple-300 font-mono font-bold">{"{{@dlg1}}"}</code> Gerardo (Instructor), <code className="text-sky-300 font-mono font-bold">{"{{@dlg2}}"}</code> Juan (Aprendiz), <code className="text-emerald-300 font-mono font-bold">{"{{@dlg3}}"}</code> Rosa (Aprendiz).</li>
                  <li><strong>Tono:</strong> Clase magistral cercana y conversacional entre amigos.</li>
                  <li><strong>Lecturas bíblicas:</strong> Invita a la audiencia a buscar los pasajes y los analiza minuciosamente.</li>
                  <li><strong>Formato automático:</strong> Inicia directamente con la primera línea de diálogo (<code className="text-purple-300 font-mono font-bold">{"{{@dlg1}}"}</code>) sin títulos ni encabezados, y finaliza con <em className="text-slate-200 font-semibold font-mono">"Podcast completo."</em></li>
                </ul>
              </div>

              {isGeneratingPodcast && (
                <div className="bg-purple-950/40 border border-purple-800/60 rounded-xl p-4 flex items-center gap-3 animate-pulse">
                  <Loader2 className="w-5 h-5 text-purple-400 animate-spin shrink-0" />
                  <div>
                    <p className="font-semibold text-purple-200 text-xs">Creando guion extenso con Inteligencia Artificial...</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Esto puede tomar de 10 a 25 segundos para redactar las ~3,000 palabras estructuradas.</p>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-800/80">
              <button
                type="button"
                onClick={() => setIsPodcastModalOpen(false)}
                disabled={isGeneratingPodcast}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors disabled:opacity-50 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleExecutePodcastGeneration}
                disabled={isGeneratingPodcast || !podcastTitleInput.trim()}
                className="px-5 py-2.5 rounded-xl font-bold bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs shadow-lg shadow-purple-900/40 active:scale-[0.97] transition-all disabled:opacity-40 disabled:pointer-events-none flex items-center gap-2 cursor-pointer"
              >
                {isGeneratingPodcast ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-purple-200" />
                    <span>Generando...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Generar Podcast Ahora</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Debate Generator Setup Modal */}
      {isDebateModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-amber-800/60 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 relative overflow-hidden">
            <button
              onClick={() => setIsDebateModalOpen(false)}
              disabled={isGeneratingDebate}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3">
              <div className="p-3 bg-amber-500/20 rounded-xl border border-amber-500/30 text-amber-300">
                <Swords className="w-6 h-6 animate-pulse text-amber-300" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                  Debate de Posturas Opuestas
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-amber-950 text-amber-300 border border-amber-800">
                    Gemini Flash
                  </span>
                </h3>
                <p className="text-xs text-slate-400">
                  Generación de debate continuo extenso (8 páginas / ~5,000 palabras)
                </p>
              </div>
            </div>

            <div className="space-y-4 text-xs text-slate-300">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-slate-200">
                    Título Inteligente del Debate:
                  </label>
                  <button
                    type="button"
                    onClick={() => analyzeTitleWithAI("debate")}
                    disabled={isAnalyzingDebateTitle || isGeneratingDebate || !text.trim()}
                    className="text-[11px] font-semibold text-amber-300 hover:text-amber-100 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-950/70 hover:bg-amber-900/80 border border-amber-700/60 shadow-sm transition-all disabled:opacity-40 cursor-pointer active:scale-95"
                    title="Analizar el contenido del editor con IA para generar o actualizar el título inteligente de debate"
                  >
                    {isAnalyzingDebateTitle ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-300" />
                        <span>Analizando con IA...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                        <span>✨ Sugerir con IA</span>
                      </>
                    )}
                  </button>
                </div>
                <div className="relative">
                  <input
                    type="text"
                    value={debateTitleInput}
                    onChange={(e) => setDebateTitleInput(e.target.value)}
                    placeholder="ej. Debate - Libre albedrío y determinismo"
                    disabled={isGeneratingDebate || isAnalyzingDebateTitle}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition-all disabled:opacity-70"
                  />
                  {isAnalyzingDebateTitle && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-amber-400 text-xs font-mono">
                      <Loader2 className="w-4 h-4 animate-spin" />
                    </div>
                  )}
                </div>
                <p className="text-[10px] text-amber-300/80 mt-1 flex items-center gap-1">
                  <span>💡</span> El título se analiza automáticamente con IA extrayendo el conflicto central del texto en el editor.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-amber-300 mb-1.5">
                  Postura u objeciones de Jorge (posición opuesta):
                </label>
                <textarea
                  value={jorgeStanceInput}
                  onChange={(e) => setJorgeStanceInput(e.target.value)}
                  placeholder="Escribe la postura, objeciones o argumentos principales que defenderá Jorge en el debate con firmeza..."
                  rows={3}
                  disabled={isGeneratingDebate}
                  className="w-full bg-slate-950 border border-amber-900/60 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition-all resize-none"
                />
              </div>

              <div className="bg-slate-950/60 rounded-xl p-3.5 border border-slate-800/80 space-y-2">
                <div className="font-semibold text-amber-300 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" /> Dinámica del Debate:
                </div>
                <ul className="list-disc list-inside space-y-1 text-[11px] text-slate-400 leading-relaxed">
                  <li><strong>Etiquetas de diálogo:</strong> <code className="text-purple-300 font-mono font-bold">{"{{@dlg1}}"}</code> Gerardo (Defiende fuentes), <code className="text-amber-300 font-mono font-bold">{"{{@dlg2}}"}</code> Jorge (Defiende postura opuesta).</li>
                  <li><strong>Estructura:</strong> Gerardo dedica 80% a argumentar y refutar activamente las objeciones de Jorge.</li>
                  <li><strong>Debates teológicos:</strong> Los debatientes invitan a la audiencia a buscar y leer los textos bíblicos clave, explicando detalladamente su relación con el tema defendido o refutado.</li>
                  <li><strong>Estilo de Jorge:</strong> Inteligente, terco, lógico y perspicaz; no da su brazo a torcer.</li>
                  <li><strong>Formato limpio:</strong> Inicia directamente con la etiqueta (<code className="text-purple-300 font-mono font-bold">{"{{@dlg1}}"}</code> / <code className="text-amber-300 font-mono font-bold">{"{{@dlg2}}"}</code>) seguida del diálogo sin nombres repetidos ni prefijos (ej. sin <em>"Jorge:"</em>).</li>
                </ul>
              </div>

              {isGeneratingDebate && (
                <div className="bg-amber-950/40 border border-amber-800/60 rounded-xl p-4 flex items-center gap-3 animate-pulse">
                  <Loader2 className="w-5 h-5 text-amber-400 animate-spin shrink-0" />
                  <div>
                    <p className="font-semibold text-amber-200 text-xs">Creando debate extenso con Inteligencia Artificial...</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Esto tomará entre 15 y 30 segundos para redactar las ~5,000 palabras estructuradas.</p>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-800/80">
              <button
                type="button"
                onClick={() => setIsDebateModalOpen(false)}
                disabled={isGeneratingDebate}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors disabled:opacity-50 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleExecuteDebateGeneration}
                disabled={isGeneratingDebate || !debateTitleInput.trim()}
                className="px-5 py-2.5 rounded-xl font-bold bg-gradient-to-r from-amber-600 via-orange-600 to-rose-600 hover:from-amber-500 hover:to-rose-500 text-white text-xs shadow-lg shadow-amber-900/40 active:scale-[0.97] transition-all disabled:opacity-40 disabled:pointer-events-none flex items-center gap-2 cursor-pointer"
              >
                {isGeneratingDebate ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-amber-200" />
                    <span>Generando...</span>
                  </>
                ) : (
                  <>
                    <Swords className="w-4 h-4" />
                    <span>Generar Debate Ahora</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
