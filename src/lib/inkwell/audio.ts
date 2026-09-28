import type { Block, InkId } from "@/lib/inkwell/score";

const CDN =
  "https://cdn.jsdelivr.net/gh/workinwithai-create/PreEight@main/public/samples";

const CATALOG: Record<string, string[]> = {
  piano: [
    "A2", "A3", "A4", "Ab3", "Bb2", "Bb3", "Bb4", "C2", "C3", "C4", "C5", "C6",
    "Db3", "Db4", "E2", "E3", "E4", "E5", "G2", "G3", "G4", "G5", "Gb3", "Gb4",
  ],
  guitar: ["A2", "A3", "A4", "B2", "B3", "B4", "D3", "D4", "E2", "E3", "E4", "E5", "G3", "G4"],
  bass: ["A1", "A2", "A3", "Bb1", "Bb2", "C2", "C3", "E1", "E2", "E3", "G1", "G2", "G3"],
  trumpet: ["A3", "A4", "C4", "C5", "E4", "E5", "G3", "G4", "G5"],
  violin: ["A3", "A4", "C4", "C5", "E4", "E5", "G3", "G4", "G5"],
};

const DRUMS = ["kick", "snare", "hihat", "crash", "tom1"] as const;

export type Inst = "piano" | "guitar" | "bass" | "trumpet" | "violin";
export type DrumName = (typeof DRUMS)[number];
export type Chair = Inst | "kit";

const SEMI: Record<string, number> = {
  C: 0, Db: 1, D: 2, Eb: 3, E: 4, F: 5, Gb: 6, G: 7, Ab: 8, A: 9, Bb: 10, B: 11,
};

function midiOf(name: string): number {
  const match = /^([A-G]b?)(\d)$/.exec(name);
  if (!match) return 60;
  const pc = SEMI[match[1] ?? "C"] ?? 0;
  const oct = Number(match[2]);
  return (oct + 1) * 12 + pc;
}

function inRange(midi: number, lo: number, hi: number): number {
  let m = midi;
  while (m < lo) m += 12;
  while (m > hi) m -= 12;
  return m;
}

type Hit = { at: number; midi: number; dur: number; gain: number };

function nearest(inst: Inst, midi: number): { key: string; rate: number } {
  const notes = CATALOG[inst] ?? ["C4"];
  let best = notes[0] ?? "C4";
  let bestDist = 99;
  for (const note of notes) {
    const dist = Math.abs(midiOf(note) - midi);
    if (dist < bestDist) {
      bestDist = dist;
      best = note;
    }
  }
  const rate = Math.pow(2, (midi - midiOf(best)) / 12);
  return { key: `${inst}/${best}.mp3`, rate };
}

export type Song = { bpm: number; blocks: Block[] };

type VoiceApi = {
  tone: (inst: Inst, midi: number, when: number, dur: number, gain: number) => void;
  drum: (name: DrumName, when: number, gain: number) => void;
};

function motif(tones: number[], local: number): Hit[] {
  const a = tones[0] ?? 60;
  const b = tones[1] ?? a;
  const c = tones[2] ?? b;
  const hi = (n: number) => inRange(n + 12, 58, 82);
  if (local === 0) {
    return [
      { at: 4, midi: hi(c), dur: 0.35, gain: 0.2 },
      { at: 8, midi: hi(b), dur: 0.28, gain: 0.16 },
      { at: 12, midi: hi(c), dur: 0.45, gain: 0.18 },
    ];
  }
  if (local === 1) {
    return [
      { at: 0, midi: hi(c), dur: 1.1, gain: 0.16 },
      { at: 12, midi: hi(a), dur: 0.4, gain: 0.14 },
    ];
  }
  if (local === 2) {
    return [
      { at: 2, midi: hi(a), dur: 0.3, gain: 0.18 },
      { at: 6, midi: hi(c), dur: 0.3, gain: 0.16 },
      { at: 10, midi: hi(b), dur: 0.45, gain: 0.16 },
    ];
  }
  return [
    { at: 0, midi: hi(c), dur: 0.28, gain: 0.18 },
    { at: 4, midi: hi(b), dur: 0.28, gain: 0.16 },
    { at: 8, midi: hi(a), dur: 0.28, gain: 0.14 },
    { at: 14, midi: hi(c), dur: 0.4, gain: 0.18 },
  ];
}

export function scheduleSong(
  api: VoiceApi,
  song: Song,
  fromBar: number,
  toBar: number,
  t0: number,
  muted: ReadonlySet<Chair>,
): number {
  const beat = 60 / song.bpm;
  const barDur = beat * 4;
  const step = barDur / 16;
  const total = song.blocks.length * 4;
  const end = Math.min(toBar, total);

  const allow = (chair: Chair) => !muted.has(chair);

  for (let bar = fromBar; bar < end; bar++) {
    const block = song.blocks[Math.floor(bar / 4)];
    if (!block) continue;
    const local = bar % 4;
    const chord = block.chords[local];
    if (!chord) continue;
    const ink: InkId = block.ink;
    const start = t0 + (bar - fromBar) * barDur;
    const at = (sixteenth: number) => start + sixteenth * step;
    const last = bar === total - 1;

    const piano = (midi: number, sixteenth: number, beats: number, gain: number) => {
      if (!allow("piano")) return;
      api.tone("piano", midi, at(sixteenth), beats * beat, gain);
    };
    const bass = (midi: number, sixteenth: number, beats: number, gain: number) => {
      if (!allow("bass")) return;
      api.tone("bass", inRange(midi, 28, 55), at(sixteenth), beats * beat, gain);
    };
    const guitar = (midi: number, sixteenth: number, beats: number, gain: number) => {
      if (!allow("guitar")) return;
      api.tone("guitar", inRange(midi, 45, 78), at(sixteenth), beats * beat, gain);
    };
    const violin = (midi: number, sixteenth: number, beats: number, gain: number) => {
      if (!allow("violin")) return;
      api.tone("violin", inRange(midi, 55, 88), at(sixteenth), beats * beat, gain);
    };
    const trumpet = (midi: number, sixteenth: number, beats: number, gain: number) => {
      if (!allow("trumpet")) return;
      api.tone("trumpet", inRange(midi, 55, 82), at(sixteenth), beats * beat, gain);
    };
    const kit = (name: DrumName, sixteenth: number, gain: number) => {
      if (!allow("kit")) return;
      api.drum(name, at(sixteenth), gain);
    };

    if (last) {
      kit("kick", 0, 0.62);
      kit("crash", 0, 0.22);
      chord.tones.forEach((tone) => piano(tone, 0, 2.2, 0.2));
      bass(chord.bass, 0, 1.4, 0.42);
      if (ink === "room" || ink === "climb") trumpet(chord.tones[2] ?? 64, 0, 1.2, 0.16);
      continue;
    }

    if (ink === "wash") {
      chord.tones.forEach((tone) => piano(tone, 0, 3.4, 0.2));
      piano(chord.tones[2] ?? 64, 8, 1.6, 0.1);
      continue;
    }

    if (ink === "bare") {
      violin(chord.tones[0] ?? 57, 0, 3.6, 0.2);
      violin(chord.tones[1] ?? 60, 0, 3.6, 0.14);
      piano(chord.tones[0] ?? 57, 0, 0.7, 0.14);
      piano(chord.tones[1] ?? 60, 6, 0.7, 0.12);
      piano(chord.tones[2] ?? 64, 10, 0.8, 0.12);
      if (local === 0) bass(chord.bass, 0, 1.2, 0.18);
      continue;
    }

    if (ink === "verse") {
      kit("kick", 0, 0.58);
      kit("kick", 8, 0.36);
      kit("snare", 4, 0.32);
      kit("snare", 12, 0.3);
      [2, 6, 10, 14].forEach((s) => kit("hihat", s, 0.07));
      bass(chord.bass, 0, 0.45, 0.42);
      bass(chord.bass + 7, 10, 0.3, 0.28);
      chord.tones.forEach((tone) => piano(tone, 0, 1.1, 0.14));
      piano(chord.tones[2] ?? 64, 10, 0.35, 0.1);
      guitar(chord.tones[0] ?? 57, 4, 0.22, 0.12);
      guitar(chord.tones[1] ?? 60, 12, 0.22, 0.1);
      continue;
    }

    if (ink === "climb") {
      kit("kick", 0, 0.55);
      kit("kick", 8, 0.4);
      if (local === 3) {
        kit("kick", 14, 0.34);
        kit("snare", 12, 0.22);
        kit("snare", 13, 0.26);
        kit("snare", 14, 0.32);
        kit("snare", 15, 0.4);
        kit("tom1", 10, 0.28);
      } else {
        kit("snare", 4, 0.3);
        kit("snare", 12, 0.28);
      }
      [0, 2, 4, 6, 8, 10, 12, 14].forEach((s) => kit("hihat", s, local >= 2 ? 0.09 : 0.06));
      bass(chord.bass, 0, 0.28, 0.4);
      bass(chord.bass + 2, 4, 0.24, 0.32);
      bass(chord.bass + 7, 8, 0.24, 0.32);
      bass(chord.bass + 5, 12, 0.24, 0.3);
      [0, 4, 8, 12].forEach((s, i) => {
        const tone = chord.tones[i % chord.tones.length] ?? 60;
        guitar(tone, s, 0.2, 0.1);
        piano(tone, s, 0.35, 0.1);
      });
      if (local >= 2) violin(chord.tones[1] ?? 60, 0, 3.2, 0.12);
      continue;
    }

    kit("kick", 0, 0.66);
    kit("kick", 8, 0.42);
    kit("kick", 10, 0.28);
    kit("snare", 4, 0.38);
    kit("snare", 12, 0.36);
    if (local === 0) kit("crash", 0, 0.2);
    [0, 2, 4, 6, 8, 10, 12, 14].forEach((s) => kit("hihat", s, s % 4 === 2 ? 0.1 : 0.06));
    bass(chord.bass, 0, 0.32, 0.46);
    bass(chord.bass + 12, 8, 0.22, 0.28);
    bass(chord.bass, 12, 0.2, 0.3);
    chord.tones.forEach((tone) => piano(tone, 0, 0.7, 0.13));
    chord.tones.forEach((tone) => piano(tone, 8, 0.45, 0.09));
    guitar(chord.tones[0] ?? 57, 0, 0.25, 0.11);
    guitar(chord.tones[2] ?? 64, 8, 0.22, 0.1);
    violin(chord.tones[1] ?? 60, 0, 3.5, 0.1);
    for (const hit of motif(chord.tones, local)) {
      trumpet(hit.midi, hit.at, hit.dur, hit.gain);
    }
  }

  return (end - fromBar) * barDur;
}

type Graph = {
  ctx: BaseAudioContext;
  out: AudioNode;
  buffers: Map<string, AudioBuffer>;
  sources: AudioBufferSourceNode[];
};

function makeApi(graph: Graph, songGain = 1): VoiceApi {
  const tone: VoiceApi["tone"] = (inst, midi, when, dur, gain) => {
    const { key, rate } = nearest(inst, midi);
    const buffer = graph.buffers.get(key);
    if (!buffer || !Number.isFinite(when)) return;
    const src = graph.ctx.createBufferSource();
    src.buffer = buffer;
    src.playbackRate.value = Math.min(1.6, Math.max(0.62, rate));
    const amp = graph.ctx.createGain();
    const attack = 0.012;
    const hold = Math.max(0.06, dur);
    amp.gain.setValueAtTime(0.0001, when);
    amp.gain.exponentialRampToValueAtTime(Math.max(0.001, gain * songGain), when + attack);
    amp.gain.setValueAtTime(Math.max(0.001, gain * songGain), when + Math.max(attack, hold - 0.06));
    amp.gain.exponentialRampToValueAtTime(0.0001, when + hold);
    src.connect(amp);
    amp.connect(graph.out);
    src.start(when);
    src.stop(when + hold + 0.02);
    graph.sources.push(src);
  };

  const drum: VoiceApi["drum"] = (name, when, gain) => {
    const buffer = graph.buffers.get(`drums/${name}.mp3`);
    if (!buffer) return;
    const src = graph.ctx.createBufferSource();
    src.buffer = buffer;
    const amp = graph.ctx.createGain();
    amp.gain.value = gain * songGain;
    src.connect(amp);
    amp.connect(graph.out);
    src.start(when);
    graph.sources.push(src);
  };

  return { tone, drum };
}

const ALL_KEYS: string[] = [
  ...Object.entries(CATALOG).flatMap(([inst, notes]) => notes.map((n) => `${inst}/${n}.mp3`)),
  ...DRUMS.map((d) => `drums/${d}.mp3`),
];

export class InkwellEngine {
  ctx: AudioContext | null = null;
  buffers = new Map<string, AudioBuffer>();
  private raw = new Map<string, ArrayBuffer>();
  private sources: AudioBufferSourceNode[] = [];
  private dest: AudioNode | null = null;
  private loading: Promise<void> | null = null;
  loaded = false;
  onProgress: ((loaded: number, total: number) => void) | null = null;

  ensure(): Promise<void> {
    if (this.loaded && this.ctx) return Promise.resolve();
    if (!this.loading) this.loading = this.load();
    return this.loading;
  }

  private async load(): Promise<void> {
    const ctx = new AudioContext();
    this.ctx = ctx;
    let done = 0;
    await Promise.all(
      ALL_KEYS.map(async (key) => {
        try {
          const res = await fetch(`${CDN}/${key}`);
          if (!res.ok) throw new Error(String(res.status));
          const raw = await res.arrayBuffer();
          this.raw.set(key, raw);
          this.buffers.set(key, await ctx.decodeAudioData(raw.slice(0)));
        } catch (err) {
          console.warn("sample miss", key, err);
        } finally {
          done += 1;
          this.onProgress?.(done, ALL_KEYS.length);
        }
      }),
    );
    if (!this.buffers.has("piano/C4.mp3") || !this.buffers.has("drums/kick.mp3")) {
      throw new Error("The band could not be seated. Check the connection and try again.");
    }
    this.loaded = true;
  }

  private master(): AudioNode {
    if (!this.ctx) throw new Error("Audio is not ready");
    if (this.dest) return this.dest;
    const comp = this.ctx.createDynamicsCompressor();
    comp.threshold.value = -12;
    comp.knee.value = 16;
    comp.ratio.value = 3.2;
    comp.attack.value = 0.004;
    comp.release.value = 0.22;
    const makeup = this.ctx.createGain();
    makeup.gain.value = 0.9;
    comp.connect(makeup);
    makeup.connect(this.ctx.destination);
    this.dest = comp;
    return comp;
  }

  stop(): void {
    for (const src of this.sources) {
      try {
        src.stop();
      } catch {
        /* already stopped */
      }
    }
    this.sources = [];
  }

  play(song: Song, fromBar: number, toBar: number, muted: ReadonlySet<Chair>): number {
    if (!this.ctx) throw new Error("Audio is not ready");
    this.stop();
    const graph: Graph = {
      ctx: this.ctx,
      out: this.master(),
      buffers: this.buffers,
      sources: this.sources,
    };
    const t0 = this.ctx.currentTime + 0.06;
    return scheduleSong(makeApi(graph), song, fromBar, toBar, t0, muted);
  }

  preview(inst: Inst, midi: number): void {
    if (!this.ctx) return;
    const graph: Graph = {
      ctx: this.ctx,
      out: this.master(),
      buffers: this.buffers,
      sources: this.sources,
    };
    const api = makeApi(graph, 1.15);
    const placed =
      inst === "bass"
        ? inRange(midi - 24, 28, 52)
        : inst === "guitar"
          ? inRange(midi - 12, 45, 76)
          : inst === "trumpet" || inst === "violin"
            ? inRange(midi, 55, 84)
            : midi;
    api.tone(
      inst,
      placed,
      this.ctx.currentTime + 0.01,
      inst === "bass" ? 0.45 : 1.1,
      inst === "trumpet" ? 0.28 : 0.34,
    );
  }

  previewDrum(name: DrumName): void {
    if (!this.ctx) return;
    const graph: Graph = {
      ctx: this.ctx,
      out: this.master(),
      buffers: this.buffers,
      sources: this.sources,
    };
    makeApi(graph, 1.1).drum(name, this.ctx.currentTime + 0.01, name === "hihat" ? 0.2 : 0.55);
  }

  async bounce(song: Song, muted: ReadonlySet<Chair>): Promise<Blob> {
    const beat = 60 / song.bpm;
    const seconds = song.blocks.length * 16 * beat + 2.4;
    const rate = 44100;
    const offline = new OfflineAudioContext(2, Math.ceil(seconds * rate), rate);
    const buffers = new Map<string, AudioBuffer>();
    await Promise.all(
      [...this.raw.entries()].map(async ([key, raw]) => {
        buffers.set(key, await offline.decodeAudioData(raw.slice(0)));
      }),
    );
    const comp = offline.createDynamicsCompressor();
    comp.threshold.value = -12;
    comp.knee.value = 16;
    comp.ratio.value = 3.2;
    comp.attack.value = 0.004;
    comp.release.value = 0.22;
    comp.connect(offline.destination);
    const sources: AudioBufferSourceNode[] = [];
    scheduleSong(
      makeApi({ ctx: offline, out: comp, buffers, sources }),
      song,
      0,
      song.blocks.length * 4,
      0.05,
      muted,
    );
    const rendered = await offline.startRendering();
    return encodeWav(rendered);
  }
}

function encodeWav(buffer: AudioBuffer): Blob {
  const length = buffer.length;
  const channels = 2;
  const dataSize = length * channels * 2;
  const ab = new ArrayBuffer(44 + dataSize);
  const view = new DataView(ab);
  const write = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
  };
  write(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  write(8, "WAVE");
  write(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, buffer.sampleRate, true);
  view.setUint32(28, buffer.sampleRate * channels * 2, true);
  view.setUint16(32, channels * 2, true);
  view.setUint16(34, 16, true);
  write(36, "data");
  view.setUint32(40, dataSize, true);
  const left = buffer.getChannelData(0);
  const right = buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : left;
  let offset = 44;
  for (let i = 0; i < length; i++) {
    const l = Math.max(-1, Math.min(1, left[i] ?? 0));
    const r = Math.max(-1, Math.min(1, right[i] ?? 0));
    view.setInt16(offset, l < 0 ? l * 0x8000 : l * 0x7fff, true);
    view.setInt16(offset + 2, r < 0 ? r * 0x8000 : r * 0x7fff, true);
    offset += 4;
  }
  return new Blob([ab], { type: "audio/wav" });
}

export const SAMPLE_TOTAL = ALL_KEYS.length;
