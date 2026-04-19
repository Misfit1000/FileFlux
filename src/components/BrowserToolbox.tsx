import React, { useEffect, useMemo, useState } from 'react';
import { marked } from 'marked';
import {
  Braces,
  Link2,
  Binary,
  BadgeInfo,
  Hash,
  FileCode2,
  Search,
  TextCursorInput,
  Type,
  Fingerprint,
  KeyRound,
  Palette,
  Clock3,
  Copy,
  Check,
  ShieldCheck,
  ListFilter,
  FileJson2,
  Diff,
} from 'lucide-react';
import * as toolbox from '../lib/toolbox-utils';

type ToolCategory = 'Text' | 'Developer' | 'Converter' | 'Generator' | 'Web' | 'Design';
type ToolId =
  | 'json-formatter'
  | 'base64'
  | 'url-codec'
  | 'markdown-preview'
  | 'regex-tester'
  | 'hash-generator'
  | 'word-counter'
  | 'case-converter'
  | 'lorem-ipsum'
  | 'uuid-generator'
  | 'password-generator'
  | 'color-converter'
  | 'timestamp-converter'
  | 'jwt-decoder'
  | 'query-parser'
  | 'html-escape'
  | 'line-tools';

type ToolMeta = {
  id: ToolId;
  title: string;
  category: ToolCategory;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
};

const TOOL_CATEGORIES: Array<ToolCategory | 'All'> = ['All', 'Text', 'Developer', 'Converter', 'Generator', 'Web', 'Design'];

const TOOLS: ToolMeta[] = [
  { id: 'json-formatter', title: 'JSON Formatter', category: 'Developer', description: 'Format, validate, and compact JSON instantly in your browser.', icon: Braces },
  { id: 'base64', title: 'Base64 Encoder/Decoder', category: 'Converter', description: 'Encode plain text into Base64 or decode Base64 back to text.', icon: Binary },
  { id: 'url-codec', title: 'URL Encoder/Decoder', category: 'Web', description: 'Safely encode and decode URL strings or query pieces.', icon: Link2 },
  { id: 'markdown-preview', title: 'Markdown Preview', category: 'Developer', description: 'Write Markdown and see a rendered preview side by side.', icon: FileCode2 },
  { id: 'regex-tester', title: 'Regex Tester', category: 'Developer', description: 'Test patterns, flags, and matches against live text.', icon: Search },
  { id: 'hash-generator', title: 'Hash Generator', category: 'Developer', description: 'Generate SHA hashes locally from any input text.', icon: Hash },
  { id: 'word-counter', title: 'Word Counter', category: 'Text', description: 'Count words, characters, lines, and reading time.', icon: TextCursorInput },
  { id: 'case-converter', title: 'Case Converter', category: 'Text', description: 'Switch between upper, lower, title, snake, and kebab case.', icon: Type },
  { id: 'lorem-ipsum', title: 'Lorem Ipsum Generator', category: 'Generator', description: 'Generate filler paragraphs for mockups and layouts.', icon: BadgeInfo },
  { id: 'uuid-generator', title: 'UUID Generator', category: 'Generator', description: 'Create random UUIDs in batches using browser crypto.', icon: Fingerprint },
  { id: 'password-generator', title: 'Password Generator', category: 'Generator', description: 'Create strong passwords without sending data anywhere.', icon: KeyRound },
  { id: 'color-converter', title: 'Color Converter', category: 'Design', description: 'Convert between HEX, RGB, and HSL with a live swatch.', icon: Palette },
  { id: 'timestamp-converter', title: 'Timestamp Converter', category: 'Converter', description: 'Convert Unix timestamps into readable local dates and back.', icon: Clock3 },
  { id: 'jwt-decoder', title: 'JWT Decoder', category: 'Developer', description: 'Decode JWT header and payload locally without any verification call.', icon: ShieldCheck },
  { id: 'query-parser', title: 'Query String Parser', category: 'Web', description: 'Parse query strings into readable key/value pairs or rebuild them from JSON.', icon: FileJson2 },
  { id: 'html-escape', title: 'HTML Escape/Unescape', category: 'Web', description: 'Escape raw HTML for code samples or turn entities back into readable text.', icon: Diff },
  { id: 'line-tools', title: 'Line Tools', category: 'Text', description: 'Sort, trim, dedupe, and clean multiline text in one browser-only panel.', icon: ListFilter },
];

function classNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(' ');
}

function toBase64(value: string) {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

function fromBase64(value: string) {
  const binary = atob(value);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function sentenceCase(value: string) {
  return value
    .toLowerCase()
    .replace(/(^\s*\w|[.!?]\s+\w)/g, (match) => match.toUpperCase());
}

function titleCase(value: string) {
  return value
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function splitWords(value: string) {
  return value
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean);
}

function snakeCase(value: string) {
  return splitWords(value).map((word) => word.toLowerCase()).join('_');
}

function kebabCase(value: string) {
  return splitWords(value).map((word) => word.toLowerCase()).join('-');
}

function slugify(value: string) {
  return kebabCase(value)
    .normalize('NFKD')
    .replace(/[^\w-]+/g, '')
    .replace(/--+/g, '-');
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function sanitizeHtml(html: string) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  doc.querySelectorAll('script, iframe, object, embed').forEach((node) => node.remove());
  doc.querySelectorAll('*').forEach((node) => {
    [...node.attributes].forEach((attribute) => {
      if (/^on/i.test(attribute.name)) {
        node.removeAttribute(attribute.name);
      }
    });
  });
  return doc.body.innerHTML;
}

function unescapeHtml(value: string) {
  const textarea = document.createElement('textarea');
  textarea.innerHTML = value;
  return textarea.value;
}

function formatCountLabel(value: number, singular: string, plural = `${singular}s`) {
  return `${value} ${value === 1 ? singular : plural}`;
}

function hexToRgb(hex: string) {
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

function rgbToHex(r: number, g: number, b: number) {
  return `#${[r, g, b].map((value) => value.toString(16).padStart(2, '0')).join('')}`.toUpperCase();
}

function rgbToHsl(r: number, g: number, b: number) {
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

function hslToRgb(h: number, s: number, l: number) {
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

function parseRgbInput(value: string) {
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

function parseHslInput(value: string) {
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

function inferColor(value: string) {
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

function formatLocalDate(date: Date) {
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(date);
}

function ToolShell({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="anime-panel rounded-[2rem] p-5 sm:p-6">
      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h4 className="font-display text-2xl font-bold text-white">{title}</h4>
          <p className="mt-2 max-w-2xl text-sm leading-7 text-[var(--text-muted)]">{description}</p>
        </div>
        {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
      </div>
      {children}
    </div>
  );
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <button type="button" onClick={handleCopy} className="anime-cta-secondary" disabled={!value}>
      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

function JsonFormatterTool() {
  const [input, setInput] = useState('{\n  "name": "FileFlux",\n  "browserOnly": true,\n  "tools": ["converter", "formatter"]\n}');
  const [indent, setIndent] = useState(2);
  const [compact, setCompact] = useState(false);

  const result = useMemo(() => {
    try {
      const parsed = JSON.parse(input);
      return {
        output: compact ? JSON.stringify(parsed) : JSON.stringify(parsed, null, indent),
        error: '',
      };
    } catch (error) {
      return {
        output: '',
        error: error instanceof Error ? error.message : 'Invalid JSON input.',
      };
    }
  }, [compact, indent, input]);

  return (
    <ToolShell title="JSON Formatter" description="Beautify, validate, or compact JSON with instant feedback." actions={<CopyButton value={result.output} />}>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <textarea value={input} onChange={(event) => setInput(event.target.value)} className="min-h-[280px] rounded-[1.4rem] border border-white/10 bg-slate-950/70 p-4 text-sm text-slate-100 outline-none" />
        <div className="rounded-[1.4rem] border border-white/10 bg-slate-950/70 p-4">
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <label className="text-sm text-[var(--text-muted)]">
              Indent
              <select value={indent} onChange={(event) => setIndent(Number(event.target.value))} className="ml-3 rounded-full border border-white/10 bg-black/20 px-3 py-1 text-white outline-none">
                {[2, 4, 6].map((value) => (
                  <option key={value} value={value}>{value}</option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
              <input type="checkbox" checked={compact} onChange={(event) => setCompact(event.target.checked)} />
              Compact output
            </label>
          </div>
          {result.error ? (
            <div className="rounded-[1rem] border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{result.error}</div>
          ) : (
            <pre className="overflow-auto whitespace-pre-wrap break-words text-sm leading-7 text-cyan-50">{result.output}</pre>
          )}
        </div>
      </div>
    </ToolShell>
  );
}

function Base64Tool() {
  const [mode, setMode] = useState<'encode' | 'decode'>('encode');
  const [input, setInput] = useState('FileFlux keeps this in your browser.');

  const result = useMemo(() => {
    try {
      return mode === 'encode' ? toolbox.toBase64(input) : toolbox.fromBase64(input);
    } catch (error) {
      return error instanceof Error ? error.message : 'Base64 conversion failed.';
    }
  }, [input, mode]);

  return (
    <ToolShell title="Base64 Encoder/Decoder" description="Convert plain text to Base64 or decode Base64 back into readable text." actions={<CopyButton value={result} />}>
      <div className="mb-4 flex gap-3">
        <button type="button" onClick={() => setMode('encode')} className={classNames('anime-cta-secondary', mode === 'encode' && 'border-cyan-300/45 bg-cyan-300/14 text-white')}>Encode</button>
        <button type="button" onClick={() => setMode('decode')} className={classNames('anime-cta-secondary', mode === 'decode' && 'border-cyan-300/45 bg-cyan-300/14 text-white')}>Decode</button>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <textarea value={input} onChange={(event) => setInput(event.target.value)} className="min-h-[220px] rounded-[1.4rem] border border-white/10 bg-slate-950/70 p-4 text-sm text-slate-100 outline-none" />
        <pre className="min-h-[220px] overflow-auto whitespace-pre-wrap break-words rounded-[1.4rem] border border-white/10 bg-slate-950/70 p-4 text-sm leading-7 text-cyan-50">{result}</pre>
      </div>
    </ToolShell>
  );
}

function UrlCodecTool() {
  const [mode, setMode] = useState<'encode' | 'decode'>('encode');
  const [input, setInput] = useState('https://fileflux.app/tools?name=Ocean Night&mode=local');
  const result = useMemo(() => {
    try {
      return mode === 'encode' ? encodeURIComponent(input) : decodeURIComponent(input);
    } catch (error) {
      return error instanceof Error ? error.message : 'URL conversion failed.';
    }
  }, [input, mode]);

  return (
    <ToolShell title="URL Encoder/Decoder" description="Encode or decode URL-safe text in place." actions={<CopyButton value={result} />}>
      <div className="mb-4 flex gap-3">
        <button type="button" onClick={() => setMode('encode')} className={classNames('anime-cta-secondary', mode === 'encode' && 'border-cyan-300/45 bg-cyan-300/14 text-white')}>Encode</button>
        <button type="button" onClick={() => setMode('decode')} className={classNames('anime-cta-secondary', mode === 'decode' && 'border-cyan-300/45 bg-cyan-300/14 text-white')}>Decode</button>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <textarea value={input} onChange={(event) => setInput(event.target.value)} className="min-h-[220px] rounded-[1.4rem] border border-white/10 bg-slate-950/70 p-4 text-sm text-slate-100 outline-none" />
        <pre className="min-h-[220px] overflow-auto whitespace-pre-wrap break-words rounded-[1.4rem] border border-white/10 bg-slate-950/70 p-4 text-sm leading-7 text-cyan-50">{result}</pre>
      </div>
    </ToolShell>
  );
}

function MarkdownPreviewTool() {
  const [markdown, setMarkdown] = useState('# FileFlux\n\n- Browser-only tools\n- Converter flows\n- Markdown preview');
  const html = useMemo(() => sanitizeHtml(marked.parse(markdown) as string), [markdown]);

  return (
    <ToolShell title="Markdown Preview" description="Type Markdown on the left and preview the rendered result on the right.">
      <div className="grid gap-4 xl:grid-cols-2">
        <textarea value={markdown} onChange={(event) => setMarkdown(event.target.value)} className="min-h-[260px] rounded-[1.4rem] border border-white/10 bg-slate-950/70 p-4 text-sm text-slate-100 outline-none" />
        <div className="prose prose-invert max-w-none rounded-[1.4rem] border border-white/10 bg-white/5 p-5" dangerouslySetInnerHTML={{ __html: html }} />
      </div>
    </ToolShell>
  );
}

function RegexTesterTool() {
  const [pattern, setPattern] = useState('\\bfile\\w*');
  const [flags, setFlags] = useState('gi');
  const [text, setText] = useState('FileFlux is a file conversion studio. Every file stays local.');
  const analysis = useMemo(() => {
    try {
      const normalizedFlags = flags.includes('g') ? flags : `${flags}g`;
      const regex = new RegExp(pattern, normalizedFlags);
      const matches = [...text.matchAll(regex)];
      return {
        error: '',
        matches: matches.map((match) => ({
          value: match[0],
          index: match.index ?? 0,
          groups: match.slice(1).filter(Boolean),
        })),
      };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Invalid regex pattern.',
        matches: [],
      };
    }
  }, [flags, pattern, text]);

  return (
    <ToolShell title="Regex Tester" description="Try a regular expression with flags and inspect every match in real time.">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_160px]">
        <input value={pattern} onChange={(event) => setPattern(event.target.value)} className="rounded-[1rem] border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none" />
        <input value={flags} onChange={(event) => setFlags(event.target.value)} className="rounded-[1rem] border border-white/10 bg-slate-950/70 px-4 py-3 text-sm uppercase text-slate-100 outline-none" />
      </div>
      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <textarea value={text} onChange={(event) => setText(event.target.value)} className="min-h-[240px] rounded-[1.4rem] border border-white/10 bg-slate-950/70 p-4 text-sm text-slate-100 outline-none" />
        <div className="rounded-[1.4rem] border border-white/10 bg-white/5 p-4">
          {analysis.error ? (
            <div className="rounded-[1rem] border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{analysis.error}</div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-[var(--text-muted)]">{toolbox.formatCountLabel(analysis.matches.length, 'match')}</p>
              {analysis.matches.map((match, index) => (
                <div key={`${match.value}-${index}`} className="rounded-[1rem] border border-white/10 bg-black/20 px-4 py-3 text-sm text-cyan-50">
                  <div className="font-semibold text-white">{match.value}</div>
                  <div className="mt-1 text-[var(--text-muted)]">Index: {match.index}</div>
                  {match.groups.length > 0 ? <div className="mt-1 text-[var(--text-muted)]">Groups: {match.groups.join(', ')}</div> : null}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </ToolShell>
  );
}

function HashGeneratorTool() {
  const [input, setInput] = useState('FileFlux');
  const [algorithm, setAlgorithm] = useState<'SHA-1' | 'SHA-256' | 'SHA-384' | 'SHA-512'>('SHA-256');
  const [hashValue, setHashValue] = useState('');

  useEffect(() => {
    let active = true;
    const run = async () => {
      const digest = await crypto.subtle.digest(algorithm, new TextEncoder().encode(input));
      const value = Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
      if (active) {
        setHashValue(value);
      }
    };
    void run();
    return () => {
      active = false;
    };
  }, [algorithm, input]);

  return (
    <ToolShell title="Hash Generator" description="Generate secure SHA hashes without leaving the browser." actions={<CopyButton value={hashValue} />}>
      <div className="mb-4 flex flex-wrap gap-3">
        {(['SHA-1', 'SHA-256', 'SHA-384', 'SHA-512'] as const).map((option) => (
          <button key={option} type="button" onClick={() => setAlgorithm(option)} className={classNames('anime-cta-secondary', algorithm === option && 'border-cyan-300/45 bg-cyan-300/14 text-white')}>
            {option}
          </button>
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <textarea value={input} onChange={(event) => setInput(event.target.value)} className="min-h-[220px] rounded-[1.4rem] border border-white/10 bg-slate-950/70 p-4 text-sm text-slate-100 outline-none" />
        <pre className="min-h-[220px] overflow-auto whitespace-pre-wrap break-all rounded-[1.4rem] border border-white/10 bg-slate-950/70 p-4 text-sm leading-7 text-cyan-50">{hashValue}</pre>
      </div>
    </ToolShell>
  );
}

function WordCounterTool() {
  const [text, setText] = useState('Count words, lines, and reading time without leaving the page.');
  const stats = useMemo(() => {
    const trimmed = text.trim();
    const words = trimmed ? trimmed.split(/\s+/).length : 0;
    const characters = text.length;
    const charactersNoSpaces = text.replace(/\s/g, '').length;
    const lines = text ? text.split(/\n/).length : 0;
    const sentences = trimmed ? trimmed.split(/[.!?]+/).filter(Boolean).length : 0;
    const readingMinutes = words / 200;
    return { words, characters, charactersNoSpaces, lines, sentences, readingMinutes };
  }, [text]);

  return (
    <ToolShell title="Word Counter" description="See quick writing stats and estimated reading time.">
      <textarea value={text} onChange={(event) => setText(event.target.value)} className="min-h-[220px] w-full rounded-[1.4rem] border border-white/10 bg-slate-950/70 p-4 text-sm text-slate-100 outline-none" />
      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {[
          ['Words', stats.words],
          ['Characters', stats.characters],
          ['No spaces', stats.charactersNoSpaces],
          ['Lines', stats.lines],
          ['Sentences', stats.sentences],
          ['Read time', `${Math.max(1, Math.ceil(stats.readingMinutes))} min`],
        ].map(([label, value]) => (
          <div key={label} className="anime-focus-card">
            <span className="anime-focus-label">{label}</span>
            <strong className="anime-focus-value">{value}</strong>
          </div>
        ))}
      </div>
    </ToolShell>
  );
}

function CaseConverterTool() {
  const [input, setInput] = useState('FileFlux browser only toolkit');
  const transforms = useMemo(() => {
    return [
      ['Uppercase', input.toUpperCase()],
      ['Lowercase', input.toLowerCase()],
      ['Title Case', toolbox.titleCase(input)],
      ['Sentence case', toolbox.sentenceCase(input)],
      ['snake_case', toolbox.snakeCase(input)],
      ['kebab-case', toolbox.kebabCase(input)],
      ['Slug', toolbox.slugify(input)],
    ] as const;
  }, [input]);

  return (
    <ToolShell title="Case Converter" description="Transform the same text into the most common writing and code styles.">
      <textarea value={input} onChange={(event) => setInput(event.target.value)} className="min-h-[180px] w-full rounded-[1.4rem] border border-white/10 bg-slate-950/70 p-4 text-sm text-slate-100 outline-none" />
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {transforms.map(([label, value]) => (
          <div key={label} className="rounded-[1.2rem] border border-white/10 bg-white/5 p-4">
            <div className="mb-2 flex items-center justify-between gap-3">
              <div className="font-display text-lg font-bold text-white">{label}</div>
              <CopyButton value={value} />
            </div>
            <pre className="overflow-auto whitespace-pre-wrap break-words text-sm leading-7 text-cyan-50">{value}</pre>
          </div>
        ))}
      </div>
    </ToolShell>
  );
}

function LoremIpsumTool() {
  const [paragraphCount, setParagraphCount] = useState(3);
  const paragraph = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed non massa vel dui volutpat luctus. Integer viverra magna id nibh sodales, a tempus leo pharetra.';
  const output = useMemo(() => Array.from({ length: paragraphCount }, () => paragraph).join('\n\n'), [paragraphCount]);

  return (
    <ToolShell title="Lorem Ipsum Generator" description="Generate placeholder paragraphs locally for layouts, cards, and mockups." actions={<CopyButton value={output} />}>
      <div className="mb-4 flex items-center gap-4">
        <span className="text-sm text-[var(--text-muted)]">Paragraphs</span>
        <input type="range" min={1} max={10} value={paragraphCount} onChange={(event) => setParagraphCount(Number(event.target.value))} className="w-full max-w-xs" />
        <span className="font-display text-xl text-white">{paragraphCount}</span>
      </div>
      <pre className="min-h-[240px] whitespace-pre-wrap rounded-[1.4rem] border border-white/10 bg-slate-950/70 p-4 text-sm leading-8 text-cyan-50">{output}</pre>
    </ToolShell>
  );
}

function UuidGeneratorTool() {
  const [count, setCount] = useState(6);
  const uuids = useMemo(() => Array.from({ length: count }, () => crypto.randomUUID()).join('\n'), [count]);

  return (
    <ToolShell title="UUID Generator" description="Create browser-generated UUIDs in batches." actions={<CopyButton value={uuids} />}>
      <div className="mb-4 flex items-center gap-4">
        <span className="text-sm text-[var(--text-muted)]">Count</span>
        <input type="range" min={1} max={20} value={count} onChange={(event) => setCount(Number(event.target.value))} className="w-full max-w-xs" />
        <span className="font-display text-xl text-white">{count}</span>
      </div>
      <pre className="min-h-[220px] whitespace-pre-wrap rounded-[1.4rem] border border-white/10 bg-slate-950/70 p-4 text-sm leading-7 text-cyan-50">{uuids}</pre>
    </ToolShell>
  );
}

function PasswordGeneratorTool() {
  const [length, setLength] = useState(20);
  const [includeSymbols, setIncludeSymbols] = useState(true);
  const [includeNumbers, setIncludeNumbers] = useState(true);
  const [includeUppercase, setIncludeUppercase] = useState(true);
  const [password, setPassword] = useState('');

  useEffect(() => {
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const numbers = '0123456789';
    const symbols = '!@#$%^&*()_+-={}[]<>?';
    let pool = lowercase;
    if (includeUppercase) pool += uppercase;
    if (includeNumbers) pool += numbers;
    if (includeSymbols) pool += symbols;

    const array = new Uint32Array(length);
    crypto.getRandomValues(array);
    setPassword(Array.from(array, (value) => pool[value % pool.length]).join(''));
  }, [includeNumbers, includeSymbols, includeUppercase, length]);

  const toggleOptions: Array<{
    label: string;
    value: boolean;
    setValue: React.Dispatch<React.SetStateAction<boolean>>;
  }> = [
    { label: 'Uppercase', value: includeUppercase, setValue: setIncludeUppercase },
    { label: 'Numbers', value: includeNumbers, setValue: setIncludeNumbers },
    { label: 'Symbols', value: includeSymbols, setValue: setIncludeSymbols },
  ];

  return (
    <ToolShell title="Password Generator" description="Create strong random passwords locally using browser crypto." actions={<CopyButton value={password} />}>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <label className="anime-focus-card">
          <span className="anime-focus-label">Length</span>
          <input type="range" min={8} max={64} value={length} onChange={(event) => setLength(Number(event.target.value))} className="mt-3 w-full" />
          <strong className="mt-3 block font-display text-2xl text-white">{length}</strong>
        </label>
        {toggleOptions.map(({ label, value, setValue }) => (
          <label key={label} className="anime-focus-card flex items-center gap-3">
            <input type="checkbox" checked={value} onChange={(event) => setValue(event.target.checked)} />
            <div>
              <span className="anime-focus-label">{label}</span>
              <strong className="anime-focus-value">{value ? 'On' : 'Off'}</strong>
            </div>
          </label>
        ))}
      </div>
      <pre className="mt-4 overflow-auto whitespace-pre-wrap break-all rounded-[1.4rem] border border-white/10 bg-slate-950/70 p-4 text-base leading-7 text-cyan-50">{password}</pre>
    </ToolShell>
  );
}

function ColorConverterTool() {
  const [input, setInput] = useState('#2F7DFF');
  const analysis = useMemo(() => {
    try {
      const rgb = toolbox.inferColor(input);
      const hsl = toolbox.rgbToHsl(rgb.r, rgb.g, rgb.b);
      const hex = toolbox.rgbToHex(rgb.r, rgb.g, rgb.b);
      return {
        error: '',
        hex,
        rgb: `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`,
        hsl: `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`,
      };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Color parsing failed.',
        hex: '#000000',
        rgb: '',
        hsl: '',
      };
    }
  }, [input]);

  return (
    <ToolShell title="Color Converter" description="Paste a HEX, RGB, or HSL color and convert it instantly.">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
        <div>
          <input value={input} onChange={(event) => setInput(event.target.value)} className="w-full rounded-[1rem] border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none" />
          {analysis.error ? (
            <div className="mt-4 rounded-[1rem] border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{analysis.error}</div>
          ) : (
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              {[analysis.hex, analysis.rgb, analysis.hsl].map((value) => (
                <div key={value} className="rounded-[1.2rem] border border-white/10 bg-white/5 p-4">
                  <div className="mb-2 text-xs uppercase tracking-[0.2em] text-[var(--text-soft)]">Value</div>
                  <div className="font-mono text-sm text-cyan-50">{value}</div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="rounded-[1.6rem] border border-white/10 bg-white/5 p-4">
          <div className="h-48 rounded-[1.2rem] border border-white/10" style={{ background: analysis.hex }} />
          <div className="mt-4 text-sm text-[var(--text-muted)]">Live swatch preview</div>
        </div>
      </div>
    </ToolShell>
  );
}

function TimestampConverterTool() {
  const [timestampInput, setTimestampInput] = useState(`${Math.floor(Date.now() / 1000)}`);
  const [dateInput, setDateInput] = useState(new Date().toISOString().slice(0, 16));

  const timestampResult = useMemo(() => {
    const raw = Number(timestampInput);
    if (!Number.isFinite(raw)) {
      return 'Enter a valid Unix timestamp.';
    }
    const normalized = timestampInput.trim().length > 10 ? raw : raw * 1000;
    return toolbox.formatLocalDate(new Date(normalized));
  }, [timestampInput]);

  const dateResult = useMemo(() => {
    if (!dateInput) return '';
    const date = new Date(dateInput);
    if (Number.isNaN(date.getTime())) return 'Invalid date.';
    return `${Math.floor(date.getTime() / 1000)}`;
  }, [dateInput]);

  return (
    <ToolShell title="Timestamp Converter" description="Convert between Unix timestamps and local date-time values." actions={<CopyButton value={dateResult} />}>
      <div className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-[1.4rem] border border-white/10 bg-white/5 p-4">
          <div className="mb-3 text-sm font-semibold text-white">Timestamp to date</div>
          <input value={timestampInput} onChange={(event) => setTimestampInput(event.target.value)} className="w-full rounded-[1rem] border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none" />
          <div className="mt-4 text-sm text-cyan-50">{timestampResult}</div>
        </div>
        <div className="rounded-[1.4rem] border border-white/10 bg-white/5 p-4">
          <div className="mb-3 text-sm font-semibold text-white">Date to timestamp</div>
          <input type="datetime-local" value={dateInput} onChange={(event) => setDateInput(event.target.value)} className="w-full rounded-[1rem] border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none" />
          <div className="mt-4 text-sm text-cyan-50">{dateResult}</div>
        </div>
      </div>
    </ToolShell>
  );
}

function JwtDecoderTool() {
  const [input, setInput] = useState('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJuYW1lIjoiRmlsZUZsdXgiLCJtb2RlIjoiYnJvd3Nlci1vbmx5In0.signature');

  const decoded = useMemo(() => {
    try {
      const parts = toolbox.decodeJwtParts(input);
      return {
        error: '',
        header: JSON.stringify(parts.header, null, 2),
        payload: JSON.stringify(parts.payload, null, 2),
      };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'JWT decoding failed.',
        header: '',
        payload: '',
      };
    }
  }, [input]);

  return (
    <ToolShell title="JWT Decoder" description="Decode the readable JWT parts locally. This tool does not verify the signature.">
      <textarea value={input} onChange={(event) => setInput(event.target.value)} className="min-h-[160px] w-full rounded-[1.4rem] border border-white/10 bg-slate-950/70 p-4 text-sm text-slate-100 outline-none" />
      {decoded.error ? (
        <div className="mt-4 rounded-[1rem] border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{decoded.error}</div>
      ) : (
        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          <div className="rounded-[1.4rem] border border-white/10 bg-slate-950/70 p-4">
            <div className="mb-2 font-display text-lg font-bold text-white">Header</div>
            <pre className="overflow-auto whitespace-pre-wrap break-words text-sm leading-7 text-cyan-50">{decoded.header}</pre>
          </div>
          <div className="rounded-[1.4rem] border border-white/10 bg-slate-950/70 p-4">
            <div className="mb-2 font-display text-lg font-bold text-white">Payload</div>
            <pre className="overflow-auto whitespace-pre-wrap break-words text-sm leading-7 text-cyan-50">{decoded.payload}</pre>
          </div>
        </div>
      )}
    </ToolShell>
  );
}

function QueryParserTool() {
  const [mode, setMode] = useState<'parse' | 'build'>('parse');
  const [input, setInput] = useState('mode=browser-only&tool=json-formatter&safe=true');

  const result = useMemo(() => {
    try {
      if (mode === 'parse') {
        return JSON.stringify(toolbox.parseQueryString(input), null, 2);
      }
      return toolbox.buildQueryString(JSON.parse(input));
    } catch (error) {
      return error instanceof Error ? error.message : 'Query processing failed.';
    }
  }, [input, mode]);

  return (
    <ToolShell title="Query String Parser" description="Parse a query string into readable data or rebuild a query string from JSON." actions={<CopyButton value={result} />}>
      <div className="mb-4 flex gap-3">
        <button type="button" onClick={() => setMode('parse')} className={classNames('anime-cta-secondary', mode === 'parse' && 'border-cyan-300/45 bg-cyan-300/14 text-white')}>Parse</button>
        <button type="button" onClick={() => setMode('build')} className={classNames('anime-cta-secondary', mode === 'build' && 'border-cyan-300/45 bg-cyan-300/14 text-white')}>Build</button>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <textarea value={input} onChange={(event) => setInput(event.target.value)} className="min-h-[220px] rounded-[1.4rem] border border-white/10 bg-slate-950/70 p-4 text-sm text-slate-100 outline-none" />
        <pre className="min-h-[220px] overflow-auto whitespace-pre-wrap break-words rounded-[1.4rem] border border-white/10 bg-slate-950/70 p-4 text-sm leading-7 text-cyan-50">{result}</pre>
      </div>
    </ToolShell>
  );
}

function HtmlEscapeTool() {
  const [mode, setMode] = useState<'escape' | 'unescape'>('escape');
  const [input, setInput] = useState('<section class="card">FileFlux</section>');
  const output = useMemo(() => (mode === 'escape' ? toolbox.escapeHtml(input) : toolbox.unescapeHtml(input)), [input, mode]);

  return (
    <ToolShell title="HTML Escape/Unescape" description="Escape markup for code examples or convert entities back into readable text." actions={<CopyButton value={output} />}>
      <div className="mb-4 flex gap-3">
        <button type="button" onClick={() => setMode('escape')} className={classNames('anime-cta-secondary', mode === 'escape' && 'border-cyan-300/45 bg-cyan-300/14 text-white')}>Escape</button>
        <button type="button" onClick={() => setMode('unescape')} className={classNames('anime-cta-secondary', mode === 'unescape' && 'border-cyan-300/45 bg-cyan-300/14 text-white')}>Unescape</button>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <textarea value={input} onChange={(event) => setInput(event.target.value)} className="min-h-[220px] rounded-[1.4rem] border border-white/10 bg-slate-950/70 p-4 text-sm text-slate-100 outline-none" />
        <pre className="min-h-[220px] overflow-auto whitespace-pre-wrap break-words rounded-[1.4rem] border border-white/10 bg-slate-950/70 p-4 text-sm leading-7 text-cyan-50">{output}</pre>
      </div>
    </ToolShell>
  );
}

function LineToolsTool() {
  const [input, setInput] = useState('sky\nwave\nsky\n aurora \nnight');
  const [sortLines, setSortLines] = useState(true);
  const [dedupeLines, setDedupeLines] = useState(true);
  const [trimLines, setTrimLines] = useState(true);
  const [removeEmpty, setRemoveEmpty] = useState(true);

  const output = useMemo(() => {
    return toolbox.processLines(input, { trimLines, removeEmpty, dedupeLines, sortLines });
  }, [dedupeLines, input, removeEmpty, sortLines, trimLines]);

  const lineOptions: Array<{
    label: string;
    value: boolean;
    setValue: React.Dispatch<React.SetStateAction<boolean>>;
  }> = [
    { label: 'Trim lines', value: trimLines, setValue: setTrimLines },
    { label: 'Remove empty', value: removeEmpty, setValue: setRemoveEmpty },
    { label: 'Deduplicate', value: dedupeLines, setValue: setDedupeLines },
    { label: 'Sort lines', value: sortLines, setValue: setSortLines },
  ];

  return (
    <ToolShell title="Line Tools" description="Clean multiline text by trimming, deduping, sorting, and removing empty rows." actions={<CopyButton value={output} />}>
      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {lineOptions.map(({ label, value, setValue }) => (
          <label key={label} className="anime-focus-card flex items-center gap-3">
            <input type="checkbox" checked={value} onChange={(event) => setValue(event.target.checked)} />
            <span className="text-sm text-white">{label}</span>
          </label>
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <textarea value={input} onChange={(event) => setInput(event.target.value)} className="min-h-[220px] rounded-[1.4rem] border border-white/10 bg-slate-950/70 p-4 text-sm text-slate-100 outline-none" />
        <pre className="min-h-[220px] overflow-auto whitespace-pre-wrap break-words rounded-[1.4rem] border border-white/10 bg-slate-950/70 p-4 text-sm leading-7 text-cyan-50">{output}</pre>
      </div>
    </ToolShell>
  );
}

function renderTool(toolId: ToolId) {
  switch (toolId) {
    case 'json-formatter':
      return <JsonFormatterTool />;
    case 'base64':
      return <Base64Tool />;
    case 'url-codec':
      return <UrlCodecTool />;
    case 'markdown-preview':
      return <MarkdownPreviewTool />;
    case 'regex-tester':
      return <RegexTesterTool />;
    case 'hash-generator':
      return <HashGeneratorTool />;
    case 'word-counter':
      return <WordCounterTool />;
    case 'case-converter':
      return <CaseConverterTool />;
    case 'lorem-ipsum':
      return <LoremIpsumTool />;
    case 'uuid-generator':
      return <UuidGeneratorTool />;
    case 'password-generator':
      return <PasswordGeneratorTool />;
    case 'color-converter':
      return <ColorConverterTool />;
    case 'timestamp-converter':
      return <TimestampConverterTool />;
    case 'jwt-decoder':
      return <JwtDecoderTool />;
    case 'query-parser':
      return <QueryParserTool />;
    case 'html-escape':
      return <HtmlEscapeTool />;
    case 'line-tools':
      return <LineToolsTool />;
    default:
      return null;
  }
}

export function BrowserToolbox() {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<ToolCategory | 'All'>('All');
  const [activeToolId, setActiveToolId] = useState<ToolId>('json-formatter');

  const visibleTools = useMemo(() => {
    return TOOLS.filter((tool) => {
      const matchesCategory = activeCategory === 'All' || tool.category === activeCategory;
      const matchesSearch =
        tool.title.toLowerCase().includes(search.toLowerCase()) ||
        tool.description.toLowerCase().includes(search.toLowerCase()) ||
        tool.category.toLowerCase().includes(search.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [activeCategory, search]);

  useEffect(() => {
    if (!visibleTools.some((tool) => tool.id === activeToolId)) {
      setActiveToolId(visibleTools[0]?.id ?? 'json-formatter');
    }
  }, [activeToolId, visibleTools]);

  const activeTool = TOOLS.find((tool) => tool.id === activeToolId) ?? TOOLS[0];

  return (
    <section className="grid gap-8 xl:grid-cols-[340px_minmax(0,1fr)]">
      <div className="anime-panel rounded-[2.2rem] p-5 sm:p-6">
        <p className="text-[0.72rem] font-bold uppercase tracking-[0.35em] text-[var(--text-soft)]">Browser toolbox</p>
        <h3 className="mt-3 font-display text-3xl font-extrabold text-white">All-in-one local utilities.</h3>
        <p className="mt-3 text-sm leading-7 text-[var(--text-muted)]">
          Every tool here runs in the browser. No uploads, no remote processing path, and no context switching to another app.
        </p>

        <div className="mt-5 rounded-[1.2rem] border border-white/10 bg-slate-950/60 px-4 py-3">
          <div className="flex items-center gap-3">
            <Search className="h-4 w-4 text-[var(--text-soft)]" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search tools..."
              className="w-full bg-transparent text-sm text-white outline-none"
            />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {TOOL_CATEGORIES.map((category) => (
            <button
              key={category}
              type="button"
              onClick={() => setActiveCategory(category)}
              className={classNames('anime-cta-secondary !px-4 !py-2 !text-xs', activeCategory === category && 'border-cyan-300/45 bg-cyan-300/14 text-white')}
            >
              {category}
            </button>
          ))}
        </div>

        <div className="mt-5 space-y-3">
          {visibleTools.map((tool) => (
            <button
              key={tool.id}
              type="button"
              onClick={() => setActiveToolId(tool.id)}
              className={classNames(
                'w-full rounded-[1.3rem] border border-white/10 bg-white/5 p-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/8',
                activeToolId === tool.id && 'border-cyan-300/35 bg-cyan-300/10',
              )}
            >
              <div className="flex items-start gap-4">
                <div className="anime-mini-icon">
                  <tool.icon className="h-5 w-5 text-cyan-100" />
                </div>
                <div className="min-w-0">
                  <div className="font-display text-lg font-bold text-white">{tool.title}</div>
                  <div className="mt-1 text-sm leading-6 text-[var(--text-muted)]">{tool.description}</div>
                </div>
              </div>
            </button>
          ))}
          {visibleTools.length === 0 ? (
            <div className="rounded-[1.3rem] border border-white/10 bg-white/5 p-4 text-sm text-[var(--text-muted)]">No tools match that search yet.</div>
          ) : null}
        </div>
      </div>

      <div className="space-y-5">
        <div className="anime-panel rounded-[2.2rem] p-5 sm:p-6">
          <div className="flex items-center gap-4">
            <div className="anime-mini-icon">
              <activeTool.icon className="h-5 w-5 text-cyan-100" />
            </div>
            <div>
              <p className="text-[0.7rem] font-bold uppercase tracking-[0.3em] text-[var(--text-soft)]">{activeTool.category}</p>
              <h3 className="font-display text-2xl font-bold text-white">{activeTool.title}</h3>
            </div>
          </div>
        </div>
        {renderTool(activeToolId)}
      </div>
    </section>
  );
}
