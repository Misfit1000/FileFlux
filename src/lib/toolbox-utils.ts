export function toBase64(value: string) {
  if (typeof btoa === 'function') {
    const bytes = new TextEncoder().encode(value);
    let binary = '';
    bytes.forEach((byte) => {
      binary += String.fromCharCode(byte);
    });
    return btoa(binary);
  }
  return Buffer.from(value, 'utf-8').toString('base64');
}

export function fromBase64(value: string) {
  if (typeof atob === 'function') {
    const binary = atob(value);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  }
  return Buffer.from(value, 'base64').toString('utf-8');
}

export function sentenceCase(value: string) {
  return value
    .toLowerCase()
    .replace(/(^\s*\w|[.!?]\s+\w)/g, (match) => match.toUpperCase());
}

export function titleCase(value: string) {
  return value
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function splitWords(value: string) {
  return value
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean);
}

export function snakeCase(value: string) {
  return splitWords(value).map((word) => word.toLowerCase()).join('_');
}

export function kebabCase(value: string) {
  return splitWords(value).map((word) => word.toLowerCase()).join('-');
}

export function slugify(value: string) {
  return kebabCase(value)
    .normalize('NFKD')
    .replace(/[^\w-]+/g, '')
    .replace(/--+/g, '-');
}

export function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function unescapeHtml(value: string) {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
}

export function formatCountLabel(value: number, singular: string, plural = `${singular}s`) {
  return `${value} ${value === 1 ? singular : plural}`;
}

export function hexToRgb(hex: string) {
  const normalized = hex.replace('#', '').trim();
  const full = normalized.length === 3 ? normalized.split('').map((value) => value + value).join('') : normalized;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) {
    throw new Error('Enter a valid HEX color like #2f7dff.');
  }
  const numeric = Number.parseInt(full, 16);
  return {
    r: (numeric >> 16) & 255,
    g: (numeric >> 8) & 255,
    b: numeric & 255,
  };
}

export function rgbToHex(r: number, g: number, b: number) {
  return `#${[r, g, b].map((value) => value.toString(16).padStart(2, '0')).join('')}`.toUpperCase();
}

export function rgbToHsl(r: number, g: number, b: number) {
  const red = r / 255;
  const green = g / 255;
  const blue = b / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (delta !== 0) {
    s = delta / (1 - Math.abs(2 * l - 1));
    switch (max) {
      case red:
        h = 60 * (((green - blue) / delta) % 6);
        break;
      case green:
        h = 60 * ((blue - red) / delta + 2);
        break;
      default:
        h = 60 * ((red - green) / delta + 4);
        break;
    }
  }

  return {
    h: Math.round((h + 360) % 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

export function hslToRgb(h: number, s: number, l: number) {
  const saturation = s / 100;
  const lightness = l / 100;
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const x = chroma * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = lightness - chroma / 2;

  let red = 0;
  let green = 0;
  let blue = 0;

  if (h < 60) [red, green, blue] = [chroma, x, 0];
  else if (h < 120) [red, green, blue] = [x, chroma, 0];
  else if (h < 180) [red, green, blue] = [0, chroma, x];
  else if (h < 240) [red, green, blue] = [0, x, chroma];
  else if (h < 300) [red, green, blue] = [x, 0, chroma];
  else [red, green, blue] = [chroma, 0, x];

  return {
    r: Math.round((red + m) * 255),
    g: Math.round((green + m) * 255),
    b: Math.round((blue + m) * 255),
  };
}

export function parseRgbInput(value: string) {
  const match = value.match(/(\d{1,3})\D+(\d{1,3})\D+(\d{1,3})/);
  if (!match) {
    throw new Error('Enter RGB like 47, 125, 255.');
  }
  const [r, g, b] = match.slice(1, 4).map((entry) => Number(entry));
  if ([r, g, b].some((entry) => entry < 0 || entry > 255)) {
    throw new Error('RGB values must stay between 0 and 255.');
  }
  return { r, g, b };
}

export function parseHslInput(value: string) {
  const match = value.match(/(-?\d{1,3})\D+(\d{1,3})\D+(\d{1,3})/);
  if (!match) {
    throw new Error('Enter HSL like 218, 100, 59.');
  }
  const [h, s, l] = match.slice(1, 4).map((entry) => Number(entry));
  if (s < 0 || s > 100 || l < 0 || l > 100) {
    throw new Error('HSL saturation and lightness must stay between 0 and 100.');
  }
  return { h: ((h % 360) + 360) % 360, s, l };
}

export function inferColor(value: string) {
  const input = value.trim();
  if (input.startsWith('#') || /^[0-9a-fA-F]{3,6}$/.test(input)) {
    return hexToRgb(input);
  }
  if (/^rgb/i.test(input) || /^\d+\D+\d+\D+\d+$/.test(input)) {
    return parseRgbInput(input);
  }
  if (/^hsl/i.test(input)) {
    const hsl = parseHslInput(input);
    return hslToRgb(hsl.h, hsl.s, hsl.l);
  }
  throw new Error('Use HEX, RGB, or HSL input.');
}

export function decodeJwtParts(input: string) {
  const [header, payload] = input.split('.');
  if (!header || !payload) {
    throw new Error('Enter a valid JWT with header and payload.');
  }

  const decodePart = (value: string) => {
    const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    return JSON.parse(fromBase64(padded));
  };

  return {
    header: decodePart(header),
    payload: decodePart(payload),
  };
}

export function parseQueryString(input: string) {
  const search = input.startsWith('?') ? input.slice(1) : input;
  const params = new URLSearchParams(search);
  return Array.from(params.entries()).map(([key, value]) => ({ key, value }));
}

export function buildQueryString(input: unknown) {
  const params = new URLSearchParams();
  if (Array.isArray(input)) {
    input.forEach((entry) => {
      if (entry && typeof entry === 'object' && 'key' in entry) {
        const record = entry as { key: string; value?: unknown };
        if (typeof record.key === 'string') {
          params.append(record.key, String(record.value ?? ''));
        }
      }
    });
    return params.toString();
  }

  if (input && typeof input === 'object') {
    Object.entries(input).forEach(([key, value]) => {
      params.append(key, String(value ?? ''));
    });
    return params.toString();
  }

  throw new Error('Use an object or an array of key/value entries.');
}

export function processLines(
  input: string,
  options: { trimLines: boolean; removeEmpty: boolean; dedupeLines: boolean; sortLines: boolean },
) {
  let lines = input.split(/\r?\n/);
  if (options.trimLines) {
    lines = lines.map((line) => line.trim());
  }
  if (options.removeEmpty) {
    lines = lines.filter((line) => line.length > 0);
  }
  if (options.dedupeLines) {
    lines = Array.from(new Set(lines));
  }
  if (options.sortLines) {
    lines = [...lines].sort((a, b) => a.localeCompare(b));
  }
  return lines.join('\n');
}

export function formatLocalDate(date: Date) {
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(date);
}
