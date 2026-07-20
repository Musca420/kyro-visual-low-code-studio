import { describe, expect, it } from "vitest";
import { clampContextMenuPosition } from "../src/contextMenu";

describe("context menu positioning", () => {
  it("keeps the menu inside the viewport", () => {
    expect(clampContextMenuPosition(1_500, 850, 1_600, 900)).toEqual({ x: 1_362, y: 556 });
    expect(clampContextMenuPosition(-20, -10, 320, 480)).toEqual({ x: 8, y: 8 });
  });
});
