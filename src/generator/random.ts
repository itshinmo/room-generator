/**
 * Small, dependency-free deterministic random helpers.
 *
 * The generator uses a seed string so a map can be reproduced (and shared)
 * by keeping the seed in the URL.
 */

export type Random = () => number;

/**
 * Hashes a string (or number) into a 32-bit unsigned integer.
 * Uses the FNV-1a algorithm, which is stable across platforms.
 */
export const hashSeed = (seed: string | number): number => {
  const value = String(seed);
  let hash = 2166136261;

  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
};

/**
 * Mulberry32: a tiny, fast seeded PRNG.
 * Returns a function producing numbers in the [0, 1) range.
 */
export const createSeededRandom = (seed: number): Random => {
  let state = seed >>> 0;

  return () => {
    state = (state + 0x6d2b79f5) >>> 0;

    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);

    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
};

/** Creates a short, URL-friendly, random seed. */
export const createSeed = (): string => {
  const values = new Uint32Array(1);

  if (typeof crypto !== "undefined" && "getRandomValues" in crypto) {
    crypto.getRandomValues(values);
  } else {
    values[0] = Math.floor(Math.random() * 0x100000000);
  }

  return values[0]!.toString(36).toUpperCase().padStart(7, "0");
};
