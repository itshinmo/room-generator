import * as React from "react";
import { BOARD_SIZE, COLS, GAP_CHANCE, MAX_ROOMS, ROWS } from "../../config";
import {
  createSeed,
  END_COLOR,
  generateBoard,
  START_COLOR,
  type GenerateBoardOptions,
} from "../../generator";
import { Cell } from "./components";
import classes from "./styles.module.css";

const SEED_PARAM = "seed";

const BOARD_OPTIONS: GenerateBoardOptions = {
  rows: ROWS,
  cols: COLS,
  maxRooms: MAX_ROOMS,
  gapChance: GAP_CHANCE,
};

const readSeedFromUrl = (): string | null => {
  if (typeof window === "undefined") return null;

  const seed = new URLSearchParams(window.location.search)
    .get(SEED_PARAM)
    ?.trim();

  return seed ? seed : null;
};

type BoardProps = {
  /** Optional starting seed, useful for tests and embedded demos. */
  initialSeed?: string;
};

const Board = ({ initialSeed }: BoardProps) => {
  const [seed, setSeed] = React.useState(
    () => initialSeed ?? readSeedFromUrl() ?? createSeed(),
  );
  const [copied, setCopied] = React.useState(false);
  const board = React.useMemo(() => generateBoard(BOARD_OPTIONS, seed), [seed]);

  React.useEffect(() => {
    const url = new URL(window.location.href);

    url.searchParams.set(SEED_PARAM, seed);
    window.history.replaceState(null, "", url);
  }, [seed]);

  React.useEffect(() => {
    if (!copied) return;

    const timeout = window.setTimeout(() => setCopied(false), 1500);

    return () => window.clearTimeout(timeout);
  }, [copied]);

  const handleRegenerate = React.useCallback(() => {
    setSeed(createSeed());
  }, []);

  const handleCopySeed = React.useCallback(async () => {
    try {
      await navigator.clipboard.writeText(seed);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }, [seed]);

  const renderBoard = () =>
    board.cells.map((cellRow, rowIndex) => (
      <div role="row" key={rowIndex} className={classes.row}>
        {cellRow.map(cell => (
          <Cell
            key={`${cell.row}-${cell.col}`}
            cell={cell}
            blocks={board.blocks}
          />
        ))}
      </div>
    ));

  return (
    <main className={classes.root}>
      <header className={classes.header}>
        <div>
          <h1 className={classes.title}>Room Generator</h1>
          <p className={classes.subtitle}>
            A tiny Binding of Isaac-inspired floor generator.
          </p>
        </div>

        <div className={classes.controls}>
          <button
            type="button"
            className={classes.seed}
            onClick={handleCopySeed}
            title="Copy seed to clipboard"
          >
            {copied ? "Copied!" : `Seed ${seed}`}
          </button>

          <button
            type="button"
            className={classes.button}
            onClick={handleRegenerate}
          >
            New room
          </button>
        </div>
      </header>

      <div
        role="grid"
        aria-label="Generated room map"
        className={classes.board}
        style={{
          maxWidth: `${BOARD_SIZE}px`,
          gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))`,
        }}
      >
        {renderBoard()}
      </div>

      <footer className={classes.legend}>
        <span className={classes.legendItem}>
          <span
            className={classes.legendSwatch}
            style={{ backgroundColor: START_COLOR }}
          />
          Start
        </span>
        <span className={classes.legendItem}>
          <span
            className={classes.legendSwatch}
            style={{ backgroundColor: END_COLOR }}
          />
          End
        </span>
        <span>{Object.keys(board.blocks).length} rooms</span>
      </footer>
    </main>
  );
};

export default Board;
