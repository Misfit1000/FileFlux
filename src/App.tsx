import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import { motion, AnimatePresence } from 'motion/react';
import {
  Download,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Eye,
  Sparkles,
  Image as ImageIcon,
  FileText,
  Database,
  X,
  File,
  Layers,
  Plus,
  RotateCcw,
  HelpCircle,
  Sun,
  Moon,
  Shield,
  WandSparkles,
  Gauge,
  ScanLine,
  CloudOff,
} from 'lucide-react';
import { cn } from './lib/utils';
import { SUPPORTED_FORMATS, getExtension, convertFile, convertPdfToDocxWithService, requiresHighFidelityServer, zipFiles, type ConversionMode } from './lib/converters';
import { renderAsync } from 'docx-preview';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;
const MAX_TOTAL_FILES = 24;
const MAX_TOTAL_BATCH_BYTES = 250 * 1024 * 1024;

function FilePreview({ url, format }: { url: string; format: string }) {
  const [content, setContent] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let isMounted = true;

    const loadPreview = async () => {
      try {
        setErrorMsg(null);
        if (['png', 'jpg', 'jpeg', 'webp', 'bmp', 'gif'].includes(format)) {
          setContent('image');
        } else if (format === 'pdf') {
          setContent('pdf');
        } else if (format === 'docx') {
          setContent('docx');
          if (containerRef.current) {
            const response = await fetch(url);
            const blob = await response.blob();

            if (blob.size > 20 * 1024 * 1024) {
              throw new Error('File is too large for the browser to preview safely.');
            }

            await renderAsync(blob, containerRef.current, containerRef.current, {
              inWrapper: true,
              ignoreWidth: false,
              ignoreHeight: false,
              ignoreFonts: false,
              breakPages: true,
            });
          }
        } else if (['txt', 'csv', 'json', 'md', 'html', 'xml', 'yaml'].includes(format)) {
          const response = await fetch(url);
          const blob = await response.blob();
          const maxBytes = 100 * 1024;
          const slice = blob.slice(0, maxBytes);
          const text = await slice.text();

          if (isMounted) {
            if (blob.size > maxBytes) {
              setContent(`${text}\n\n... [Preview truncated for performance. Download to see full file] ...`);
            } else {
              setContent(text);
            }
          }
        } else {
          throw new Error('Preview is not supported for this file format.');
        }
      } catch (err) {
        console.error('Preview error:', err);
        if (isMounted) {
          setErrorMsg(err instanceof Error ? err.message : 'An unexpected error occurred while generating the preview.');
        }
      }
    };

    setTimeout(loadPreview, 0);

    return () => {
      isMounted = false;
    };
  }, [url, format]);

  if (errorMsg) {
    return (
      <div className="w-full rounded-[1.5rem] border border-rose-400/30 bg-rose-500/10 p-6 text-center text-rose-100 shadow-[0_20px_60px_rgba(20,10,30,0.28)]">
        <AlertCircle className="mx-auto mb-3 h-8 w-8 text-rose-300" />
        <h4 className="mb-1 text-base font-bold">Preview unavailable</h4>
        <p className="text-sm text-rose-100/90">{errorMsg}</p>
        <p className="mt-2 text-xs uppercase tracking-[0.24em] text-rose-200/75">Download is still available</p>
      </div>
    );
  }

  if (content === 'image') {
    return <img src={url} alt="Preview" className="mx-auto h-auto max-w-full rounded-[1.5rem] border border-white/15 shadow-[0_20px_60px_rgba(20,10,30,0.28)]" />;
  }

  if (content === 'pdf') {
    return <iframe src={`${url}#toolbar=0`} className="h-[600px] w-full rounded-[1.5rem] border border-white/15 bg-black/40 shadow-[0_20px_60px_rgba(20,10,30,0.28)]" title="PDF Preview" />;
  }

  if (content === 'docx') {
    return <div ref={containerRef} className="docx-preview-container min-h-[600px] w-full overflow-auto rounded-[1.5rem] border border-white/15 bg-white p-8 text-black shadow-[0_20px_60px_rgba(20,10,30,0.28)]" />;
  }

  if (['txt', 'csv', 'json', 'md', 'html', 'xml', 'yaml'].includes(format)) {
    let language = 'text';
    if (format === 'json') language = 'json';
    if (format === 'csv') language = 'csv';
    if (format === 'md') language = 'markdown';
    if (format === 'html') language = 'html';
    if (format === 'xml') language = 'xml';
    if (format === 'yaml') language = 'yaml';

    return (
      <div className="w-full max-h-[600px] overflow-auto rounded-[1.5rem] border border-white/15 shadow-[0_20px_60px_rgba(20,10,30,0.28)]">
        <SyntaxHighlighter
          language={language}
          style={vscDarkPlus}
          customStyle={{ margin: 0, padding: '1.5rem', minHeight: '100%', background: 'rgba(14, 18, 38, 0.95)' }}
          wrapLines={true}
          wrapLongLines={true}
        >
          {content || 'Loading preview...'}
        </SyntaxHighlighter>
      </div>
    );
  }

  return (
    <div className="flex w-full items-center justify-center rounded-[1.5rem] border border-white/15 bg-slate-950/80 p-6 font-mono text-sm text-slate-100 shadow-[0_20px_60px_rgba(20,10,30,0.28)]">
      {content || 'Loading preview...'}
    </div>
  );
}

const CATEGORIES = [
  {
    id: 'universal',
    label: 'Universal',
    icon: Sparkles,
    accept: undefined,
    description: 'Auto-detect any supported file',
    color: 'text-cyan-100',
    accent: 'from-cyan-300/70 via-sky-400/55 to-blue-500/70',
    surface: 'bg-sky-400/15',
    border: 'border-sky-300/50',
  },
  {
    id: 'images',
    label: 'Images',
    icon: ImageIcon,
    accept: { 'image/*': ['.png', '.jpg', '.jpeg', '.webp', '.bmp', '.gif', '.svg', '.ico'] },
    description: 'Portraits, icons, scenes, stickers',
    color: 'text-sky-100',
    accent: 'from-sky-300/70 via-blue-400/55 to-indigo-500/70',
    surface: 'bg-sky-400/15',
    border: 'border-sky-300/50',
  },
  {
    id: 'documents',
    label: 'Documents',
    icon: FileText,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'text/plain': ['.txt'],
      'text/markdown': ['.md'],
      'text/html': ['.html'],
    },
    description: 'PDF, DOCX, text, markdown',
    color: 'text-cyan-100',
    accent: 'from-blue-400/70 via-cyan-300/55 to-sky-500/70',
    surface: 'bg-blue-400/15',
    border: 'border-blue-300/50',
  },
  {
    id: 'data',
    label: 'Data',
    icon: Database,
    accept: {
      'application/json': ['.json'],
      'text/csv': ['.csv'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/xml': ['.xml'],
      'text/yaml': ['.yaml', '.yml'],
    },
    description: 'Structured files and sheets',
    color: 'text-teal-100',
    accent: 'from-teal-300/70 via-cyan-400/50 to-blue-500/65',
    surface: 'bg-teal-400/15',
    border: 'border-teal-300/50',
  },
] as const;

const getFormatPills = (catId: string) => {
  switch (catId) {
    case 'images':
      return ['PNG', 'JPG', 'WEBP', 'BMP', 'GIF', 'SVG', 'ICO'];
    case 'documents':
      return ['PDF', 'DOCX', 'TXT', 'MD', 'HTML'];
    case 'data':
      return ['JSON', 'CSV', 'XLSX', 'XML', 'YAML'];
    default:
      return ['PDF', 'JPG', 'DOCX', 'JSON', 'CSV', 'XLSX'];
  }
};

const getCategoryExtensions = (catId: string) => {
  switch (catId) {
    case 'images':
      return ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'gif', 'svg', 'ico'];
    case 'documents':
      return ['pdf', 'docx', 'txt', 'txt (OCR)', 'md', 'html'];
    case 'data':
      return ['json', 'csv', 'xlsx', 'xml', 'yaml', 'yml'];
    default:
      return [];
  }
};

const STUDIO_TOOLS = [
  { title: 'Layout-aware PDF lane', description: 'Keeps PDF, DOCX, text, and OCR flows close together so the main task is never buried.', icon: FileText },
  { title: 'Image and icon remixes', description: 'Switch between PNG, JPG, WEBP, BMP, GIF, SVG, and ICO without leaving the workspace.', icon: ImageIcon },
  { title: 'Structured data transforms', description: 'Move between JSON, CSV, XLSX, XML, and YAML with a cleaner queue and safer batch handling.', icon: Database },
  { title: 'Preview before export', description: 'Open the result view before downloading so the final file feels checked, not guessed.', icon: Eye },
];

const PROMISE_POINTS = [
  { label: 'On-device flow', value: 'Private by default', icon: Shield },
  { label: 'Performance', value: 'Batch ready', icon: Gauge },
  { label: 'Scanned docs', value: 'OCR assist', icon: ScanLine },
  { label: 'Offline-friendly', value: 'No constant upload loop', icon: CloudOff },
];

export type FileItem = {
  id: string;
  file: File;
  targetFormat: string;
  status: 'idle' | 'converting' | 'success' | 'error';
  convertedUrl?: string;
  convertedName?: string;
  error?: string;
  showPreview?: boolean;
  progress?: number;
};

export default function App() {
  const [activeCategory, setActiveCategory] = useState('universal');
  const [files, setFiles] = useState<FileItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [useOcrForPdf, setUseOcrForPdf] = useState(false);
  const [isConvertingAny, setIsConvertingAny] = useState(false);
  const [isZipping, setIsZipping] = useState(false);
  const [theme, setTheme] = useState('night');
  const [showAbout, setShowAbout] = useState(false);
  const [pdfDocxMode, setPdfDocxMode] = useState<ConversionMode>('high-fidelity');
  const filesRef = useRef<FileItem[]>([]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    filesRef.current = files;
  }, [files]);

  useEffect(() => {
    return () => {
      filesRef.current.forEach((file) => {
        if (file.convertedUrl) {
          URL.revokeObjectURL(file.convertedUrl);
        }
      });
    };
  }, []);

  const filesToConvert = files.filter((file) => file.status !== 'success');
  const numConverting = files.filter((file) => file.status === 'converting').length;
  const isMultipleConverting = filesToConvert.length > 1 && numConverting > 0;

  let globalProgress = 0;
  if (isMultipleConverting) {
    const totalProgress = filesToConvert.reduce((acc, file) => {
      if (file.status === 'success' || file.status === 'error') return acc + 100;
      if (file.status === 'converting') return acc + (file.progress || 0);
      return acc;
    }, 0);
    globalProgress = totalProgress / filesToConvert.length;
  }

  const handleConvert = async () => {
    if (files.length === 0) return;

    setIsConvertingAny(true);
    setError(null);

    const updatedFiles = [...files];

    await Promise.all(
      updatedFiles.map(async (fileItem, index) => {
        if (fileItem.status === 'success' || !fileItem.targetFormat || fileItem.status === 'converting') return;

        setFiles((current) => {
          const next = [...current];
          if (next[index] && next[index].status === 'idle') {
            next[index] = { ...next[index], status: 'converting', error: undefined };
          }
          return next;
        });

        try {
          const conversionOptions = {
            useOcr: useOcrForPdf,
            onProgress: (progress: number) => {
              setFiles((current) => {
                const next = [...current];
                if (next[index]) {
                  next[index] = { ...next[index], progress };
                }
                return next;
              });
            },
          };

          const shouldUseHighFidelity = pdfDocxMode === 'high-fidelity' && requiresHighFidelityServer(fileItem.file, fileItem.targetFormat);

          let conversionResult;

          if (shouldUseHighFidelity) {
            try {
              conversionResult = await convertPdfToDocxWithService(fileItem.file, conversionOptions);
            } catch (serviceError) {
              setError(
                serviceError instanceof Error
                  ? `${serviceError.message} Falling back to the local converter for ${fileItem.file.name}.`
                  : `High-fidelity conversion is unavailable. Falling back to the local converter for ${fileItem.file.name}.`,
              );
              conversionResult = await convertFile(fileItem.file, fileItem.targetFormat, conversionOptions);
            }
          } else {
            conversionResult = await convertFile(fileItem.file, fileItem.targetFormat, conversionOptions);
          }

          const { blob, filename } = conversionResult;
          const url = URL.createObjectURL(blob);

          setFiles((current) => {
            const next = [...current];
            if (next[index]) {
              next[index] = { ...next[index], status: 'success', convertedUrl: url, convertedName: filename, _blob: blob } as any;
            }
            return next;
          });
        } catch (err) {
          setFiles((current) => {
            const next = [...current];
            if (next[index]) {
              next[index] = { ...next[index], status: 'error', error: err instanceof Error ? err.message : 'Unknown error' };
            }
            return next;
          });
        }
      }),
    );

    setIsConvertingAny(false);
  };

  const activeCatData = CATEGORIES.find((category) => category.id === activeCategory)!;

  const onDrop = useCallback(
    (acceptedFiles: File[], rejectedFiles: any[]) => {
      const nextErrors: string[] = [];
      const existingKeys = new Set(files.map((file) => `${file.file.name}:${file.file.size}:${file.file.lastModified}`));
      const totalBytesInQueue = files.reduce((sum, file) => sum + file.file.size, 0);

      if (rejectedFiles.length > 0) {
        nextErrors.push(`Some files were skipped because they do not fit ${activeCatData.label.toLowerCase()} mode.`);
      }

      const newFiles: FileItem[] = [];
      let nextTotalBytes = totalBytesInQueue;

      for (const file of acceptedFiles) {
        const ext = getExtension(file.name);
        const fileKey = `${file.name}:${file.size}:${file.lastModified}`;

        if (!SUPPORTED_FORMATS[ext]) {
          nextErrors.push(`${file.name} is not a supported format.`);
          continue;
        }

        if (existingKeys.has(fileKey)) {
          nextErrors.push(`${file.name} is already in the queue.`);
          continue;
        }

        if (file.size > MAX_FILE_SIZE_BYTES) {
          nextErrors.push(`${file.name} is larger than ${formatBytes(MAX_FILE_SIZE_BYTES)}.`);
          continue;
        }

        if (files.length + newFiles.length >= MAX_TOTAL_FILES) {
          nextErrors.push(`Queue limit reached. Keep the batch under ${MAX_TOTAL_FILES} files.`);
          break;
        }

        if (nextTotalBytes + file.size > MAX_TOTAL_BATCH_BYTES) {
          nextErrors.push(`Batch size limit reached. Keep the queue under ${formatBytes(MAX_TOTAL_BATCH_BYTES)} total.`);
          break;
        }

        if (SUPPORTED_FORMATS[ext]) {
          newFiles.push({
            id: typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : Math.random().toString(36).slice(2),
            file,
            targetFormat: SUPPORTED_FORMATS[ext][0] || '',
            status: 'idle',
          });
          existingKeys.add(fileKey);
          nextTotalBytes += file.size;
        }
      }

      if (newFiles.length > 0) {
        setFiles((prev) => [...prev, ...newFiles]);
      }

      setError(nextErrors.length > 0 ? nextErrors[0] : null);
    },
    [activeCatData.label, files],
  );

  const { getRootProps, getInputProps, isDragActive, isDragAccept, isDragReject } = useDropzone({
    onDrop,
    accept: activeCatData.accept,
    maxFiles: 0,
    multiple: true,
  });

  const handleDownloadAll = async () => {
    const successFiles: { name: string; blob: Blob }[] = [];
    files.forEach((file) => {
      if (file.status === 'success' && file.convertedName && (file as any)._blob) {
        successFiles.push({ name: file.convertedName, blob: (file as any)._blob });
      }
    });

    if (successFiles.length === 0) return;

    setIsZipping(true);
    try {
      const zipBlob = await zipFiles(successFiles);
      const url = URL.createObjectURL(zipBlob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `FileFlux_${Date.now()}.zip`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      setTimeout(() => URL.revokeObjectURL(url), 100);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to zip files');
    } finally {
      setIsZipping(false);
    }
  };

  const handleReset = () => {
    files.forEach((file) => {
      if (file.convertedUrl) URL.revokeObjectURL(file.convertedUrl);
    });
    setFiles([]);
    setError(null);
    setUseOcrForPdf(false);
  };

  const handleResetFile = (id: string) => {
    setFiles((current) =>
      current.map((file) => {
        if (file.id === id) {
          if (file.convertedUrl) URL.revokeObjectURL(file.convertedUrl);
          return {
            ...file,
            status: 'idle',
            convertedUrl: undefined,
            convertedName: undefined,
            _blob: undefined,
            showPreview: false,
            error: undefined,
          };
        }
        return file;
      }),
    );
  };

  const removeFile = (id: string) => {
    setFiles((prev) => {
      const fileToRemove = prev.find((file) => file.id === id);
      if (fileToRemove?.convertedUrl) {
        URL.revokeObjectURL(fileToRemove.convertedUrl);
      }
      return prev.filter((file) => file.id !== id);
    });
  };

  const updateFormat = (id: string, format: string) => {
    setFiles((prev) => prev.map((file) => (file.id === id ? { ...file, targetFormat: format, status: 'idle', convertedUrl: undefined } : file)));
  };

  const togglePreview = (id: string) => {
    setFiles((prev) => prev.map((file) => (file.id === id ? { ...file, showPreview: !file.showPreview } : file)));
  };

  const formatBytes = (bytes: number, decimals = 2) => {
    if (!+bytes) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
  };

  const pendingCount = files.filter((file) => file.status === 'idle' || file.status === 'error').length;
  const finishedCount = files.filter((file) => file.status === 'success' || file.status === 'error').length;
  const successfulCount = files.filter((file) => file.status === 'success').length;
  const totalQueuedBytes = files.reduce((sum, file) => sum + file.file.size, 0);
  const failedCount = files.filter((file) => file.status === 'error').length;

  return (
    <div className="anime-shell min-h-screen overflow-hidden text-[var(--text-primary)]">
      <div className="anime-bg pointer-events-none">
        <div className="anime-orb anime-orb-a" />
        <div className="anime-orb anime-orb-b" />
        <div className="anime-orb anime-orb-c" />
        <div className="anime-grid" />
      </div>

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-[1440px] flex-col px-4 py-4 sm:px-6 lg:px-8">
        <header className="anime-panel sticky top-4 z-40 mb-6 rounded-[2rem] px-5 py-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4">
              <div className="anime-badge-box">
                <Layers className="h-6 w-6" />
              </div>
              <div>
                <p className="text-[0.68rem] font-bold uppercase tracking-[0.36em] text-[var(--text-soft)]">Browser-first conversion suite</p>
                <h1 className="font-display text-2xl font-extrabold tracking-[0.08em] text-white sm:text-3xl">FileFlux</h1>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 lg:justify-end">
              <nav className="hidden items-center gap-2 lg:flex">
                <a href="#workspace" className="anime-nav-link">Workspace</a>
                <a href="#tool-grid" className="anime-nav-link">Formats</a>
                <a href="#promises" className="anime-nav-link">Flow</a>
              </nav>
              <div className="anime-chip">
                <Shield className="h-4 w-4" />
                Private on device
              </div>
              <div className="anime-chip">
                <WandSparkles className="h-4 w-4" />
                Simple 3-step flow
              </div>
              <button
                onClick={() => setTheme((current) => (current === 'night' ? 'sunrise' : 'night'))}
                className="anime-icon-button"
                title={theme === 'night' ? 'Switch to dawn mode' : 'Switch to midnight mode'}
              >
                {theme === 'night' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
              </button>
              <button onClick={() => setShowAbout(true)} className="anime-cta-secondary">
                <HelpCircle className="h-4 w-4" />
                About FileFlux
              </button>
            </div>
          </div>

          <AnimatePresence>
            {isMultipleConverting && (
              <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="mt-4">
                <div className="overflow-hidden rounded-full bg-white/8">
                  <div className="h-2 rounded-full bg-gradient-to-r from-fuchsia-400 via-cyan-300 to-amber-300 transition-all duration-300" style={{ width: `${globalProgress}%` }} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </header>

        <main className="flex flex-1 flex-col gap-8">
          <section className="anime-panel anime-hero-shell relative overflow-hidden rounded-[2.5rem] px-6 py-8 sm:px-8 lg:px-10 lg:py-10">
            <div className="anime-panel-glow" />
            <div className="anime-sea-ribbon" />
            <div className="relative z-10 grid gap-8 xl:grid-cols-[minmax(0,1.3fr)_360px] xl:items-end">
              <div className="max-w-4xl">
                <p className="text-[0.74rem] font-bold uppercase tracking-[0.38em] text-[var(--text-soft)]">All your format switches in one calm stage</p>
                <h2 className="mt-3 font-display text-4xl font-extrabold leading-[1.02] text-white sm:text-5xl xl:text-[4.5rem]">
                  A slick conversion studio with ocean-night anime energy.
                </h2>
                <p className="mt-5 max-w-2xl text-base leading-8 text-[var(--text-muted)] sm:text-lg">
                  Drop your files, pick the output, and move through the queue with spacious controls, high-clarity previews, and stronger PDF handling without losing the local-first feel.
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <div className="anime-chip">
                    <Shield className="h-4 w-4" />
                    Private by default
                  </div>
                  <div className="anime-chip">
                    <Gauge className="h-4 w-4" />
                    Faster batch rhythm
                  </div>
                  <div className="anime-chip">
                    <ScanLine className="h-4 w-4" />
                    OCR for hard scans
                  </div>
                </div>
              </div>

              <div className="anime-hero-card">
                <p className="text-[0.68rem] font-bold uppercase tracking-[0.28em] text-[var(--text-soft)]">Live snapshot</p>
                <div className="mt-4 space-y-4">
                  <div className="flex items-center justify-between rounded-[1.35rem] border border-white/10 bg-white/6 px-4 py-3">
                    <span className="text-sm text-[var(--text-muted)]">Queue</span>
                    <strong className="font-display text-xl text-white">{files.length}</strong>
                  </div>
                  <div className="flex items-center justify-between rounded-[1.35rem] border border-white/10 bg-white/6 px-4 py-3">
                    <span className="text-sm text-[var(--text-muted)]">Ready</span>
                    <strong className="font-display text-xl text-white">{successfulCount}</strong>
                  </div>
                  <div className="flex items-center justify-between rounded-[1.35rem] border border-white/10 bg-white/6 px-4 py-3">
                    <span className="text-sm text-[var(--text-muted)]">Batch weight</span>
                    <strong className="font-display text-lg text-white">{formatBytes(totalQueuedBytes)}</strong>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="anime-trust-strip grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {PROMISE_POINTS.map((point) => (
              <div key={point.label} className="anime-focus-card flex items-start gap-4">
                <div className="anime-mini-icon">
                  <point.icon className="h-5 w-5 text-cyan-100" />
                </div>
                <div>
                  <span className="anime-focus-label">{point.label}</span>
                  <strong className="anime-focus-value">{point.value}</strong>
                </div>
              </div>
            ))}
          </section>

          <div id="workspace" className="grid gap-8 xl:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="order-2 space-y-6 xl:order-1">
            <section className="anime-panel rounded-[2rem] p-5">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-[0.68rem] font-bold uppercase tracking-[0.3em] text-[var(--text-soft)]">Choose mode</p>
                  <h2 className="font-display text-xl font-bold text-white">Conversion paths</h2>
                </div>
                <Sparkles className="h-5 w-5 text-fuchsia-200" />
              </div>
              <div className="space-y-3">
                {CATEGORIES.map((category) => (
                  <button
                    key={category.id}
                    onClick={() => {
                      setActiveCategory(category.id);
                      handleReset();
                    }}
                    className={cn('anime-category-card', activeCategory === category.id && 'anime-category-card-active')}
                  >
                    <div className={cn('anime-category-icon bg-gradient-to-br', category.accent)}>
                      <category.icon className={cn('h-5 w-5', category.color)} />
                    </div>
                    <div className="min-w-0 text-left">
                      <div className="font-display text-base font-bold text-white">{category.label}</div>
                      <div className="text-sm text-[var(--text-muted)]">{category.description}</div>
                    </div>
                  </button>
                ))}
              </div>
            </section>

            <section className="anime-panel rounded-[2rem] p-5">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-[0.68rem] font-bold uppercase tracking-[0.3em] text-[var(--text-soft)]">Mission control</p>
                  <h2 className="font-display text-xl font-bold text-white">Progress and guide</h2>
                </div>
                <Shield className="h-5 w-5 text-cyan-100" />
              </div>
              <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
                  <div className="anime-stat-card">
                    <span className="anime-stat-label">Queued</span>
                    <strong className="anime-stat-value">{pendingCount}</strong>
                </div>
                <div className="anime-stat-card">
                  <span className="anime-stat-label">Finished</span>
                  <strong className="anime-stat-value">{finishedCount}</strong>
                </div>
                  <div className="anime-stat-card">
                    <span className="anime-stat-label">Ready</span>
                    <strong className="anime-stat-value">{successfulCount}</strong>
                  </div>
                </div>
              <div className="mt-4 rounded-[1.2rem] border border-white/8 bg-white/5 px-4 py-3 text-xs text-[var(--text-muted)]">
                Batch weight: {formatBytes(totalQueuedBytes)} of {formatBytes(MAX_TOTAL_BATCH_BYTES)}
              </div>
              <div className="mt-5 space-y-3">
                <div className="anime-step-card">
                  <span className="anime-step-number">1</span>
                  <div>
                    <div className="font-display text-base font-bold text-white">Choose a mode</div>
                    <p className="text-sm text-[var(--text-muted)]">Pick Universal, Images, Documents, or Data before you add files.</p>
                  </div>
                </div>
                <div className="anime-step-card">
                  <span className="anime-step-number">2</span>
                  <div>
                    <div className="font-display text-base font-bold text-white">Set the output</div>
                    <p className="text-sm text-[var(--text-muted)]">Each file keeps its own target format, so mixed batches are easier to manage.</p>
                  </div>
                </div>
                <div className="anime-step-card">
                  <span className="anime-step-number">3</span>
                  <div>
                    <div className="font-display text-base font-bold text-white">Preview before download</div>
                    <p className="text-sm text-[var(--text-muted)]">Open the preview panel when accuracy matters, especially for PDFs and OCR output.</p>
                  </div>
                </div>
              </div>
            </section>
          </aside>

          <section className="anime-panel relative order-1 overflow-hidden rounded-[2.4rem] xl:order-2">
            <div className="anime-panel-glow" />
            <div className="anime-sea-ribbon" />
            <div className="relative flex h-full flex-col p-5 sm:p-7 lg:p-10">
              <div className="mb-8 grid gap-6 2xl:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.8fr)] 2xl:items-end">
                <div className="max-w-3xl">
                  <p className="text-[0.72rem] font-bold uppercase tracking-[0.35em] text-[var(--text-soft)]">Anime-inspired interface</p>
                  <h2 className="font-display text-4xl font-extrabold leading-[1.05] text-white sm:text-5xl xl:text-[3.6rem]">
                    Slick file conversion with a calm ocean-sky stage.
                  </h2>
                  <p className="mt-4 max-w-2xl text-base leading-8 text-[var(--text-muted)] sm:text-lg">
                    Pick a mode, drop in files, choose the output, and preview every result in one responsive workspace built to feel sharp on both desktop and mobile.
                  </p>
                  <div className="mt-6 flex flex-wrap gap-3">
                    <div className="anime-chip">
                      <Shield className="h-4 w-4" />
                      Local-first workflow
                    </div>
                    <div className="anime-chip">
                      <WandSparkles className="h-4 w-4" />
                      Anime-coded visuals
                    </div>
                    <div className="anime-chip">
                      <Sparkles className="h-4 w-4" />
                      Preview before download
                    </div>
                  </div>
                </div>
                <div className="anime-hero-card">
                  <p className="text-[0.68rem] font-bold uppercase tracking-[0.28em] text-[var(--text-soft)]">Current mode</p>
                  <div className="mt-3 flex items-center gap-4">
                    <div className={cn('anime-category-icon bg-gradient-to-br', activeCatData.accent)}>
                      <activeCatData.icon className={cn('h-6 w-6', activeCatData.color)} />
                    </div>
                    <div>
                      <div className="font-display text-2xl font-bold text-white">{activeCatData.label}</div>
                      <div className="text-sm text-[var(--text-muted)]">{activeCatData.description}</div>
                    </div>
                  </div>
                  <div className="anime-hero-pills mt-5">
                    {getFormatPills(activeCategory).map((format) => (
                      <span key={format} className="anime-pill">
                        {format}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

                <div className="mb-8 grid gap-4 md:grid-cols-3">
                  <div className="anime-focus-card">
                    <span className="anime-focus-label">Local-first</span>
                    <strong className="anime-focus-value">No account wall</strong>
                  </div>
                <div className="anime-focus-card">
                  <span className="anime-focus-label">PDF to DOCX</span>
                  <strong className="anime-focus-value">Better layout recovery</strong>
                </div>
                  <div className="anime-focus-card">
                    <span className="anime-focus-label">Scanned pages</span>
                    <strong className="anime-focus-value">OCR ready</strong>
                  </div>
                </div>

              <div className="mb-6 rounded-[1.4rem] border border-white/10 bg-white/6 p-4 sm:p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="max-w-2xl">
                    <p className="text-[0.68rem] font-bold uppercase tracking-[0.28em] text-[var(--text-soft)]">PDF to DOCX mode</p>
                    <h3 className="font-display text-xl font-bold text-white">Choose speed or high fidelity</h3>
                    <p className="mt-1 text-sm leading-7 text-[var(--text-muted)]">
                      High-fidelity mode uses a server-backed conversion route for production PDFs. Local mode stays fully in-browser and works as a fallback.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => setPdfDocxMode('high-fidelity')}
                      className={cn('anime-cta-secondary', pdfDocxMode === 'high-fidelity' && 'border-cyan-300/45 bg-cyan-300/14 text-white')}
                    >
                      High fidelity
                    </button>
                    <button
                      type="button"
                      onClick={() => setPdfDocxMode('local')}
                      className={cn('anime-cta-secondary', pdfDocxMode === 'local' && 'border-cyan-300/45 bg-cyan-300/14 text-white')}
                    >
                      Fast local
                    </button>
                  </div>
                </div>
              </div>

              {error && (
                <div className="mb-5 rounded-[1.4rem] border border-rose-300/35 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
                  {error}
                </div>
              )}

              <ErrorBoundary>
                <AnimatePresence mode="wait">
                  {files.length === 0 ? (
                    <motion.div key="dropzone" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="flex flex-1 flex-col">
                      <div
                        {...getRootProps()}
                        className={cn(
                          'anime-dropzone group flex min-h-[580px] flex-1 cursor-pointer flex-col items-center justify-center overflow-hidden rounded-[2.2rem] border px-6 py-10 text-center transition-all duration-300 sm:px-10 sm:py-14',
                          isDragReject && 'border-rose-300/60 bg-rose-500/10',
                          isDragAccept && 'border-cyan-300/70 bg-cyan-400/12',
                          isDragActive && !isDragReject && activeCatData.border,
                        )}
                      >
                        <input {...getInputProps()} />
                        <div className="anime-speedlines" />
                        <motion.div
                          animate={isDragActive ? { scale: [1, 1.08, 1], rotate: [0, -3, 3, 0] } : { y: [0, -8, 0] }}
                          transition={isDragActive ? { duration: 0.9, repeat: Infinity } : { duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                          className={cn('anime-drop-icon bg-gradient-to-br', activeCatData.accent)}
                        >
                          {isDragReject ? <AlertCircle className="h-16 w-16 text-rose-200" /> : isDragAccept ? <CheckCircle2 className="h-16 w-16 text-cyan-100" /> : <activeCatData.icon className={cn('h-16 w-16', activeCatData.color)} />}
                        </motion.div>

                        <div className="relative z-10 max-w-2xl">
                          <p className="mb-3 text-[0.74rem] font-bold uppercase tracking-[0.42em] text-[var(--text-soft)]">Drop zone</p>
                          <h3 className="font-display text-4xl font-extrabold tracking-[0.06em] text-white sm:text-5xl">
                            {isDragReject ? 'That file does not match this mode.' : isDragAccept ? 'Release to add the files.' : 'Drop files here to get started.'}
                          </h3>
                          <p className="mx-auto mt-4 max-w-xl text-base leading-8 text-[var(--text-muted)]">
                            {isDragReject
                              ? `Switch the mode or choose a compatible format for ${activeCatData.label.toLowerCase()}.`
                              : 'Tap or drag files here to prepare a local conversion batch with previews, downloads, and optional OCR for scanned PDFs.'}
                          </p>
                        </div>

                        <div className="relative z-10 mt-10 flex flex-wrap justify-center gap-3">
                          {getFormatPills(activeCategory).map((format) => (
                            <span key={format} className="anime-pill">
                              {format}
                            </span>
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div key="queue" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex flex-1 flex-col">
                      <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                        <div>
                          <p className="text-[0.72rem] font-bold uppercase tracking-[0.32em] text-[var(--text-soft)]">Current queue</p>
                          <h3 className="font-display text-2xl font-bold text-white">Files in motion: {files.length}</h3>
                          <p className="mt-2 text-sm text-[var(--text-muted)]">Keep your batch flowing with per-file format controls, previews, and download actions.</p>
                        </div>
                        <div className="flex flex-wrap gap-3">
                          <div {...getRootProps()} className="cursor-pointer">
                            <input {...getInputProps()} />
                            <button className="anime-cta-secondary">
                              <Plus className="h-4 w-4" />
                              Add files
                            </button>
                          </div>
                          <button onClick={handleReset} className="anime-danger-button">
                            <X className="h-4 w-4" />
                            Clear queue
                          </button>
                        </div>
                      </div>

                      <div className="anime-file-list mb-6 flex-1 space-y-5 overflow-y-auto pr-1">
                        <AnimatePresence>
                          {files.map((fileItem) => {
                            const ext = getExtension(fileItem.file.name);
                            const allAvailable = SUPPORTED_FORMATS[ext] || [];
                            const available =
                              activeCategory === 'universal'
                                ? allAvailable
                                : allAvailable.filter((format) => getCategoryExtensions(activeCategory).includes(format));

                            return (
                              <motion.div
                                key={fileItem.id}
                                layout="position"
                                initial={{ opacity: 0, y: 16 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.96 }}
                                transition={{ duration: 0.22 }}
                                className={cn(
                                  'anime-file-card overflow-hidden rounded-[1.7rem] border',
                                  fileItem.status === 'converting' && 'border-cyan-300/45 bg-cyan-400/8',
                                  fileItem.status === 'success' && 'border-emerald-300/40 bg-emerald-400/8',
                                  fileItem.status === 'error' && 'border-rose-300/40 bg-rose-400/8',
                                )}
                              >
                                <div className="relative p-4 sm:p-5">
                                  {fileItem.status === 'converting' && (
                                    <>
                                      <motion.div
                                        className="absolute inset-0 bg-[linear-gradient(110deg,transparent,rgba(125,211,252,0.12),transparent)]"
                                        initial={{ x: '-120%' }}
                                        animate={{ x: '120%' }}
                                        transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
                                      />
                                      <div className="absolute bottom-0 left-0 h-1 bg-gradient-to-r from-cyan-300 to-fuchsia-300 transition-all duration-300" style={{ width: `${fileItem.progress || 0}%` }} />
                                    </>
                                  )}

                                  <div className="relative z-10 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                    <div className="flex min-w-0 gap-4">
                                      <div className="anime-file-icon">
                                        <File className="h-6 w-6 text-white" />
                                      </div>
                                      <div className="min-w-0">
                                        <div className="truncate font-display text-lg font-bold text-white">{fileItem.file.name}</div>
                                        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-[var(--text-muted)]">
                                          <span>{formatBytes(fileItem.file.size)}</span>
                                          <span>{ext.toUpperCase() || 'FILE'}</span>
                                        </div>
                                        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs font-bold uppercase tracking-[0.24em]">
                                          {fileItem.status === 'idle' && <span className="text-[var(--text-soft)]">Ready</span>}
                                          {fileItem.status === 'converting' && <span className="text-cyan-200">Converting {Math.round(fileItem.progress || 0)}%</span>}
                                          {fileItem.status === 'success' && <span className="text-emerald-200">Converted</span>}
                                          {fileItem.status === 'error' && <span className="max-w-full truncate text-rose-200">{fileItem.error}</span>}
                                        </div>
                                      </div>
                                    </div>

                                    <div className="flex flex-wrap items-center justify-end gap-3">
                                      {(fileItem.status === 'idle' || fileItem.status === 'error') && (
                                        <div className="anime-format-picker">
                                          <span className="text-[0.68rem] font-bold uppercase tracking-[0.24em] text-[var(--text-soft)]">To</span>
                                          <select
                                            value={fileItem.targetFormat}
                                            onChange={(event) => updateFormat(fileItem.id, event.target.value)}
                                            className="bg-transparent text-sm font-bold text-white outline-none [&>option]:bg-slate-900"
                                          >
                                            {available.map((format) => (
                                              <option key={format} value={format}>
                                                {format.toUpperCase()}
                                              </option>
                                            ))}
                                          </select>
                                        </div>
                                      )}

                                      {fileItem.status === 'success' && fileItem.convertedUrl && (
                                        <div className="flex flex-wrap gap-2">
                                          <button onClick={() => handleResetFile(fileItem.id)} className="anime-icon-button" title="Convert this file again">
                                            <RotateCcw className="h-5 w-5" />
                                          </button>
                                          <button
                                            onClick={() => togglePreview(fileItem.id)}
                                            className={cn('anime-icon-button', fileItem.showPreview && 'border-cyan-300/50 bg-cyan-300/15 text-cyan-100')}
                                            title="Toggle preview"
                                          >
                                            <Eye className="h-5 w-5" />
                                          </button>
                                          <a href={fileItem.convertedUrl} download={fileItem.convertedName} className="anime-icon-button anime-download-button" title="Download converted file">
                                            <Download className="h-5 w-5" />
                                          </a>
                                        </div>
                                      )}

                                      <button onClick={() => removeFile(fileItem.id)} className="anime-icon-button" disabled={isConvertingAny} title="Remove file">
                                        <X className="h-5 w-5" />
                                      </button>
                                    </div>
                                  </div>
                                </div>

                                <AnimatePresence>
                                  {fileItem.showPreview && fileItem.convertedUrl && fileItem.status === 'success' && (
                                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.28 }} className="border-t border-white/10 bg-black/15 p-4 sm:p-6">
                                      <div className="mb-4 flex items-center justify-between">
                                        <h4 className="font-display text-lg font-bold text-white">Preview: {fileItem.convertedName}</h4>
                                      </div>
                                      <FilePreview url={fileItem.convertedUrl} format={fileItem.targetFormat} />
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </motion.div>
                            );
                          })}
                        </AnimatePresence>
                      </div>

                      {files.some((file) => getExtension(file.file.name) === 'pdf' && (file.targetFormat === 'docx' || file.targetFormat === 'txt') && (file.status === 'idle' || file.status === 'error')) &&
                        (activeCategory === 'documents' || activeCategory === 'universal') && (
                          <div className="mb-6 rounded-[1.6rem] border border-white/12 bg-white/6 p-4 sm:p-5">
                            <label htmlFor="useOcr" className="flex cursor-pointer items-start gap-4">
                              <input
                                type="checkbox"
                                id="useOcr"
                                checked={useOcrForPdf}
                                onChange={(event) => setUseOcrForPdf(event.target.checked)}
                                className="mt-1 h-5 w-5 rounded border-white/20 bg-black/20"
                              />
                              <div>
                                <div className="font-display text-lg font-bold text-white">Enable OCR boost for PDF text pulls</div>
                                <p className="mt-1 text-sm leading-7 text-[var(--text-muted)]">
                                  Best for scanned pages and dense layouts when converting PDF files into DOCX or TXT. It takes longer, but usually captures more text and structure.
                                </p>
                              </div>
                            </label>
                          </div>
                        )}

                      <AnimatePresence>
                        {isConvertingAny && (
                          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mb-6 overflow-hidden">
                            <div className="rounded-[1.6rem] border border-cyan-300/25 bg-cyan-400/8 p-5">
                              <div className="mb-3 flex items-center justify-between gap-4">
                                <div className="flex items-center gap-3 text-cyan-100">
                                  <RefreshCw className="h-5 w-5 animate-spin" />
                                  <span className="font-display text-lg font-bold">Converting your files</span>
                                </div>
                                <div className="rounded-full bg-white/10 px-3 py-1 text-sm text-[var(--text-muted)]">
                                  {finishedCount} / {files.length}
                                </div>
                              </div>
                              <div className="h-3 overflow-hidden rounded-full bg-black/20">
                                <motion.div
                                  className="h-full rounded-full bg-gradient-to-r from-fuchsia-400 via-cyan-300 to-amber-300"
                                  initial={{ width: '0%' }}
                                  animate={{ width: `${Math.max(5, (finishedCount / files.length) * 100)}%` }}
                                  transition={{ type: 'spring', stiffness: 60, damping: 14 }}
                                />
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      <div className="mt-auto">
                        {!files.every((file) => file.status === 'success') && (
                          <button onClick={handleConvert} disabled={isConvertingAny || files.every((file) => file.status === 'success' || file.status === 'converting')} className="anime-primary-button w-full">
                            {isConvertingAny ? (
                              <>
                                <RefreshCw className="h-5 w-5 animate-spin" />
                                Converting now
                              </>
                            ) : (
                              <>
                                <Sparkles className="h-5 w-5" />
                                Convert {pendingCount} file{pendingCount === 1 ? '' : 's'}
                              </>
                            )}
                          </button>
                        )}

                        {files.every((file) => file.status === 'success') && files.length > 0 && (
                          <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
                            <div className="flex flex-1 items-center gap-4 rounded-[1.6rem] border border-emerald-300/30 bg-emerald-400/10 p-5">
                              <div className="flex h-12 w-12 items-center justify-center rounded-[1.2rem] bg-emerald-300/20">
                                <CheckCircle2 className="h-7 w-7 text-emerald-100" />
                              </div>
                              <div>
                                <p className="font-display text-lg font-bold text-white">Everything is ready</p>
                                <p className="text-sm text-[var(--text-muted)]">Preview each result or download the whole set as a zip.</p>
                              </div>
                            </div>
                            <button onClick={handleDownloadAll} disabled={isZipping} className="anime-primary-button lg:w-auto">
                              {isZipping ? (
                                <>
                                  <RefreshCw className="h-5 w-5 animate-spin" />
                                  Packing zip
                                </>
                              ) : (
                                <>
                                  <Download className="h-5 w-5" />
                                  Download all
                                </>
                              )}
                            </button>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </ErrorBoundary>
            </div>
          </section>
          </div>

          <section id="tool-grid" className="anime-panel rounded-[2.4rem] p-6 sm:p-8">
            <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-[0.72rem] font-bold uppercase tracking-[0.35em] text-[var(--text-soft)]">Format lanes</p>
                <h3 className="font-display text-3xl font-extrabold text-white">Built to feel clearer the moment you land.</h3>
              </div>
              <p className="max-w-2xl text-sm leading-7 text-[var(--text-muted)]">
                The page now leads with one big stage, a lighter trust rail, and cleaner supporting cards so the converter feels more like a polished product and less like a stacked utility panel.
              </p>
            </div>
            <div className="anime-tools-grid">
              {STUDIO_TOOLS.map((tool) => (
                <div key={tool.title} className="anime-tool-card">
                  <div className="anime-mini-icon">
                    <tool.icon className="h-5 w-5 text-cyan-100" />
                  </div>
                  <h4 className="mt-4 font-display text-xl font-bold text-white">{tool.title}</h4>
                  <p className="mt-2 text-sm leading-7 text-[var(--text-muted)]">{tool.description}</p>
                </div>
              ))}
            </div>
          </section>

          <section id="promises" className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
            <div className="anime-panel rounded-[2.2rem] p-6 sm:p-8">
              <p className="text-[0.72rem] font-bold uppercase tracking-[0.35em] text-[var(--text-soft)]">Why it feels better</p>
              <h3 className="mt-3 font-display text-3xl font-extrabold text-white">More room, less friction, stronger focus.</h3>
              <div className="mt-6 grid gap-4 md:grid-cols-3">
                <div className="anime-step-card">
                  <span className="anime-step-number">1</span>
                  <div>
                    <div className="font-display text-base font-bold text-white">Cleaner entry</div>
                    <p className="text-sm text-[var(--text-muted)]">The first screen guides you straight into the workflow instead of making you decode the layout.</p>
                  </div>
                </div>
                <div className="anime-step-card">
                  <span className="anime-step-number">2</span>
                  <div>
                    <div className="font-display text-base font-bold text-white">Softer density</div>
                    <p className="text-sm text-[var(--text-muted)]">Important controls stay visible, while supportive information sits in calmer secondary cards.</p>
                  </div>
                </div>
                <div className="anime-step-card">
                  <span className="anime-step-number">3</span>
                  <div>
                    <div className="font-display text-base font-bold text-white">Anime-coded finish</div>
                    <p className="text-sm text-[var(--text-muted)]">Blue atmosphere, glow accents, and sharp typography create a more intentional visual identity.</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="anime-panel rounded-[2.2rem] p-6 sm:p-8">
              <p className="text-[0.72rem] font-bold uppercase tracking-[0.35em] text-[var(--text-soft)]">Trust note</p>
              <h3 className="mt-3 font-display text-2xl font-extrabold text-white">Your queue stays readable even when the batch grows.</h3>
              <div className="mt-6 space-y-4 text-sm leading-7 text-[var(--text-muted)]">
                <p>The layout keeps the upload stage, queue actions, and preview flow in one path, while PDF-specific controls only appear when they matter.</p>
                <p>That gives the app a more production-ready front page without compromising the conversion logic we already improved underneath.</p>
              </div>
              <div className="mt-6 flex flex-wrap gap-3">
                <button onClick={() => window.location.hash = '#workspace'} className="anime-primary-button lg:w-auto">
                  Return to workspace
                </button>
                <button onClick={() => setShowAbout(true)} className="anime-cta-secondary">
                  <HelpCircle className="h-4 w-4" />
                  Learn more
                </button>
              </div>
            </div>
          </section>
        </main>
      </div>

      <AnimatePresence>
        {showAbout && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={() => setShowAbout(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 20 }}
              className="anime-panel relative z-10 w-full max-w-xl rounded-[2rem] p-7"
            >
              <div className="mb-5 flex items-start justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="anime-badge-box">
                    <Layers className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-[0.7rem] font-bold uppercase tracking-[0.32em] text-[var(--text-soft)]">About</p>
                    <h2 className="font-display text-2xl font-extrabold text-white">FileFlux</h2>
                  </div>
                </div>
                <button onClick={() => setShowAbout(false)} className="anime-icon-button">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-4 text-sm leading-7 text-[var(--text-muted)] sm:text-base">
                <p>
                  <strong className="text-white">FileFlux</strong> is a browser-based file conversion workspace designed for quick format changes, previews, and bulk downloads.
                </p>
                <p>
                  The app keeps the workflow local in your browser, so you can move between images, documents, and structured data without sending every file through a remote upload pipeline.
                </p>
                <ul className="space-y-2">
                  <li>Batch queue with per-file format controls</li>
                  <li>Preview support for images, text files, PDFs, and DOCX outputs</li>
                  <li>Optional OCR mode for difficult PDF extractions</li>
                  <li>One-click zip download after the run finishes</li>
                </ul>
              </div>

              <div className="mt-6 flex justify-end">
                <button onClick={() => setShowAbout(false)} className="anime-primary-button lg:w-auto">
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
