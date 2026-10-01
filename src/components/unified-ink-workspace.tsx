import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Mic2, SlidersHorizontal, Sparkles } from "lucide-react";
import { InkwellDesk } from "@/components/inkwell-desk";

const SONG_KEY = "pipe_dreams_song_context_v1";
const INKWELL_KEY = "inkwell-map-v1";
const AURAMIX_PREVIEW = "https://auramix-git-preview-mantra-unified-workflow-release-forge.vercel.app/";
const DEFAULT_CONTEXT = {
  title: "Untitled song",
  key: "",
  bpm: 96,
  tuning: 432,
  projectId: "",
  updatedAt: 0,
} satisfies SongContext;

type SongContext = {
  title: string;
  key: string;
  bpm: number;
  tuning: number;
  projectId: string;
  updatedAt: number;
};

function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function readClientContext(): SongContext {
  const params = new URLSearchParams(window.location.search);
  const saved = readJSON<Partial<SongContext>>(SONG_KEY, {});
  const map = readJSON<{ bpm?: number }>(INKWELL_KEY, {});

  return {
    title: params.get("song") || saved.title || "Untitled song",
    key: params.get("key") || saved.key || "",
    bpm: Number(params.get("bpm") || saved.bpm || map.bpm || 96) || 96,
    tuning: Number(params.get("tuning") || saved.tuning || 432) || 432,
    projectId: params.get("project") || saved.projectId || "",
    updatedAt: Date.now(),
  };
}

function setNativeRangeValue(input: HTMLInputElement, value: number) {
  const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");
  descriptor?.set?.call(input, String(value));
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

export function UnifiedInkWorkspace() {
  const [context, setContext] = useState<SongContext>(DEFAULT_CONTEXT);
  const [hydrated, setHydrated] = useState(false);
  const [synced, setSynced] = useState(false);

  useEffect(() => {
    setContext(readClientContext());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(SONG_KEY, JSON.stringify({ ...context, updatedAt: Date.now() }));
      localStorage.setItem("pipe_dreams_ink_url", window.location.href.split("?")[0]);
    } catch {
      // Browser storage is optional in the preview.
    }
  }, [context, hydrated]);

  useEffect(() => {
    if (!hydrated) return;

    const timer = window.setTimeout(() => {
      const bpm = document.getElementById("bpm") as HTMLInputElement | null;
      if (bpm && Number(bpm.value) !== context.bpm) setNativeRangeValue(bpm, context.bpm);
      setSynced(true);
    }, 80);

    const onInput = (event: Event) => {
      const target = event.target as HTMLInputElement | null;
      if (target?.id !== "bpm") return;
      const next = Number(target.value);
      if (!Number.isFinite(next)) return;
      setContext((current) => (current.bpm === next ? current : { ...current, bpm: next }));
    };

    document.addEventListener("input", onInput, true);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("input", onInput, true);
    };
  }, [context.bpm, hydrated]);

  const pipesHref = useMemo(() => {
    if (typeof window === "undefined" || !hydrated) return "#";
    const queryOverride = new URLSearchParams(window.location.search).get("pipesUrl");
    const url = new URL(queryOverride || AURAMIX_PREVIEW);
    url.searchParams.set("song", context.title);
    if (context.key.trim()) url.searchParams.set("key", context.key.trim());
    url.searchParams.set("bpm", String(context.bpm));
    url.searchParams.set("tuning", String(context.tuning));
    if (context.projectId) url.searchParams.set("project", context.projectId);
    url.searchParams.set("from", "ink");
    url.searchParams.set("inkUrl", window.location.href.split("?")[0]);
    return url.toString();
  }, [context, hydrated]);

  const change = <K extends keyof SongContext>(key: K, value: SongContext[K]) => {
    setContext((current) => ({ ...current, [key]: value, updatedAt: Date.now() }));
  };

  return (
    <div className="min-h-screen bg-paper text-ink">
      <section className="border-b border-line bg-ink text-paper">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 py-5 md:px-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-semibold tracking-[0.18em] text-copper uppercase">Pipe Dreams Studio · Song Room</p>
              <div className="mt-1 flex flex-wrap items-baseline gap-3">
                <h1 className="font-display text-4xl leading-none md:text-5xl">INK</h1>
                <span className="text-sm text-paper/55">Write + build the song before the mic turns on.</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="rounded-full border border-copper/50 bg-copper/10 px-3 py-2 text-copper">1 · INK</span>
              <ArrowRight size={14} className="text-paper/35" />
              <span className="rounded-full border border-paper/15 px-3 py-2 text-paper/65">2 · PIPES</span>
              <ArrowRight size={14} className="text-paper/35" />
              <span className="rounded-full border border-paper/15 px-3 py-2 text-paper/65">3 · MIX</span>
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-[1.35fr_0.8fr_0.7fr_0.72fr_auto]">
            <label className="flex min-w-0 flex-col gap-1">
              <span className="text-[10px] font-semibold tracking-widest text-paper/45 uppercase">Song</span>
              <input
                value={context.title}
                onChange={(event) => change("title", event.target.value)}
                className="min-h-11 rounded-xl border border-paper/15 bg-paper/5 px-3 text-sm text-paper outline-none focus:border-copper/70"
                placeholder="Song title"
              />
            </label>

            <label className="flex min-w-0 flex-col gap-1">
              <span className="text-[10px] font-semibold tracking-widest text-paper/45 uppercase">Key</span>
              <input
                value={context.key}
                onChange={(event) => change("key", event.target.value)}
                className="min-h-11 rounded-xl border border-paper/15 bg-paper/5 px-3 text-sm text-paper outline-none focus:border-copper/70"
                placeholder="G major"
              />
            </label>

            <label className="flex min-w-0 flex-col gap-1">
              <span className="text-[10px] font-semibold tracking-widest text-paper/45 uppercase">Tempo</span>
              <input
                type="number"
                min={72}
                max={132}
                value={context.bpm}
                onChange={(event) => {
                  const bpm = Math.max(72, Math.min(132, Number(event.target.value) || 96));
                  change("bpm", bpm);
                  const slider = document.getElementById("bpm") as HTMLInputElement | null;
                  if (slider) setNativeRangeValue(slider, bpm);
                }}
                className="min-h-11 rounded-xl border border-paper/15 bg-paper/5 px-3 text-sm text-paper outline-none focus:border-copper/70"
              />
            </label>

            <label className="flex min-w-0 flex-col gap-1">
              <span className="text-[10px] font-semibold tracking-widest text-paper/45 uppercase">Reference</span>
              <div className="flex min-h-11 items-center overflow-hidden rounded-xl border border-paper/15 bg-paper/5">
                <span className="pl-3 text-xs text-paper/45">A=</span>
                <input
                  type="number"
                  min={420}
                  max={460}
                  value={context.tuning}
                  onChange={(event) => change("tuning", Math.max(420, Math.min(460, Number(event.target.value) || 432)))}
                  className="min-w-0 flex-1 bg-transparent px-1 text-sm text-paper outline-none"
                />
                <span className="pr-3 text-xs text-paper/45">Hz</span>
              </div>
            </label>

            <div className="flex items-end">
              <a
                href={pipesHref}
                aria-disabled={!hydrated}
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-copper px-4 text-sm font-semibold text-ink no-underline transition hover:brightness-110 lg:w-auto"
              >
                <Mic2 size={16} />
                Send to PIPES
              </a>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-paper/50">
            <span className="inline-flex items-center gap-1.5"><Sparkles size={13} /> One song context follows the handoff.</span>
            <span className="inline-flex items-center gap-1.5"><SlidersHorizontal size={13} /> BPM is synced to INK’s existing playback control.</span>
            <span>{hydrated && synced ? "Song state connected." : "Connecting song state…"}</span>
          </div>
        </div>
      </section>

      <InkwellDesk />
    </div>
  );
}
