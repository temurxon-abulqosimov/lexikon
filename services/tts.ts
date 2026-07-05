
import { GoogleGenAI, Modality } from "@google/genai";
import { Language } from "../types";
import { VOICE_MAPPING } from "../constants";

const audioBufferCache = new Map<string, AudioBuffer>();
let sharedAudioCtx: AudioContext | null = null;
let isResuming = false;

/**
 * Safely accesses the API Key.
 */
const getApiKey = () => {
  try {
    return process.env.API_KEY;
  } catch (e) {
    return (window as any).process?.env?.API_KEY || "";
  }
};

/**
 * Standardizes the AudioContext retrieval.
 */
export function getAudioContext() {
  if (!sharedAudioCtx) {
    const AudioContextClass = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      sharedAudioCtx = new AudioContextClass({ sampleRate: 24000 });
    }
  }
  return sharedAudioCtx;
}

/**
 * Robustly resumes the AudioContext within a user gesture.
 */
export async function resumeAudioContext(): Promise<void> {
  const ctx = getAudioContext();
  if (!ctx || isResuming) return;
  
  if (ctx.state === 'running') return;
  
  isResuming = true;
  try {
    await ctx.resume();
    
    // Critical iOS/macOS Fix: Inject a tiny silent buffer to "warm" the audio hardware.
    const buffer = ctx.createBuffer(1, 1, 24000);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start(0);
  } catch (e) {
    // Silent catch for environment restrictions
  } finally {
    isResuming = false;
  }
}

/**
 * Custom base64 decoder.
 */
function decode(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Decodes raw PCM 16-bit audio bytes into an AudioBuffer.
 */
async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const arrayBuffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
  const dataInt16 = new Int16Array(arrayBuffer);
  
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

/**
 * Synthesizes and plays text via Gemini TTS.
 */
export async function speak(text: string, lang: Language): Promise<void> {
  if (!text || !text.trim()) return;
  
  const ctx = getAudioContext();
  if (!ctx) return;

  const cacheKey = `${text.trim()}:${lang}`;

  const playBuffer = (buffer: AudioBuffer) => {
    if (ctx.state !== 'running') {
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
    const apiKey = getApiKey();
    const ai = new GoogleGenAI({ apiKey });
    const voiceName = VOICE_MAPPING[lang] || 'Puck';
    
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: `Say clearly: ${text}` }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) return;

    const audioBuffer = await decodeAudioData(decode(base64Audio), ctx, 24000, 1);
    audioBufferCache.set(cacheKey, audioBuffer);
    playBuffer(audioBuffer);
  } catch (error) {
    console.error("Philologist Voice Engine Failure:", error);
  }
}
