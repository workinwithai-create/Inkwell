export type InkId = "wash" | "verse" | "climb" | "room" | "bare";

export type Chord = { sym: string; bass: number; tones: number[] };

export type Block = { ink: InkId; chords: Chord[] };

export type Stencil = {
  id: string;
  name: string;
  bpm: number;
  blurb: string;
  scale: { name: string; midis: number[] };
  blocks: Block[];
};

export const INK_ORDER: InkId[] = ["wash", "verse", "climb", "room", "bare"];

export const INK_LABEL: Record<InkId, string> = {
  wash: "Wash",
  verse: "Verse",
  climb: "Climb",
  room: "Room",
  bare: "Bare",
};

export const INK_HINT: Record<InkId, string> = {
  wash: "Piano alone",
  verse: "Guitar, bass, soft kit",
  climb: "The band leans in",
  room: "Everyone, including trumpet",
  bare: "Violin and piano, no kit",
};

const chord = (sym: string, bass: number, tones: number[]): Chord => ({
  sym,
  bass,
  tones,
});

const Am = chord("Am", 45, [57, 60, 64]);
const F = chord("F", 41, [53, 57, 60]);
const C = chord("C", 36, [60, 64, 67]);
const G = chord("G", 43, [55, 59, 62]);
const Em = chord("Em", 40, [52, 55, 59]);
const Dm = chord("Dm", 38, [50, 53, 57]);
const Bb = chord("Bb", 34, [58, 62, 65]);
const FC = chord("C", 36, [60, 64, 67]);
const A = chord("A", 33, [57, 61, 64]);
const FF = chord("F", 41, [65, 69, 72]);

const C_MAJOR = {
  name: "C major",
  midis: [60, 62, 64, 65, 67, 69, 71, 72],
};
const D_MINOR = {
  name: "D minor",
  midis: [62, 64, 65, 67, 69, 70, 72, 74],
};

const NAMES = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];

export function noteName(midi: number): string {
  const n = ((midi % 12) + 12) % 12;
  return NAMES[n] ?? "C";
}

function block(ink: InkId, chords: Chord[]): Block {
  return { ink, chords };
}

function repeat(ink: InkId, chords: Chord[], times: number): Block[] {
  return Array.from({ length: times }, () => block(ink, chords));
}

export const STENCILS: Stencil[] = [
  {
    id: "loop",
    name: "The Loop",
    bpm: 96,
    blurb: "Eight copies of the same four bars. This is the song that will not finish.",
    scale: C_MAJOR,
    blocks: repeat("verse", [Am, F, C, G], 8),
  },
  {
    id: "radio",
    name: "Radio",
    bpm: 100,
    blurb: "Intro, verse, climb, room, and a bare bar before the last chorus. A form you can finish.",
    scale: C_MAJOR,
    blocks: [
      block("wash", [C, G, Am, F]),
      block("verse", [Am, F, C, G]),
      block("climb", [F, G, Em, Am]),
      block("room", [C, G, Am, F]),
      block("verse", [Am, F, C, G]),
      block("room", [C, G, Am, F]),
      block("bare", [Am, Em, F, G]),
      block("room", [F, G, C, C]),
    ],
  },
  {
    id: "floor",
    name: "Floor",
    bpm: 118,
    blurb: "A dance form with two doubles still in it. Break the joins and the drop has somewhere to land.",
    scale: D_MINOR,
    blocks: [
      block("verse", [Dm, Dm, Bb, FC]),
      block("verse", [Dm, Dm, Bb, FC]),
      block("bare", [Dm, Bb, FF, FC]),
      block("room", [Dm, FC, Bb, FC]),
      block("verse", [Dm, Bb, FF, FC]),
      block("bare", [Bb, FF, FC, Dm]),
      block("room", [Dm, FC, Bb, A]),
      block("room", [Dm, Bb, FC, Dm]),
    ],
  },
  {
    id: "night",
    name: "Night",
    bpm: 82,
    blurb: "A ballad that opens thin, earns the room, and leaves on a wash instead of a slam.",
    scale: C_MAJOR,
    blocks: [
      block("wash", [C, Em, Am, F]),
      block("wash", [F, C, G, Am]),
      block("verse", [Am, F, C, G]),
      block("climb", [F, G, Em, Am]),
      block("room", [C, G, Am, F]),
      block("bare", [Am, Em, Am, Em]),
      block("room", [F, C, G, Am]),
      block("wash", [C, G, F, C]),
    ],
  },
];

export function stencilById(id: string): Stencil {
  return STENCILS.find((s) => s.id === id) ?? STENCILS[0]!;
}

export type LoopScore = {
  score: number;
  unique: number;
  joins: number;
  harmonyLoops: boolean;
  verdict: string;
  detail: string;
};

export function scoreInks(blocks: Block[]): LoopScore {
  const inks = blocks.map((b) => b.ink);
  const unique = new Set(inks).size;
  let joins = 0;
  for (let i = 0; i < inks.length - 1; i++) {
    if (inks[i] === inks[i + 1]) joins += 1;
  }
  const pairs = Math.max(1, inks.length - 1);
  const variety = (unique / INK_ORDER.length) * 48;
  const motion = ((pairs - joins) / pairs) * 44;
  const hasRoom = inks.includes("room");
  const hasQuiet = inks.some((ink) => ink === "wash" || ink === "bare");
  let score = Math.round(variety + motion + (hasRoom && hasQuiet ? 8 : 0));
  if (unique === 1) score = Math.min(score, 8);
  score = Math.max(0, Math.min(100, score));

  const first = blocks[0]?.chords.map((c) => c.sym).join(" ");
  const harmonyLoops = blocks.every(
    (b) => b.chords.map((c) => c.sym).join(" ") === first,
  );

  let verdict = "Finished form";
  if (score < 30) verdict = "Still a loop";
  else if (score < 60) verdict = "Leaving the loop";
  else if (score < 85) verdict = "It moves";

  const detail = harmonyLoops
    ? "Harmony repeats every four bars. Ink is doing the arranging."
    : "Harmony and ink both change. That is a song, not a loop.";

  return { score, unique, joins, harmonyLoops, verdict, detail };
}

export function chairsFor(ink: InkId): string[] {
  switch (ink) {
    case "wash":
      return ["Piano"];
    case "verse":
      return ["Piano", "Guitar", "Bass", "Kit"];
    case "climb":
      return ["Piano", "Guitar", "Bass", "Violin", "Kit"];
    case "room":
      return ["Piano", "Guitar", "Bass", "Trumpet", "Violin", "Kit"];
    case "bare":
      return ["Piano", "Violin"];
  }
}

export function punchList(stencil: Stencil, blocks: Block[], bpm: number): string {
  const scored = scoreInks(blocks);
  const lines = [
    `Inkwell · ${stencil.name} · ${bpm} BPM · ${stencil.scale.name}`,
    `${scored.verdict} · score ${scored.score} · ${scored.unique} inks · ${scored.joins} identical joins`,
    scored.detail,
    "",
    "Eight blocks, four bars each. Paint the ink. The live band follows.",
    "",
  ];
  blocks.forEach((b, i) => {
    const chords = b.chords.map((c) => c.sym).join("  ");
    lines.push(
      `${i + 1}. ${INK_LABEL[b.ink].padEnd(6, " ")} ${chords}   · ${chairsFor(b.ink).join(", ")}`,
    );
  });
  lines.push(
    "",
    "Live chairs: piano, steel guitar, finger bass, trumpet, violin, kit.",
    "Drop the bounce on a fresh timeline. Do not keep stacking the same four bars.",
  );
  return lines.join("\n");
}

export function applyInk(blocks: Block[], index: number, ink: InkId): Block[] {
  return blocks.map((b, i) => (i === index ? { ...b, ink } : b));
}
