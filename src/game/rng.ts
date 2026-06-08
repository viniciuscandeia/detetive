// Mulberry32 — fast, seedable, good distribution
export type Rng = () => number;

export function makeRng(seed: number): Rng {
  let s = seed >>> 0;
  return function () {
    s += 0x6d2b79f5;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function roll1d6(rng: Rng): number {
  return Math.floor(rng() * 6) + 1;
}

export function roll2d6(rng: Rng): [number, number] {
  return [roll1d6(rng), roll1d6(rng)];
}

export function shuffle<T>(arr: T[], rng: Rng): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
