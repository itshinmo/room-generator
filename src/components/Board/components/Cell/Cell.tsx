import { BlockType } from "../../../../enums";
import { type Blocks, type CellT } from "../../../../types";
import classes from "./styles.module.css";

type Props = {
  cell: CellT;
  blocks: Blocks;
};

const LABELS: Partial<Record<BlockType, string>> = {
  [BlockType.START]: "S",
  [BlockType.END]: "E",
};

const getAriaLabel = (type: BlockType | undefined): string => {
  switch (type) {
    case BlockType.START:
      return "Start room";
    case BlockType.END:
      return "End room";
    case BlockType.ROOM:
      return "Room";
    default:
      return "Empty space";
  }
};

const Cell = (props: Props) => {
  const { cell, blocks } = props;
  const block = cell.blockId ? blocks[cell.blockId] : undefined;
  const label = block ? LABELS[block.type] : undefined;

  return (
    <div
      role="gridcell"
      aria-label={getAriaLabel(block?.type)}
      className={classes.root}
      style={block ? { backgroundColor: block.color } : undefined}
    >
      {label ?? null}
    </div>
  );
};

export default Cell;
