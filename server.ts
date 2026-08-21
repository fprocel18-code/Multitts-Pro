import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";
import { GoogleGenAI } from "@google/genai";

// Comprehensive list of Spanish voices as requested
const RAW_VOICES = [
  { code: "es-AR-ElenaNeural", name: "Argentina - Elena" },
  { code: "es-AR-TomasNeural", name: "Argentina - Tomas" },
  { code: "es-BO-SofiaNeural", name: "Bolivia - Sofia" },
  { code: "es-BO-MarceloNeural", name: "Bolivia - Marcelo" },
  { code: "es-CL-CatalinaNeural", name: "Chile - Catalina" },
  { code: "es-CL-LorenzoNeural", name: "Chile - Lorenzo" },
  { code: "es-CO-SalomeNeural", name: "Colombia - Salome" },
  { code: "es-CO-GonzaloNeural", name: "Colombia - Gonzalo" },
  { code: "es-CR-MariaNeural", name: "Costa Rica - Maria" },
  { code: "es-CR-JuanNeural", name: "Costa Rica - Juan" },
  { code: "es-CU-BelkysNeural", name: "Cuba - Belkys" },
  { code: "es-CU-ManuelNeural", name: "Cuba - Manuel" },
  { code: "es-DO-RamonaNeural", name: "Rep. Dominicana - Ramona" },
  { code: "es-DO-EmilioNeural", name: "Rep. Dominicana - Emilio" },
  { code: "es-EC-AndreaNeural", name: "Ecuador - Andrea" },
  { code: "es-EC-LuisNeural", name: "Ecuador - Luis" },
  { code: "es-ES-ElviraNeural", name: "España - Elvira" },
  { code: "es-ES-AlvaroNeural", name: "España - Alvaro" },
  { code: "es-ES-AbrilNeural", name: "España - Abril" },
  { code: "es-ES-ArnauNeural", name: "España - Arnau" },
  { code: "es-ES-DarioNeural", name: "España - Dario" },
  { code: "es-ES-EliasNeural", name: "España - Elias" },
  { code: "es-ES-EstrellaNeural", name: "España - Estrella" },
  { code: "es-ES-IreneNeural", name: "España - Irene" },
  { code: "es-ES-LaiaNeural", name: "España - Laia" },
  { code: "es-ES-LiaNeural", name: "España - Lia" },
  { code: "es-ES-NilNeural", name: "España - Nil" },
  { code: "es-ES-SaulNeural", name: "España - Saul" },
  { code: "es-ES-TeoNeural", name: "España - Teo" },
  { code: "es-ES-TrianaNeural", name: "España - Triana" },
  { code: "es-ES-VeraNeural", name: "España - Vera" },
  { code: "es-ES-XimenaNeural", name: "España - Ximena" },
  { code: "es-ES-HelenaRUS", name: "España - Helena (RUS)" },
  { code: "es-ES-Laura", name: "España - Laura" },
  { code: "es-ES-Pablo", name: "España - Pablo" },
  { code: "es-GQ-TeresaNeural", name: "Guinea Ecuat. - Teresa" },
  { code: "es-GQ-JavierNeural", name: "Guinea Ecuat. - Javier" },
  { code: "es-GT-MartaNeural", name: "Guatemala - Marta" },
  { code: "es-GT-AndresNeural", name: "Guatemala - Andres" },
  { code: "es-HN-KarlaNeural", name: "Honduras - Karla" },
  { code: "es-HN-CarlosNeural", name: "Honduras - Carlos" },
  { code: "es-MX-DaliaNeural", name: "México - Dalia" },
  { code: "es-MX-JorgeNeural", name: "México - Jorge" },
  { code: "es-MX-BeatrizNeural", name: "México - Beatriz" },
  { code: "es-MX-CandelaNeural", name: "México - Candela" },
  { code: "es-MX-CarlotaNeural", name: "México - Carlota" },
  { code: "es-MX-CecilioNeural", name: "México - Cecilio" },
  { code: "es-MX-GerardoNeural", name: "México - Gerardo" },
  { code: "es-MX-LarissaNeural", name: "México - Larissa" },
  { code: "es-MX-LibertoNeural", name: "México - Liberto" },
  { code: "es-MX-LucianoNeural", name: "México - Luciano" },
  { code: "es-MX-MarinaNeural", name: "México - Marina" },
  { code: "es-MX-NuriaNeural", name: "México - Nuria" },
  { code: "es-MX-PelayoNeural", name: "México - Pelayo" },
  { code: "es-MX-RenataNeural", name: "México - Renata" },
  { code: "es-MX-YagoNeural", name: "México - Yago" },
  { code: "es-MX-HildaRUS", name: "México - Hilda (RUS)" },
  { code: "es-MX-Raul", name: "México - Raúl" },
  { code: "es-NI-YolandaNeural", name: "Nicaragua - Yolanda" },
  { code: "es-NI-FedericoNeural", name: "Nicaragua - Federico" },
  { code: "es-PA-MargaritaNeural", name: "Panamá - Margarita" },
  { code: "es-PA-RobertoNeural", name: "Panamá - Roberto" },
  { code: "es-PE-CamilaNeural", name: "Perú - Camila" },
  { code: "es-PE-AlexNeural", name: "Perú - Alex" },
  { code: "es-PR-KarinaNeural", name: "Puerto Rico - Karina" },
  { code: "es-PR-VictorNeural", name: "Puerto Rico - Víctor" },
  { code: "es-PY-TaniaNeural", name: "Paraguay - Tania" },
  { code: "es-PY-MarioNeural", name: "Paraguay - Mario" },
  { code: "es-SV-LorenaNeural", name: "El Salvador - Lorena" },
  { code: "es-SV-RodrigoNeural", name: "El Salvador - Rodrigo" },
  { code: "es-US-PalomaNeural", name: "EE.UU. - Paloma" },
  { code: "es-US-AlonsoNeural", name: "EE.UU. - Alonso" },
  { code: "es-UY-ValentinaNeural", name: "Uruguay - Valentina" },
  { code: "es-UY-MateoNeural", name: "Uruguay - Mateo" },
  { code: "es-VE-PaolaNeural", name: "Venezuela - Paola" },
  { code: "es-VE-SebastianNeural", name: "Venezuela - Sebastián" }
];

// Helper to extract voice metadata
function getVoiceMetadata(code: string, fullName: string) {
  const parts = fullName.split(" - ");
  const country = parts[0]?.trim() || "España";
  const name = parts[1]?.trim() || code;

  // Classify gender based on name list
  const maleNames = [
    "tomas", "marcelo", "lorenzo", "gonzalo", "juan", "manuel", "emilio", "luis", 
    "alvaro", "arnau", "dario", "elias", "nil", "saul", "teo", "pablo", "javier", 
    "andres", "carlos", "jorge", "cecilio", "gerardo", "liberto", "luciano", 
    "pelayo", "yago", "raul", "federico", "roberto", "alex", "victor", "mario", 
    "rodrigo", "alonso", "mateo", "sebastian"
  ];
  const lowerName = name.toLowerCase();
  const gender = maleNames.some(m => lowerName.includes(m)) ? "male" : "female";
  
  // Extract locale from code
  const localeMatch = code.match(/^([a-z]{2}-[A-Z]{2})/);
  const locale = localeMatch ? localeMatch[1] : "es-ES";

  return {
    code,
    name,
    country,
    gender,
    locale,
    fullName
  };
}

const ENRICHED_VOICES = RAW_VOICES.map(v => getVoiceMetadata(v.code, v.name));

function generateTTSBuffer(text: string, voice: string, rateStr: string, pitchStr: string): Promise<Buffer> {
  return new Promise(async (resolve, reject) => {
    try {
      const tts = new MsEdgeTTS();
      await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);

      const streamData = await tts.toStream(text, {
        rate: rateStr,
        pitch: pitchStr
      });

      const readable = streamData.audioStream;
      const chunks: Buffer[] = [];
      let isResolvedOrRejected = false;

      readable.on("data", (chunk: Buffer) => {
        chunks.push(chunk);
      });

      readable.on("close", () => {
        if (isResolvedOrRejected) return;
        isResolvedOrRejected = true;
        if (chunks.length === 0) {
          reject(new Error("No se recibió ningún fragmento de audio (el stream se cerró vacío)."));
        } else {
          resolve(Buffer.concat(chunks));
        }
      });

      readable.on("error", (err: any) => {
        if (isResolvedOrRejected) return;
        isResolvedOrRejected = true;
        reject(err);
      });
    } catch (err) {
      reject(err);
    }
  });
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function prepareSsmlText(rawText: string): string {
  // 1. Remove dialogue tags
  let cleaned = rawText.replace(/\{\{\@dlg\d+\}\}/gi, "");

  // 2. Escape XML characters so quotes/ampersands/brackets don't break SSML
  let escaped = escapeXml(cleaned);

  // 3. Convert pause tags {{@~MS}} into <break time="...ms"/>
  let ssml = escaped.replace(/\{\{\@\~(\d+)\}\}/gi, (_, msStr) => {
    let ms = parseInt(msStr, 10);
    if (isNaN(ms) || ms <= 0) return "";
    
    // MS Edge / Azure Speech SSML limits individual break tags to max 5000ms (5 seconds)
    const MAX_BREAK = 5000;
    let breaks = "";
    while (ms > MAX_BREAK) {
      breaks += `<break time="${MAX_BREAK}ms"/>`;
      ms -= MAX_BREAK;
    }
    if (ms > 0) {
      breaks += `<break time="${ms}ms"/>`;
    }
    return breaks;
  });

  // 4. Ensure there is speakable content alongside break tags if text consists only of breaks
  const textWithoutTags = ssml.replace(/<[^>]+>/g, "").trim();
  if (!textWithoutTags && ssml.includes("<break")) {
    ssml = ssml + ".";
  }

  return ssml;
}

async function generateTTSBufferWithRetry(rawText: string, voice: string, rateStr: string, pitchStr: string, retries = 3): Promise<Buffer> {
  const ssmlText = prepareSsmlText(rawText);
  let lastError: any = null;

  // Attempt with SSML
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`[TTS] Generando audio SSML - Intento ${attempt} de ${retries} (Voz: ${voice}, Longitud: ${ssmlText.length})...`);
      const buffer = await generateTTSBuffer(ssmlText, voice, rateStr, pitchStr);
      return buffer;
    } catch (err: any) {
      lastError = err;
      console.warn(`[TTS SSML Intento ${attempt} fallido]:`, err.message || err);
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, 500 * attempt));
      }
    }
  }

  // Fallback: If SSML fails all retries (e.g., edge websocket closed unexpectedly on SSML), try with plain stripped text
  const plainText = rawText.replace(/\{\{\@dlg\d+\}\}/gi, "").replace(/\{\{\@\~\d+\}\}/gi, "").replace(/\s+/g, " ").trim();
  if (plainText) {
    console.warn(`[TTS Fallback] Intentando síntesis con texto plano sin SSML para voz ${voice}...`);
    try {
      return await generateTTSBuffer(plainText, voice, rateStr, pitchStr);
    } catch (fallbackErr: any) {
      console.error(`[TTS Fallback también falló]:`, fallbackErr.message || fallbackErr);
    }
  }

  throw lastError || new Error("Se superó el número máximo de intentos para generar el audio.");
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // Health check endpoint
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", voicesCount: ENRICHED_VOICES.length });
  });

  // Get voices endpoint
  app.get("/api/voices", (req, res) => {
    res.json(ENRICHED_VOICES);
  });

  // Text-To-Speech conversion endpoint
  app.post("/api/tts", async (req, res) => {
    try {
      const { text, voice, rate = 1.0, pitch = 0 } = req.body;

      if (!text || typeof text !== "string") {
        return res.status(400).json({ error: "El texto es obligatorio." });
      }

      if (!voice || typeof voice !== "string") {
        return res.status(400).json({ error: "La voz es obligatoria." });
      }

      // Format prosody options
      // rate: speed multiplier (e.g. 1.2 -> "+20%")
      const ratePct = Math.round((rate - 1) * 100);
      const rateStr = ratePct >= 0 ? `+${ratePct}%` : `${ratePct}%`;

      // pitch: Hz adjustment (e.g. 5 -> "+5Hz")
      const pitchStr = pitch >= 0 ? `+${pitch}Hz` : `${pitch}Hz`;

      console.log(`[TTS Request] Voice: ${voice}, Rate: ${rateStr}, Pitch: ${pitchStr}, Text length: ${text.length}`);

      const audioBuffer = await generateTTSBufferWithRetry(text, voice, rateStr, pitchStr, 3);

      console.log(`[TTS Success] Generated audio size: ${audioBuffer.length} bytes`);
      res.setHeader("Content-Type", "audio/mpeg");
      res.setHeader("Content-Length", audioBuffer.length);
      res.send(audioBuffer);

    } catch (err: any) {
      console.error("[TTS Endpoint Error]:", err);
      if (!res.headersSent) {
        res.status(500).json({ error: "No se pudo procesar la solicitud de síntesis de voz: " + (err.message || err) });
      }
    }
  });

  // Resilient Gemini text generation helper with model fallback and exponential backoff
  async function generateGeminiContentWithFallback(
    ai: GoogleGenAI,
    prompt: string,
    operationName: string
  ): Promise<{ text: string; model: string }> {
    // Valid models according to @google/genai guidelines:
    // 'gemini-3.7-flash', 'gemini-flash-latest', 'gemini-3.1-flash-lite'
    const candidateModels = ["gemini-3.7-flash", "gemini-flash-latest", "gemini-3.1-flash-lite"];
    let lastError: any = null;

    for (const model of candidateModels) {
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          console.log(`[${operationName}] Intentando generación con ${model} (intento ${attempt} de 3)...`);
          const response = await ai.models.generateContent({
            model,
            contents: prompt,
            config: {
              temperature: 0.7,
            },
          });

          if (response && response.text && response.text.trim().length > 0) {
            console.log(`[${operationName} Success] Completado con éxito usando ${model}.`);
            return { text: response.text, model };
          }
        } catch (err: any) {
          lastError = err;
          const status = err?.status || err?.code || "";
          const msg = err?.message || String(err);
          console.warn(`[${operationName} Warning] Modelo ${model} devolvió error (${status}): ${msg}`);

          const isTemporary =
            status === 503 ||
            status === 429 ||
            msg.includes("503") ||
            msg.includes("429") ||
            msg.includes("high demand") ||
            msg.includes("UNAVAILABLE") ||
            msg.includes("RESOURCE_EXHAUSTED");

          if (isTemporary && attempt < 3) {
            const backoffMs = attempt * 1200 + Math.floor(Math.random() * 400);
            console.log(`[${operationName}] Esperando ${backoffMs}ms antes de reintentar con ${model}...`);
            await new Promise((resolve) => setTimeout(resolve, backoffMs));
          } else {
            // If non-temporary or attempt limit reached for this model, move immediately to next fallback model
            break;
          }
        }
      }
    }

    throw lastError || new Error("No se pudo generar contenido con los modelos de Gemini disponibles.");
  }

  // Analyze content in text editor and produce an Intelligent Title with Gemini AI
  app.post("/api/analyze-title", async (req, res) => {
    try {
      const { text, type = "podcast" } = req.body;

      if (!text || typeof text !== "string" || text.trim().length === 0) {
        return res.status(400).json({ error: "El texto del editor es obligatorio para analizar el título." });
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({
          error: "La clave GEMINI_API_KEY no está configurada en el servidor."
        });
      }

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      const isDebate = type === "debate";
      // Take an informative sample of the editor text (first 6000 characters)
      const sampleText = text.slice(0, 6000).trim();

      const prompt = isDebate
        ? `Eres un asistente experto en análisis de contenido y redacción de títulos intelectuales.
Analiza detenidamente el siguiente texto presente en el editor y extrae el tema central, dilema filosófico o conflicto doctrinal sobre el que se debatirá.

Genera un TÍTULO INTELIGENTE, conciso, elocuente y profesional para un DEBATE.

REGLAS CRÍTICAS:
1. El título DEBE empezar SIEMPRE con la palabra "Debate - " seguido del tema analizado (por ejemplo: "Debate - Libre albedrío y predestinación divina", "Debate - El verdadero significado de la salvación por fe", "Debate - La justicia y la soberanía de Dios").
2. No agregues comillas, ni markdown de negrita, ni explicaciones previas o posteriores.
3. Responde ÚNICAMENTE en una sola línea con el título final (máximo 8 a 14 palabras).

Texto del editor:
${sampleText}`
        : `Eres un asistente experto en análisis de contenido y redacción de títulos de podcasts reflexivos y educativos.
Analiza detenidamente el siguiente texto presente en el editor y extrae la enseñanza principal, mensaje clave o reflexión central.

Genera un TÍTULO INTELIGENTE, atractivo, respetuoso y conciso para un PODCAST de enseñanza bíblica y reflexiva.

REGLAS CRÍTICAS:
1. El título DEBE empezar SIEMPRE con la palabra "Podcast - " seguido del tema analizado (por ejemplo: "Podcast - Las bendiciones y el propósito del Reino de Dios", "Podcast - Cómo cultivar una fe inquebrantable en tiempos difíciles", "Podcast - Lecciones de perseverancia y esperanza").
2. No agregues comillas, ni markdown de negrita, ni explicaciones previas o posteriores.
3. Responde ÚNICAMENTE en una sola línea con el título final (máximo 8 a 14 palabras).

Texto del editor:
${sampleText}`;

      const { text: rawTitle, model } = await generateGeminiContentWithFallback(
        ai,
        prompt,
        `AI Title Analysis (${type})`
      );

      let cleanTitle = rawTitle.replace(/^["'«»“”`]+|["'«»“”`]+$/g, "").replace(/\n+/g, " ").replace(/\s+/g, " ").trim();

      // Enforce correct prefix
      if (isDebate) {
        if (!cleanTitle.toLowerCase().startsWith("debate")) {
          cleanTitle = `Debate - ${cleanTitle}`;
        } else {
          cleanTitle = cleanTitle.replace(/^debate\s*(?:sobre|acerca\s+de|de|respecto\s+a)?\s*[:\-–—]?\s*/i, "Debate - ");
        }
      } else {
        if (!cleanTitle.toLowerCase().startsWith("podcast")) {
          cleanTitle = `Podcast - ${cleanTitle}`;
        } else {
          cleanTitle = cleanTitle.replace(/^podcast\s*(?:jw|enseñanza|sobre|acerca\s+de|de|respecto\s+a)?\s*[:\-–—]?\s*/i, "Podcast - ");
        }
      }

      console.log(`[Title Analysis Success] Título inteligente generado con ${model}: "${cleanTitle}"`);
      res.json({ title: cleanTitle, modelUsed: model });

    } catch (err: any) {
      console.error("[Title Analysis Error]:", err);
      if (!res.headersSent) {
        res.status(500).json({ error: "Error al analizar el título con IA: " + (err.message || err) });
      }
    }
  });

  // Generate Podcast endpoint using Gemini API
  app.post("/api/generate-podcast", async (req, res) => {
    try {
      const { text, title } = req.body;

      if (!text || typeof text !== "string" || text.trim().length === 0) {
        return res.status(400).json({ error: "El texto base es obligatorio para generar el podcast." });
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({
          error: "La clave GEMINI_API_KEY no está configurada en el servidor."
        });
      }

      const podcastTitle = (title && typeof title === "string" && title.trim().length > 0)
        ? title.trim()
        : "Enseñanza Principal";

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      const podcastPrompt = `
INSTRUCCIONES PARA LA GENERACIÓN DEL PODCAST:

TEMA / TÍTULO DE REFERENCIA (SOLO COMO CONTEXTO TEMÁTICO, NO LO ESCRIBAS EN LA RESPUESTA):
${podcastTitle}

REGLA FUNDAMENTAL DE INICIO (CRÍTICA):
- NO incluyas ningún título, subtítulo, encabezado, metadatos, presentación de texto ni líneas introductorias.
- El texto generado DEBE EMPEZAR DIRECTAMENTE con la primera línea del diálogo del primer interlocutor: {{@dlg1}}
- El primerísimo texto de tu respuesta debe ser exactamente la etiqueta {{@dlg1}} seguida de la primera intervención hablada de Gerardo.

(En caso de ser información bíblica: Necesito que se lean todos los textos bíblicos clave para respaldar las ideas principales.
Antes de leer cada texto, invita a la audiencia a buscarlo en su Biblia.
Después de la lectura, explica claramente cómo el pasaje se relaciona con el tema y cómo respalda la idea que se está desarrollando.
Basa la explicación en el propio texto, destacando palabras o ideas clave.
Mantén una transición natural entre lectura, explicación y siguiente argumento.)

Generar un podcast conversacional de una sola entrega, muy extenso y profundo (equivalente al desarrollo de cinco páginas completas, aproximadamente tres mil palabras en total). Debes entregar todo el contenido de corrido en esta única respuesta, sin interrupciones, sin resúmenes y sin pedir permiso para continuar.

El podcast será entre Gerardo, Rosa y Juan.
El estilo debe ser el de una clase magistral realista pero en tono de conversación entre amigos, donde:
Gerardo es quien guía la explicación y enseña el tema, pero sin actitud formal de profesor.
Rosa y Juan no saben nada del tema, están aprendiendo por primera vez.
Todos se tratan con confianza, como amigos, sin formalidades.

Rosa y Juan deben:
- Hacer preguntas naturales de alguien que no entiende el tema.
- Expresar dudas comunes, confusiones y malentendidos.
- Pedir que se repitan ideas o que se expliquen de otra forma.
- Interrumpir ocasionalmente para aclarar algo.
- Reaccionar con frases como: “no entendí”, “¿puedes explicarlo otra vez?”, “eso me confundió”, “¿cómo así?”, “ponme un ejemplo”.

Gerardo debe:
- Explicar paso a paso, como si enseñara desde cero, pero con tono cercano.
- Reformular ideas cuando Rosa o Juan no entienden.
- Usar ejemplos cotidianos y analogías simples.
- Hacer preguntas retóricas para ayudar a comprender.
- Detectar confusiones y aclararlas con paciencia.

No es debate ni discusión; es una explicación guiada con interacción realista entre amigos.
El tono debe ser:
- Natural, cercano y fluido.
- Conversacional, como una charla entre amigos.
- Con pausas implícitas y lenguaje cotidiano.

Evitar:
- Trato formal de profesor-alumno.
- Monólogos largos sin interrupciones.
- Explicaciones demasiado técnicas sin simplificación.

Estructura del diálogo:
- Intervenciones cortas y dinámicas.
- Alternar constantemente entre los tres.
- Muchas preguntas de Rosa y Juan.
- Respuestas claras, progresivas y adaptadas por parte de Gerardo.

Uso de etiquetas de diálogo (MUY IMPORTANTE):
- {{@dlg1}} corresponde siempre a Gerardo.
- {{@dlg2}} corresponde siempre a Juan.
- {{@dlg3}} corresponde siempre a Rosa.

Reglas obligatorias:
- Cada intervención debe comenzar con su etiqueta correspondiente.
- El código debe ir al inicio de cada línea de diálogo, sin excepción.
- Cada personaje debe usar siempre su misma etiqueta durante todo el podcast.
- No escribir nombres como “Gerardo”, “Rosa” o “Juan” dentro del diálogo.
- No usar guiones, dos puntos ni etiquetas de nombre.
- Solo el código seguido directamente del texto hablado.
- Todos los símbolos y números deben ser dichos en palabras (ejemplo: escribir "tres" en lugar de "3", "por ciento" en lugar de "%").
- Evita a toda costa la palabra "cruz". Menciona el sacrificio de Jesús, la muerte de Jesús, etc., pero no uses esa palabra.
- Evita a toda costa la doctrina de la Trinidad. En caso de que dicha doctrina esté presente, reemplázala por el arrianismo pero sin usar la palabra "arrianismo" en los argumentos.
- Refiérete a la iglesia usando la palabra "congregación cristiana".

Ejemplo correcto:
{{@dlg1}} Hola a todos, hoy vamos a empezar desde cero con este tema tan interesante.
{{@dlg2}} No entendí eso, ¿puedes explicarlo otra vez?
{{@dlg3}} A ver, creo que me perdí en esa parte.

Ejemplo incorrecto:
Título del Podcast
Gerardo: Hola…
Hola…
{{@dlg1}} Gerardo: Hola…

El contenido debe basarse solo en el tema proporcionado abajo.
Expresar cifras y símbolos en palabras.
Inicia Gerardo presentándose brevemente junto a Rosa y Juan dentro de su primera línea hablada; luego continúan todo el desarrollo extenso sin volver a presentarse.
Al finalizar todo el desarrollo extenso de corrido, cerrar inmediatamente con:
“Podcast completo.”
Sin ninguna explicación extra.

TEMA Y TEXTO BASE:
${text}
`;

      const { text: rawGeneratedText, model } = await generateGeminiContentWithFallback(
        ai,
        podcastPrompt,
        `Podcast Request "${podcastTitle}"`
      );

      let cleanResult = rawGeneratedText.trim();
      const firstDlgIndex = cleanResult.indexOf("{{@dlg");
      if (firstDlgIndex > 0) {
        cleanResult = cleanResult.substring(firstDlgIndex).trim();
      }

      console.log(`[Podcast Success] Longitud del texto generado con ${model}: ${cleanResult.length} caracteres.`);
      res.json({ result: cleanResult, modelUsed: model });

    } catch (err: any) {
      console.error("[Podcast Endpoint Error]:", err);
      if (!res.headersSent) {
        res.status(500).json({ error: "Error al generar el podcast con IA: " + (err.message || err) });
      }
    }
  });

  // Generate Debate endpoint using Gemini API
  app.post("/api/generate-debate", async (req, res) => {
    try {
      const { text, jorgeStance, title } = req.body;

      if (!text || typeof text !== "string" || text.trim().length === 0) {
        return res.status(400).json({ error: "El texto base es obligatorio para generar el debate." });
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({
          error: "La clave GEMINI_API_KEY no está configurada en el servidor."
        });
      }

      const debateTitle = (title && typeof title === "string" && title.trim().length > 0)
        ? title.trim()
        : "Debate Principal";

      const jorgePosition = (jorgeStance && typeof jorgeStance === "string" && jorgeStance.trim().length > 0)
        ? jorgeStance.trim()
        : "Postura completamente opuesta y crítica hacia la posición de las fuentes.";

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      const debatePrompt = `
INSTRUCCIONES PARA LA GENERACIÓN DEL DEBATE:

TEMA / TÍTULO DE REFERENCIA (SOLO COMO CONTEXTO TEMÁTICO, NO LO ESCRIBAS EN LA RESPUESTA):
${debateTitle}

REGLA FUNDAMENTAL DE INICIO (CRÍTICA):
- NO incluyas ningún título, subtítulo, encabezado, metadatos ni líneas introductorias.
- El texto generado DEBE EMPEZAR DIRECTAMENTE con la primera línea del diálogo de Gerardo: {{@dlg1}}
- El primerísimo texto de tu respuesta debe ser exactamente la etiqueta {{@dlg1}} seguida de la primera intervención hablada.

(EN CASO DE SER UN DEBATE TEOLÓGICO O BÍBLICO:
Si es un debate teológico, necesito que los debatientes lean los textos bíblicos clave para defender las ideas.
Antes de leer cada texto bíblico clave, el debatiente debe pedir a la audiencia que lo acompañe en la lectura (por ejemplo: "vamos a leer juntos en...", "los invito a buscar en sus Biblias el texto de...", "acompáñenme a leer el pasaje de...").
Luego de pedir a la audiencia que los acompañe y leer el texto bíblico, el debatiente debe explicar claramente cómo se relaciona con el tema en discusión, fundamentando por qué respalda su postura o refuta el argumento contrario, destacando las palabras o conceptos clave del propio pasaje bíblico.)

Simula una conversación larga, fluida y muy natural entre dos amigos que tienen posturas opuestas sobre el tema analizado.
La conversación debe ser intensa, realista y extremadamente humana, como si fuera una charla entre panas que se respetan, pero defienden con pasión lo que creen.

───

TEMA PREVIAMENTE ANALIZADO / FUENTES (Defendido por Gerardo):
${text}

POSTURA ESPECÍFICA DE JORGE (Posición opuesta a defender):
${jorgePosition}

───

REGLAS DEL DEBATE / CONVERSACIÓN
Interlocutores:

GERARDO:
Inicia la conversación.
Defiende activamente la postura previamente analizada.
Su función principal NO es hacer preguntas.
Su función principal es argumentar, responder objeciones y refutar la posición de Jorge.
Las preguntas son solamente una herramienta secundaria para exponer errores, contradicciones o presupuestos ocultos en los argumentos de Jorge.
Gerardo debe comportarse como un debatiente experimentado y no como un entrevistador.
Debe construir argumentos positivos a favor de su postura.
Debe atacar directamente los argumentos de Jorge.
Debe explicar por qué considera que un argumento es insuficiente, inconsistente o problemático.
Debe señalar explícitamente cuando detecta:
- contradicciones internas;
- consecuencias absurdas;
- presupuestos injustificados;
- dobles estándares;
- errores de categoría;
- cambios arbitrarios de criterio;
- razonamientos circulares;
- apelaciones emocionales disfrazadas de argumentos.

Cuando Jorge presente un argumento, Gerardo debe seguir normalmente esta secuencia:
1. Identificar exactamente lo que Jorge está afirmando.
2. Explicar por qué considera que ese argumento falla.
3. Mostrar las consecuencias lógicas del argumento.
4. Exponer las contradicciones o dificultades generadas.
5. Presentar una explicación alternativa más coherente desde su propia cosmovisión.

Gerardo debe responder a prácticamente todas las afirmaciones importantes de Jorge.
No debe limitarse a preguntar.
No debe dejar objeciones importantes sin contestar.
No debe permitir que Jorge acumule afirmaciones sin examinarlas críticamente.

La proporción aproximada del diálogo de Gerardo debe ser:
- 20% preguntas estratégicas.
- 80% argumentación, refutación y defensa de su postura.

Las preguntas deben ser breves y servir para abrir la puerta a una refutación inmediata.

Ejemplo del patrón correcto:
"Entonces tu criterio sería este... Pero si usamos ese mismo criterio aquí ocurre este problema..."
"Entiendo lo que dices, pero ahí veo dos dificultades importantes..."
"Creo que ese argumento tiene un problema de fondo..."
"El inconveniente con esa explicación es que..."
"Si aceptamos eso, entonces también tendríamos que aceptar esto otro, y ahí aparece una contradicción."
"Creo que tu explicación explica menos cosas y genera más excepciones que la alternativa que estoy proponiendo."

Gerardo debe sentirse cómodo diciendo frases como:
- "No creo que ese argumento funcione por esta razón..."
- "Ahí veo una contradicción importante."
- "Creo que estás asumiendo algo que todavía no has demostrado."
- "Tu explicación parece generar más problemas de los que resuelve."
- "Esa conclusión no parece seguirse de las premisas."
- "Creo que ese razonamiento falla aquí."

Gerardo no debe sonar agresivo ni hostil.
Pero tampoco debe sonar excesivamente prudente, tímido o excesivamente inquisitivo.
Debe transmitir seguridad intelectual y claridad argumentativa.
El debate debe sentirse como un intercambio entre dos personas que intentan desmontar activamente la posición del otro.
Gerardo utiliza preguntas para preparar la refutación.
La refutación es el objetivo principal.
La pregunta es únicamente el instrumento.

───

JORGE:
Responde a Gerardo.
Es inteligente, terco, lógico y persuasivo.
No se deja convencer fácilmente.
Refuta con fuerza.
Detecta posibles fallos en los razonamientos de Gerardo.
Presenta objeciones serias.
También utiliza reducción al absurdo cuando lo considere apropiado.
Mantiene siempre un tono amistoso y conversacional.
Nunca se convierte en una caricatura.
Debe parecer una persona real defendiendo sinceramente su posición.
Jorge defiende su postura con firmeza y no da su brazo a torcer.

───

TONO Y ESTILO:
Todo debe sonar como dos amigos hablando.
Nada académico ni rígido.
Nada de conferencias o discursos preparados.
Utilizar lenguaje natural, expresiones cotidianas, interrupciones ocasionales y reacciones espontáneas.
Preguntas genuinas, momentos de duda, reflexión y tensión intelectual.
Deben sonar como personas reales pensando mientras hablan.
Después de la presentación inicial deben tratarse exclusivamente de "tú".
La conversación debe sentirse orgánica y humana.
No convertir el diálogo en monólogos largos.
Alternar constantemente entre ambos interlocutores.

───

REGLAS OBLIGATORIAS DE TERMINOLOGÍA Y ESTILO:
- Todos los símbolos y números deben ser dichos en palabras (ejemplo: escribir "tres" en lugar de "3", "por ciento" en lugar de "%").
- Evita a toda costa la palabra "cruz". Menciona el sacrificio de Jesús, la muerte de Jesús, etc., pero no uses esa palabra.
- Evita a toda costa la doctrina de la Trinidad. En caso de que dicha doctrina esté presente, reemplázala por el arrianismo pero sin usar la palabra "arrianismo" en los argumentos.
- Refiérete a la iglesia usando la palabra "congregación cristiana".

───

DURACIÓN:
Genera el debate completo en una única respuesta.
Aunque NO debes dividir el contenido en páginas, la longitud total debe equivaler al contenido completo de ocho páginas desarrolladas (~4,000 a 5,000 palabras de diálogo continuo).
No resumir ni acelerar la conclusión.

───

FORMATO OBLIGATORIO DE ETIQUETAS (MUY IMPORTANTE):
- {{@dlg1}} corresponde siempre a Gerardo.
- {{@dlg2}} corresponde siempre a Jorge.

REGLAS OBLIGATORIAS SOBRE ETIQUETAS:
1. Cada intervención debe comenzar única y exclusivamente con su etiqueta ({{@dlg1}} o {{@dlg2}}).
2. ESTÁ ESTRICTAMENTE PROHIBIDO escribir el nombre del hablante después de la etiqueta (NUNCA escribir cosas como "{{@dlg2}} Jorge:", "{{@dlg1}} Gerardo:", "{{@dlg2}} Jorge -", "{{@dlg2}} (Jorge):").
3. Solo debe ir la etiqueta seguida directamente del espacio y del texto hablado.
4. No usar guiones, dos puntos, ni prefijos de nombres para identificar hablantes.

Ejemplo CORRECTO:
{{@dlg1}} Hola Jorge, quería comenzar comentándote algo que he estado analizando con detenimiento.
{{@dlg2}} Dime Gerardo, ¿de qué se trata? Porque tú sabes que en este asunto tengo una postura bien clara.
{{@dlg1}} Precisamente por eso te lo comento. Si revisamos el argumento central...

Ejemplo INCORRECTO (PROHIBIDO):
{{@dlg1}} Gerardo: Hola Jorge...
{{@dlg2}} Jorge: Dime Gerardo...
{{@dlg1}} (Gerardo) Hola...

───

CONTINUIDAD:
Desarrolla toda la conversación como una única toma continua sin cortes.
`;

      const { text: generatedText, model } = await generateGeminiContentWithFallback(
        ai,
        debatePrompt,
        `Debate Request "${debateTitle}"`
      );

      let cleanResult = generatedText.trim();
      const firstDlgIndex = cleanResult.indexOf("{{@dlg");
      if (firstDlgIndex > 0) {
        cleanResult = cleanResult.substring(firstDlgIndex).trim();
      }

      // Remove unwanted speaker name tags or prefixes immediately following {{@dlg1}} or {{@dlg2}}
      // e.g. "{{@dlg2}} Jorge:" -> "{{@dlg2}}" or "{{@dlg1}} Gerardo -" -> "{{@dlg1}}"
      cleanResult = cleanResult.replace(
        /(\{\{@dlg[1-9]\d*\}\})\s*(?:\[|\()? *(?:Gerardo|Jorge|Juan|Rosa|[A-Za-záéíóúÁÉÍÓÚñÑ]+) *(?:\]|\))? *[:\-–—]\s*/gi,
        "$1 "
      );
      cleanResult = cleanResult.replace(
        /(\{\{@dlg[1-9]\d*\}\})\s*(?:\((?:Gerardo|Jorge|Juan|Rosa)\)|\[(?:Gerardo|Jorge|Juan|Rosa)\])\s*/gi,
        "$1 "
      );

      console.log(`[Debate Success] Longitud del debate generado con ${model}: ${cleanResult.length} caracteres.`);
      res.json({ result: cleanResult, modelUsed: model });

    } catch (err: any) {
      console.error("[Debate Endpoint Error]:", err);
      if (!res.headersSent) {
        res.status(500).json({ error: "Error al generar el debate con IA: " + (err.message || err) });
      }
    }
  });

  // Vite development middleware or static production serving
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Server] Running on http://0.0.0.0:${PORT} in ${process.env.NODE_ENV || "development"} mode`);
  });
}

startServer().catch((err) => {
  console.error("[Server Crash] Failed to start server:", err);
  process.exit(1);
});
