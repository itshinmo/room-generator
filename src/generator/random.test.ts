import { describe, expect, it } from "vitest";
import { createSeed, createSeededRandom, hashSeed } from "./random";

describe("hashSeed", () => {
  it("is stable for strings and numbers", () => {
    expect(hashSeed("room")).toBe(hashSeed("room"));
    expect(hashSeed(42)).toBe(hashSeed("42"));
    expect(hashSeed("room")).not.toBe(hashSeed("rooms"));
  });
});

describe("createSeededRandom", () => {
  it("produces the same sequence for the same seed", () => {
    const first = createSeededRandom(hashSeed("repeatable"));
    const second = createSeededRandom(hashSeed("repeatable"));

    const firstSequence = Array.from({ length: 20 }, () => first());
    const secondSequence = Array.from({ length: 20 }, () => second());

    expect(firstSequence).toEqual(secondSequence);
  });

  it("stays in the [0, 1) range", () => {
    const random = createSeededRandom(123);

    for (let index = 0; index < 1000; index++) {
      const value = random();

      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});

describe("createSeed", () => {
  it("creates a short URL-friendly seed", () => {
    expect(createSeed()).toMatch(/^[0-9A-Z]{7}$/);
  });
});
