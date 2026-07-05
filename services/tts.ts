import { Language } from "../types";
import { VOICE_MAPPING, ELEVENLABS_MODEL } from "../constants";

const ELEVENLABS_API = "https://api.elevenlabs.io/v1/text-to-speech";

const audioBufferCache = new Map<string, AudioBuffer>();
let sharedAudioCtx: AudioContext | null = null;
let isResuming = false;

const getApiKey = (): string => {
  return (process.env.ELEVENLABS_API_KEY as string) || "";
};

export function getAudioContext() {
  if (!sharedAudioCtx) {
    const AudioContextClass =
      (window as any).AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      sharedAudioCtx = new AudioContextClass({ sampleRate: 44100 });
    }
  }
  return sharedAudioCtx;
}

export async function resumeAudioContext(): Promise<void> {
  const ctx = getAudioContext();
  if (!ctx || isResuming) return;
  if (ctx.state === "running") return;

  isResuming = true;
  try {
    await ctx.resume();
    const buffer = ctx.createBuffer(1, 1, 44100);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start(0);
  } catch {
    // silent catch
  } finally {
    isResuming = false;
  }
}

async function fetchElevenLabsAudio(
  text: string,
  voiceId: string
): Promise<ArrayBuffer> {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("ELEVENLABS_API_KEY is not configured");

  const res = await fetch(`${ELEVENLABS_API}/${voiceId}`, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text,
      model_id: ELEVENLABS_MODEL,
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75,
        style: 0.0,
        use_speaker_boost: true,
      },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`ElevenLabs TTS error: ${res.status} – ${errText}`);
  }

  return res.arrayBuffer();
}

export async function speak(
  text: string,
  lang: Language
): Promise<void> {
  if (!text || !text.trim()) return;

  const ctx = getAudioContext();
  if (!ctx) return;

  const cacheKey = `${text.trim()}:${lang}`;

  const playBuffer = (buffer: AudioBuffer) => {
    if (ctx.state !== "running") {
      ctx.resume().catch(() => {});
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start(0);
  };

  if (audioBufferCache.has(cacheKey)) {
    playBuffer(audioBufferCache.get(cacheKey)!);
    return;
  }

  try {
    const voiceId = VOICE_MAPPING[lang] || VOICE_MAPPING.English;
    const mp3Buffer = await fetchElevenLabsAudio(text.trim(), voiceId);
    const audioBuffer = await ctx.decodeAudioData(mp3Buffer);
    audioBufferCache.set(cacheKey, audioBuffer);
    playBuffer(audioBuffer);
  } catch (error) {
    console.error("TTS Engine Failure:", error);
  }
}
