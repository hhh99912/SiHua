/**
 * Color utility for robust alpha blending and CSS/Canvas gradient color formatting.
 */

export function withAlpha(color: string | undefined | null, alpha: number): string {
  if (!color || typeof color !== 'string') {
    return `rgba(0, 242, 255, ${alpha})`;
  }

  const c = color.trim();
  if (!c) {
    return `rgba(0, 242, 255, ${alpha})`;
  }

  // 1. Hex Color (#RGB, #RGBA, #RRGGBB, #RRGGBBAA)
  if (c.startsWith('#')) {
    let hex = c.slice(1);
    if (hex.length === 3 || hex.length === 4) {
      hex = hex.split('').map(char => char + char).join('');
    }
    if (hex.length >= 6) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      if (!isNaN(r) && !isNaN(g) && !isNaN(b)) {
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
      }
    }
  }

  // 2. RGB / RGBA
  if (c.startsWith('rgb')) {
    const match = c.match(/[\d.]+/g);
    if (match && match.length >= 3) {
      const r = parseFloat(match[0]);
      const g = parseFloat(match[1]);
      const b = parseFloat(match[2]);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
  }

  // 3. Named colors lookup table
  const namedColors: Record<string, [number, number, number]> = {
    white: [255, 255, 255],
    black: [0, 0, 0],
    red: [239, 68, 68],
    cyan: [0, 242, 255],
    blue: [59, 130, 246],
    amber: [245, 158, 11],
    emerald: [16, 185, 129],
    slate: [30, 41, 59],
    transparent: [0, 0, 0]
  };

  const lower = c.toLowerCase();
  if (namedColors[lower]) {
    const [r, g, b] = namedColors[lower];
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  return `rgba(0, 242, 255, ${alpha})`;
}
