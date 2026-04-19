import { describe, expect, it } from 'vitest';
import {
  buildQueryString,
  decodeJwtParts,
  escapeHtml,
  fromBase64,
  hexToRgb,
  hslToRgb,
  inferColor,
  kebabCase,
  parseQueryString,
  processLines,
  rgbToHex,
  rgbToHsl,
  sentenceCase,
  slugify,
  snakeCase,
  titleCase,
  toBase64,
  unescapeHtml,
} from './toolbox-utils';

describe('toolbox-utils', () => {
  it('encodes and decodes base64', () => {
    const encoded = toBase64('FileFlux browser-only');
    expect(fromBase64(encoded)).toBe('FileFlux browser-only');
  });

  it('converts text case variants', () => {
    expect(titleCase('fileflux browser only')).toBe('Fileflux Browser Only');
    expect(sentenceCase('hello world. fileflux rocks')).toBe('Hello world. Fileflux rocks');
    expect(snakeCase('FileFlux Browser Only')).toBe('file_flux_browser_only');
    expect(kebabCase('FileFlux Browser Only')).toBe('file-flux-browser-only');
    expect(slugify('Ocean Night Toolkit!')).toBe('ocean-night-toolkit');
  });

  it('escapes and unescapes html safely', () => {
    const raw = `<section class="card">It's safe & local</section>`;
    const escaped = escapeHtml(raw);
    expect(escaped).toContain('&lt;section');
    expect(unescapeHtml(escaped)).toBe(raw);
  });

  it('converts colors between formats', () => {
    expect(hexToRgb('#2F7DFF')).toEqual({ r: 47, g: 125, b: 255 });
    expect(rgbToHex(47, 125, 255)).toBe('#2F7DFF');
    expect(rgbToHsl(47, 125, 255)).toEqual({ h: 218, s: 100, l: 59 });
    expect(hslToRgb(218, 100, 59)).toEqual({ r: 46, g: 123, b: 255 });
    expect(inferColor('rgb(47, 125, 255)')).toEqual({ r: 47, g: 125, b: 255 });
  });

  it('decodes jwt header and payload', () => {
    const jwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJuYW1lIjoiRmlsZUZsdXgiLCJsb2NhbCI6dHJ1ZX0.signature';
    const decoded = decodeJwtParts(jwt);
    expect(decoded.header).toEqual({ alg: 'HS256', typ: 'JWT' });
    expect(decoded.payload).toEqual({ name: 'FileFlux', local: true });
  });

  it('parses and builds query strings', () => {
    expect(parseQueryString('?mode=local&tool=json')).toEqual([
      { key: 'mode', value: 'local' },
      { key: 'tool', value: 'json' },
    ]);
    expect(buildQueryString({ mode: 'local', tool: 'json' })).toBe('mode=local&tool=json');
  });

  it('processes lines with trim, dedupe, and sort', () => {
    const output = processLines(' sky\nwave\nsky\n\nnight ', {
      trimLines: true,
      removeEmpty: true,
      dedupeLines: true,
      sortLines: true,
    });
    expect(output).toBe('night\nsky\nwave');
  });
});
