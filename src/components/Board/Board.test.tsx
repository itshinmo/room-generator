import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import Board from "./Board";

const renderBoard = () => renderToStaticMarkup(<Board initialSeed="seed-0" />);

describe("Board", () => {
  it("renders every cell in the grid", () => {
    const html = renderBoard();

    expect(html.match(/role="gridcell"/g)).toHaveLength(11 * 11);
  });

  it("renders a start room and an end room", () => {
    const html = renderBoard();

    expect(html).toContain('aria-label="Start room"');
    expect(html).toContain('aria-label="End room"');
  });

  it("renders the seed and the regenerate control", () => {
    const html = renderBoard();

    expect(html).toContain("Seed ");
    expect(html).toContain("New room");
    expect(html).toContain("15 rooms");
  });
});
