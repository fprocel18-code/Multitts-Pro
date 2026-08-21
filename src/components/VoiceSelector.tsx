import { useState, useMemo, useRef, useEffect } from "react";
import { Search, User, Globe, SlidersHorizontal, Check, Tag, Play, Square, Loader2 } from "lucide-react";
import { Voice } from "../types";
import { buildVoiceToTagMap } from "../utils/dialogue";

export const COUNTRY_FLAGS: Record<string, string> = {
  "Argentina": "🇦🇷",
  "Bolivia": "🇧🇴",
  "Chile": "🇨🇱",
  "Colombia": "🇨🇴",
  "Costa Rica": "🇨🇷",
  "Cuba": "🇨🇺",
  "Rep. Dominicana": "🇩🇴",
  "Ecuador": "🇪🇨",
  "España": "🇪🇸",
  "Guinea Ecuat.": "🇬🇶",
  "Guatemala": "🇬🇹",
  "Honduras": "🇭🇳",
  "México": "🇲🇽",
  "Nicaragua": "🇳🇮",
  "Panamá": "🇵🇦",
  "Perú": "🇵🇪",
  "Puerto Rico": "🇵🇷",
  "Paraguay": "🇵🇾",
  "El Salvador": "🇸🇻",
  "EE.UU.": "🇺🇸",
  "Uruguay": "🇺🇾",
  "Venezuela": "🇻🇪"
};

interface VoiceSelectorProps {
  voices: Voice[];
  selectedVoice: Voice | null;
  onSelectVoice: (voice: Voice) => void;
}

export default function VoiceSelector({
  voices,
  selectedVoice,
  onSelectVoice,
}: VoiceSelectorProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [genderFilter, setGenderFilter] = useState<"all" | "male" | "female">("all");
  const [regionFilter, setRegionFilter] = useState<string>("all");

  // Audition preview states
  const [playingVoiceCode, setPlayingVoiceCode] = useState<string | null>(null);
  const [loadingVoiceCode, setLoadingVoiceCode] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Clean up any active audition playback on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  // Handle playing a brief voice preview audition
  const handlePlayAudition = async (voice: Voice) => {
    if (playingVoiceCode === voice.code) {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      setPlayingVoiceCode(null);
      return;
    }

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setPlayingVoiceCode(null);
    setLoadingVoiceCode(voice.code);

    try {
      const textPreview = `Hola, mi nombre es ${voice.name} y esta es una muestra de mi voz en español de ${voice.country}.`;
      const response = await fetch("/api/tts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: textPreview,
          voice: voice.code,
          rate: 1.0,
          pitch: 0,
        }),
      });

      if (!response.ok) {
        throw new Error("No se pudo obtener la audición de voz");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      
      audioRef.current = audio;
      setPlayingVoiceCode(voice.code);
      setLoadingVoiceCode(null);

      audio.onended = () => {
        setPlayingVoiceCode(null);
        URL.revokeObjectURL(url);
      };

      audio.onerror = () => {
        setPlayingVoiceCode(null);
        setLoadingVoiceCode(null);
        URL.revokeObjectURL(url);
      };

      await audio.play();
    } catch (err) {
      console.error("Error al reproducir audición de voz:", err);
      setPlayingVoiceCode(null);
      setLoadingVoiceCode(null);
    }
  };

  // Get unique countries for filter dropdown
  const countries = useMemo(() => {
    const list = new Set<string>();
    voices.forEach((v) => list.add(v.country));
    return Array.from(list).sort();
  }, [voices]);

  // Map voice codes to dialogue tags (e.g. {{@dlg1}})
  const voiceTagMap = useMemo(() => {
    return buildVoiceToTagMap(voices);
  }, [voices]);

  // Filter voices based on search, gender, and country region
  const filteredVoices = useMemo(() => {
    return voices.filter((voice) => {
      const matchesSearch =
        voice.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        voice.country.toLowerCase().includes(searchTerm.toLowerCase()) ||
        voice.code.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesGender = genderFilter === "all" || voice.gender === genderFilter;
      const matchesRegion = regionFilter === "all" || voice.country === regionFilter;

      return matchesSearch && matchesGender && matchesRegion;
    });
  }, [voices, searchTerm, genderFilter, regionFilter]);

  return (
    <div className="flex flex-col h-full bg-slate-900/40 rounded-2xl border border-slate-800/60 overflow-hidden">
      {/* Search and Filters Header */}
      <div className="p-4 border-b border-slate-800/60 bg-slate-900/60 space-y-3">
        <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
          <Globe className="w-4 h-4 text-sky-500" />
          Voces Neurales de Hispanoamérica ({filteredVoices.length})
        </h3>
        
        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
          <input
            type="text"
            placeholder="Buscar por voz o país..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm bg-slate-950/80 text-slate-200 border border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500 transition-all placeholder:text-slate-600"
          />
        </div>

        {/* Filter Controls Row */}
        <div className="flex flex-wrap gap-2 text-xs">
          {/* Gender Filter */}
          <div className="flex items-center gap-1 bg-slate-950/60 rounded-lg p-0.5 border border-slate-800">
            <button
              onClick={() => setGenderFilter("all")}
              className={`px-2 py-1 rounded-md font-medium transition-all ${
                genderFilter === "all"
                  ? "bg-slate-800 text-slate-100"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Todos
            </button>
            <button
              onClick={() => setGenderFilter("female")}
              className={`px-2 py-1 rounded-md font-medium flex items-center gap-1 transition-all ${
                genderFilter === "female"
                  ? "bg-fuchsia-950/60 text-fuchsia-300 border border-fuchsia-850/60"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Femeninas
            </button>
            <button
              onClick={() => setGenderFilter("male")}
              className={`px-2 py-1 rounded-md font-medium flex items-center gap-1 transition-all ${
                genderFilter === "male"
                  ? "bg-sky-950/60 text-sky-300 border border-sky-850/60"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Masculinas
            </button>
          </div>

          {/* Region/Country Dropdown */}
          <div className="relative flex-1 min-w-[120px]">
            <select
              value={regionFilter}
              onChange={(e) => setRegionFilter(e.target.value)}
              className="w-full h-full px-2.5 py-1.5 bg-slate-950/60 text-slate-300 border border-slate-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-sky-500 transition-all text-xs cursor-pointer appearance-none"
            >
              <option value="all">📍 Todos los países</option>
              {countries.map((c) => (
                <option key={c} value={c}>
                  {COUNTRY_FLAGS[c] || "🏳️"} {c}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Voices List Body */}
      <div className="flex-1 overflow-y-auto max-h-[460px] md:max-h-[580px] p-2 space-y-1 custom-scrollbar">
        {filteredVoices.length === 0 ? (
          <div className="py-12 text-center text-slate-500">
            <SlidersHorizontal className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No se encontraron voces</p>
            <p className="text-xs text-slate-600 mt-1">Intenta ajustando los filtros</p>
          </div>
        ) : (
          filteredVoices.map((voice) => {
            const isSelected = selectedVoice?.code === voice.code;
            const flag = COUNTRY_FLAGS[voice.country] || "🏳️";
            const dialogueTag = voiceTagMap.get(voice.code);

            return (
              <div
                key={voice.code}
                className={`w-full flex items-center justify-between p-2.5 rounded-xl transition-all border ${
                  isSelected
                    ? "bg-sky-500/10 border-sky-500/40 text-sky-100"
                    : "bg-transparent border-transparent text-slate-300 hover:bg-slate-800/40 hover:border-slate-800/60"
                }`}
              >
                {/* Selection part */}
                <button
                  onClick={() => onSelectVoice(voice)}
                  className="flex-1 flex items-center gap-3 text-left focus:outline-none min-w-0 pr-1"
                >
                  <span className="text-2xl shrink-0" role="img" aria-label={voice.country}>
                    {flag}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-semibold text-sm truncate">{voice.name}</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-slate-950/60 text-slate-400 font-medium whitespace-nowrap">
                        {voice.country}
                      </span>
                      {dialogueTag && (
                        <code 
                          className="text-[9px] font-mono font-bold px-1 py-0.5 rounded bg-purple-950/80 text-purple-300 border border-purple-800/60 shadow-sm whitespace-nowrap"
                          title={`Etiqueta de diálogo asignada: ${dialogueTag}`}
                        >
                          {dialogueTag}
                        </code>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-500 flex items-center gap-1.5 mt-0.5 min-w-0">
                      <span className="flex items-center gap-0.5 shrink-0">
                        <User className="w-3 h-3 text-slate-600" />
                        {voice.gender === "female" ? "Voz Femenina" : "Voz Masculina"}
                      </span>
                      <span className="shrink-0">•</span>
                      <span className="truncate text-[10px]">{voice.code}</span>
                    </div>
                  </div>
                </button>

                {/* Right Actions: Audition Button & Checkmark */}
                <div className="flex items-center gap-2 shrink-0">
                  {/* Audition Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePlayAudition(voice);
                    }}
                    disabled={loadingVoiceCode === voice.code}
                    className={`p-2 rounded-lg transition-all border flex items-center justify-center ${
                      playingVoiceCode === voice.code
                        ? "bg-red-500/25 border-red-500/40 text-red-300 hover:bg-red-500/35 active:scale-[0.95]"
                        : loadingVoiceCode === voice.code
                        ? "bg-sky-500/10 border-sky-500/30 text-sky-400"
                        : "bg-slate-950/50 border-slate-800/80 text-slate-400 hover:text-sky-300 hover:border-sky-500/30 hover:bg-slate-950 active:scale-[0.95]"
                    }`}
                    title={playingVoiceCode === voice.code ? "Detener muestra" : "Escuchar muestra de voz"}
                  >
                    {loadingVoiceCode === voice.code ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : playingVoiceCode === voice.code ? (
                      <Square className="w-3.5 h-3.5 fill-current" />
                    ) : (
                      <Play className="w-3.5 h-3.5 fill-current" />
                    )}
                  </button>

                  {/* Selected Indicator */}
                  {isSelected && (
                    <div className="bg-sky-500 text-slate-950 p-1 rounded-full shrink-0" title="Voz seleccionada">
                      <Check className="w-3 h-3 stroke-[3px]" />
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
