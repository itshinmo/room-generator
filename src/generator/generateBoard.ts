import { BlockType } from "../enums";
import {
  type Block,
  type BlockId,
  type BoardState,
  type Blocks,
  type CellT,
} from "../types";
import { createSeededRandom, hashSeed, type Random } from "./random";

export type GenerateBoardOptions = {
  rows: number;
  cols: number;
  /** Maximum number of rooms, including the start and end rooms. */
  maxRooms: number;
  /** Chance of leaving a frontier cell empty instead of placing a room. */
  gapChance?: number;
};

type FrontierCell = {
  row: number;
  col: number;
  /** Distance from START, in room-to-room steps. */
  depth: number;
  /** Manhattan distance from the board center, used as a tie-breaker. */
  distance: number;
};

type EndPlacement =
  | { cell: CellT; depth: number }
  | { block: Block; depth: number };

export const START_COLOR = "#15803d";
export const END_COLOR = "#b91c1c";
const DEFAULT_GAP_CHANCE = 0.15;

const START_ROOM_COUNT = 1;

const DIRECTIONS = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
] as const;

const keyOf = (row: number, col: number) => `${row}:${col}`;

const isInBounds = (cells: CellT[][], row: number, col: number) =>
  row >= 0 && row < cells.length && col >= 0 && col < (cells[0]?.length ?? 0);

const manhattanDistance = (
  row: number,
  col: number,
  centerRow: number,
  centerCol: number,
) => Math.abs(row - centerRow) + Math.abs(col - centerCol);

/**
 * Builds every room shape that fits around a frontier cell.
 * Shapes: 1x1, 1x2, 2x1 and 2x2. Every option contains the center cell, which
 * guarantees that a placed room stays connected to the existing floor.
 */
export const getRoomOptions = (
  centerCell: CellT,
  cells: CellT[][],
  skipped: ReadonlySet<string> = new Set(),
): CellT[][] => {
  const { row, col } = centerCell;

  const isAvailable = (candidateRow: number, candidateCol: number) =>
    isInBounds(cells, candidateRow, candidateCol) &&
    !cells[candidateRow]![candidateCol]!.blockId &&
    !skipped.has(keyOf(candidateRow, candidateCol));

  if (!isAvailable(row, col)) return [];

  const cellAt = (candidateRow: number, candidateCol: number) =>
    cells[candidateRow]![candidateCol]!;

  const options: CellT[][] = [[cellAt(row, col)]];

  if (isAvailable(row, col - 1)) {
    options.push([cellAt(row, col - 1), cellAt(row, col)]);
  }
  if (isAvailable(row, col + 1)) {
    options.push([cellAt(row, col), cellAt(row, col + 1)]);
  }
  if (isAvailable(row - 1, col)) {
    options.push([cellAt(row - 1, col), cellAt(row, col)]);
  }
  if (isAvailable(row + 1, col)) {
    options.push([cellAt(row, col), cellAt(row + 1, col)]);
  }

  const quadrants: Array<Array<[number, number]>> = [
    [
      [row - 1, col - 1],
      [row - 1, col],
      [row, col - 1],
      [row, col],
    ],
    [
      [row - 1, col],
      [row - 1, col + 1],
      [row, col],
      [row, col + 1],
    ],
    [
      [row, col - 1],
      [row, col],
      [row + 1, col - 1],
      [row + 1, col],
    ],
    [
      [row, col],
      [row, col + 1],
      [row + 1, col],
      [row + 1, col + 1],
    ],
  ];

  for (const quadrant of quadrants) {
    if (
      quadrant.every(([quadrantRow, quadrantCol]) =>
        isAvailable(quadrantRow, quadrantCol),
      )
    ) {
      options.push(
        quadrant.map(([quadrantRow, quadrantCol]) =>
          cellAt(quadrantRow, quadrantCol),
        ),
      );
    }
  }

  return options;
};

/** Every free cell orthogonally adjacent to an existing room. */
const getFrontier = (
  cells: CellT[][],
  depths: ReadonlyMap<BlockId, number>,
  skipped: ReadonlySet<string>,
  includeSkipped: boolean,
): FrontierCell[] => {
  const rows = cells.length;
  const cols = cells[0]?.length ?? 0;
  const centerRow = Math.floor(rows / 2);
  const centerCol = Math.floor(cols / 2);
  const frontier = new Map<string, FrontierCell>();

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (!cells[row]![col]!.blockId) continue;

      for (const [rowOffset, colOffset] of DIRECTIONS) {
        const neighborRow = row + rowOffset;
        const neighborCol = col + colOffset;

        if (!isInBounds(cells, neighborRow, neighborCol)) continue;
        if (cells[neighborRow]![neighborCol]!.blockId) continue;

        const key = keyOf(neighborRow, neighborCol);
        if (!includeSkipped && skipped.has(key)) continue;

        let minimumDepth = Number.POSITIVE_INFINITY;

        for (const [depthRowOffset, depthColOffset] of DIRECTIONS) {
          const adjacentRow = neighborRow + depthRowOffset;
          const adjacentCol = neighborCol + depthColOffset;

          if (!isInBounds(cells, adjacentRow, adjacentCol)) continue;

          const adjacentBlockId = cells[adjacentRow]![adjacentCol]!.blockId;

          if (adjacentBlockId) {
            const depth = depths.get(adjacentBlockId);

            if (depth !== undefined) {
              minimumDepth = Math.min(minimumDepth, depth);
            }
          }
        }

        const candidate: FrontierCell = {
          row: neighborRow,
          col: neighborCol,
          depth: minimumDepth + 1,
          distance: manhattanDistance(
            neighborRow,
            neighborCol,
            centerRow,
            centerCol,
          ),
        };
        const existing = frontier.get(key);

        if (!existing || candidate.depth < existing.depth) {
          frontier.set(key, candidate);
        }
      }
    }
  }

  return [...frontier.values()];
};

/** Depth of a room, based on the rooms it touches. */
const getOptionDepth = (
  roomCells: CellT[],
  cells: CellT[][],
  depths: ReadonlyMap<BlockId, number>,
): number => {
  let minimumDepth = Number.POSITIVE_INFINITY;

  for (const cell of roomCells) {
    for (const [rowOffset, colOffset] of DIRECTIONS) {
      const row = cell.row + rowOffset;
      const col = cell.col + colOffset;

      if (!isInBounds(cells, row, col)) continue;

      const adjacentBlockId = cells[row]![col]!.blockId;

      if (adjacentBlockId) {
        const depth = depths.get(adjacentBlockId);

        if (depth !== undefined) {
          minimumDepth = Math.min(minimumDepth, depth);
        }
      }
    }
  }

  return Number.isFinite(minimumDepth) ? minimumDepth + 1 : 0;
};

/**
 * Places END on the farthest free cell that touches the existing floor.
 * If the deepest room is boxed in and no frontier cell is at least as deep,
 * that room is promoted to END instead. This keeps END the deepest room,
 * even though it can cost one room in rare layouts.
 */
const findEndPlacement = (
  blocks: Blocks,
  cells: CellT[][],
  depths: ReadonlyMap<BlockId, number>,
  skipped: ReadonlySet<string>,
): EndPlacement | null => {
  const allBlocks = Object.values(blocks);
  const maximumDepth = Math.max(...allBlocks.map(block => block.depth));

  let frontier = getFrontier(cells, depths, skipped, false);

  if (frontier.length === 0) {
    frontier = getFrontier(cells, depths, skipped, true);
  }

  const farthest = frontier.reduce<FrontierCell | null>((best, candidate) => {
    if (!best) return candidate;
    if (candidate.depth !== best.depth) {
      return candidate.depth > best.depth ? candidate : best;
    }

    return candidate.distance > best.distance ? candidate : best;
  }, null);

  if (farthest && farthest.depth >= maximumDepth) {
    return {
      cell: cells[farthest.row]![farthest.col]!,
      depth: farthest.depth,
    };
  }

  const rows = cells.length;
  const cols = cells[0]?.length ?? 0;
  const centerRow = Math.floor(rows / 2);
  const centerCol = Math.floor(cols / 2);
  const promotable = allBlocks
    .filter(
      block => block.type !== BlockType.START && block.depth === maximumDepth,
    )
    .sort((first, second) => {
      const firstDistance = Math.max(
        ...first.filledCells.map(cell =>
          manhattanDistance(cell.row, cell.col, centerRow, centerCol),
        ),
      );
      const secondDistance = Math.max(
        ...second.filledCells.map(cell =>
          manhattanDistance(cell.row, cell.col, centerRow, centerCol),
        ),
      );

      return secondDistance - firstDistance;
    })[0];

  return promotable ? { block: promotable, depth: maximumDepth } : null;
};

const createRoomColor = (roomIndex: number, random: Random): string => {
  const hue = (roomIndex * 137.508 + random() * 24) % 360;
  const saturation = 58 + Math.floor(random() * 18);
  const lightness = 38 + Math.floor(random() * 12);

  return `hsl(${Math.round(hue)} ${saturation}% ${lightness}%)`;
};

const assertPositiveInteger = (name: string, value: number) => {
  if (!Number.isInteger(value) || value < 1) {
    throw new RangeError(
      `${name} must be a positive integer (received ${String(value)})`,
    );
  }
};

/**
 * Generates a connected floor of rooms.
 *
 * The start room is placed in the center. Rooms then grow outwards from the
 * frontier, with a small chance of leaving a gap. The end room is placed on
 * the farthest free frontier cell; if none is deep enough, the deepest room
 * is promoted to END instead.
 *
 * The same seed and options always produce the same board.
 */
export const generateBoard = (
  options: GenerateBoardOptions,
  seed: string | number,
): BoardState => {
  const { rows, cols, maxRooms } = options;
  const gapChance = options.gapChance ?? DEFAULT_GAP_CHANCE;

  assertPositiveInteger("rows", rows);
  assertPositiveInteger("cols", cols);
  assertPositiveInteger("maxRooms", maxRooms);

  if (!Number.isFinite(gapChance) || gapChance < 0 || gapChance > 1) {
    throw new RangeError(
      `gapChance must be between 0 and 1 (received ${String(gapChance)})`,
    );
  }

  const random = createSeededRandom(hashSeed(seed));
  const cells: CellT[][] = Array.from({ length: rows }, (_, row) =>
    Array.from({ length: cols }, (_, col) => ({ row, col, blockId: null })),
  );
  const blocks: Blocks = {};
  const depths = new Map<BlockId, number>();
  const skipped = new Set<string>();

  let blockCount = 0;

  const placeBlock = (
    type: BlockType,
    filledCells: CellT[],
    color: string,
    depth: number,
  ): Block => {
    const id = `block-${blockCount}`;
    const block: Block = { id, type, depth, filledCells, color };

    for (const cell of filledCells) {
      cell.blockId = id;
    }

    blocks[id] = block;
    depths.set(id, depth);
    blockCount++;

    return block;
  };

  const centerRow = Math.floor(rows / 2);
  const centerCol = Math.floor(cols / 2);
  const startBlock = placeBlock(
    BlockType.START,
    [cells[centerRow]![centerCol]!],
    START_COLOR,
    0,
  );

  const targetRooms = Math.min(maxRooms, rows * cols);

  // Reserve one room for END.
  while (blockCount < targetRooms - START_ROOM_COUNT) {
    const frontier = getFrontier(cells, depths, skipped, false);

    if (frontier.length === 0) {
      // A room may have been placed in a pocket surrounded by gaps. Reclaim
      // the skipped cells so a map always reaches its room target when there
      // is still free space.
      if (skipped.size > 0) {
        skipped.clear();
        continue;
      }

      break;
    }

    const candidate = frontier[Math.floor(random() * frontier.length)]!;
    const centerCell = cells[candidate.row]![candidate.col]!;
    const roomOptions = getRoomOptions(centerCell, cells, skipped);

    if (roomOptions.length === 0) {
      skipped.add(keyOf(candidate.row, candidate.col));
      continue;
    }

    const leaveGap =
      blockCount >= 3 && frontier.length > 1 && random() < gapChance;

    if (leaveGap) {
      skipped.add(keyOf(candidate.row, candidate.col));
      continue;
    }

    const roomCells = roomOptions[Math.floor(random() * roomOptions.length)]!;
    const depth = getOptionDepth(roomCells, cells, depths);

    placeBlock(
      BlockType.ROOM,
      roomCells,
      createRoomColor(blockCount, random),
      depth,
    );
  }

  let endBlockId: BlockId | null = null;

  if (targetRooms > START_ROOM_COUNT) {
    const endPlacement = findEndPlacement(blocks, cells, depths, skipped);

    if (endPlacement) {
      if ("cell" in endPlacement) {
        const endBlock = placeBlock(
          BlockType.END,
          [endPlacement.cell],
          END_COLOR,
          endPlacement.depth,
        );
        endBlockId = endBlock.id;
      } else {
        endPlacement.block.type = BlockType.END;
        endPlacement.block.color = END_COLOR;
        endBlockId = endPlacement.block.id;
      }
    }
  }

  return {
    cells,
    blocks,
    startBlockId: startBlock.id,
    endBlockId,
  };
};
