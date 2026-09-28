import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Copy, Download, Play, Square } from "lucide-react";
import {
  INK_HINT,
  INK_LABEL,
  INK_ORDER,
  STENCILS,
  applyInk,
  chairsFor,
  noteName,
  punchList,
  scoreInks,
  stencilById,
  type Block,
  type InkId,
  type Stencil,
} from "@/lib/inkwell/score";
import { InkwellEngine, type Chair, type Inst } from "@/lib/inkwell/audio";

const STORE = "inkwell-map-v1";

type Save = {
  stencilId: string;
  bpm: number;
  inks: Partial<Record<string, InkId[]>>;
};

const LIVE: { id: Inst; label: string }[] = [
  { id: "piano", label: "Piano" },
  { id: "guitar", label: "Guitar" },
  { id: "bass", label: "Bass" },
  { id: "trumpet", label: "Trumpet" },
  { id: "violin", label: "Violin" },
];

const BAND: { id: Chair; label: string }[] = [
  ...LIVE.map((c) => ({ id: c.id as Chair, label: c.label })),
  { id: "kit", label: "Kit" },
];

function loadSave(): Save | null {
  try {
    const raw = localStorage.getItem(STORE);
    if (!raw) return null;
    return JSON.parse(raw) as Save;
  } catch {
    return null;
  }
}

function blocksFrom(stencil: Stencil, inks?: InkId[]): Block[] {
  if (!inks || inks.length !== stencil.blocks.length) return stencil.blocks.map((b) => ({ ...b, chords: b.chords }));
  return stencil.blocks.map((b, i) => ({ ...b, ink: inks[i] ?? b.ink }));
}

function formatClock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function InkwellDesk() {
  const engine = useRef<InkwellEngine | null>(null);
  if (!engine.current) engine.current = new InkwellEngine();

  const [ready, setReady] = useState(false);
  const [booting, setBooting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [stencilId, setStencilId] = useState("loop");
  const [bpm, setBpm] = useState(96);
  const [blocks, setBlocks] = useState<Block[]>(() => stencilById("loop").blocks);
  const [ink, setInk] = useState<InkId>("room");
  const [muted, setMuted] = useState<Chair[]>([]);
  const [live, setLive] = useState<Inst>("piano");
  const [playing, setPlaying] = useState(false);
  const [bar, setBar] = useState(-1);
  const [copied, setCopied] = useState(false);
  const [bouncing, setBouncing] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  const playMeta = useRef({ start: 0, from: 0, to: 0, barDur: 1 });
  const mutedSet = useMemo(() => new Set(muted), [muted]);
  const stencil = stencilById(stencilId);
  const scored = scoreInks(blocks);
  const activeBlock = bar >= 0 ? Math.floor(bar / 4) : -1;
  const songSeconds = blocks.length * 16 * (60 / bpm);

  useEffect(() => {
    const saved = loadSave();
    const id = saved?.stencilId && STENCILS.some((s) => s.id === saved.stencilId) ? saved.stencilId : "loop";
    const base = stencilById(id);
    setStencilId(id);
    setBpm(saved?.bpm ?? base.bpm);
    setBlocks(blocksFrom(base, saved?.inks?.[id]));
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const prev = loadSave();
    const inks = { ...(prev?.inks ?? {}), [stencilId]: blocks.map((b) => b.ink) };
    localStorage.setItem(STORE, JSON.stringify({ stencilId, bpm, inks } satisfies Save));
  }, [hydrated, stencilId, bpm, blocks]);

  const boot = useCallback(async () => {
    const eng = engine.current;
    if (!eng) return;
    setError("");
    setBooting(true);
    eng.onProgress = (done, total) => setProgress(Math.round((done / total) * 100));
    try {
      await eng.ensure();
      if (eng.ctx?.state === "suspended") await eng.ctx.resume();
      setReady(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "The band could not be seated.");
    } finally {
      setBooting(false);
    }
  }, []);

  const stop = useCallback(() => {
    engine.current?.stop();
    setPlaying(false);
    setBar(-1);
  }, []);

  const playRange = useCallback(
    async (from: number, to: number) => {
      const eng = engine.current;
      if (!eng) return;
      if (!eng.loaded) await boot();
      if (!eng.ctx) return;
      if (eng.ctx.state === "suspended") await eng.ctx.resume();
      const dur = eng.play({ bpm, blocks }, from, to, mutedSet);
      const barDur = (60 / bpm) * 4;
      playMeta.current = { start: eng.ctx.currentTime + 0.06, from, to, barDur };
      setPlaying(true);
      setBar(from);
      void dur;
    },
    [blocks, bpm, boot, mutedSet],
  );

  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    const tick = () => {
      const eng = engine.current;
      const meta = playMeta.current;
      if (!eng?.ctx) return;
      const elapsed = eng.ctx.currentTime - meta.start;
      const index = meta.from + Math.floor(elapsed / meta.barDur);
      if (elapsed >= (meta.to - meta.from) * meta.barDur) {
        setPlaying(false);
        setBar(-1);
        return;
      }
      setBar(index);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      if (event.code === "Space") {
        event.preventDefault();
        if (playing) stop();
        else void playRange(0, blocks.length * 4);
      }
      const scale = stencil.scale.midis;
      const map: Record<string, number> = {
        KeyA: 0, KeyS: 1, KeyD: 2, KeyF: 3, KeyG: 4, KeyH: 5, KeyJ: 6, KeyK: 7,
      };
      const idx = map[event.code];
      if (idx !== undefined && !event.repeat) {
        const midi = scale[idx];
        if (midi !== undefined) {
          void (async () => {
            if (!engine.current?.loaded) await boot();
            engine.current?.preview(live, midi);
          })();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [blocks.length, boot, live, playRange, playing, stencil.scale.midis, stop]);

  const chooseStencil = (id: string) => {
    stop();
    const next = stencilById(id);
    const saved = loadSave();
    setStencilId(id);
    setBpm(next.bpm);
    setBlocks(blocksFrom(next, saved?.inks?.[id]));
  };

  const paint = (index: number) => {
    setBlocks((curr) => applyInk(curr, index, ink));
  };

  const copyMap = async () => {
    await navigator.clipboard.writeText(punchList(stencil, blocks, bpm));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  const bounce = async () => {
    if (!engine.current) return;
    setBouncing(true);
    setError("");
    try {
      if (!engine.current.loaded) await boot();
      const blob = await engine.current.bounce({ bpm, blocks }, mutedSet);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `inkwell-${stencil.id}.wav`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bounce failed.");
    } finally {
      setBouncing(false);
    }
  };

  const touchKey = async (midi: number) => {
    if (!engine.current?.loaded) await boot();
    if (engine.current?.ctx?.state === "suspended") await engine.current.ctx.resume();
    engine.current?.preview(live, midi);
  };

  const nowBlock = activeBlock >= 0 ? blocks[activeBlock] : null;

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 md:px-8 md:py-10">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="max-w-xl">
          <p className="text-xs font-medium tracking-widest text-copper uppercase">Finish the form</p>
          <h1 className="mt-1 font-display text-5xl leading-none text-ink md:text-6xl">Inkwell</h1>
          <p className="mt-3 text-pretty text-base leading-relaxed text-muted">
            Eight blocks. Paint the ink. A live band — piano, steel guitar, finger bass, trumpet, violin, and kit —
            changes with the colour, so the track stops being one loop.
          </p>
        </div>
        <div className="flex items-end gap-4 rounded-2xl border border-line bg-paper px-4 py-3">
          <div>
            <p className="text-xs tracking-wide text-muted uppercase">Loop score</p>
            <p className="font-display text-5xl leading-none tabular-nums text-ink">{scored.score}</p>
          </div>
          <div className="pb-1">
            <p className="font-medium text-ink">{scored.verdict}</p>
            <p className="text-sm text-muted">
              {scored.unique} inks · {scored.joins} identical {scored.joins === 1 ? "join" : "joins"}
            </p>
          </div>
        </div>
      </header>

      <p className="max-w-3xl text-sm leading-relaxed text-muted">{scored.detail}</p>

      <section className="flex flex-col gap-3">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {STENCILS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => chooseStencil(item.id)}
              className={`min-h-11 shrink-0 rounded-full border px-4 text-sm ${
                item.id === stencilId
                  ? "border-ink bg-ink text-paper"
                  : "border-line bg-paper text-ink"
              }`}
            >
              {item.name}
              <span className={item.id === stencilId ? "text-paper/70" : "text-muted"}> · {item.bpm}</span>
            </button>
          ))}
        </div>
        <p className="text-sm text-ink">{stencil.blurb}</p>
      </section>

      <section className="flex flex-wrap items-center gap-2">
        <span className="text-xs tracking-wide text-muted uppercase">Ink</span>
        {INK_ORDER.map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setInk(id)}
            className={`swatch-${id} min-h-11 rounded-full px-3 text-sm ${
              ink === id ? "ring-2 ring-copper ring-offset-2 ring-offset-paper" : ""
            }`}
          >
            {INK_LABEL[id]}
          </button>
        ))}
        <span className="text-sm text-muted">{INK_HINT[ink]}</span>
      </section>

      <ol className="grid grid-cols-4 gap-2 md:grid-cols-8">
        {blocks.map((block, index) => {
          const same = index > 0 && blocks[index - 1]?.ink === block.ink;
          const on = activeBlock === index;
          return (
            <li key={index}>
              <button
                type="button"
                onClick={() => paint(index)}
                className={`swatch-${block.ink} flex min-h-32 w-full flex-col items-start rounded-xl p-2 text-left ${
                  on ? "ring-2 ring-copper ring-offset-2 ring-offset-paper" : ""
                }`}
              >
                <span className="flex w-full items-center justify-between text-xs tabular-nums opacity-80">
                  <span>{index + 1}</span>
                  {same ? <span>joins</span> : <span />}
                </span>
                <span className="mt-2 font-display text-xl leading-none">{INK_LABEL[block.ink]}</span>
                <span className="mt-auto pt-3 text-xs tabular-nums tracking-wide opacity-80">
                  {block.chords.map((c) => c.sym).join(" ")}
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      <section className="flex flex-col gap-3 rounded-2xl border border-line p-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => (playing ? stop() : void playRange(0, blocks.length * 4))}
            className="inline-flex min-h-11 items-center gap-2 rounded-full bg-ink px-4 text-sm text-paper"
          >
            {playing ? <Square size={16} /> : <Play size={16} />}
            {playing ? "Stop" : ready ? "Play the form" : "Seat the band"}
          </button>
          <button
            type="button"
            disabled={activeBlock < 0 && !blocks.length}
            onClick={() => {
              const index = activeBlock >= 0 ? activeBlock : 0;
              void playRange(index * 4, index * 4 + 4);
            }}
            className="min-h-11 rounded-full border border-line px-4 text-sm text-ink"
          >
            This block
          </button>
          <button
            type="button"
            onClick={() => void copyMap()}
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-line px-4 text-sm text-ink"
          >
            <Copy size={16} />
            {copied ? "Copied" : "Copy map"}
          </button>
          <button
            type="button"
            onClick={() => void bounce()}
            disabled={bouncing}
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-line px-4 text-sm text-ink disabled:opacity-50"
          >
            <Download size={16} />
            {bouncing ? "Bouncing…" : "Bounce WAV"}
          </button>
        </div>
        <div className="flex items-center gap-3">
          <label className="text-sm text-muted" htmlFor="bpm">
            BPM
          </label>
          <input
            id="bpm"
            type="range"
            min={72}
            max={132}
            value={bpm}
            suppressHydrationWarning
            onChange={(event) => {
              stop();
              setBpm(Number(event.target.value));
            }}
            className="w-32 accent-copper"
          />
          <span className="w-10 tabular-nums text-ink">{bpm}</span>
          <span className="tabular-nums text-sm text-muted">
            {playing && bar >= 0
              ? formatClock((bar - playMeta.current.from) * playMeta.current.barDur)
              : "0:00"}
            {" / "}
            {formatClock(songSeconds)}
          </span>
        </div>
      </section>

      <p className="text-sm text-muted" role="status">
        {error
          ? error
          : booting
            ? `Seating live chairs… ${progress}%`
            : !ready
              ? "Press play to seat the band. Samples are real instruments, not a synth."
              : nowBlock
                ? `Block ${activeBlock + 1} · ${INK_LABEL[nowBlock.ink]} · ${chairsFor(nowBlock.ink).join(", ")}`
                : "Band seated. Paint a block, then play."}
      </p>

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs tracking-wide text-muted uppercase">Band</span>
          {BAND.map((chair) => {
            const off = muted.includes(chair.id);
            return (
              <button
                key={chair.id}
                type="button"
                onClick={() =>
                  setMuted((curr) =>
                    curr.includes(chair.id) ? curr.filter((id) => id !== chair.id) : [...curr, chair.id],
                  )
                }
                className={`min-h-11 rounded-full border px-3 text-sm ${
                  off ? "border-line text-muted line-through" : "border-ink text-ink"
                }`}
              >
                {chair.label}
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs tracking-wide text-muted uppercase">You play</span>
          {LIVE.map((chair) => (
            <button
              key={chair.id}
              type="button"
              onClick={() => setLive(chair.id)}
              className={`min-h-11 rounded-full px-3 text-sm ${
                live === chair.id ? "bg-copper text-paper" : "border border-line text-ink"
              }`}
            >
              {chair.label}
            </button>
          ))}
          <span className="text-sm text-muted">{stencil.scale.name}</span>
        </div>
        <div className="grid grid-cols-4 gap-2 md:grid-cols-8">
          {stencil.scale.midis.map((midi) => (
            <button
              key={midi}
              type="button"
              onPointerDown={(event) => {
                event.preventDefault();
                void touchKey(midi);
              }}
              className="keycap min-h-14 rounded-lg border border-ink bg-paper font-display text-lg text-ink"
            >
              {noteName(midi)}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-4 gap-2">
          {(
            [
              ["kick", "Kick"],
              ["snare", "Snare"],
              ["hihat", "Hat"],
              ["crash", "Crash"],
            ] as const
          ).map(([name, label]) => (
            <button
              key={name}
              type="button"
              onPointerDown={(event) => {
                event.preventDefault();
                void (async () => {
                  if (!engine.current?.loaded) await boot();
                  engine.current?.previewDrum(name);
                })();
              }}
              className="min-h-12 rounded-lg bg-ink text-sm text-paper"
            >
              {label}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted">Keys A S D F G H J K play along. Space starts and stops the form.</p>
      </section>
    </main>
  );
}
