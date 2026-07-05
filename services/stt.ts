import { Language } from "../types";

const ASSEMBLYAI_WS = "wss://api.assemblyai.com/v2/realtime";
const TOKEN_PROXY = "/api/get-token";
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

async function getTemporaryToken(): Promise<string> {
  const res = await fetch(TOKEN_PROXY, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Token proxy error: ${res.status}`);
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

    // Step 1: Fetch token
    let token: string;
    try {
      token = await getTemporaryToken();
    } catch (e: any) {
      throw new Error(`AUTH_FAILED: ${e?.message || "Token fetch failed"}`);
    }

    // Step 2: Create AudioContext
    try {
      this.audioContext = new AudioContext({ sampleRate: SAMPLE_RATE });
      if (this.audioContext.state === "suspended") {
        await this.audioContext.resume();
      }
    } catch (e: any) {
      throw new Error(`AUDIOCTX_FAILED: ${e?.message || "AudioContext creation failed"}`);
    }

    // Step 3: Load AudioWorklet
    try {
      await this.audioContext.audioWorklet.addModule("/audio-processor.js");
    } catch {
      // Fallback: inline worklet via Blob URL
      try {
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
                const newBuf = new Float32Array(this._buffer.length + mono.length);
                newBuf.set(this._buffer);
                newBuf.set(mono, this._buffer.length);
                this._buffer = newBuf;
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
      } catch (e: any) {
        throw new Error(`WORKLET_FAILED: ${e?.message || "AudioWorklet not supported on this device"}`);
      }
    }

    // Step 4: Connect audio source
    try {
      const source = this.audioContext.createMediaStreamSource(this.mediaStream);
      this.workletNode = new AudioWorkletNode(this.audioContext, "audio-processor");
      source.connect(this.workletNode);
    } catch (e: any) {
      throw new Error(`SOURCE_FAILED: ${e?.message || "Audio graph setup failed"}`);
    }

    // Step 5: Open WebSocket with timeout
    const wsUrl = `${ASSEMBLYAI_WS}?token=${token}`;

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("WS_TIMEOUT: WebSocket connection timed out"));
      }, 10000);

      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        clearTimeout(timeout);
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

        resolve();
      };

      this.ws.onerror = (e) => {
        clearTimeout(timeout);
        console.error("AssemblyAI WebSocket error:", e);
        reject(new Error("WS_FAILED: WebSocket connection failed"));
      };
    });

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
  // Always attempt AssemblyAI — token is fetched server-side via proxy.
  // If the proxy/key is misconfigured, start() will throw and the caller falls back.
  return typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia;
}
