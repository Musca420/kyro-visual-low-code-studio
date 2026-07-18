import { describe, expect, it } from "vitest";
import { gridColumns, gridFractions, resizeGridColumns } from "../src/gridLayout";

describe("layout visuale a colonne", () => {
  it("crea fino a dodici colonne e legge preset e larghezze personalizzate", () => {
    expect(gridColumns(20)).toBe("repeat(12, minmax(0, 1fr))");
    expect(gridFractions("repeat(4, minmax(0, 1fr))")).toEqual([1, 1, 1, 1]);
    expect(gridFractions("0.7fr 1.3fr")).toEqual([0.7, 1.3]);
  });

  it("sposta un separatore senza collassare una colonna", () => {
    expect(resizeGridColumns("1fr 1fr", 0, 0.1)).toBe("1.2fr 0.8fr");
    expect(resizeGridColumns("1fr 1fr", 0, 2)).toBe("1.5fr 0.5fr");
  });
});
