const repeatPattern = /^repeat\(\s*(\d+)\s*,\s*(?:minmax\(\s*0\s*,\s*)?([\d.]+)fr\)?\s*\)$/i;

export function gridFractions(value: string): number[] {
  const repeat = value.trim().match(repeatPattern);
  if (repeat) return Array.from({ length: Number(repeat[1]) }, () => Number(repeat[2]));
  const values = [...value.matchAll(/([\d.]+)fr/g)].map((match) => Number(match[1]));
  return values.length && values.every((item) => Number.isFinite(item) && item > 0) ? values : [1];
}

export function gridColumns(count: number) {
  return `repeat(${Math.max(1, Math.min(12, count))}, minmax(0, 1fr))`;
}

export function resizeGridColumns(value: string, boundary: number, deltaRatio: number) {
  const columns = gridFractions(value);
  if (boundary < 0 || boundary >= columns.length - 1) return value;
  const total = columns.reduce((sum, item) => sum + item, 0);
  const pair = columns[boundary] + columns[boundary + 1];
  const minimum = Math.min(0.5, pair / 3);
  const left = Math.max(minimum, Math.min(pair - minimum, columns[boundary] + deltaRatio * total));
  columns[boundary] = left;
  columns[boundary + 1] = pair - left;
  return columns.map((item) => `${Number(item.toFixed(3))}fr`).join(" ");
}
