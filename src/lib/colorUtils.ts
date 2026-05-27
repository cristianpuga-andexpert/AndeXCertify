/**
 * colorUtils.ts — Utilidades de color para detección de paleta desde logo
 * y aplicación dinámica del color de marca en la app.
 */

export function darkenHex(hex: string, amount = 30): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (
    '#' +
    [r, g, b]
      .map((c) => Math.max(0, c - amount).toString(16).padStart(2, '0'))
      .join('')
  );
}

export function rgbToHex(r: number, g: number, b: number): string {
  return (
    '#' +
    [r, g, b]
      .map((c) =>
        Math.min(255, Math.max(0, Math.round(c)))
          .toString(16)
          .padStart(2, '0')
      )
      .join('')
  );
}

/**
 * Extrae los colores dominantes más saturados de una imagen.
 * Ignora blancos, negros y tonos grises (baja saturación).
 */
export async function extractDominantColors(
  imgSrc: string,
  maxColors = 6
): Promise<string[]> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      const SIZE = 100;
      const canvas = document.createElement('canvas');
      canvas.width = SIZE;
      canvas.height = SIZE;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, SIZE, SIZE);
      const { data } = ctx.getImageData(0, 0, SIZE, SIZE);

      const bucketMap = new Map<
        string,
        { count: number; r: number; g: number; b: number }
      >();

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const a = data[i + 3];

        if (a < 128) continue;                        // transparente
        if (r > 235 && g > 235 && b > 235) continue; // blanco
        if (r < 20 && g < 20 && b < 20) continue;    // negro

        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const sat = max === 0 ? 0 : (max - min) / max;
        if (sat < 0.12) continue; // gris sin saturación

        // Agrupar en cubos de 32
        const br = Math.round(r / 32) * 32;
        const bg = Math.round(g / 32) * 32;
        const bb = Math.round(b / 32) * 32;
        const key = `${br},${bg},${bb}`;

        const existing = bucketMap.get(key);
        if (existing) {
          existing.count++;
        } else {
          bucketMap.set(key, { count: 1, r: br, g: bg, b: bb });
        }
      }

      // Puntuar por frecuencia × saturación para preferir colores vivos
      const scored = [...bucketMap.values()]
        .map(({ count, r, g, b }) => {
          const max = Math.max(r, g, b);
          const min = Math.min(r, g, b);
          const sat = max === 0 ? 0 : (max - min) / max;
          return { r, g, b, score: count * sat };
        })
        .sort((a, b) => b.score - a.score);

      // Deduplicar colores similares
      const result: { r: number; g: number; b: number }[] = [];
      for (const c of scored) {
        const isSimilar = result.some(
          ({ r, g, b }) =>
            Math.abs(r - c.r) + Math.abs(g - c.g) + Math.abs(b - c.b) < 80
        );
        if (!isSimilar) {
          result.push(c);
          if (result.length >= maxColors) break;
        }
      }

      resolve(result.map(({ r, g, b }) => rgbToHex(r, g, b)));
    };

    img.onerror = () => resolve([]);
    img.src = imgSrc;
  });
}

export const DEFAULT_BRAND_COLOR = '#6366f1';

/**
 * Aplica el color de marca en los CSS custom properties de :root.
 * Se usa tanto en carga de sesión como al cambiar color en tiempo real.
 */
export function applyBrandColor(hex: string | undefined) {
  const color = hex || DEFAULT_BRAND_COLOR;
  const dark = darkenHex(color, 28);
  document.documentElement.style.setProperty('--color-brand', color);
  document.documentElement.style.setProperty('--color-brand-dark', dark);
}
