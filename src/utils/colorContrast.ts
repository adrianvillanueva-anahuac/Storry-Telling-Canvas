/**
 * Computes a high-contrast foreground color (#ffffff or #171717) for a given hex background color
 * using relative sRGB luminance so color-coded badges remain legible across custom user hues.
 */
export function getContrastTextColor(hexColor?: string | null): '#ffffff' | '#171717' {
  if (!hexColor) return '#ffffff';
  const cleaned = hexColor.trim().replace(/^#/, '');
  let r = 0;
  let g = 0;
  let b = 0;

  if (cleaned.length === 3 || cleaned.length === 4) {
    r = parseInt(cleaned[0] + cleaned[0], 16);
    g = parseInt(cleaned[1] + cleaned[1], 16);
    b = parseInt(cleaned[2] + cleaned[2], 16);
  } else if (cleaned.length >= 6) {
    r = parseInt(cleaned.slice(0, 2), 16);
    g = parseInt(cleaned.slice(2, 4), 16);
    b = parseInt(cleaned.slice(4, 6), 16);
  } else {
    return '#ffffff';
  }

  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) {
    return '#ffffff';
  }

  const toLinear = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };

  const luminance = 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
  return luminance > 0.42 ? '#171717' : '#ffffff';
}
