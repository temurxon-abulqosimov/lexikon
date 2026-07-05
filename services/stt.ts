import { Language } from "../types";

const ASSEMBLYAI_BASE = "https://api.assemblyai.com/v2";
const ASSEMBLYAI_WS = "wss://api.assemblyai.com/v2/realtime";
const SAMPLE_RATE = 16000;
const CHANNELS = 1;
const CHUNK_SIZE = 4096;

const LANG_MAP: Partial<Record<Language, string>> = {
  German: "de",
  English: "en",
  Russian: "ru",
};

interface STTOptions {
  language: Language;
  onInterim?: (text: string) => void;
  onFinal: (text: string) => void;
  onError?: (err: Error) => void;
}

function getApiKey(): string {
  return (process.env.ASSEMBLYAI_API_KEY as string) || "";
}

async function getTemporaryToken(): Promise<string> {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("ASSEMBLYAI_API_KEY is not configured");

  const res = await fetch(`${ASSEMBLYAI_BASE}/realtime/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ expires_in: 300 }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`AssemblyAI token error: ${res.status} – ${errText}`);
  }

  const data = await res.json();
  return data.token;
}

function buildLanguageConfig(lang: Language): Record<string, unknown> {
  const code = LANG_MAP[lang];
  if (code) {
    return { language_code: code };
  }
  return {};
}

export class AssemblyAIRecorder {
  private mediaStream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private ws: WebSocket | null = null;
  private isRecording = false;
  private options: STTOptions;

  constructor(options: STTOptions) {
    this.options = options;
  }

  /**
   * Request mic permission FIRST (must be in user gesture on iOS).
   * Returns the MediaStream so start() can use it later without re-prompting.
   */
  async requestMicPermission(): Promise<MediaStream> {
    this.mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        sampleRate: SAMPLE_RATE,
        channelCount: CHANNELS,
        echoCancellation: true,
        noiseSuppression: true,
      },
    });
    return this.mediaStream;
  }

  async start(stream?: MediaStream): Promise<void> {
    if (this.isRecording) return;

    // Use pre-obtained stream or request one now (fallback)
    if (stream) {
      this.mediaStream = stream;
    } else if (!this.mediaStream) {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: SAMPLE_RATE,
          channelCount: CHANNELS,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
    }

    const token = await getTemporaryToken();

    this.audioContext = new AudioContext({ sampleRate: SAMPLE_RATE });

    if (this.audioContext.state === "suspended") {
      await this.audioContext.resume();
    }

    try {
      await this.audioContext.audioWorklet.addModule(
        "/audio-processor.js"
      );
    } catch {
      const blob = new Blob(
        [
          `
          class AudioProcessor extends AudioWorkletProcessor {
            _buffer = new Float32Array(0);
            _chunkSize = ${CHUNK_SIZE};

            process(inputs) {
              const input = inputs[0];
              if (!input || !input[0]) return true;

              const mono = input[0];
              const newBuffer = new Float32Array(this._buffer.length + mono.length);
              newBuffer.set(this._buffer);
              newBuffer.set(mono, this._buffer.length);
              this._buffer = newBuffer;

              while (this._buffer.length >= this._chunkSize) {
                const chunk = this._buffer.slice(0, this._chunkSize);
                this._buffer = this._buffer.slice(this._chunkSize);
                this.port.postMessage({ audio: chunk });
              }

              return true;
            }
          }
          registerProcessor("audio-processor", AudioProcessor);
          `,
        ],
        { type: "application/javascript" }
      );
      const url = URL.createObjectURL(blob);
      await this.audioContext.audioWorklet.addModule(url);
      URL.revokeObjectURL(url);
    }

    const source = this.audioContext.createMediaStreamSource(this.mediaStream);
    this.workletNode = new AudioWorkletNode(this.audioContext, "audio-processor");
    source.connect(this.workletNode);

    const wsUrl = `${ASSEMBLYAI_WS}?token=${token}`;
    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      this.isRecording = true;

      const config: Record<string, unknown> = {
        sample_rate: SAMPLE_RATE,
        audio_encoding: "pcm_s16le",
        format_text: true,
        ...buildLanguageConfig(this.options.language),
      };

      this.ws!.send(JSON.stringify({ type: "session.update", config }));

      this.workletNode!.port.onmessage = (event: MessageEvent) => {
        if (
          this.ws?.readyState === WebSocket.OPEN &&
          event.data.audio
        ) {
          const float32 = event.data.audio as Float32Array;
          const int16 = new Int16Array(float32.length);
          for (let i = 0; i < float32.length; i++) {
            const s = Math.max(-1, Math.min(1, float32[i]));
            int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
          }
          const base64 = btoa(
            String.fromCharCode(...new Uint8Array(int16.buffer))
          );
          this.ws!.send(
            JSON.stringify({ type: "audio.data", audio: base64 })
          );
        }
      };
    };

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string);
        if (msg.type === "transcript.final") {
          const text = msg.transcript?.trim();
          if (text) this.options.onFinal(text);
        } else if (msg.type === "transcript.partial") {
          const text = msg.transcript?.trim();
          if (text && this.options.onInterim) this.options.onInterim(text);
        } else if (msg.type === "error") {
          console.error("AssemblyAI error:", msg.error);
          this.options.onError?.(new Error(msg.error));
        }
      } catch {
        // ignore parse errors
      }
    };

    this.ws.onerror = (e) => {
      console.error("AssemblyAI WebSocket error:", e);
      this.options.onError?.(new Error("WebSocket connection failed"));
    };

    this.ws.onclose = () => {
      if (this.isRecording) {
        this.isRecording = false;
        this.cleanup();
      }
    };
  }

  stop(): void {
    if (!this.isRecording) return;
    this.isRecording = false;

    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: "end_turn" }));
      setTimeout(() => this.ws?.close(), 500);
    }

    this.cleanup();
  }

  private cleanup(): void {
    this.workletNode?.disconnect();
    this.workletNode = null;

    this.mediaStream?.getTracks().forEach((t) => t.stop());
    this.mediaStream = null;

    this.audioContext?.close().catch(() => {});
    this.audioContext = null;
  }

  destroy(): void {
    this.stop();
    this.ws?.close();
    this.ws = null;
  }
}

export function isAssemblyAIAvailable(): boolean {
  return !!getApiKey();
}
