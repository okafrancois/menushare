import { describe, expect, it } from "vitest";

import {
  decodeSelection,
  encodeSelection,
  MAX_QUANTITY,
  mergeSelections,
  sanitizeSelection,
  selectionCount,
  selectionTotal,
  setQuantity,
} from "@/lib/menu-selection";

const valid = new Set(["burrata", "tiramisu", "pairing:burrata"]);

describe("sélection du client", () => {
  it("ajoute, plafonne et retire des quantités", () => {
    let selection = setQuantity({}, "burrata", 2);
    selection = setQuantity(selection, "tiramisu", 99);
    expect(selection).toEqual({ burrata: 2, tiramisu: MAX_QUANTITY });
    expect(setQuantity(selection, "burrata", 0)).toEqual({
      tiramisu: MAX_QUANTITY,
    });
  });

  it("compte les articles et le total estimé", () => {
    const selection = { burrata: 2, tiramisu: 1 };
    expect(selectionCount(selection)).toBe(3);
    const prices: Record<string, number> = { burrata: 1400, tiramisu: 900 };
    expect(selectionTotal(selection, (id) => prices[id])).toBe(3700);
  });

  it("ignore les plats inconnus et les quantités invalides", () => {
    expect(
      sanitizeSelection(
        { burrata: 2, ghost: 1, tiramisu: -1, "pairing:burrata": 1.5 },
        valid,
      ),
    ).toEqual({ burrata: 2 });
    expect(sanitizeSelection("nope", valid)).toEqual({});
  });

  it("encode une sélection partageable dans l’URL", () => {
    const encoded = encodeSelection({ burrata: 2, "pairing:burrata": 1 });
    expect(encoded).toBe("burrata~2.pairing:burrata~1");
    expect(decodeSelection(encoded, valid)).toEqual({
      burrata: 2,
      "pairing:burrata": 1,
    });
    expect(decodeSelection("burrata~x.ghost~2", valid)).toEqual({});
    expect(decodeSelection(null, valid)).toEqual({});
  });

  it("fusionne une sélection partagée sans baisser les quantités", () => {
    expect(
      mergeSelections({ burrata: 3 }, { burrata: 1, tiramisu: 2 }),
    ).toEqual({ burrata: 3, tiramisu: 2 });
  });
});
