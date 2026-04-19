import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import { motion, AnimatePresence } from 'motion/react';
import { 
  FileUp, ArrowRight, Download, RefreshCw, 
  AlertCircle, CheckCircle2, Eye, Sparkles, Image as ImageIcon, 
  FileText, Database, X, File, Layers, Plus, RotateCcw, HelpCircle, Sun, Moon
} from 'lucide-react';
import { cn } from './lib/utils';
import { SUPPORTED_FORMATS, getExtension, convertFile, zipFiles } from './lib/converters';
import { renderAsync } from 'docx-preview';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

function FilePreview({ url, format }: { url: string, format: string }) {
  const [content, setContent] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let isMounted = true;

    const loadPreview = async () => {
      try {
        if (['png', 'jpg', 'jpeg', 'webp', 'bmp', 'gif'].includes(format)) {
          setContent('image');
        } else if (format === 'pdf') {
          setContent('pdf');
        } else if (format === 'docx') {
          setContent('docx');
          if (containerRef.current) {
            const response = await fetch(url);
            const blob = await response.blob();
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
          const text = await response.text();
          if (isMounted) setContent(text);
        }
      } catch (err) {
        console.error('Preview error:', err);
        if (isMounted) setContent('Error loading preview');
      }
    };

    loadPreview();
    return () => { isMounted = false; };
  }, [url, format]);

  if (content === 'image') {
    return <img src={url} alt="Preview" className="max-w-full h-auto mx-auto rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.5)] border border-white/20" />;
  }

  if (content === 'pdf') {
    return <iframe src={`${url}#toolbar=0`} className="w-full h-[600px] rounded-2xl border border-white/20 shadow-[0_8px_30px_rgba(0,0,0,0.5)] bg-black/60 backdrop-blur-xl" title="PDF Preview" />;
  }

  if (content === 'docx') {
    return <div ref={containerRef} className="w-full min-h-[600px] bg-white text-black backdrop-blur-xl rounded-2xl overflow-auto docx-preview-container border border-white/20 shadow-[0_8px_30px_rgba(0,0,0,0.5)] p-8" />;
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
      <div className="w-full max-h-[600px] overflow-auto rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.5)] border border-white/20">
        <SyntaxHighlighter
          language={language}
          style={vscDarkPlus}
          customStyle={{ margin: 0, padding: '1.5rem', minHeight: '100%', background: 'rgba(15, 23, 42, 0.9)' }}
          wrapLines={true}
          wrapLongLines={true}
        >
          {content || 'Loading preview...'}
        </SyntaxHighlighter>
      </div>
    );
  }

  return (
    <div className="w-full max-h-[600px] overflow-auto bg-[#0f172a]/90 backdrop-blur-2xl text-indigo-100 p-6 rounded-2xl font-mono text-sm whitespace-pre-wrap shadow-[0_8px_30px_rgba(0,0,0,0.5)] border border-white/20">
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
    description: 'Auto-detects any supported file',
    color: 'text-cyan-300',
    bg: 'bg-cyan-500/20',
    border: 'border-cyan-400/50'
  },
  { 
    id: 'images', 
    label: 'Images', 
    icon: ImageIcon, 
    accept: {'image/*': ['.png', '.jpg', '.jpeg', '.webp', '.bmp', '.gif', '.svg', '.ico']}, 
    description: 'Convert between image formats',
    color: 'text-pink-300',
    bg: 'bg-pink-500/20',
    border: 'border-pink-400/50'
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
      'text/html': ['.html']
    }, 
    description: 'PDF, Word, TXT, HTML, Markdown',
    color: 'text-indigo-300',
    bg: 'bg-indigo-500/20',
    border: 'border-indigo-400/50'
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
      'text/yaml': ['.yaml', '.yml']
    }, 
    description: 'JSON, CSV, Excel, XML, YAML',
    color: 'text-emerald-300',
    bg: 'bg-emerald-500/20',
    border: 'border-emerald-400/50'
  }
];

const getFormatPills = (catId: string) => {
  switch(catId) {
    case 'images': return ['PNG', 'JPG', 'WEBP', 'BMP', 'GIF', 'SVG', 'ICO'];
    case 'documents': return ['PDF', 'DOCX', 'TXT', 'MD', 'HTML'];
    case 'data': return ['JSON', 'CSV', 'XLSX', 'XML', 'YAML'];
    default: return ['PDF', 'JPG', 'DOCX', 'JSON', 'CSV', '...'];
  }
};

export type FileItem = {
  id: string;
  file: File;
  targetFormat: string;
  status: 'idle' | 'converting' | 'success' | 'error';
  convertedUrl?: string;
  convertedName?: string;
  error?: string;
  showPreview?: boolean;
};

export default function App() {
  const [activeCategory, setActiveCategory] = useState('universal');
  const [files, setFiles] = useState<FileItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [useOcrForPdf, setUseOcrForPdf] = useState(false);
  const [isConvertingAny, setIsConvertingAny] = useState(false);
  const [isZipping, setIsZipping] = useState(false);
  const [theme, setTheme] = useState('dark');

  useEffect(() => {
    if (theme === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  }, [theme]);

  const handleConvert = async () => {
    if (files.length === 0) return;

    setIsConvertingAny(true);
    setError(null);

    const updatedFiles = [...files];

    await Promise.all(updatedFiles.map(async (fileItem, index) => {
      if (fileItem.status === 'success' || !fileItem.targetFormat || fileItem.status === 'converting') return;

      // Optimistic update
      setFiles(current => {
        const next = [...current];
        if (next[index] && next[index].status === 'idle') {
            next[index] = { ...next[index], status: 'converting', error: undefined };
        }
        return next;
      });

      try {
        const { blob, filename } = await convertFile(fileItem.file, fileItem.targetFormat, { useOcr: useOcrForPdf });
        const url = URL.createObjectURL(blob);
        
        setFiles(current => {
          const next = [...current];
          if (next[index]) {
            next[index] = { ...next[index], status: 'success', convertedUrl: url, convertedName: filename, _blob: blob } as any;
          }
          return next;
        });
      } catch (err) {
        setFiles(current => {
          const next = [...current];
          if (next[index]) {
            next[index] = { ...next[index], status: 'error', error: err instanceof Error ? err.message : 'Unknown error' };
          }
          return next;
        });
      }
    }));

    setIsConvertingAny(false);
  };


  const activeCatData = CATEGORIES.find(c => c.id === activeCategory)!;

  const onDrop = useCallback((acceptedFiles: File[], rejectedFiles: any[]) => {
    if (rejectedFiles.length > 0) {
      setError(`Some files were skipped. Maybe unsupported in ${activeCatData.label} mode.`);
    }
    
    const newFiles: FileItem[] = [];
    for (const f of acceptedFiles) {
      const ext = getExtension(f.name);
      if (SUPPORTED_FORMATS[ext]) {
        newFiles.push({
          id: Math.random().toString(36).substring(7),
          file: f,
          targetFormat: SUPPORTED_FORMATS[ext][0] || '',
          status: 'idle'
        });
      }
    }
    
    if (newFiles.length > 0) {
      setFiles(prev => [...prev, ...newFiles]);
      setError(null);
    }
  }, [activeCatData.label]);

  const { getRootProps, getInputProps, isDragActive, isDragAccept, isDragReject } = useDropzone({
    onDrop,
    accept: activeCatData.accept,
    maxFiles: 0, // no limit
    multiple: true,
  });


  const handleDownloadAll = async () => {
    const successFiles: { name: string, blob: Blob }[] = [];
    files.forEach(f => {
      if (f.status === 'success' && f.convertedName && (f as any)._blob) {
        successFiles.push({ name: f.convertedName, blob: (f as any)._blob });
      }
    });

    if (successFiles.length === 0) return;

    setIsZipping(true);
    try {
      const zipBlob = await zipFiles(successFiles);
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `FileFlux_Files_${Date.now()}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 100);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to zip files');
    } finally {
      setIsZipping(false);
    }
  };

  const handleReset = () => {
    files.forEach(f => {
      if (f.convertedUrl) URL.revokeObjectURL(f.convertedUrl);
    });
    setFiles([]);
    setError(null);
    setUseOcrForPdf(false);
  };

  const handleResetFile = (id: string) => {
    setFiles(current => current.map(f => {
      if (f.id === id) {
        if (f.convertedUrl) URL.revokeObjectURL(f.convertedUrl);
        return {
          ...f,
          status: 'idle',
          convertedUrl: undefined,
          convertedName: undefined,
          _blob: undefined,
          showPreview: false,
          error: undefined
        };
      }
      return f;
    }));
  };

  const removeFile = (id: string) => {
    setFiles(prev => {
      const fileToRm = prev.find(f => f.id === id);
      if (fileToRm?.convertedUrl) {
        URL.revokeObjectURL(fileToRm.convertedUrl);
      }
      return prev.filter(f => f.id !== id);
    });
  };

  const updateFormat = (id: string, format: string) => {
    setFiles(prev => prev.map(f => f.id === id ? { ...f, targetFormat: format, status: 'idle', convertedUrl: undefined } : f));
  };
  
  const togglePreview = (id: string) => {
    setFiles(prev => prev.map(f => f.id === id ? { ...f, showPreview: !f.showPreview } : f));
  };

  const formatBytes = (bytes: number, decimals = 2) => {
    if (!+bytes) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
  };

  return (
    <div className="min-h-screen bg-[#070b19] text-indigo-50 font-sans selection:bg-cyan-500/40 flex flex-col relative overflow-hidden">
      
      {/* Anime Sky Background */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        {/* Base deep sky */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#091128] via-[#163365] to-[#147998]" />
        {/* Glow at horizon (Sunrise/Sunset) */}
        <div className="absolute bottom-0 w-full h-[50%] bg-gradient-to-t from-[#ff8c78]/40 via-[#ffba92]/10 to-transparent" />
        {/* Ocean body */}
        <div className="absolute bottom-0 w-full h-[25%] bg-gradient-to-b from-[#0e5170] to-[#041a29] border-t border-cyan-400/30" />
        
        {/* Atmospheric Clouds / Orbs */}
        <div className="absolute top-[10%] left-[20%] w-[50%] h-[30%] bg-cyan-400/20 blur-[120px] rounded-full mix-blend-screen" />
        <div className="absolute top-[30%] right-[10%] w-[40%] h-[40%] bg-indigo-500/30 blur-[130px] rounded-full mix-blend-screen" />
        <div className="absolute bottom-[20%] left-[-10%] w-[40%] h-[20%] bg-[#ff9a76]/20 blur-[100px] rounded-full mix-blend-screen" />
      </div>

      {/* Navbar */}
      <header className="bg-[#0f172a]/40 backdrop-blur-xl border-b border-white/10 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-cyan-400 to-indigo-500 p-2 rounded-xl shadow-[0_0_15px_rgba(34,211,238,0.4)]">
              <Layers className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">
              FileFlux
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
              className="p-2 rounded-full border border-white/10 hover:bg-white/10 text-indigo-200 hover:text-white transition-colors mr-2 shadow-[0_4px_12px_rgba(0,0,0,0.2)]"
              title={theme === 'dark' ? "Switch to Light Mode" : "Switch to Dark Mode"}
            >
              {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            <button 
              onClick={() => alert("FileFlux allows you to flexibly convert any file to dozens of formats. Just drag and drop, select your target output format, and hit convert! We use a combination of web assembly native processing and serverless processing.")}
              className="text-sm flex items-center gap-2 font-bold text-indigo-100 hover:text-white transition-colors bg-white/5 hover:bg-white/10 px-4 py-2 rounded-full border border-white/10 shadow-[0_4px_12px_rgba(0,0,0,0.2)]"
            >
              <HelpCircle className="w-4 h-4" />
              What is FileFlux?
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12 flex flex-col lg:flex-row gap-8 relative z-10">
        
        {/* Sidebar Categories */}
        <aside className="w-full lg:w-72 shrink-0">
          <div className="sticky top-24 space-y-6">
            <div className="bg-[#0f172a]/40 backdrop-blur-xl border border-white/10 rounded-[2rem] p-4 shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
              <h2 className="text-xs font-bold text-indigo-300/80 uppercase tracking-wider mb-4 px-3">Conversion Types</h2>
              <div className="space-y-2">
                {CATEGORIES.map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => { setActiveCategory(cat.id); handleReset(); }}
                    className={cn(
                      "w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-left transition-all duration-300",
                      activeCategory === cat.id 
                        ? "bg-white/10 shadow-[0_4px_20px_rgba(0,0,0,0.2)] border border-white/20 scale-[1.02]" 
                        : "hover:bg-white/5 text-indigo-200 border border-transparent"
                    )}
                  >
                    <div className={cn("p-2.5 rounded-xl transition-colors shadow-inner", activeCategory === cat.id ? cat.bg : "bg-white/5")}>
                      <cat.icon className={cn("w-5 h-5", activeCategory === cat.id ? cat.color : "text-indigo-400")} />
                    </div>
                    <div>
                      <div className={cn("font-bold text-sm", activeCategory === cat.id ? "text-white" : "text-indigo-100")}>{cat.label}</div>
                      <div className="text-xs font-medium text-indigo-300/70 mt-0.5">{cat.description}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <div className="flex-1 min-w-0">
          <div className="bg-[#0f172a]/50 backdrop-blur-2xl rounded-[2.5rem] shadow-[0_8px_32px_rgba(0,0,0,0.5)] border border-white/10 overflow-hidden min-h-[600px] flex flex-col relative">
            
            <div className="relative flex-1 p-6 md:p-10 flex flex-col">
              <ErrorBoundary>
                <AnimatePresence mode="wait">
                {files.length === 0 ? (
                  <motion.div
                    key="upload"
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    transition={{ duration: 0.2 }}
                    className="flex-1 flex flex-col relative"
                  >
                          <div
                            {...getRootProps()}
                            className={cn(
                              "relative flex-1 border-2 border-dashed rounded-[2rem] p-8 md:p-12 text-center cursor-pointer transition-all duration-500 ease-out flex flex-col items-center justify-center min-h-[400px] shadow-[inset_0_2px_20px_rgba(0,0,0,0.3)] overflow-hidden group",
                              isDragReject ? "border-red-400 bg-red-900/20 scale-[0.98]" :
                              isDragAccept ? "border-cyan-400 bg-cyan-900/30 scale-[0.98]" :
                              isDragActive 
                                ? `${activeCatData.border} ${activeCatData.bg} scale-[0.98] border-opacity-100` 
                                : "border-white/20 bg-white/5 hover:bg-white/10 hover:border-white/40 hover:shadow-[inset_0_2px_30px_rgba(255,255,255,0.05)]"
                            )}
                          >
                            <input {...getInputProps()} />
                            
                            {/* Animated Background Ring when Active */}
                            <AnimatePresence>
                              {isDragActive && !isDragReject && (
                                <motion.div 
                                  initial={{ opacity: 0, scale: 0.5 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                  exit={{ opacity: 0, scale: 0.5 }}
                                  transition={{ duration: 0.5 }}
                                  className="absolute inset-0 flex items-center justify-center z-0 pointer-events-none"
                                >
                                  <motion.div 
                                     className="w-[300px] h-[300px] sm:w-[400px] sm:h-[400px] rounded-full border border-cyan-500/30 bg-cyan-500/5 blur-xl"
                                     animate={{ scale: [1, 1.4], opacity: [0.8, 0] }}
                                     transition={{ duration: 1.5, repeat: Infinity, ease: "easeOut" }}
                                  />
                                  <motion.div 
                                     className="absolute w-[200px] h-[200px] sm:w-[300px] sm:h-[300px] rounded-full border border-cyan-400/40 bg-cyan-400/5 blur-lg"
                                     animate={{ scale: [1, 1.4], opacity: [0.8, 0] }}
                                     transition={{ duration: 1.5, repeat: Infinity, ease: "easeOut", delay: 0.3 }}
                                  />
                                </motion.div>
                              )}
                            </AnimatePresence>

                            <div className="relative z-10 flex flex-col items-center">
                              <motion.div 
                                animate={isDragActive ? { scale: [1, 1.15, 1], rotate: [0, -5, 5, 0] } : { y: [0, -6, 0] }}
                                transition={isDragActive ? { duration: 0.8, repeat: Infinity } : { duration: 4, repeat: Infinity, ease: "easeInOut" }}
                                className={cn(
                                "w-28 h-28 sm:w-32 sm:h-32 mb-6 rounded-[2rem] flex items-center justify-center shadow-[0_15px_40px_rgba(0,0,0,0.4)] border border-white/20 backdrop-blur-xl relative transition-colors duration-300", 
                                isDragAccept ? "bg-cyan-500/40 border-cyan-400/60 shadow-[0_0_50px_rgba(34,211,238,0.3)]" :
                                isDragReject ? "bg-red-500/40 border-red-400/60 shadow-[0_0_50px_rgba(248,113,113,0.3)]" :
                                "bg-[#1e293b]/80 group-hover:bg-[#1e293b]"
                              )}>
                                {isDragActive && !isDragReject && (
                                  <motion.div className="absolute inset-0 rounded-[2rem] bg-cyan-400/20 blur-xl" animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 1.5, repeat: Infinity }} />
                                )}
                                {isDragReject ? (
                                  <AlertCircle className="w-14 h-14 sm:w-16 sm:h-16 text-red-400 drop-shadow-[0_0_12px_rgba(248,113,113,0.8)] relative z-10" />
                                ) : isDragAccept ? (
                                  <CheckCircle2 className="w-14 h-14 sm:w-16 sm:h-16 text-cyan-400 drop-shadow-[0_0_12px_rgba(34,211,238,0.8)] relative z-10" />
                                ) : (
                                  <activeCatData.icon className={cn("w-14 h-14 sm:w-16 sm:h-16 relative z-10 transition-transform duration-300 group-hover:scale-110", activeCatData.color, "drop-shadow-[0_2px_12px_rgba(0,0,0,0.6)]")} />
                                )}
                              </motion.div>
                              <h3 className={cn(
                                "text-3xl sm:text-4xl font-bold mb-4 transition-colors duration-300 drop-shadow-md tracking-tight",
                                isDragReject ? "text-red-400" :
                                isDragAccept ? "text-cyan-400" :
                                "text-white"
                              )}>
                                {isDragReject ? "File type not supported!" : 
                                 isDragAccept ? "Drop to upload!" : 
                                 isDragActive ? "Drop it like it's hot!" : 
                                 `Upload ${activeCatData.label}`}
                              </h3>
                              <p className={cn(
                                "font-medium max-w-sm mx-auto mb-10 transition-colors duration-300 text-lg drop-shadow-sm",
                                isDragReject ? "text-red-300" :
                                isDragAccept ? "text-cyan-300" :
                                "text-indigo-200"
                              )}>
                                {isDragReject ? `Please select a valid file for ${activeCatData.label} mode.` :
                                 isDragAccept ? "Release to start conversion." :
                                 "Drag and drop your files here, or click to browse from your computer."}
                              </p>
                              
                              {/* Format pills */}
                              <div className="flex flex-wrap justify-center gap-2.5">
                                {getFormatPills(activeCategory).map(fmt => (
                                  <span key={fmt} className="px-5 py-2 bg-black/40 backdrop-blur-md border border-white/10 rounded-xl text-sm font-bold text-indigo-100 shadow-[0_4px_12px_rgba(0,0,0,0.5)]">
                                    {fmt}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="config"
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex-1 flex flex-col"
                  >
                          <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-white drop-shadow-md flex items-center">
                              <Layers className="w-6 h-6 mr-3 text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.5)]" />
                              Your Files ({files.length})
                            </h3>
                            <div className="flex gap-3">
                              <div {...getRootProps()} className="cursor-pointer">
                                <input {...getInputProps()} />
                                <button className="px-5 py-3 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl text-sm font-bold text-white shadow-lg transition-all flex items-center gap-2">
                                  <Plus className="w-4 h-4" /> Add Files
                                </button>
                              </div>
                              <button onClick={handleReset} className="px-5 py-3 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-300 rounded-xl text-sm font-bold shadow-lg transition-all flex items-center gap-2">
                                Clear All
                              </button>
                            </div>
                          </div>
                          
                          <div className="space-y-4 mb-8 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
                            <AnimatePresence>
                              {files.map(fileItem => {
                                const getCategoryExtensions = (catId: string) => {
                                  switch (catId) {
                                    case 'images': return ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'gif', 'svg', 'ico'];
                                    case 'documents': return ['pdf', 'docx', 'txt', 'txt (OCR)', 'md', 'html'];
                                    case 'data': return ['json', 'csv', 'xlsx', 'xml', 'yaml', 'yml'];
                                    default: return [];
                                  }
                                };
                                const ext = getExtension(fileItem.file.name);
                                const allAvailable = SUPPORTED_FORMATS[ext] || [];
                                const available = activeCategory === 'universal'
                                  ? allAvailable
                                  : allAvailable.filter(fmt => getCategoryExtensions(activeCategory).includes(fmt));
                                
                                return (
                                  <motion.div
                                    layout="position"
                                    variants={{
                                      hidden: { opacity: 0, y: 20 },
                                      visible: { opacity: 1, y: 0 }
                                    }}
                                    initial="hidden"
                                    animate="visible"
                                    exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.15 } }}
                                    transition={{ type: "tween", duration: 0.3, ease: "easeOut" }}
                                    key={fileItem.id}
                                    className={cn(
                                      "relative backdrop-blur-xl rounded-2xl border overflow-hidden transition-all duration-500",
                                      fileItem.status === 'converting' ? "bg-[#1e293b]/80 border-cyan-400/50 shadow-[0_0_20px_rgba(34,211,238,0.15)]" :
                                      fileItem.status === 'success' ? "bg-[#0f1b33]/60 border-emerald-500/30 shadow-[0_8px_20px_rgba(0,0,0,0.3)]" :
                                      fileItem.status === 'error' ? "bg-red-950/20 border-red-500/30 shadow-[0_8px_20px_rgba(0,0,0,0.3)]" :
                                      "bg-[#1e293b]/60 border-white/10 shadow-[0_8px_20px_rgba(0,0,0,0.3)]"
                                    )}
                                  >
                                    {/* Sweeping progress gradient for converting items */}
                                    {fileItem.status === 'converting' && (
                                      <motion.div
                                        className="absolute inset-0 bg-gradient-to-r from-transparent via-cyan-400/10 to-transparent skew-x-[-20deg]"
                                        initial={{ x: '-150%' }}
                                        animate={{ x: '150%' }}
                                        transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
                                      />
                                    )}
                                    {/* Success Glow effect */}
                                    {fileItem.status === 'success' && (
                                       <motion.div
                                        className="absolute inset-0 bg-emerald-400/10"
                                        initial={{ opacity: 1 }}
                                        animate={{ opacity: 0 }}
                                        transition={{ duration: 1 }}
                                       />
                                    )}
                                    
                                    <div className="flex flex-col sm:flex-row items-center p-5 gap-4 relative z-10">
                                      <motion.div 
                                        animate={fileItem.status === 'converting' ? { scale: [1, 1.05, 1] } : {}}
                                        transition={{ duration: 1, repeat: Infinity }}
                                        className={cn("w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)] border border-white/10", activeCatData.bg)}
                                      >
                                         <File className={cn("w-7 h-7 drop-shadow-md", activeCatData.color)} />
                                      </motion.div>
                                      
                                      <div className="flex-1 min-w-0 w-full">
                                        <p className="text-base font-bold text-indigo-50 truncate drop-shadow-sm">
                                          {fileItem.file.name}
                                        </p>
                                        <div className="flex flex-wrap items-center gap-3 mt-1 text-sm">
                                          <span className="font-medium text-indigo-300/80">
                                            {formatBytes(fileItem.file.size)} • {ext.toUpperCase()}
                                          </span>
                                          {fileItem.status === 'converting' && (
                                            <span className="flex items-center text-cyan-400 font-bold text-xs"><RefreshCw className="w-3 h-3 mr-1 animate-spin" /> Converting</span>
                                          )}
                                          {fileItem.status === 'success' && (
                                            <span className="flex items-center text-emerald-400 font-bold text-xs"><CheckCircle2 className="w-3 h-3 mr-1 drop-shadow-[0_0_5px_rgba(52,211,153,0.5)]" /> Success</span>
                                          )}
                                          {fileItem.status === 'error' && (
                                            <span className="flex items-center text-red-400 font-bold text-xs truncate max-w-[200px]"><AlertCircle className="w-3 h-3 mr-1" /> {fileItem.error}</span>
                                          )}
                                        </div>
                                      </div>
                                      
                                      <div className="flex items-center gap-3 w-full sm:w-auto mt-4 sm:mt-0 justify-end">
                                        {fileItem.status === 'idle' || fileItem.status === 'error' ? (
                                          <div className="flex items-center gap-3 bg-black/40 p-1.5 rounded-xl border border-white/10 shadow-inner">
                                            <span className="text-xs font-bold text-indigo-400 uppercase px-2 drop-shadow-sm">To</span>
                                            <select
                                              value={fileItem.targetFormat}
                                              onChange={(e) => updateFormat(fileItem.id, e.target.value)}
                                              className="bg-transparent font-bold text-white focus:outline-none cursor-pointer text-sm [&>option]:bg-slate-800"
                                            >
                                              {available.map(fmt => (
                                                <option key={fmt} value={fmt}>{fmt.toUpperCase()}</option>
                                              ))}
                                            </select>
                                          </div>
                                        ) : fileItem.status === 'success' && fileItem.convertedUrl ? (
                                          <div className="flex gap-2">
                                            <button
                                              onClick={() => handleResetFile(fileItem.id)}
                                              className="p-2.5 bg-white/10 hover:bg-white/20 text-indigo-200 border-white/10 rounded-xl font-bold transition-all shadow-lg border"
                                              title="Reconvert back to original file"
                                            >
                                              <RotateCcw className="w-5 h-5 pointer-events-none" />
                                            </button>
                                            <button
                                              onClick={() => togglePreview(fileItem.id)}
                                              className={cn("p-2.5 rounded-xl font-bold transition-all shadow-lg border", fileItem.showPreview ? "bg-cyan-500/20 text-cyan-300 border-cyan-400/50" : "bg-white/10 hover:bg-white/20 text-indigo-200 border-white/10")}
                                              title="Preview the extracted file contents"
                                            >
                                              <Eye className="w-5 h-5 pointer-events-none" />
                                            </button>
                                            <a
                                              href={fileItem.convertedUrl}
                                              download={fileItem.convertedName}
                                              className="p-2.5 bg-gradient-to-r from-cyan-500 to-indigo-500 hover:from-cyan-400 hover:to-indigo-400 text-white rounded-xl font-bold transition-all shadow-[0_4px_15px_rgba(34,211,238,0.3)] hover:-translate-y-0.5 border border-white/20"
                                              title="Download the converted file"
                                            >
                                              <Download className="w-5 h-5 pointer-events-none" />
                                            </a>
                                          </div>
                                        ) : null}
                                        
                                        <button
                                          onClick={() => removeFile(fileItem.id)}
                                          className="p-2.5 text-indigo-400/50 hover:text-red-400 hover:bg-white/10 rounded-xl transition-all"
                                          disabled={isConvertingAny}
                                          title="Remove this file from the list"
                                        >
                                          <X className="w-5 h-5 pointer-events-none" />
                                        </button>
                                      </div>
                                    </div>
                                    
                                    <AnimatePresence>
                                      {fileItem.showPreview && fileItem.convertedUrl && fileItem.status === 'success' && (
                                        <motion.div
                                          initial={{ height: 0, opacity: 0 }}
                                          animate={{ height: 'auto', opacity: 1 }}
                                          exit={{ height: 0, opacity: 0 }}
                                          transition={{ duration: 0.3, ease: 'easeInOut' }}
                                          className="border-t border-white/10 bg-black/30 p-6 overflow-hidden"
                                        >
                                          <div className="mb-4 flex items-center justify-between">
                                            <h4 className="text-sm font-bold text-indigo-200 drop-shadow-sm">Preview: {fileItem.convertedName}</h4>
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
                          
                          {/* Needs OCR Option */}
                          {files.some(f => getExtension(f.file.name) === 'pdf' && (f.targetFormat === 'docx' || f.targetFormat === 'txt') && (f.status === 'idle' || f.status === 'error')) && (activeCategory === 'documents' || activeCategory === 'universal') && (
                            <div className="mb-8 flex items-start gap-4 p-5 bg-[#1e293b]/60 rounded-2xl border border-white/10 shadow-[0_4px_15px_rgba(0,0,0,0.3)]">
                              <div className="flex items-center h-6 mt-0.5">
                                <input
                                  type="checkbox"
                                  id="useOcr"
                                  checked={useOcrForPdf}
                                  onChange={(e) => setUseOcrForPdf(e.target.checked)}
                                  className="w-5 h-5 rounded border-white/20 text-cyan-500 focus:ring-cyan-500/50 bg-black/40 transition-colors cursor-pointer shadow-inner"
                                />
                              </div>
                              <label htmlFor="useOcr" className="text-sm text-indigo-200 cursor-pointer select-none">
                                <span className="font-bold text-white block mb-1 text-base drop-shadow-sm">Use OCR Text Extraction for PDF</span>
                                Slower, but significantly better for scanned PDFs or documents with complex layouts. Works for converting to DOCX and TXT.
                              </label>
                            </div>
                          )}

                          {/* Overall Progress Bar during conversion */}
                          <AnimatePresence>
                            {isConvertingAny && (
                              <motion.div
                                initial={{ opacity: 0, height: 0, overflow: 'hidden' }}
                                animate={{ opacity: 1, height: 'auto', overflow: 'visible' }}
                                exit={{ opacity: 0, height: 0, overflow: 'hidden' }}
                                transition={{ duration: 0.3 }}
                                className="mb-6"
                              >
                                <div className="bg-[#1e293b]/80 backdrop-blur-md rounded-2xl border border-cyan-500/30 p-5 shadow-[0_0_20px_rgba(34,211,238,0.1)] relative overflow-hidden">
                                  {/* Dynamic Background Pulse */}
                                  <motion.div 
                                    className="absolute inset-0 bg-gradient-to-r from-cyan-500/10 to-indigo-500/10"
                                    animate={{ opacity: [0.3, 0.8, 0.3] }}
                                    transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                                  />
                                  <div className="relative z-10 flex justify-between items-center mb-3">
                                    <div className="flex items-center gap-3 text-cyan-400">
                                      <RefreshCw className="w-5 h-5 animate-spin drop-shadow-[0_0_8px_rgba(34,211,238,0.8)]" />
                                      <span className="font-bold tracking-tight text-white drop-shadow-sm">Converting Files...</span>
                                    </div>
                                    <div className="text-sm font-bold text-cyan-200 bg-cyan-900/40 px-3 py-1 rounded-full border border-cyan-400/20">
                                      {files.filter(f => f.status === 'success' || f.status === 'error').length} / {files.length}
                                    </div>
                                  </div>
                                  <div className="relative z-10 h-3 w-full bg-black/40 rounded-full overflow-hidden border border-white/5 shadow-[inset_0_2px_4px_rgba(0,0,0,0.6)]">
                                    <motion.div 
                                      className="absolute inset-y-0 left-0 bg-gradient-to-r from-cyan-500 to-indigo-500 rounded-full shadow-[0_0_10px_rgba(34,211,238,0.7)]"
                                      initial={{ width: '0%' }}
                                      animate={{ width: `${Math.max(5, (files.filter(f => f.status === 'success' || f.status === 'error').length / files.length) * 100)}%` }}
                                      transition={{ type: 'spring', stiffness: 60, damping: 15 }}
                                    >
                                      <motion.div
                                        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent skew-x-[-20deg]"
                                        initial={{ x: '-150%' }}
                                        animate={{ x: '150%' }}
                                        transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
                                      />
                                    </motion.div>
                                  </div>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>

                          {/* Action Buttons */}
                          <div className="mt-auto">
                            {!files.every(f => f.status === 'success') && (
                              <button
                                onClick={handleConvert}
                                disabled={isConvertingAny || files.every(f => f.status === 'success' || f.status === 'converting')}
                                className={cn(
                                  "w-full py-4 px-6 rounded-2xl font-bold text-white flex items-center justify-center transition-all duration-300 shadow-xl",
                                  isConvertingAny || files.every(f => f.status === 'success' || f.status === 'converting')
                                    ? "bg-slate-700/50 shadow-none cursor-not-allowed text-slate-300 backdrop-blur-md border border-white/5"
                                    : "bg-gradient-to-r from-cyan-500 to-indigo-500 hover:from-cyan-400 hover:to-indigo-400 hover:-translate-y-1 shadow-[0_8px_25px_rgba(34,211,238,0.4)] border border-white/20"
                                )}
                              >
                                {isConvertingAny ? (
                                  <>
                                    <RefreshCw className="w-6 h-6 mr-3 animate-spin drop-shadow-md" />
                                    Converting Batch...
                                  </>
                                ) : (
                                  <>
                                    <Sparkles className="w-6 h-6 mr-2 drop-shadow-md" />
                                    Convert {files.filter(f => f.status === 'idle' || f.status === 'error').length} Files
                                  </>
                                )}
                              </button>
                            )}
                            
                            {files.every(f => f.status === 'success') && files.length > 0 && (
                              <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center">
                                <div className="p-5 bg-emerald-500/20 backdrop-blur-xl border border-emerald-400/40 rounded-2xl flex items-center text-emerald-100 shadow-[0_8px_30px_rgba(16,185,129,0.3)] flex-1">
                                  <div className="w-12 h-12 rounded-xl bg-emerald-400/30 flex items-center justify-center mr-4 shrink-0 border border-emerald-300/50">
                                    <CheckCircle2 className="w-7 h-7 text-emerald-300 drop-shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                                  </div>
                                  <div>
                                    <p className="font-bold text-lg text-emerald-50 drop-shadow-md">Batch Conversion Successful!</p>
                                    <p className="text-sm font-medium text-emerald-200 mt-0.5">You can download files individually above.</p>
                                  </div>
                                </div>
                                <button
                                  onClick={handleDownloadAll}
                                  disabled={isZipping}
                                  className="p-5 bg-gradient-to-r from-cyan-500 to-indigo-500 hover:from-cyan-400 hover:to-indigo-400 text-white rounded-2xl font-bold transition-all shadow-[0_8px_25px_rgba(34,211,238,0.4)] flex items-center justify-center hover:-translate-y-1 border border-white/20 whitespace-nowrap"
                                >
                                  {isZipping ? (
                                    <>
                                      <RefreshCw className="w-6 h-6 mr-3 animate-spin drop-shadow-md" />
                                      Zipping...
                                    </>
                                  ) : (
                                    <>
                                      <Download className="w-6 h-6 mr-3 drop-shadow-md" />
                                      Download All (.zip)
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
          </div>



        </div>
      </main>
    </div>
  );
}
