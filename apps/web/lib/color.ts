function channels(hex: string) {
  const value = /^#?([0-9a-f]{6})$/i.exec(hex.trim())?.[1];
  if (!value) return null;
  return [0, 2, 4].map((index) => parseInt(value.slice(index, index + 2), 16));
}

function luminance(hex: string) {
  const rgb = channels(hex);
  if (!rgb) return null;
  const [r, g, b] = rgb.map((channel) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string) {
  const la = luminance(a);
  const lb = luminance(b);
  if (la === null || lb === null) return 1;
  const [light, dark] = la > lb ? [la, lb] : [lb, la];
  return (light + 0.05) / (dark + 0.05);
}

/** Text colour placed on the venue colour: white unless the colour is light. */
export function readableInk(accent: string) {
  return contrastRatio(accent, "#ffffff") >= 3 ? "#ffffff" : "#1f1a17";
}

export function safeAccent(accent: string | undefined, fallback = "#76263c") {
  return accent && channels(accent) ? accent : fallback;
}
