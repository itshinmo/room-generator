import { type BlockType } from "./enums";

export type BlockId = string;

export type CellT = {
  row: number;
  col: number;
  /** `null` means this cell is intentionally empty (void). */
  blockId: BlockId | null;
};

export type Block = {
  id: BlockId;
  type: BlockType;
  /** Distance from the start room, in room-to-room steps. */
  depth: number;
  filledCells: CellT[];
  color: string;
};

export type Blocks = Record<BlockId, Block>;

export type BoardState = {
  cells: CellT[][];
  blocks: Blocks;
  startBlockId: BlockId;
  endBlockId: BlockId | null;
};
