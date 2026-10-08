/** The diner's memo of dishes for the table: quantities by item id. */
export type Selection = Record<string, number>;

export const MAX_QUANTITY = 20;

export function selectionStorageKey(venueId: string) {
  return `menushare.selection.${venueId}`;
}

export function setQuantity(selection: Selection, id: string, quantity: number) {
  const next = { ...selection };
  const clamped = Math.min(MAX_QUANTITY, Math.max(0, Math.round(quantity)));
  if (clamped === 0) delete next[id];
  else next[id] = clamped;
  return next;
}

export function selectionCount(selection: Selection) {
  return Object.values(selection).reduce((sum, quantity) => sum + quantity, 0);
}

export function selectionTotal(
  selection: Selection,
  priceOf: (id: string) => number | undefined,
) {
  return Object.entries(selection).reduce(
    (sum, [id, quantity]) => sum + (priceOf(id) ?? 0) * quantity,
    0,
  );
}

/** Keeps only known dishes with a valid quantity. */
export function sanitizeSelection(value: unknown, validIds: Set<string>) {
  const selection: Selection = {};
  if (!value || typeof value !== "object") return selection;
  for (const [id, quantity] of Object.entries(value)) {
    if (
      validIds.has(id) &&
      typeof quantity === "number" &&
      Number.isInteger(quantity) &&
      quantity > 0
    ) {
      selection[id] = Math.min(MAX_QUANTITY, quantity);
    }
  }
  return selection;
}

/** Compact, URL-safe form used to share a selection: `id~2.id~1`. */
export function encodeSelection(selection: Selection) {
  return Object.entries(selection)
    .map(([id, quantity]) => `${id}~${quantity}`)
    .join(".");
}

export function decodeSelection(param: string | null, validIds: Set<string>) {
  if (!param) return {};
  const raw: Record<string, number> = {};
  for (const part of param.split(".")) {
    const [id, quantity] = part.split("~");
    if (id && quantity && /^\d{1,2}$/.test(quantity))
      raw[id] = Number(quantity);
  }
  return sanitizeSelection(raw, validIds);
}

/** Adds a shared selection to the current one, without lowering quantities. */
export function mergeSelections(current: Selection, incoming: Selection) {
  const merged = { ...current };
  for (const [id, quantity] of Object.entries(incoming)) {
    merged[id] = Math.min(MAX_QUANTITY, Math.max(merged[id] ?? 0, quantity));
  }
  return merged;
}
