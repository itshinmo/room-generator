import { describe, expect, it } from "vitest";
import { BlockType } from "../enums";
import type { Block, BoardState, CellT } from "../types";
import {
  generateBoard,
  getRoomOptions,
  type GenerateBoardOptions,
} from "./generateBoard";

const BOARD_OPTIONS: GenerateBoardOptions = {
  rows: 11,
  cols: 11,
  maxRooms: 15,
  gapChance: 0.15,
};

const SEEDS = Array.from({ length: 100 }, (_, index) => `seed-${index}`);

const cellKey = (row: number, col: number) => `${row}:${col}`;

const createEmptyCells = (rows: number, cols: number): CellT[][] =>
  Array.from({ length: rows }, (_, row) =>
    Array.from({ length: cols }, (_, col) => ({ row, col, blockId: null })),
  );

const countCellsByBlock = (board: BoardState) => {
  const counts = new Map<string, number>();

  for (const row of board.cells) {
    for (const cell of row) {
      if (!cell.blockId) continue;

      counts.set(cell.blockId, (counts.get(cell.blockId) ?? 0) + 1);
    }
  }

  return counts;
};

const expectValidRoomShape = (block: Block) => {
  const rows = block.filledCells.map(cell => cell.row);
  const cols = block.filledCells.map(cell => cell.col);
  const height = Math.max(...rows) - Math.min(...rows) + 1;
  const width = Math.max(...cols) - Math.min(...cols) + 1;

  expect([
    [1, 1],
    [1, 2],
    [2, 1],
    [2, 2],
  ]).toContainEqual([height, width]);
  expect(block.filledCells).toHaveLength(height * width);

  for (let row = Math.min(...rows); row <= Math.max(...rows); row++) {
    for (let col = Math.min(...cols); col <= Math.max(...cols); col++) {
      expect(
        block.filledCells.some(cell => cell.row === row && cell.col === col),
      ).toBe(true);
    }
  }
};

const expectConnected = (board: BoardState) => {
  const startBlock = board.blocks[board.startBlockId];
  const startCell = startBlock?.filledCells[0];

  expect(startCell).toBeDefined();

  const visited = new Set<string>();
  const queue: CellT[] = [startCell!];

  while (queue.length > 0) {
    const cell = queue.pop()!;
    const key = cellKey(cell.row, cell.col);

    if (visited.has(key)) continue;
    if (!cell.blockId) continue;

    visited.add(key);

    for (const [rowOffset, colOffset] of [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ] as const) {
      const row = cell.row + rowOffset;
      const col = cell.col + colOffset;

      if (board.cells[row]?.[col]?.blockId) {
        queue.push(board.cells[row]![col]!);
      }
    }
  }

  const filledCount = board.cells
    .flat()
    .filter(cell => cell.blockId !== null).length;

  expect(visited.size).toBe(filledCount);
};

describe("generateBoard", () => {
  it("is deterministic for the same seed", () => {
    for (const seed of SEEDS.slice(0, 10)) {
      expect(generateBoard(BOARD_OPTIONS, seed)).toEqual(
        generateBoard(BOARD_OPTIONS, seed),
      );
    }
  });

  it("produces different maps for different seeds", () => {
    const first = generateBoard(BOARD_OPTIONS, "first");
    const second = generateBoard(BOARD_OPTIONS, "second");

    const cellsOf = (board: BoardState) =>
      board.cells.flat().map(cell => cell.blockId);

    expect(cellsOf(first)).not.toEqual(cellsOf(second));
  });

  it.each(SEEDS)("respects the room limit (%s)", seed => {
    const board = generateBoard(BOARD_OPTIONS, seed);
    const roomCount = Object.keys(board.blocks).length;

    expect(roomCount).toBeLessThanOrEqual(15);
    expect(roomCount).toBeGreaterThanOrEqual(14);
  });

  it("reaches the room limit for almost every seed", () => {
    const fullCount = SEEDS.filter(
      seed =>
        Object.keys(generateBoard(BOARD_OPTIONS, seed).blocks).length === 15,
    ).length;

    expect(fullCount).toBeGreaterThanOrEqual(90);
  });

  it.each(SEEDS)("places START at the center (%s)", seed => {
    const board = generateBoard(BOARD_OPTIONS, seed);
    const startBlock = board.blocks[board.startBlockId]!;

    expect(startBlock.type).toBe(BlockType.START);
    expect(startBlock.filledCells).toHaveLength(1);
    expect(startBlock.filledCells[0]).toMatchObject({ row: 5, col: 5 });
  });

  it.each(SEEDS)(
    "always creates one END and no other block is deeper (%s)",
    seed => {
      const board = generateBoard(BOARD_OPTIONS, seed);
      const blocks = Object.values(board.blocks);
      const endBlocks = blocks.filter(block => block.type === BlockType.END);

      expect(endBlocks).toHaveLength(1);
      expect(board.endBlockId).toBe(endBlocks[0]!.id);

      const endDepth = endBlocks[0]!.depth;

      expect(blocks.every(block => block.depth <= endDepth)).toBe(true);
    },
  );

  it.each(SEEDS)("does not put END next to START (%s)", seed => {
    const board = generateBoard(BOARD_OPTIONS, seed);
    const endBlock = board.blocks[board.endBlockId!]!;
    const [endCell] = endBlock.filledCells;

    const distance = Math.abs(endCell!.row - 5) + Math.abs(endCell!.col - 5);

    expect(distance).toBeGreaterThan(1);
  });

  it.each(SEEDS)("keeps the whole floor connected (%s)", seed => {
    expectConnected(generateBoard(BOARD_OPTIONS, seed));
  });

  it.each(SEEDS)(
    "never overlaps rooms or puts cells outside the grid (%s)",
    seed => {
      const board = generateBoard(BOARD_OPTIONS, seed);
      const counts = countCellsByBlock(board);
      const seen = new Set<string>();

      for (const block of Object.values(board.blocks)) {
        expectValidRoomShape(block);
        expect(counts.get(block.id)).toBe(block.filledCells.length);

        for (const cell of block.filledCells) {
          expect(cell.row).toBeGreaterThanOrEqual(0);
          expect(cell.row).toBeLessThan(BOARD_OPTIONS.rows);
          expect(cell.col).toBeGreaterThanOrEqual(0);
          expect(cell.col).toBeLessThan(BOARD_OPTIONS.cols);
          expect(board.cells[cell.row]![cell.col]!.blockId).toBe(block.id);

          const key = cellKey(cell.row, cell.col);

          expect(seen.has(key)).toBe(false);
          seen.add(key);
        }
      }
    },
  );

  it("still reaches the room limit when gaps are forced", () => {
    for (const seed of SEEDS) {
      const board = generateBoard({ ...BOARD_OPTIONS, gapChance: 1 }, seed);

      expect(Object.keys(board.blocks).length).toBeGreaterThanOrEqual(14);
      expect(Object.keys(board.blocks).length).toBeLessThanOrEqual(15);
      expect(board.endBlockId).not.toBeNull();
      expectConnected(board);
    }
  });

  it("handles boards smaller than the room target", () => {
    const board = generateBoard(
      { rows: 3, cols: 3, maxRooms: 5, gapChance: 0 },
      "tiny",
    );

    expect(Object.keys(board.blocks).length).toBeLessThanOrEqual(5);
    expect(board.blocks[board.startBlockId]!.type).toBe(BlockType.START);
    expect(board.endBlockId).not.toBeNull();
    expectConnected(board);
  });

  it("handles a 1x1 board", () => {
    const board = generateBoard(
      { rows: 1, cols: 1, maxRooms: 1, gapChance: 0 },
      "single",
    );

    expect(Object.keys(board.blocks)).toHaveLength(1);
    expect(board.endBlockId).toBeNull();
  });

  it("rejects invalid options", () => {
    expect(() =>
      generateBoard({ rows: 0, cols: 11, maxRooms: 5 }, "x"),
    ).toThrow(RangeError);
    expect(() =>
      generateBoard({ rows: 11, cols: 11, maxRooms: 5, gapChance: 1.5 }, "x"),
    ).toThrow(RangeError);
    expect(() =>
      generateBoard({ rows: 11, cols: 11, maxRooms: 0 }, "x"),
    ).toThrow(RangeError);
  });
});

describe("getRoomOptions", () => {
  it("returns all nine shapes around an empty center", () => {
    const cells = createEmptyCells(5, 5);
    const options = getRoomOptions(cells[2]![2]!, cells);

    expect(options).toHaveLength(9);
    expect(options.every(option => option.includes(cells[2]![2]!))).toBe(true);
  });

  it("excludes shapes that overlap a room or a skipped cell", () => {
    const cells = createEmptyCells(5, 5);

    cells[2]![1]!.blockId = "occupied";

    const skipped = new Set([cellKey(1, 1)]);
    const options = getRoomOptions(cells[2]![2]!, cells, skipped);

    expect(
      options.some(option =>
        option.some(cell => cell.row === 2 && cell.col === 1),
      ),
    ).toBe(false);
    expect(
      options.some(option =>
        option.some(cell => cell.row === 1 && cell.col === 1),
      ),
    ).toBe(false);
  });

  it("returns nothing when the center is unavailable", () => {
    const cells = createEmptyCells(5, 5);

    cells[2]![2]!.blockId = "occupied";

    expect(getRoomOptions(cells[2]![2]!, cells)).toEqual([]);
  });
});
