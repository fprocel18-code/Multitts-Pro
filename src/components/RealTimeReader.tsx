import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { 
  Play, 
  Pause, 
  Square, 
  SkipForward, 
  SkipBack, 
  Loader2, 
  BookOpen, 
  CheckCircle,
  FileAudio,
  SlidersHorizontal,
  Zap,
  Users,
  Copy,
  Check,
  Sparkles,
  Download,
  X
} from "lucide-react";
import { Voice } from "../types";
import { parseDialogueChunks, buildDialogueVoiceMappings } from "../utils/dialogue";
import { extractTopicFromContent, formatDebateTitle, formatPodcastTitle, sanitizeFileName } from "../utils/titleUtils";

interface RealTimeReaderProps {
  text: string;
  voices: Voice[];
  selectedVoice: Voice | null;
  rate: number;
  pitch: number;
  volume: number;
  isMuted: boolean;
  onSetApiError: (error: string | null) => void;
  isReadingActive: boolean;
  setIsReadingActive: (active: boolean) => void;
  omitParenthesesAndSymbols?: boolean;
  setOmitParenthesesAndSymbols?: (omit: boolean) => void;
  customFileName?: string;
  setCustomFileName?: (name: string) => void;
}

interface ChunkAudioState {
  blob: Blob | null;
  url: string;
  loading: boolean;
  error: boolean;
}

export default function RealTimeReader({
  text,
  voices,
  selectedVoice,
  rate,
  pitch,
  volume,
  isMuted,
  onSetApiError,
  isReadingActive,
  setIsReadingActive,
  omitParenthesesAndSymbols: propOmit,
  setOmitParenthesesAndSymbols: propSetOmit,
  customFileName,
  setCustomFileName,
}: RealTimeReaderProps) {
  // Config state: Sentences sent per server request (1 to 5, default 5)
  const [sentencesPerChunk, setSentencesPerChunk] = useState<number>(5);
  const [localOmit, setLocalOmit] = useState<boolean>(true);

  const omitParenthesesAndSymbols = propOmit !== undefined ? propOmit : localOmit;
  const setOmitParenthesesAndSymbols = propSetOmit !== undefined ? propSetOmit : setLocalOmit;

  const [showTagGuide, setShowTagGuide] = useState<boolean>(false);
  const [copiedTag, setCopiedTag] = useState<string | null>(null);

  // Build tag-to-voice mapping for the guide
  const dialogueMappings = useMemo(() => {
    return buildDialogueVoiceMappings(voices, selectedVoice);
  }, [voices, selectedVoice]);

  // Group sentences into dialogue-aware chunks based on slider setting (1..5) and clean reading setting
  const chunks = useMemo(() => {
    return parseDialogueChunks(text, voices, selectedVoice, sentencesPerChunk, omitParenthesesAndSymbols);
  }, [text, voices, selectedVoice, sentencesPerChunk, omitParenthesesAndSymbols]);

  // Audio queue and caching states
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const currentIndexRef = useRef<number>(0);
  useEffect(() => {
    currentIndexRef.current = currentIndex;
  }, [currentIndex]);

  const [playbackState, setPlaybackState] = useState<"idle" | "playing" | "paused">("idle");
  const playbackStateRef = useRef<"idle" | "playing" | "paused">("idle");
  const [chunkAudios, setChunkAudios] = useState<Record<number, ChunkAudioState>>({});

  const updatePlaybackState = (state: "idle" | "playing" | "paused") => {
    playbackStateRef.current = state;
    setPlaybackState(state);
  };
  
  // Audio playback metrics
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0.1);
  const [isLoadingActiveChunk, setIsLoadingActiveChunk] = useState<boolean>(false);

  // Background synthesis state & completion notification banner
  const [allReadyBanner, setAllReadyBanner] = useState<boolean>(false);
  const hasNotifiedAllSynthesizedRef = useRef<boolean>(false);
  const syncEpochRef = useRef<number>(0);

  // Buffer assembly downloading state
  const [downloadProgress, setDownloadProgress] = useState<{
    isActive: boolean;
    current: number;
    total: number;
    phase: "fetching" | "merging" | "done";
  } | null>(null);

  // References to Dual Audio Players (Ping-Pong) for 100% click-free transitions
  const audioRefA = useRef<HTMLAudioElement | null>(null);
  const audioRefB = useRef<HTMLAudioElement | null>(null);
  const activePlayerIndexRef = useRef<0 | 1>(0);

  const activeChunkRef = useRef<HTMLDivElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  const audioCacheRef = useRef<Map<number, ChunkAudioState>>(new Map());
  const activeFetchesRef = useRef<Map<number, Promise<ChunkAudioState | null>>>(new Map());

  // Calculated metrics
  const synthesizedChunksCount = useMemo(() => {
    return chunks.filter((_, i) => {
      const c = chunkAudios[i];
      return c && c.blob && !c.error;
    }).length;
  }, [chunks, chunkAudios]);

  const isAllSynthesized = chunks.length > 0 && synthesizedChunksCount === chunks.length;
  const synthesisProgressPct = chunks.length > 0 ? Math.round((synthesizedChunksCount / chunks.length) * 100) : 0;

  // Helper to lazily initialize player A and player B
  const getPlayers = () => {
    if (!audioRefA.current) {
      audioRefA.current = new Audio();
      audioRefA.current.preload = "auto";
    }
    if (!audioRefB.current) {
      audioRefB.current = new Audio();
      audioRefB.current.preload = "auto";
    }

    const activeAudio = activePlayerIndexRef.current === 0 ? audioRefA.current : audioRefB.current;
    const inactiveAudio = activePlayerIndexRef.current === 0 ? audioRefB.current : audioRefA.current;

    return { activeAudio, inactiveAudio };
  };

  // Helper to safely clamp volume values between 0 and 1
  const safeVolume = (v: number): number => {
    if (isNaN(v) || !isFinite(v)) return 0;
    return Math.max(0, Math.min(1, v));
  };

  // Clean up Blob URLs to prevent memory leaks and reset audio sources safely
  const clearAudioCache = () => {
    if (audioRefA.current) {
      audioRefA.current.onplay = null;
      audioRefA.current.onpause = null;
      audioRefA.current.onended = null;
      audioRefA.current.ontimeupdate = null;
      audioRefA.current.onerror = null;
      audioRefA.current.pause();
      audioRefA.current.removeAttribute("src");
    }
    if (audioRefB.current) {
      audioRefB.current.onplay = null;
      audioRefB.current.onpause = null;
      audioRefB.current.onended = null;
      audioRefB.current.ontimeupdate = null;
      audioRefB.current.onerror = null;
      audioRefB.current.pause();
      audioRefB.current.removeAttribute("src");
    }
    audioCacheRef.current.forEach((item) => {
      if (item.url) {
        try {
          URL.revokeObjectURL(item.url);
        } catch (e) {}
      }
    });
    audioCacheRef.current.clear();
    activeFetchesRef.current.clear();
  };

  // Sync volume with parent settings
  useEffect(() => {
    const targetVolume = safeVolume(isMuted ? 0 : volume);
    if (audioRefA.current) {
      try { audioRefA.current.volume = targetVolume; } catch (e) {}
    }
    if (audioRefB.current) {
      try { audioRefB.current.volume = targetVolume; } catch (e) {}
    }
  }, [volume, isMuted]);

  // Stop reading session completely
  const stopReading = () => {
    if (audioRefA.current) {
      audioRefA.current.onplay = null;
      audioRefA.current.onpause = null;
      audioRefA.current.onended = null;
      audioRefA.current.ontimeupdate = null;
      audioRefA.current.onerror = null;
      audioRefA.current.pause();
      try { audioRefA.current.currentTime = 0; } catch (e) {}
    }
    if (audioRefB.current) {
      audioRefB.current.onplay = null;
      audioRefB.current.onpause = null;
      audioRefB.current.onended = null;
      audioRefB.current.ontimeupdate = null;
      audioRefB.current.onerror = null;
      audioRefB.current.pause();
      try { audioRefB.current.currentTime = 0; } catch (e) {}
    }
    updatePlaybackState("idle");
    setIsReadingActive(false);
    setCurrentTime(0);
    setDuration(0.1);
  };

  // Clean up on component unmount
  useEffect(() => {
    return () => {
      stopReading();
      clearAudioCache();
      if (audioRefA.current) {
        audioRefA.current.pause();
        audioRefA.current = null;
      }
      if (audioRefB.current) {
        audioRefB.current.pause();
        audioRefB.current = null;
      }
    };
  }, []);

  // Smooth scroll to active chunk
  useEffect(() => {
    if (activeChunkRef.current && scrollContainerRef.current) {
      activeChunkRef.current.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  }, [currentIndex, isReadingActive]);

  // Fetch audio for a single chunk from API with retries
  const fetchChunkAudio = useCallback((index: number, forceRetry = false): Promise<ChunkAudioState | null> => {
    if (index < 0 || index >= chunks.length) return Promise.resolve(null);

    // 1. Check in-memory cache (unless forcing a retry)
    if (!forceRetry && audioCacheRef.current.has(index)) {
      const cached = audioCacheRef.current.get(index)!;
      if (cached.url || cached.loading) {
        return Promise.resolve(cached);
      }
    }

    // 2. Check active pending fetch
    if (activeFetchesRef.current.has(index) && !forceRetry) {
      return activeFetchesRef.current.get(index)!;
    }

    // 3. Start fetching from backend with retries
    const loadingState: ChunkAudioState = { blob: null, url: "", loading: true, error: false };
    audioCacheRef.current.set(index, loadingState);
    setChunkAudios((prev) => ({ ...prev, [index]: loadingState }));

    const targetVoiceCode = chunks[index].voice ? chunks[index].voice.code : (selectedVoice?.code || "es-MX-JorgeNeural");

    const fetchPromise = (async () => {
      let retries = 3;
      let lastErr: any = null;

      for (let attempt = 1; attempt <= retries; attempt++) {
        try {
          const res = await fetch("/api/tts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              text: chunks[index].text,
              voice: targetVoiceCode,
              rate,
              pitch,
            }),
          });

          if (!res.ok) throw new Error(`HTTP error ${res.status}`);

          const blob = await res.blob();
          if (blob.size === 0) throw new Error("Audio blob is empty");
          const url = URL.createObjectURL(blob);

          const successState: ChunkAudioState = { blob, url, loading: false, error: false };
          audioCacheRef.current.set(index, successState);
          setChunkAudios((prev) => ({ ...prev, [index]: successState }));

          // Check if this chunk completes all chunks
          const completedCount = chunks.filter((_, i) => {
            const c = audioCacheRef.current.get(i);
            return c && c.blob && !c.error;
          }).length;

          if (completedCount === chunks.length && !hasNotifiedAllSynthesizedRef.current) {
            hasNotifiedAllSynthesizedRef.current = true;
            setAllReadyBanner(true);
          }

          return successState;
        } catch (err: any) {
          lastErr = err;
          console.warn(`Intento ${attempt} fallido para fragmento ${index + 1}:`, err?.message || err);
          if (attempt < retries) {
            await new Promise((r) => setTimeout(r, 500 * attempt));
          }
        }
      }

      console.error(`Error al obtener fragmento ${index + 1} tras ${retries} intentos:`, lastErr);
      const errorState: ChunkAudioState = { blob: null, url: "", loading: false, error: true };
      audioCacheRef.current.set(index, errorState);
      setChunkAudios((prev) => ({ ...prev, [index]: errorState }));
      return errorState;
    })();

    activeFetchesRef.current.set(index, fetchPromise);
    return fetchPromise;
  }, [chunks, selectedVoice, rate, pitch]);

  // Continuous Full-Text Background Synthesis Engine
  // Automatically processes all chunks continuously in parallel while reading
  useEffect(() => {
    stopReading();
    clearAudioCache();
    setChunkAudios({});
    setCurrentIndex(0);
    setAllReadyBanner(false);
    hasNotifiedAllSynthesizedRef.current = false;

    if (chunks.length === 0) return;

    const currentEpoch = ++syncEpochRef.current;
    const CONCURRENCY = 2; // 2 balanced concurrent synthesis workers

    const getPriorityQueue = (): number[] => {
      const cur = currentIndexRef.current;
      const list: number[] = [];

      // 1. Current and immediate next chunks (highest priority for seamless listening)
      for (let i = 0; i <= 3; i++) {
        const idx = cur + i;
        if (idx < chunks.length) list.push(idx);
      }
      // 2. All subsequent forward chunks till the end
      for (let i = cur + 4; i < chunks.length; i++) {
        list.push(i);
      }
      // 3. Preceding chunks (from 0 to cur - 1)
      for (let i = 0; i < cur; i++) {
        list.push(i);
      }

      // Filter to only items not yet fetched and not actively in flight
      return list.filter((idx) => {
        const cached = audioCacheRef.current.get(idx);
        return !cached || (!cached.blob && !cached.loading);
      });
    };

    const runWorker = async () => {
      while (syncEpochRef.current === currentEpoch) {
        const queue = getPriorityQueue();
        if (queue.length === 0) {
          // Check if all are loaded
          const allDone = chunks.every((_, i) => {
            const c = audioCacheRef.current.get(i);
            return c && c.blob && !c.error;
          });
          if (allDone && !hasNotifiedAllSynthesizedRef.current) {
            hasNotifiedAllSynthesizedRef.current = true;
            setAllReadyBanner(true);
          }
          break;
        }

        const nextIdx = queue[0];
        try {
          await fetchChunkAudio(nextIdx);
        } catch (e) {
          await new Promise((r) => setTimeout(r, 600));
        }
      }
    };

    // Spawn concurrent workers
    for (let c = 0; c < CONCURRENCY; c++) {
      runWorker();
    }
  }, [text, selectedVoice, rate, pitch, sentencesPerChunk, omitParenthesesAndSymbols, chunks, fetchChunkAudio]);

  // Trigger high-priority prefetching when active index changes
  const triggerPrefetch = (idx: number) => {
    for (let offset = 0; offset <= 3; offset++) {
      const targetIdx = idx + offset;
      if (targetIdx >= 0 && targetIdx < chunks.length) {
        fetchChunkAudio(targetIdx);
      }
    }
  };

  // Play a specific chunk using Dual Audio Players (Ping-Pong) + Pre-buffering + Micro Crossfade
  const playChunk = async (index: number) => {
    if (index < 0 || index >= chunks.length) {
      stopReading();
      return;
    }

    onSetApiError(null);
    setCurrentIndex(index);
    updatePlaybackState("playing");
    setIsReadingActive(true);

    triggerPrefetch(index);

    const targetVolume = isMuted ? 0 : volume;
    const { activeAudio, inactiveAudio } = getPlayers();

    const cached = audioCacheRef.current.get(index);

    const executePlayback = (url: string) => {
      let currentPlayingObj: HTMLAudioElement;
      let previousPlayingObj: HTMLAudioElement;

      // Check if inactive player was already preloaded with this URL
      if (inactiveAudio.src === url || (url && inactiveAudio.src.endsWith(url))) {
        // Switch active player (Ping-Pong switch)
        currentPlayingObj = inactiveAudio;
        previousPlayingObj = activeAudio;
        activePlayerIndexRef.current = activePlayerIndexRef.current === 0 ? 1 : 0;
      } else {
        currentPlayingObj = activeAudio;
        previousPlayingObj = inactiveAudio;
        if (currentPlayingObj.src !== url) {
          currentPlayingObj.pause();
          currentPlayingObj.src = url;
          currentPlayingObj.load();
        }
      }

      // Stop previous player cleanly
      if (!previousPlayingObj.paused) {
        previousPlayingObj.pause();
      }

      let nextTriggered = false;

      currentPlayingObj.ontimeupdate = () => {
        if (getPlayers().activeAudio === currentPlayingObj) {
          setCurrentTime(currentPlayingObj.currentTime);
          setDuration(currentPlayingObj.duration || 0.1);

          // Fast dialogue handover: calibrated to ~0.08s before end to ensure 100% gapless turnover without cutting words
          if (currentPlayingObj.duration && currentPlayingObj.duration > 0.4 && !nextTriggered) {
            if (currentPlayingObj.currentTime >= currentPlayingObj.duration - 0.08) {
              nextTriggered = true;
              if (index + 1 < chunks.length) {
                const pauseMatch = chunks[index]?.text?.match(/\{\{@\~(\d+)\}\}/);
                const pauseMs = pauseMatch ? parseInt(pauseMatch[1], 10) : 0;

                if (pauseMs > 0) {
                  setTimeout(() => {
                    if (playbackStateRef.current === "playing") {
                      playChunk(index + 1);
                    }
                  }, pauseMs);
                } else {
                  playChunk(index + 1);
                }
              } else {
                stopReading();
              }
            }
          }
        }
      };

      currentPlayingObj.onended = () => {
        if (getPlayers().activeAudio === currentPlayingObj && !nextTriggered) {
          nextTriggered = true;
          if (index + 1 < chunks.length) {
            const pauseMatch = chunks[index]?.text?.match(/\{\{@\~(\d+)\}\}/);
            const pauseMs = pauseMatch ? parseInt(pauseMatch[1], 10) : 0;

            if (pauseMs > 0) {
              setTimeout(() => {
                if (playbackStateRef.current === "playing") {
                  playChunk(index + 1);
                }
              }, pauseMs);
            } else {
              playChunk(index + 1);
            }
          } else {
            stopReading();
          }
        }
      };

      currentPlayingObj.onerror = () => {
        if (getPlayers().activeAudio === currentPlayingObj && currentPlayingObj.src && currentPlayingObj.src.startsWith("blob:")) {
          console.warn("Audio playback issue detected on chunk:", index + 1);
          setIsLoadingActiveChunk(false);
          onSetApiError("Error al reproducir el fragmento " + (index + 1));
          updatePlaybackState("paused");
        }
      };

      // Set volume immediately to target volume before play to guarantee the first syllable is crystal clear
      try {
        currentPlayingObj.volume = targetVolume;
      } catch (e) {}

      // Start playback immediately at full target volume
      currentPlayingObj.play().then(() => {
        setIsLoadingActiveChunk(false);
        updatePlaybackState("playing");
        try {
          currentPlayingObj.volume = targetVolume;
        } catch (e) {}

        // Immediately preload next chunk (index + 1) onto the now-inactive player!
        const nextIdx = index + 1;
        if (nextIdx < chunks.length) {
          fetchChunkAudio(nextIdx).then((nextCached) => {
            if (nextCached && nextCached.url && nextCached.url.startsWith("blob:")) {
              const { inactiveAudio: futureInactive } = getPlayers();
              if (futureInactive && futureInactive.src !== nextCached.url) {
                futureInactive.onerror = null;
                futureInactive.src = nextCached.url;
                futureInactive.load(); // Pre-fetches byte 0 and decodes MP3 header in background!
              }
            }
          });
          // Also prefetch future chunks into memory reservoir
          triggerPrefetch(nextIdx);
        }
      }).catch((err) => {
        if (err?.name !== "AbortError") {
          console.warn("Playback start notice:", err?.message || err);
          setIsLoadingActiveChunk(false);
          updatePlaybackState("paused");
        }
      });
    };

    if (cached && cached.url && !cached.loading && !cached.error) {
      setIsLoadingActiveChunk(false);
      executePlayback(cached.url);
    } else {
      setIsLoadingActiveChunk(true);
      try {
        const fetched = await fetchChunkAudio(index, cached?.error ? true : false);
        if (fetched && fetched.url) {
          executePlayback(fetched.url);
        } else {
          throw new Error("No URL available");
        }
      } catch (err) {
        setIsLoadingActiveChunk(false);
        onSetApiError("No se pudo cargar el audio para el fragmento " + (index + 1));
        updatePlaybackState("paused");
      }
    }
  };

  // Pause reading
  const pauseReading = () => {
    const { activeAudio, inactiveAudio } = getPlayers();
    activeAudio.pause();
    inactiveAudio.pause();
    updatePlaybackState("paused");
  };

  // Toggle Play / Pause
  const togglePlayPause = () => {
    const targetVolume = isMuted ? 0 : volume;
    const { activeAudio } = getPlayers();

    if (playbackState === "idle") {
      playChunk(0);
    } else if (playbackState === "playing") {
      pauseReading();
    } else if (playbackState === "paused") {
      const hasValidSrc = activeAudio && activeAudio.src && activeAudio.src.startsWith("blob:");
      if (hasValidSrc) {
        try {
          activeAudio.volume = targetVolume;
        } catch (e) {}
        activeAudio.play().then(() => {
          updatePlaybackState("playing");
        }).catch((err) => {
          if (err?.name !== "AbortError") {
            playChunk(currentIndex);
          }
        });
      } else {
        playChunk(currentIndex);
      }
    }
  };

  // Skip Forward
  const handleNext = () => {
    if (currentIndex < chunks.length - 1) {
      playChunk(currentIndex + 1);
    }
  };

  // Skip Backward
  const handlePrev = () => {
    if (currentIndex > 0) {
      playChunk(currentIndex - 1);
    }
  };

  // Copy tag helper
  const handleCopyTag = (tag: string) => {
    navigator.clipboard.writeText(tag);
    setCopiedTag(tag);
    setTimeout(() => setCopiedTag(null), 1500);
  };

  // Concatenate all chunk audio files sequentially and trigger download
  const handleDownloadFullAudio = async () => {
    if (chunks.length === 0) return;
    onSetApiError(null);
    
    setDownloadProgress({
      isActive: true,
      current: 0,
      total: chunks.length,
      phase: "fetching",
    });

    try {
      const finalBlobs: Blob[] = [];

      for (let i = 0; i < chunks.length; i++) {
        setDownloadProgress((prev) => prev ? { ...prev, current: i + 1 } : null);
        
        const cached = audioCacheRef.current.get(i);
        if (cached && cached.blob && !cached.error) {
          finalBlobs.push(cached.blob);
        } else {
          const fetched = await fetchChunkAudio(i);
          if (fetched && fetched.blob) {
            finalBlobs.push(fetched.blob);
          } else {
            throw new Error(`No se pudo obtener el audio del fragmento ${i + 1}`);
          }
        }
      }

      setDownloadProgress((prev) => prev ? { ...prev, phase: "merging" } : null);
      
      const arrayBuffers = await Promise.all(finalBlobs.map((b) => b.arrayBuffer()));
      const totalLength = arrayBuffers.reduce((acc, ab) => acc + ab.byteLength, 0);
      
      const combinedBuffer = new Uint8Array(totalLength);
      let offset = 0;
      for (const ab of arrayBuffers) {
        combinedBuffer.set(new Uint8Array(ab), offset);
        offset += ab.byteLength;
      }

      const mergedBlob = new Blob([combinedBuffer], { type: "audio/mpeg" });
      const mergedUrl = URL.createObjectURL(mergedBlob);

      // Determine proper file name for download
      let resolvedName = customFileName?.trim() || "";
      if (!resolvedName) {
        if (text.includes("{{@dlg1}}") && text.includes("{{@dlg2}}")) {
          resolvedName = formatDebateTitle(extractTopicFromContent(text) || "Discusión");
        } else if (text.includes("{{@dlg3}}")) {
          resolvedName = formatPodcastTitle(extractTopicFromContent(text) || "Enseñanza");
        } else {
          const topic = extractTopicFromContent(text);
          resolvedName = topic ? `Audio - ${topic}` : `Audio_Dialogo_${Date.now()}`;
        }
        if (setCustomFileName) {
          setCustomFileName(resolvedName);
        }
      }

      const safeName = sanitizeFileName(resolvedName, "Audio_Completo");

      const link = document.createElement("a");
      link.href = mergedUrl;
      link.download = `${safeName}.mp3`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setDownloadProgress((prev) => prev ? { ...prev, phase: "done" } : null);
      setTimeout(() => setDownloadProgress(null), 1500);
    } catch (err: any) {
      console.error("Concatenation failed:", err);
      onSetApiError("Error al generar el archivo de descarga completo: " + err.message);
      setDownloadProgress(null);
    }
  };

  if (chunks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 bg-slate-900/20 rounded-2xl border border-dashed border-slate-800/60 text-slate-500 text-center">
        <BookOpen className="w-10 h-10 mb-3 opacity-30 text-sky-500" />
        <p className="font-semibold text-sm">El lector en tiempo real está vacío</p>
        <p className="text-xs text-slate-600 mt-1 max-w-sm">
          Por favor, escribe o pega algún texto en la pestaña del Editor para comenzar.
        </p>
      </div>
    );
  }

  const renderTextWithBadges = (rawText: string) => {
    const parts = rawText.split(/(\{\{\@\~\d+\}\})/g);
    if (parts.length === 1) return rawText;

    return parts.map((part, index) => {
      const match = part.match(/^\{\{\@\~(\d+)\}\}$/);
      if (match) {
        const ms = parseInt(match[1], 10);
        const sec = (ms / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 });
        return (
          <span
            key={index}
            className="inline-flex items-center gap-1 px-1.5 py-0.5 mx-1 rounded text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 select-none align-middle"
            title={`Pausa programada de ${ms} ms (${sec} s)`}
          >
            ⏱️ {ms}ms
          </span>
        );
      }
      return part;
    });
  };

  return (
    <div className="flex flex-col h-full bg-slate-900/40 rounded-2xl border border-slate-800/60 overflow-hidden space-y-0">
      
      {/* Title Header bar */}
      <div className="p-4 border-b border-slate-800/60 bg-slate-900/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-sky-400 animate-pulse" />
          <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
            Lectura en Tiempo Real (Streaming Continuo Multivoz)
          </h3>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Continuous Synthesis Live Status Badge */}
          {isAllSynthesized ? (
            <div className="flex items-center gap-1.5 text-[11px] text-emerald-300 font-semibold bg-emerald-950/80 px-2.5 py-1 rounded-md border border-emerald-800/70 shadow-sm animate-in fade-in">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              <span>100% Sintetizado ({chunks.length}/{chunks.length})</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-[11px] text-sky-300 font-medium bg-sky-950/80 px-2.5 py-1 rounded-md border border-sky-800/60 shadow-sm">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-sky-400" />
              <span>Sintetizando {synthesizedChunksCount}/{chunks.length} ({synthesisProgressPct}%)</span>
            </div>
          )}

          <button
            onClick={() => setShowTagGuide(!showTagGuide)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all flex items-center gap-1.5 ${
              showTagGuide 
                ? "bg-purple-950/80 border-purple-700/80 text-purple-300" 
                : "bg-slate-950/80 border-slate-800 text-slate-400 hover:text-slate-200"
            }`}
            title="Ver etiquetas de voces para diálogos"
          >
            <Users className="w-3.5 h-3.5 text-purple-400" />
            <span>Etiquetas Diálogo</span>
          </button>

          <div className="text-[11px] text-slate-400 font-mono bg-slate-950/80 px-2.5 py-1 rounded-md border border-slate-800">
            Fragmento {playbackState === "idle" ? 0 : currentIndex + 1} de {chunks.length}
          </div>
        </div>
      </div>

      {/* Global Background Synthesis Progress Bar */}
      <div className="w-full bg-slate-950/80 h-1 overflow-hidden relative border-b border-slate-800/40">
        <div 
          className={`h-full transition-all duration-300 ${
            isAllSynthesized 
              ? "bg-gradient-to-r from-emerald-500 to-teal-400 shadow-sm shadow-emerald-500/50" 
              : "bg-gradient-to-r from-sky-500 via-indigo-500 to-purple-500"
          }`}
          style={{ width: `${synthesisProgressPct}%` }}
        />
      </div>

      {/* All Synthesized Ready Toast Banner */}
      {allReadyBanner && isAllSynthesized && (
        <div className="mx-4 mt-3 p-3.5 bg-gradient-to-r from-emerald-950/90 via-teal-950/90 to-slate-900/90 border border-emerald-600/60 rounded-xl shadow-lg shadow-emerald-950/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 shrink-0">
              <CheckCircle className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-emerald-200 flex items-center gap-2">
                ¡Todos los {chunks.length} fragmentos sintetizados con éxito!
                <span className="text-[10px] bg-emerald-900/80 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-700/60 font-mono">100%</span>
              </h4>
              <p className="text-[11px] text-emerald-300/80 mt-0.5">
                Ya puedes escuchar sin ningún retraso y descargar el audio completo en MP3 instantáneamente sin esperas.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              onClick={handleDownloadFullAudio}
              className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-md shadow-emerald-950/30 flex items-center gap-1.5 transition-all active:scale-[0.97]"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Descargar MP3 Ahora</span>
            </button>
            <button
              onClick={() => setAllReadyBanner(false)}
              className="p-1.5 rounded-lg text-emerald-400/70 hover:text-emerald-200 hover:bg-emerald-900/40 transition-all"
              title="Ocultar notificación"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Dialogue Tag Mappings Drawer */}
      {showTagGuide && (
        <div className="p-4 bg-purple-950/20 border-b border-purple-900/40 space-y-4 animate-in fade-in duration-200">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-purple-300 uppercase tracking-wider flex items-center gap-2">
                <Users className="w-4 h-4 text-purple-400" />
                Guía de Etiquetas de Diálogo (Personajes)
              </span>
              <span className="text-[10px] text-purple-400/80">
                Escribe estas etiquetas para cambiar de voz automáticamente
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
              {[
                { tag: "{{@dlg1}}", voice: dialogueMappings.get("{{@dlg1}}"), label: "Jorge (México)" },
                { tag: "{{@dlg2}}", voice: dialogueMappings.get("{{@dlg2}}"), label: "Álvaro (España)" },
                { tag: "{{@dlg3}}", voice: dialogueMappings.get("{{@dlg3}}"), label: "Dalia (México)" },
                { tag: "{{@dlg4}}", voice: dialogueMappings.get("{{@dlg4}}"), label: dialogueMappings.get("{{@dlg4}}")?.fullName || "Voz 4" },
                { tag: "{{@dlg5}}", voice: dialogueMappings.get("{{@dlg5}}"), label: dialogueMappings.get("{{@dlg5}}")?.fullName || "Voz 5" },
              ].map(({ tag, voice, label }) => (
                <div 
                  key={tag}
                  className="flex items-center justify-between p-2 rounded-xl bg-slate-950/80 border border-purple-900/40 text-xs"
                >
                  <div className="flex items-center gap-2 overflow-hidden">
                    <code className="px-2 py-0.5 rounded bg-purple-900/40 text-purple-300 font-mono text-[11px] font-bold border border-purple-800/40">
                      {tag}
                    </code>
                    <span className="text-slate-300 font-medium truncate">
                      {voice?.name || label}
                    </span>
                  </div>
                  <button
                    onClick={() => handleCopyTag(tag)}
                    className="p-1 rounded text-purple-400 hover:text-purple-200 hover:bg-purple-900/50 transition-all ml-1 shrink-0"
                    title="Copiar etiqueta"
                  >
                    {copiedTag === tag ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Pause / Silence Tag Section */}
          <div className="pt-2 border-t border-purple-900/30 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-300 uppercase tracking-wider flex items-center gap-2">
                <span>⏱️</span> Etiquetas de Pausa y Silencio
              </span>
              <span className="text-[10px] text-amber-400/80">
                Pausas en milisegundos (ej. {`{{@~2000}}`} = 2.0 segundos de silencio)
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { tag: "{{@~500}}", label: "Pausa 0.5s" },
                { tag: "{{@~1000}}", label: "Pausa 1.0s" },
                { tag: "{{@~2000}}", label: "Pausa 2.0s" },
                { tag: "{{@~3000}}", label: "Pausa 3.0s" },
              ].map(({ tag, label }) => (
                <div 
                  key={tag}
                  className="flex items-center justify-between p-2 rounded-xl bg-slate-950/80 border border-amber-900/40 text-xs"
                >
                  <div className="flex items-center gap-1.5">
                    <code className="px-1.5 py-0.5 rounded bg-amber-950/60 text-amber-300 font-mono text-[11px] font-bold border border-amber-800/50">
                      {tag}
                    </code>
                    <span className="text-slate-400 text-[10px]">{label}</span>
                  </div>
                  <button
                    onClick={() => handleCopyTag(tag)}
                    className="p-1 rounded text-amber-400 hover:text-amber-200 hover:bg-amber-900/50 transition-all shrink-0"
                    title="Copiar etiqueta de silencio"
                  >
                    {copiedTag === tag ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Options Control Bar: Checkbox & Slider */}
      <div className="px-4 py-3 bg-slate-950/40 border-b border-slate-800/50 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3">
        {/* Checkbox: Omit Parentheses, Symbols & Emojis */}
        <label className="flex items-center gap-3 cursor-pointer group select-none text-xs bg-slate-950/80 hover:bg-slate-950 border border-slate-800/80 hover:border-slate-700/80 px-3.5 py-2 rounded-xl transition-all shadow-sm w-full lg:w-auto">
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

        {/* Slider Control: Sentences per Request */}
        <div className="flex items-center justify-between sm:justify-end gap-3 w-full lg:w-auto">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-sky-400 shrink-0" />
            <span className="text-xs font-semibold text-slate-300 whitespace-nowrap">
              Lote:
            </span>
            <span className="text-xs font-bold font-mono text-sky-300 bg-sky-950/80 px-2 py-0.5 rounded-md border border-sky-800/60 shadow-sm whitespace-nowrap">
              {sentencesPerChunk} {sentencesPerChunk === 1 ? "oración" : "oraciones"}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-500 font-mono font-semibold">1</span>
            <input
              type="range"
              min="1"
              max="5"
              step="1"
              value={sentencesPerChunk}
              onChange={(e) => setSentencesPerChunk(parseInt(e.target.value, 10))}
              className="w-24 sm:w-32 accent-sky-500 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer"
              title="Ajusta cuántas oraciones se empaquetan y envían por cada solicitud al servidor"
            />
            <span className="text-[10px] text-slate-500 font-mono font-semibold">5</span>
          </div>
        </div>
      </div>

      {/* Main Teleprompter Scroll Screen */}
      <div 
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto p-5 space-y-3 max-h-[360px] min-h-[280px] bg-slate-950/20 scroll-smooth custom-scrollbar"
      >
        {chunks.map((chunk, idx) => {
          const isActive = idx === currentIndex && playbackState !== "idle";
          const isRead = idx < currentIndex && playbackState !== "idle";
          const chunkState = chunkAudios[idx];
          const isBuffered = chunkState && chunkState.blob && !chunkState.loading && !chunkState.error;
          const isFetching = chunkState && chunkState.loading;

          return (
            <div
              key={idx}
              ref={isActive ? activeChunkRef : null}
              onClick={() => playChunk(idx)}
              className={`p-4 rounded-xl border text-left cursor-pointer transition-all duration-300 relative group ${
                isActive
                  ? "bg-sky-950/30 border-sky-500/60 shadow-lg shadow-sky-950/30 ring-1 ring-sky-500/30"
                  : isRead
                  ? "bg-transparent border-transparent text-slate-500 hover:text-slate-400"
                  : "bg-slate-900/20 border-slate-800/40 text-slate-300 hover:bg-slate-900/40 hover:border-slate-800/80"
              }`}
            >
              {/* Header meta line inside block */}
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <span className={`text-[11px] font-mono font-semibold tracking-wider ${
                    isActive ? "text-sky-400" : isRead ? "text-slate-600" : "text-slate-500"
                  }`}>
                    {chunk.startSentence === chunk.endSentence
                      ? `Oración ${chunk.startSentence}`
                      : `Oraciones ${chunk.startSentence} - ${chunk.endSentence}`}
                  </span>

                  {/* Character Voice Badge */}
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border flex items-center gap-1 ${
                    isActive
                      ? "bg-purple-950/80 border-purple-700/80 text-purple-300"
                      : "bg-slate-950/80 border-slate-800 text-slate-400"
                  }`}>
                    🎭 {chunk.voice.name} ({chunk.voice.country})
                    {chunk.tag && (
                      <code className="ml-1 text-[9px] text-purple-400 font-mono font-bold bg-purple-900/40 px-1 rounded">
                        {chunk.tag}
                      </code>
                    )}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {isActive && (
                    <span className="flex items-center gap-1.5 text-[10px] font-bold text-sky-400 bg-sky-900/50 px-2.5 py-0.5 rounded-full border border-sky-700/50">
                      <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-ping" />
                      Reproduciendo fragmento
                    </span>
                  )}

                  {!isActive && isBuffered && (
                    <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-400/90 bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-800/40">
                      <CheckCircle className="w-3 h-3 text-emerald-400" />
                      Sintetizado
                    </span>
                  )}

                  {!isActive && isFetching && (
                    <span className="flex items-center gap-1 text-[10px] font-semibold text-amber-400/90 bg-amber-950/40 px-2 py-0.5 rounded-full border border-amber-800/40">
                      <Loader2 className="w-3 h-3 animate-spin text-amber-400" />
                      Sintetizando...
                    </span>
                  )}
                </div>
              </div>

              {/* Clean segment text with pause badges */}
              <p className={`text-sm leading-relaxed ${
                isActive 
                  ? "text-slate-100 font-medium" 
                  : isRead 
                  ? "text-slate-500 line-through decoration-slate-700/60 font-normal" 
                  : "text-slate-300 font-normal"
              }`}>
                {renderTextWithBadges(chunk.text)}
              </p>
            </div>
          );
        })}
      </div>

      {/* Dynamic Teleprompter Audio Status Indicator */}
      {isLoadingActiveChunk && (
        <div className="bg-sky-950/40 border-y border-sky-900/40 px-4 py-2 flex items-center justify-center gap-2 text-xs text-sky-300">
          <Loader2 className="w-3.5 h-3.5 animate-spin text-sky-400" />
          <span>Sintetizando fragmento actual en tiempo real...</span>
        </div>
      )}

      {/* Central control deck */}
      <div className="p-4 bg-slate-900/60 border-t border-slate-800/60 flex flex-col gap-4">
        
        {/* Playback Progress Indicator */}
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-mono text-slate-500">
            {playbackState === "idle" ? "0:00" : `${Math.floor(currentTime / 60)}:${String(Math.floor(currentTime % 60)).padStart(2, "0")}`}
          </span>
          <div className="flex-1 h-1.5 bg-slate-950 rounded-full overflow-hidden relative border border-slate-900">
            <div 
              className="absolute left-0 top-0 h-full bg-gradient-to-r from-sky-500 to-indigo-500 rounded-full transition-all duration-100"
              style={{ width: `${(currentTime / duration) * 100}%` }}
            />
          </div>
          <span className="text-[10px] font-mono text-slate-500">
            {playbackState === "idle" ? "0:00" : `${Math.floor(duration / 60)}:${String(Math.floor(duration % 60)).padStart(2, "0")}`}
          </span>
        </div>

        {/* Action Controls deck */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          
          {/* Deck 1: Playback buttons */}
          <div className="flex items-center gap-2">
            {/* Prev Chunk */}
            <button
              onClick={handlePrev}
              disabled={currentIndex === 0 || playbackState === "idle"}
              className="p-2.5 rounded-xl bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-850 hover:bg-slate-900 active:scale-[0.96] transition-all disabled:opacity-30 disabled:pointer-events-none"
              title="Fragmento anterior"
            >
              <SkipBack className="w-4 h-4 fill-current" />
            </button>

            {/* Play / Pause Toggle */}
            <button
              onClick={togglePlayPause}
              className={`p-3.5 rounded-2xl font-bold shadow-lg transition-all duration-200 active:scale-[0.96] ${
                playbackState === "playing"
                  ? "bg-amber-500 text-slate-950 hover:bg-amber-400 shadow-amber-500/10"
                  : "bg-sky-500 text-slate-950 hover:bg-sky-400 shadow-sky-500/10"
              }`}
              title={playbackState === "playing" ? "Pausar" : "Reproducir"}
            >
              {playbackState === "playing" ? (
                <Pause className="w-5 h-5 stroke-[2.5px]" />
              ) : (
                <Play className="w-5 h-5 stroke-[2.5px] fill-current" />
              )}
            </button>

            {/* Stop Button */}
            <button
              onClick={stopReading}
              disabled={playbackState === "idle"}
              className="p-2.5 rounded-xl bg-slate-950 text-slate-400 hover:text-red-400 border border-slate-850 hover:bg-slate-900 active:scale-[0.96] transition-all disabled:opacity-30 disabled:pointer-events-none"
              title="Detener lectura"
            >
              <Square className="w-4 h-4 fill-current" />
            </button>

            {/* Next Chunk */}
            <button
              onClick={handleNext}
              disabled={currentIndex === chunks.length - 1 || playbackState === "idle"}
              className="p-2.5 rounded-xl bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-850 hover:bg-slate-900 active:scale-[0.96] transition-all disabled:opacity-30 disabled:pointer-events-none"
              title="Siguiente fragmento"
            >
              <SkipForward className="w-4 h-4 fill-current" />
            </button>
          </div>

          {/* Deck 2: Actions - Merged Audio Download button with live synthesis state */}
          <div className="w-full sm:w-auto">
            {downloadProgress ? (
              <div className="flex items-center gap-2.5 bg-slate-950/80 px-4 py-2.5 rounded-xl border border-slate-800 text-xs w-full justify-center">
                {downloadProgress.phase === "fetching" ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-sky-400" />
                    <span className="text-slate-300 font-medium">
                      Verificando fragmentos: {downloadProgress.current} de {downloadProgress.total}...
                    </span>
                  </>
                ) : downloadProgress.phase === "merging" ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                    <span className="text-slate-300 font-medium animate-pulse">
                      Uniendo y empaquetando MP3 final...
                    </span>
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4 text-emerald-400" />
                    <span className="text-emerald-400 font-semibold">
                      ¡Descarga completada con éxito!
                    </span>
                  </>
                )}
              </div>
            ) : (
              <button
                onClick={handleDownloadFullAudio}
                className={`w-full sm:w-auto px-4 py-2.5 rounded-xl text-xs font-semibold border shadow-md active:scale-[0.97] transition-all flex items-center justify-center gap-2 ${
                  isAllSynthesized
                    ? "bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500/40 shadow-emerald-950/30"
                    : "bg-indigo-600 hover:bg-indigo-500 text-white border-indigo-500/20 shadow-indigo-950/20"
                }`}
                title={
                  isAllSynthesized 
                    ? "Descargar inmediatamente (todos los fragmentos ya están sintetizados en memoria)" 
                    : `Descargar audio completo (${synthesizedChunksCount} de ${chunks.length} listos)`
                }
              >
                {isAllSynthesized ? (
                  <>
                    <Download className="w-4 h-4 text-emerald-200" />
                    <span>Descargar MP3 Completo (Listo al 100%)</span>
                  </>
                ) : (
                  <>
                    <FileAudio className="w-4 h-4" />
                    <span>Descargar Audio Completo ({synthesizedChunksCount}/{chunks.length})</span>
                  </>
                )}
              </button>
            )}
          </div>

        </div>
      </div>

    </div>
  );
}

