import Papa from 'papaparse';
import { marked } from 'marked';
import mammoth from 'mammoth';
import { jsPDF } from 'jspdf';
import { renderAsync } from 'docx-preview';
import html2canvas from 'html2canvas';
import { AlignmentType, Document, Packer, Paragraph, Table, TableCell, TableRow, TextRun, TabStopType, WidthType } from 'docx';
import yaml from 'js-yaml';
import { json2xml, xml2json } from 'xml-js';
import JSZip from 'jszip';

// Dynamic import for pdfjs
async function getPdfjs() {
  const pdfjsLib = await import('pdfjs-dist');
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
  return pdfjsLib;
}

export const SUPPORTED_FORMATS: Record<string, string[]> = {
  // Images
  png: ['jpg', 'jpeg', 'webp', 'bmp', 'pdf', 'txt (OCR)', 'ico', 'gif'],
  jpg: ['png', 'jpeg', 'webp', 'bmp', 'pdf', 'txt (OCR)', 'ico', 'gif'],
  jpeg: ['png', 'jpg', 'webp', 'bmp', 'pdf', 'txt (OCR)', 'ico', 'gif'],
  webp: ['png', 'jpg', 'jpeg', 'bmp', 'pdf', 'txt (OCR)', 'ico', 'gif'],
  bmp: ['png', 'jpg', 'jpeg', 'webp', 'pdf', 'txt (OCR)', 'ico', 'gif'],
  gif: ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'pdf', 'ico'],
  svg: ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'pdf', 'ico', 'gif'],
  ico: ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'pdf', 'gif'],
  
  // Data
  json: ['csv', 'txt', 'xlsx', 'xml', 'yaml', 'docx'],
  csv: ['json', 'txt', 'xlsx', 'xml', 'yaml', 'docx'],
  xlsx: ['csv', 'json', 'xml', 'yaml', 'txt'],
  xml: ['json', 'csv', 'yaml', 'txt', 'xlsx', 'docx'],
  yaml: ['json', 'csv', 'xml', 'txt', 'xlsx', 'docx'],
  
  // Text & Documents
  md: ['html', 'txt', 'pdf', 'docx'],
  txt: ['json', 'csv', 'md', 'pdf', 'html', 'xml', 'yaml', 'docx'],
  html: ['txt', 'md', 'pdf', 'docx'],
  docx: ['txt', 'html', 'pdf', 'md'],
  pdf: ['txt', 'txt (OCR)', 'docx'],
};

export type ConversionMode = 'local' | 'high-fidelity';

export function getExtension(filename: string): string {
  const parts = filename.split('.');
  return parts.length > 1 ? parts.pop()?.toLowerCase() || '' : '';
}

export function getBaseName(filename: string): string {
  const parts = filename.split('.');
  if (parts.length > 1) parts.pop();
  return parts.join('.');
}

export function requiresHighFidelityServer(file: File, toExt: string) {
  return getExtension(file.name) === 'pdf' && toExt === 'docx';
}

const TWIPS_PER_POINT = 20;

type PdfWordItem = {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  fontName?: string;
};

type PdfLineSegment = {
  text: string;
  x: number;
  width: number;
  fontSize: number;
  isBold: boolean;
  isItalic: boolean;
};

type PdfLineLayout = {
  baselineY: number;
  maxHeight: number;
  segments: PdfLineSegment[];
  leftX: number;
  rightX: number;
};

type DocxPageChild = Paragraph | Table;

function clampNumber(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function toTwipsFromViewport(value: number, viewportWidth: number, pageWidthTwips: number) {
  if (!Number.isFinite(value) || viewportWidth <= 0 || pageWidthTwips <= 0) return 0;
  return Math.round(value * (pageWidthTwips / viewportWidth));
}

function getNumericValue(value: unknown, fallback = 0) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function getPdfWordItems(textItems: any[]) {
  const items: PdfWordItem[] = [];

  for (const item of textItems) {
    const rawText = typeof item?.str === 'string' ? item.str : '';
    if (!rawText || (!rawText.trim() && rawText !== ' ')) continue;

    const transform = Array.isArray(item?.transform) ? item.transform : [];
    const x = getNumericValue(transform[4], 0);
    const y = getNumericValue(transform[5], 0);
    const width = Math.max(0, getNumericValue(item?.width, 0));
    const height = Math.max(
      getNumericValue(item?.height, 0),
      Math.abs(getNumericValue(transform[0], 0)),
      Math.abs(getNumericValue(transform[3], 0)),
      1,
    );

    items.push({
      text: rawText.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, ''),
      x,
      y,
      width,
      height,
      fontSize: clampNumber(height * 0.75, 8, 42),
      fontName: typeof item?.fontName === 'string' ? item.fontName : undefined,
    });
  }

  return items;
}

function buildPdfLineLayouts(items: PdfWordItem[]) {
  if (items.length === 0) return [];

  const avgHeight = items.reduce((sum, item) => sum + item.height, 0) / items.length;
  const tolerance = clampNumber(avgHeight * 0.35, 2, 8);
  const lines: Array<{ baselineY: number; items: PdfWordItem[] }> = [];

  for (const item of items) {
    let targetLine = lines.find((line) => Math.abs(line.baselineY - item.y) <= tolerance);
    if (!targetLine) {
      targetLine = { baselineY: item.y, items: [] };
      lines.push(targetLine);
    }
    targetLine.items.push(item);
  }

  return lines
    .sort((a, b) => b.baselineY - a.baselineY)
    .map((line) => {
      const sortedItems = [...line.items].sort((a, b) => a.x - b.x);
      const segments: PdfLineSegment[] = [];

      let currentSegment: PdfLineSegment | null = null;

      for (const item of sortedItems) {
        const itemIsBold = item.fontName ? /bold|black|semibold|demibold/i.test(item.fontName) : false;
        const itemIsItalic = item.fontName ? /italic|oblique/i.test(item.fontName) : false;

        if (!currentSegment) {
          currentSegment = {
            text: item.text,
            x: item.x,
            width: Math.max(item.width, item.text.length * item.fontSize * 0.45),
            fontSize: item.fontSize,
            isBold: itemIsBold,
            isItalic: itemIsItalic,
          };
          continue;
        }

        const currentRight = currentSegment.x + currentSegment.width;
        const gap = item.x - currentRight;
        const noSpaceThreshold = Math.max(currentSegment.fontSize * 0.18, 1.2);
        const softSpaceThreshold = Math.max(currentSegment.fontSize * 0.9, 3.2);
        const compatibleStyle =
          currentSegment.isBold === itemIsBold &&
          currentSegment.isItalic === itemIsItalic &&
          Math.abs(currentSegment.fontSize - item.fontSize) <= 1.5;

        if (compatibleStyle && gap <= noSpaceThreshold) {
          currentSegment.text += item.text;
          currentSegment.width = Math.max(item.x + item.width - currentSegment.x, currentSegment.width);
          continue;
        }

        if (compatibleStyle && gap <= softSpaceThreshold) {
          if (!currentSegment.text.endsWith(' ') && !item.text.startsWith(' ')) {
            currentSegment.text += ' ';
          }
          currentSegment.text += item.text;
          currentSegment.width = Math.max(item.x + item.width - currentSegment.x, currentSegment.width);
          continue;
        }

        segments.push(currentSegment);
        currentSegment = {
          text: item.text,
          x: item.x,
          width: Math.max(item.width, item.text.length * item.fontSize * 0.45),
          fontSize: item.fontSize,
          isBold: itemIsBold,
          isItalic: itemIsItalic,
        };
      }

      if (currentSegment) {
        segments.push(currentSegment);
      }

      const leftX = segments[0]?.x ?? 0;
      const rightX = segments[segments.length - 1] ? segments[segments.length - 1].x + segments[segments.length - 1].width : leftX;

      return {
        baselineY: line.baselineY,
        maxHeight: sortedItems.reduce((max, item) => Math.max(max, item.height), 0),
        segments,
        leftX,
        rightX,
      } satisfies PdfLineLayout;
    });
}

function getParagraphAlignment(line: PdfLineLayout, viewportWidth: number) {
  const lineWidth = line.rightX - line.leftX;
  const leftMargin = line.leftX;
  const rightMargin = Math.max(0, viewportWidth - line.rightX);

  if (line.segments.length <= 1 && lineWidth < viewportWidth * 0.7) {
    if (Math.abs(leftMargin - rightMargin) <= viewportWidth * 0.08) {
      return AlignmentType.CENTER;
    }

    if (rightMargin <= viewportWidth * 0.08 && leftMargin >= viewportWidth * 0.2) {
      return AlignmentType.RIGHT;
    }
  }

  return AlignmentType.LEFT;
}

function buildParagraphFromPdfLine(line: PdfLineLayout, viewportWidth: number, pageWidthTwips: number, previousLine?: PdfLineLayout | null) {
  let previousBaselineY: number | null = null;
  let previousHeight = 0;
  if (previousLine) {
    previousBaselineY = previousLine.baselineY;
    previousHeight = previousLine.maxHeight;
  }

  const runs: TextRun[] = [];
  const tabStops: { type: typeof TabStopType.LEFT; position: number }[] = [];
  let currentRightX = line.leftX;

  for (let index = 0; index < line.segments.length; index++) {
    const segment = line.segments[index];
    const size = clampNumber(Math.round(segment.fontSize * 2), 16, 96);

    if (index > 0) {
      const gap = segment.x - currentRightX;
      if (gap > segment.fontSize * 1.2) {
        const tabPosition = clampNumber(toTwipsFromViewport(segment.x, viewportWidth, pageWidthTwips), 0, pageWidthTwips);
        tabStops.push({ type: TabStopType.LEFT, position: tabPosition });
        runs.push(
          new TextRun({
            text: `\t${segment.text}`,
            size,
            bold: segment.isBold,
            italics: segment.isItalic,
          }),
        );
      } else {
        runs.push(
          new TextRun({
            text: ` ${segment.text}`.replace(/^  +/, ' '),
            size,
            bold: segment.isBold,
            italics: segment.isItalic,
          }),
        );
      }
    } else {
      runs.push(
        new TextRun({
          text: segment.text,
          size,
          bold: segment.isBold,
          italics: segment.isItalic,
        }),
      );
    }

    currentRightX = segment.x + segment.width;
  }

  const spacingBeforeUnits =
    previousBaselineY === null
      ? 0
      : Math.max(0, previousBaselineY - line.baselineY - Math.max(previousHeight, line.maxHeight) * 0.9);

  return new Paragraph({
    children: runs.length > 0 ? runs : [new TextRun('')],
    alignment: getParagraphAlignment(line, viewportWidth),
    indent: {
      left: clampNumber(toTwipsFromViewport(line.leftX, viewportWidth, pageWidthTwips), 0, pageWidthTwips),
    },
    spacing: {
      before: clampNumber(toTwipsFromViewport(spacingBeforeUnits, viewportWidth, pageWidthTwips), 0, 2400),
      line: clampNumber(toTwipsFromViewport(line.maxHeight * 1.15, viewportWidth, pageWidthTwips), 240, 1200),
    },
    tabStops: tabStops.length > 0 ? tabStops : undefined,
  });
}

function isPotentialTableLine(line: PdfLineLayout, viewportWidth: number) {
  if (line.segments.length < 2 || line.segments.length > 6) return false;

  let significantGapCount = 0;
  for (let i = 1; i < line.segments.length; i++) {
    const previous = line.segments[i - 1];
    const current = line.segments[i];
    const gap = current.x - (previous.x + previous.width);
    if (gap > Math.max(previous.fontSize * 2.6, viewportWidth * 0.035)) {
      significantGapCount += 1;
    }
  }

  return significantGapCount > 0 && line.rightX - line.leftX > viewportWidth * 0.28;
}

function areCompatibleTableRows(a: PdfLineLayout, b: PdfLineLayout) {
  if (a.segments.length !== b.segments.length) return false;

  let totalDrift = 0;
  for (let i = 0; i < a.segments.length; i++) {
    totalDrift += Math.abs(a.segments[i].x - b.segments[i].x);
  }

  return totalDrift / a.segments.length <= 18;
}

function buildTableFromPdfLines(lines: PdfLineLayout[], viewportWidth: number, pageWidthTwips: number) {
  const columnCount = Math.max(...lines.map((line) => line.segments.length));
  const columnStarts = Array.from({ length: columnCount }, (_, index) => {
    const values = lines
      .map((line) => line.segments[index]?.x)
      .filter((value): value is number => typeof value === 'number')
      .sort((a, b) => a - b);
    if (values.length === 0) return (index / columnCount) * viewportWidth;
    return values[Math.floor(values.length / 2)];
  });
  const boundaries = [0];

  for (let index = 1; index < columnStarts.length; index++) {
    boundaries.push((columnStarts[index - 1] + columnStarts[index]) / 2);
  }
  boundaries.push(viewportWidth);

  const rows = lines.map((line) => {
    const cells = Array.from({ length: columnCount }, (_, index) => {
      const segment = line.segments[index];
      const widthViewport = Math.max(24, boundaries[index + 1] - boundaries[index]);
      const widthTwips = clampNumber(toTwipsFromViewport(widthViewport, viewportWidth, pageWidthTwips), 360, pageWidthTwips);
      const paragraph = segment
        ? new Paragraph({
            children: [
              new TextRun({
                text: segment.text,
                size: clampNumber(Math.round(segment.fontSize * 2), 16, 96),
                bold: segment.isBold,
                italics: segment.isItalic,
              }),
            ],
            spacing: { line: 280 },
          })
        : new Paragraph('');

      return new TableCell({
        width: {
          size: widthTwips,
          type: WidthType.DXA,
        },
        children: [paragraph],
      });
    });

    return new TableRow({ children: cells });
  });

  return new Table({
    width: {
      size: pageWidthTwips,
      type: WidthType.DXA,
    },
    rows,
  });
}

function buildDocxBlocksFromPdfLines(lines: PdfLineLayout[], viewportWidth: number, pageWidthTwips: number) {
  const children: DocxPageChild[] = [];
  let index = 0;
  let previousParagraphLine: PdfLineLayout | null = null;

  while (index < lines.length) {
    const currentLine = lines[index];

    if (isPotentialTableLine(currentLine, viewportWidth)) {
      const candidateLines = [currentLine];
      let cursor = index + 1;

      while (cursor < lines.length) {
        const nextLine = lines[cursor];
        const previousLine = candidateLines[candidateLines.length - 1];
        const verticalGap = previousLine.baselineY - nextLine.baselineY;
        const maxAllowedGap = Math.max(previousLine.maxHeight, nextLine.maxHeight) * 2.4;

        if (!isPotentialTableLine(nextLine, viewportWidth) || !areCompatibleTableRows(previousLine, nextLine) || verticalGap > maxAllowedGap) {
          break;
        }

        candidateLines.push(nextLine);
        cursor += 1;
      }

      if (candidateLines.length >= 2) {
        children.push(buildTableFromPdfLines(candidateLines, viewportWidth, pageWidthTwips));
        previousParagraphLine = candidateLines[candidateLines.length - 1];
        index = cursor;
        continue;
      }
    }

    children.push(buildParagraphFromPdfLine(currentLine, viewportWidth, pageWidthTwips, previousParagraphLine));
    previousParagraphLine = currentLine;
    index += 1;
  }

  return children;
}

async function convertImage(file: File, toExt: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        URL.revokeObjectURL(url);
        return reject(new Error('Could not get canvas context'));
      }
      
      // Fill white background for transparent to jpeg conversions
      if (toExt === 'jpg' || toExt === 'jpeg' || toExt === 'bmp') {
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      
      ctx.drawImage(img, 0, 0);
      
      let mimeType = `image/${toExt}`;
      if (toExt === 'jpg') mimeType = 'image/jpeg';
      if (toExt === 'ico') mimeType = 'image/x-icon';
      
      canvas.toBlob((blob) => {
        URL.revokeObjectURL(url);
        if (blob) resolve(blob);
        else reject(new Error('Canvas to Blob failed'));
      }, mimeType, 0.9);
    };
    
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };
    
    img.src = url;
  });
}

async function convertDocxToPdf(file: File, onProgress?: (p: number) => void): Promise<Blob> {
  if (onProgress) onProgress(20);
  const container = document.createElement('div');
  container.style.position = 'absolute';
  container.style.left = '-9999px';
  container.style.top = '-9999px';
  container.style.width = '1000px'; // Give enough width for the wrapper
  document.body.appendChild(container);

  try {
    const arrayBuffer = await file.arrayBuffer();
    await renderAsync(arrayBuffer, container, container, {
      inWrapper: true,
      ignoreWidth: false,
      ignoreHeight: false,
      ignoreFonts: false,
      breakPages: true,
    });
    if (onProgress) onProgress(40);

    // docx-preview renders pages as <section class="docx"> inside the wrapper
    const pages = Array.from(container.querySelectorAll('.docx'));
    const elementsToRender = pages.length > 0 ? pages : [container];
    
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'pt',
      format: 'a4'
    });

    for (let i = 0; i < elementsToRender.length; i++) {
      if (i > 0) pdf.addPage();
      const page = elementsToRender[i] as HTMLElement;
      page.style.backgroundColor = 'white';
      
      const canvas = await html2canvas(page, { 
        scale: 5, 
        useCORS: true, 
        backgroundColor: '#ffffff',
        logging: false 
      });
      const imgData = canvas.toDataURL('image/png');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      // Center on page if height is suspiciously small
      let yOffset = 0;
      if (pdfHeight < pdf.internal.pageSize.getHeight() * 0.9) {
          yOffset = 20;
      }
      pdf.addImage(imgData, 'PNG', 0, yOffset, pdfWidth, pdfHeight, undefined, 'FAST');
      
      if (onProgress) {
        onProgress(40 + Math.floor((i / elementsToRender.length) * 50));
      }
    }

    if (onProgress) onProgress(90);
    return new Blob([pdf.output('blob')], { type: 'application/pdf' });
  } finally {
    document.body.removeChild(container);
  }
}

async function convertPdfToDocx(file: File, useOcr: boolean = false, onProgress?: (p: number) => void): Promise<Blob> {
  if (useOcr) {
    return convertPdfToDocxWithOcr(file, onProgress);
  }

  const arrayBuffer = await file.arrayBuffer();
  const pdfjsLib = await getPdfjs();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const sections: { properties: any; children: DocxPageChild[] }[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    if (onProgress) onProgress(10 + Math.floor((i / pdf.numPages) * 80));
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const viewport = page.getViewport({ scale: 1.0 });
    const [, , pdfWidth = viewport.width, pdfHeight = viewport.height] = page.view || [0, 0, viewport.width, viewport.height];
    const pageWidthTwips = Math.max(Math.round(pdfWidth * TWIPS_PER_POINT), 1);
    const pageHeightTwips = Math.max(Math.round(pdfHeight * TWIPS_PER_POINT), 1);
    const lineLayouts = buildPdfLineLayouts(getPdfWordItems(textContent.items as any[]));
    const children = buildDocxBlocksFromPdfLines(lineLayouts, viewport.width, pageWidthTwips);

    sections.push({
      properties: {
        page: {
          size: {
            width: pageWidthTwips,
            height: pageHeightTwips,
          },
          margin: {
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
          },
        },
      },
      children: children.length > 0 ? children : [new Paragraph({ children: [new TextRun('No text found')] })],
    });
  }

  const doc = new Document({
    sections,
  });

  return Packer.toBlob(doc);
}

let ocrScheduler: any = null;

async function getOcrScheduler() {
  if (!ocrScheduler) {
    const { createWorker, createScheduler } = await import('tesseract.js');
    ocrScheduler = createScheduler();
    const numWorkers = Math.min(4, navigator.hardwareConcurrency || 2);
    for (let i = 0; i < numWorkers; i++) {
      const worker = await createWorker('eng', 1, {
        logger: m => console.log(m)
      });
      await worker.setParameters({
        tessedit_pageseg_mode: 4 as any,
        preserve_interword_spaces: '1',
      });
      ocrScheduler.addWorker(worker);
    }
  }
  return ocrScheduler;
}

async function convertPdfToDocxWithOcr(file: File, onProgress?: (p: number) => void): Promise<Blob> {
  const arrayBuffer = await file.arrayBuffer();
  const pdfjsLib = await getPdfjs();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  
  const scheduler = await getOcrScheduler();
  const sections: { properties: any; children: DocxPageChild[] }[] = [];
  // Use Promise.all to process pages simultaneously
  const pagePromises = [];
  let completedPages = 0;

  for (let i = 1; i <= pdf.numPages; i++) {
    pagePromises.push((async () => {
      const page = await pdf.getPage(i);
      const scaleFactor = 4.5;
      const viewport = page.getViewport({ scale: scaleFactor }); // Increased for better OCR
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        completedPages++;
        if (onProgress) onProgress(10 + Math.floor((completedPages / pdf.numPages) * 80));
        return { i, data: null, scaleFactor: 1.0 };
      }
      
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      await page.render({ canvasContext: ctx, viewport, canvas: canvas as any }).promise;
      
      // OCR pre-processing tuned for scanned pages: grayscale, contrast boost, and soft thresholding.
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const pd = imageData.data;
      for (let p = 0; p < pd.length; p += 4) {
        const r = pd[p];
        const g = pd[p+1];
        const b = pd[p+2];
        let gray = 0.299 * r + 0.587 * g + 0.114 * b;
        gray = clampNumber((gray - 128) * 1.45 + 128, 0, 255);
        gray = gray > 168 ? 255 : gray < 120 ? 0 : gray;
        pd[p] = pd[p+1] = pd[p+2] = gray;
      }
      ctx.putImageData(imageData, 0, 0);

      const { data } = await scheduler.addJob('recognize', canvas);
      completedPages++;
      if (onProgress) onProgress(10 + Math.floor((completedPages / pdf.numPages) * 80));
      return { i, data, scaleFactor };
    })());
  }

  const pageResults = await Promise.all(pagePromises);
  // Sort them back by page index just in case they resolve out of order
  pageResults.sort((a, b) => a.i - b.i);

  for (const result of pageResults) {
    if (!result.data) continue;
    const page = await pdf.getPage(result.i);
    const viewport = page.getViewport({ scale: 1.0 });
    const [, , pdfWidth = viewport.width, pdfHeight = viewport.height] = page.view || [0, 0, viewport.width, viewport.height];
    const pageWidthTwips = Math.max(Math.round(pdfWidth * TWIPS_PER_POINT), 1);
    const pageHeightTwips = Math.max(Math.round(pdfHeight * TWIPS_PER_POINT), 1);

    const pageChildren: DocxPageChild[] = [];
    let lastY: number | null = null;
    const scaleFactor = result.scaleFactor;
    
    const lines = (result.data as any)?.lines || [];
    for (const line of lines) {
      const x0 = line.bbox.x0 / scaleFactor;
      const y0 = line.bbox.y0 / scaleFactor;
      const y1 = line.bbox.y1 / scaleFactor;
      const height = y1 - y0;
      
      let ptSize = height * 0.7;
      if (ptSize < 6) ptSize = 11;
      if (ptSize > 72) ptSize = 72;
      let size = Math.round(ptSize * 2);
      
      let indentLeft = Math.max(0, Math.min(Math.round(x0 * 20), 9000));
      
      let spacingBefore = 0;
      if (lastY !== null) {
        const deltaY = y0 - lastY;
        spacingBefore = Math.max(0, Math.min(Math.round((deltaY) * 18), 2000));
      } else {
        spacingBefore = Math.max(0, Math.min(Math.round(y0 * 20), 2000));
      }
      
      let currentParagraphRuns: TextRun[] = [];
      let tabStops: any[] = [];
      let currentX = x0;
      
      for (let j = 0; j < line.words.length; j++) {
        const word = line.words[j];
        const wordX = word.bbox.x0 / scaleFactor;
        const text = word.text;
        
        if (j > 0) {
          const gap = wordX - currentX;
          if (gap > (ptSize * 0.5)) {
            const tabPosition = Math.max(0, Math.min(Math.round(wordX * 20), 9000));
            tabStops.push({
              type: TabStopType.LEFT,
              position: tabPosition
            });
            currentParagraphRuns.push(new TextRun({ text: "\t" + text, size: size }));
          } else {
            currentParagraphRuns.push(new TextRun({ text: " " + text, size: size }));
          }
        } else {
          currentParagraphRuns.push(new TextRun({ text: text, size: size }));
        }
        
        currentX = word.bbox.x1 / scaleFactor;
      }
      
      pageChildren.push(new Paragraph({
        children: currentParagraphRuns,
        alignment: line.words.length === 1 && x0 > viewport.width * 0.55 ? AlignmentType.RIGHT : AlignmentType.LEFT,
        indent: { left: indentLeft },
        spacing: { before: spacingBefore },
        tabStops: tabStops.length > 0 ? tabStops : undefined,
      }));
      
      lastY = y0;
    }

    sections.push({
      properties: {
        page: {
          size: {
            width: pageWidthTwips,
            height: pageHeightTwips,
          },
          margin: {
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
          },
        },
      },
      children: pageChildren.length > 0 ? pageChildren : [new Paragraph({ children: [new TextRun('No text found')] })],
    });
  }
  
  // We don't terminate the scheduler so other batch conversions can reuse the worker pool

  const doc = new Document({
    sections,
  });

  return Packer.toBlob(doc);
}

async function performOcr(file: File, isPdf: boolean, onProgress?: (p: number) => void): Promise<Blob> {
  const scheduler = await getOcrScheduler();
  
  let text = '';
  
  if (isPdf) {
    const arrayBuffer = await file.arrayBuffer();
    const pdfjsLib = await getPdfjs();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    
    const pagePromises = [];
    let completedPages = 0;
    for (let i = 1; i <= pdf.numPages; i++) {
      pagePromises.push((async () => {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 3.0 });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = 'white';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          await page.render({ canvasContext: ctx, viewport, canvas: canvas as any }).promise;
          const imgData = canvas.toDataURL('image/png');
          const { data } = await scheduler.addJob('recognize', imgData);
          completedPages++;
          if (onProgress) onProgress(10 + Math.floor((completedPages / pdf.numPages) * 80));
          return { i, text: data?.text || '' };
        }
        completedPages++;
        if (onProgress) onProgress(10 + Math.floor((completedPages / pdf.numPages) * 80));
        return { i, text: '' };
      })());
    }
    
    const results = await Promise.all(pagePromises);
    results.sort((a, b) => a.i - b.i);
    for (const res of results) {
      if (res.text) text += res.text + '\n\n';
    }
  } else {
    if (onProgress) onProgress(30);
    const imgUrl = URL.createObjectURL(file);
    const { data } = await scheduler.addJob('recognize', imgUrl);
    text = data?.text || '';
    URL.revokeObjectURL(imgUrl);
    if (onProgress) onProgress(90);
  }
  
  return new Blob([text], { type: 'text/plain' });
}

async function extractPdfText(file: File, onProgress?: (p: number) => void): Promise<Blob> {
  const arrayBuffer = await file.arrayBuffer();
  const pdfjsLib = await getPdfjs();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let fullText = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    
    if (onProgress) onProgress(10 + Math.floor((i / pdf.numPages) * 80));
    const linesMap = new Map<number, any[]>();
    for (const item of textContent.items as any[]) {
      if (!item.str || (!item.str.trim() && item.str !== ' ')) continue;
      let y = item.transform && item.transform.length > 5 ? Number(item.transform[5]) : 0;
      if (!Number.isFinite(y)) y = 0;
      
      let foundY = y;
      for (const existingY of linesMap.keys()) {
        if (Math.abs(existingY - y) <= 4) {
          foundY = existingY;
          break;
        }
      }
      if (!linesMap.has(foundY)) linesMap.set(foundY, []);
      linesMap.get(foundY)!.push(item);
    }
    
    const sortedY = Array.from(linesMap.keys()).sort((a, b) => b - a);
    let pageText = '';
    
    for (const y of sortedY) {
      const lineItems = linesMap.get(y)!;
      lineItems.sort((a, b) => {
        let ax = a.transform && a.transform.length > 4 ? Number(a.transform[4]) : 0;
        let bx = b.transform && b.transform.length > 4 ? Number(b.transform[4]) : 0;
        return ax - bx;
      });
      
      pageText += lineItems.map(item => item.str).join(' ') + '\n';
    }
    
    fullText += pageText + '\n';
  }
  return new Blob([fullText], { type: 'text/plain' });
}

async function convertToPdf(file: File, fromExt: string): Promise<Blob> {
  if (fromExt === 'docx') {
    return convertDocxToPdf(file);
  }

  const pdf = new jsPDF();
  
  if (['png', 'jpg', 'jpeg', 'webp', 'bmp', 'gif'].includes(fromExt)) {
    const imgUrl = URL.createObjectURL(file);
    const img = new Image();
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = imgUrl;
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const ratio = Math.min(pageWidth / img.width, pageHeight / img.height);
    const width = img.width * ratio;
    const height = img.height * ratio;

    let format = fromExt.toUpperCase();
    if (format === 'JPG') format = 'JPEG';
    if (!['JPEG', 'PNG', 'WEBP'].includes(format)) format = 'JPEG';

    pdf.addImage(img, format, 0, 0, width, height);
    URL.revokeObjectURL(imgUrl);
  } else if (['txt', 'md'].includes(fromExt)) {
    const text = await file.text();
    const lines = pdf.splitTextToSize(text, pdf.internal.pageSize.getWidth() - 20);
    let y = 10;
    const pageHeight = pdf.internal.pageSize.getHeight();
    
    for (let i = 0; i < lines.length; i++) {
      if (y > pageHeight - 10) {
        pdf.addPage();
        y = 10;
      }
      pdf.text(lines[i], 10, y);
      y += 7;
    }
  } else {
    throw new Error(`Cannot convert ${fromExt} to PDF yet.`);
  }

  return new Blob([pdf.output('blob')], { type: 'application/pdf' });
}

async function convertDocx(file: File, toExt: string): Promise<Blob> {
  const arrayBuffer = await file.arrayBuffer();
  if (toExt === 'txt') {
    const result = await mammoth.extractRawText({ arrayBuffer });
    return new Blob([result.value], { type: 'text/plain' });
  } else if (toExt === 'html') {
    const result = await mammoth.convertToHtml({ arrayBuffer });
    return new Blob([result.value], { type: 'text/html' });
  }
  throw new Error(`Unsupported docx conversion to ${toExt}`);
}

async function convertSpreadsheet(file: File, fromExt: string, toExt: string): Promise<Blob> {
  const XLSX = await import('xlsx');
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];

  if (fromExt === 'xlsx') {
    if (toExt === 'csv') {
      const csv = XLSX.utils.sheet_to_csv(worksheet);
      return new Blob([csv], { type: 'text/csv' });
    } else if (toExt === 'json') {
      const json = XLSX.utils.sheet_to_json(worksheet);
      return new Blob([JSON.stringify(json, null, 2)], { type: 'application/json' });
    } else if (toExt === 'xml') {
      const json = XLSX.utils.sheet_to_json(worksheet);
      const xml = json2xml(JSON.stringify({ row: json }), { compact: true, spaces: 2 });
      return new Blob([xml], { type: 'application/xml' });
    } else if (toExt === 'yaml') {
      const json = XLSX.utils.sheet_to_json(worksheet);
      const yamlStr = yaml.dump(json);
      return new Blob([yamlStr], { type: 'text/yaml' });
    } else if (toExt === 'txt') {
      const txt = XLSX.utils.sheet_to_txt(worksheet);
      return new Blob([txt], { type: 'text/plain' });
    }
  }
  throw new Error(`Unsupported spreadsheet conversion`);
}

function parseData(text: string, ext: string): any {
  if (ext === 'json') return JSON.parse(text);
  if (ext === 'yaml') return yaml.load(text);
  if (ext === 'xml') {
    const raw = xml2json(text, { compact: true, spaces: 2 });
    return JSON.parse(raw);
  }
  if (ext === 'csv') return Papa.parse(text, { header: true, skipEmptyLines: true }).data;
  return { content: text };
}

function stringifyData(data: any, toExt: string): { result: string, mimeType: string } {
  if (toExt === 'json') return { result: JSON.stringify(data, null, 2), mimeType: 'application/json' };
  if (toExt === 'yaml') return { result: yaml.dump(data), mimeType: 'text/yaml' };
  if (toExt === 'xml') return { result: json2xml(JSON.stringify(data), { compact: true, spaces: 2 }), mimeType: 'application/xml' };
  if (toExt === 'csv') {
    let arr = Array.isArray(data) ? data : typeof data === 'object' && data !== null ? [data] : [{ value: data }];
    return { result: Papa.unparse(arr), mimeType: 'text/csv' };
  }
  if (toExt === 'txt') {
    const res = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
    return { result: res, mimeType: 'text/plain' };
  }
  throw new Error(`Unsupported target format: ${toExt}`);
}

async function convertData(file: File, fromExt: string, toExt: string): Promise<Blob> {
  const text = await file.text();
  
  try {
    // Special document conversions
    if ((fromExt === 'md' || fromExt === 'txt') && toExt === 'html') {
      const html = await marked.parse(text);
      return new Blob([html], { type: 'text/html' });
    }
    
    if (toExt === 'md') {
      return new Blob([text], { type: 'text/markdown' });
    }

    // Export to DOCX
    if (toExt === 'docx') {
      const doc = new Document({
        sections: [{
          properties: {},
          children: text.split('\n').map(line => new Paragraph({
            children: [new TextRun(line)]
          }))
        }]
      });
      return await Packer.toBlob(doc);
    }

    // Export to XLSX
    if (toExt === 'xlsx') {
      const XLSX = await import('xlsx');
      let data = parseData(text, fromExt);
      if (!Array.isArray(data)) data = [data];
      
      const worksheet = XLSX.utils.json_to_sheet(data);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");
      const xlsxBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
      return new Blob([xlsxBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    }

    // Generic data conversions (JSON, YAML, XML, CSV, TXT)
    const data = parseData(text, fromExt);
    const { result, mimeType } = stringifyData(data, toExt);
    return new Blob([result], { type: mimeType });
    
  } catch (err) {
    if (err instanceof Error) {
      if (err.message.includes('unknown MIME type')) {
         throw new Error(`Data format detection failed for ${fromExt}. Make sure the file content matches its extension.`);
      }
      throw new Error(`Failed to convert data: ${err.message}`);
    }
    throw new Error('Unknown error converting data');
  }
}

export async function convertFile(file: File, toExt: string, options?: { useOcr?: boolean, onProgress?: (p: number) => void }): Promise<{ blob: Blob, filename: string }> {
  try {
    const fromExt = getExtension(file.name);
    const baseName = getBaseName(file.name);
    const onProgress = options?.onProgress;
    
    if (onProgress) onProgress(10);
    
    // Handle OCR specific extension
    const isOcr = toExt === 'txt (OCR)';
    const actualToExt = isOcr ? 'txt' : toExt;
    const newFilename = `${baseName}.${actualToExt}`;

    let resultBlob: Blob;

    if (isOcr) {
      resultBlob = await performOcr(file, fromExt === 'pdf', onProgress);
    } else if (fromExt === 'pdf' && toExt === 'txt') {
      if (options?.useOcr) {
        resultBlob = await performOcr(file, true, onProgress);
      } else {
        resultBlob = await extractPdfText(file, onProgress);
      }
    } else if (fromExt === 'pdf' && toExt === 'docx') {
      resultBlob = await convertPdfToDocx(file, options?.useOcr, onProgress);
    } else if (fromExt === 'docx' && toExt === 'pdf') {
      resultBlob = await convertDocxToPdf(file, onProgress);
    } else if (toExt === 'pdf') {
      resultBlob = await convertToPdf(file, fromExt);
    } else if (fromExt === 'docx') {
      resultBlob = await convertDocx(file, toExt);
    } else if (fromExt === 'xlsx') {
      resultBlob = await convertSpreadsheet(file, fromExt, toExt);
    } else {
      const imageExts = ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'gif', 'svg', 'ico'];
      if (imageExts.includes(fromExt) && imageExts.includes(toExt)) {
        resultBlob = await convertImage(file, toExt);
      } else {
        resultBlob = await convertData(file, fromExt, toExt);
      }
    }

    if (onProgress) onProgress(100);
    return { blob: resultBlob, filename: newFilename };
  } catch (error) {
    console.error('File conversion error:', error);
    if (error instanceof Error) {
      if (error.message.includes('mammoth')) {
        throw new Error('Failed to read DOCX file. It might be corrupted or password-protected.');
      }
      if (error.message.includes('spreadsheetml')) {
        throw new Error('Failed to parse spreadsheet. Ensure it is a valid XLSX file.');
      }
      if (error.message.includes('PDF')) {
        throw new Error('PDF conversion error. The PDF might be restricted or use unsupported fonts/layouts.');
      }
      if (error.message.includes('Tesseract')) {
        throw new Error('OCR process failed. The image might be too complex or the worker couldn\'t load.');
      }
      throw error;
    }
    throw new Error('An unexpected error occurred during conversion.');
  }
}

export async function convertPdfToDocxWithService(
  file: File,
  options?: { useOcr?: boolean; onProgress?: (p: number) => void },
): Promise<{ blob: Blob; filename: string }> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('ocrMode', options?.useOcr ? 'force' : 'auto');
  formData.append('wysiwyg', 'true');

  if (options?.onProgress) {
    options.onProgress(15);
  }

  const response = await fetch('/api/convert/pdf-to-docx', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error || 'High-fidelity conversion is unavailable right now.');
  }

  if (options?.onProgress) {
    options.onProgress(95);
  }

  const blob = await response.blob();
  const outputName = response.headers.get('x-output-filename') || `${getBaseName(file.name)}.docx`;

  if (options?.onProgress) {
    options.onProgress(100);
  }

  return {
    blob,
    filename: outputName,
  };
}

export async function zipFiles(files: { name: string, blob: Blob }[]): Promise<Blob> {
  const zip = new JSZip();
  files.forEach(({ name, blob }) => {
    zip.file(name, blob);
  });
  return zip.generateAsync({ type: 'blob' });
}
