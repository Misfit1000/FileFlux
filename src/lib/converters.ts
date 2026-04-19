import Papa from 'papaparse';
import { marked } from 'marked';
import mammoth from 'mammoth';
import { jsPDF } from 'jspdf';
import { renderAsync } from 'docx-preview';
import html2canvas from 'html2canvas';
import { Document, Packer, Paragraph, TextRun, TabStopType } from 'docx';
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

export function getExtension(filename: string): string {
  const parts = filename.split('.');
  return parts.length > 1 ? parts.pop()?.toLowerCase() || '' : '';
}

export function getBaseName(filename: string): string {
  const parts = filename.split('.');
  if (parts.length > 1) parts.pop();
  return parts.join('.');
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

async function convertDocxToPdf(file: File): Promise<Blob> {
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
    }

    return new Blob([pdf.output('blob')], { type: 'application/pdf' });
  } finally {
    document.body.removeChild(container);
  }
}

async function convertPdfToDocx(file: File, useOcr: boolean = false): Promise<Blob> {
  if (useOcr) {
    return convertPdfToDocxWithOcr(file);
  }

  const arrayBuffer = await file.arrayBuffer();
  const pdfjsLib = await getPdfjs();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  
  const children: Paragraph[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const viewport = page.getViewport({ scale: 1.0 });
    const pageHeight = viewport.height;
    
    // Group items by their Y coordinate to form lines
    const linesMap = new Map<number, any[]>();
    for (const item of textContent.items as any[]) {
      if (!item.str || (!item.str.trim() && item.str !== ' ')) continue;
      
      let y = item.transform && item.transform.length > 5 ? Number(item.transform[5]) : 0;
      if (!Number.isFinite(y)) y = 0;
      
      // Allow a slightly larger tolerance for Y coordinates (up to 8) to group items on the same line robustly
      let foundY = y;
      for (const existingY of linesMap.keys()) {
        if (Math.abs(existingY - y) <= 8) {
          foundY = existingY;
          break;
        }
      }
      
      if (!linesMap.has(foundY)) {
        linesMap.set(foundY, []);
      }
      linesMap.get(foundY)!.push(item);
    }

    // Sort Y coordinates descending (PDF coordinates go bottom to top)
    const sortedY = Array.from(linesMap.keys()).sort((a, b) => b - a);
    
    let lastY: number | null = null;
    
    for (const y of sortedY) {
      const lineItems = linesMap.get(y)!;
      // Sort items by X coordinate
      lineItems.sort((a, b) => {
        let ax = a.transform && a.transform.length > 4 ? Number(a.transform[4]) : 0;
        if (!Number.isFinite(ax)) ax = 0;
        let bx = b.transform && b.transform.length > 4 ? Number(b.transform[4]) : 0;
        if (!Number.isFinite(bx)) bx = 0;
        return ax - bx;
      });
      
      // Merge adjacent items to fix character spacing
      const mergedItems: any[] = [];
      let currentItem: any = null;

      for (const item of lineItems) {
        if (!currentItem) {
          currentItem = { ...item };
          continue;
        }

        let currentX = currentItem.transform[4];
        let currentScaleX = Math.abs(currentItem.transform[0]);
        let currentWidth = currentItem.width || (currentItem.str.length * currentScaleX * 0.5);
        let nextX = item.transform[4];
        
        let gap = nextX - (currentX + currentWidth);
        
        // If gap is very small (e.g. character spacing) or negative (overlapping), merge without space
        if (gap < currentScaleX * 0.25) {
          currentItem.str += item.str;
          currentItem.width = (nextX + (item.width || (item.str.length * Math.abs(item.transform[0]) * 0.5))) - currentX;
        } 
        // If gap is roughly a space width, merge with space
        else if (gap >= currentScaleX * 0.25 && gap < currentScaleX * 1.5) {
          if (!currentItem.str.endsWith(' ') && !item.str.startsWith(' ')) {
            currentItem.str += ' ';
          }
          currentItem.str += item.str;
          currentItem.width = (nextX + (item.width || (item.str.length * Math.abs(item.transform[0]) * 0.5))) - currentX;
        }
        // Force split if extremely large gap
        else {
          mergedItems.push(currentItem);
          currentItem = { ...item };
        }
      }
      if (currentItem) {
        mergedItems.push(currentItem);
      }
      
      if (mergedItems.length === 0) continue;
      
      let currentParagraphRuns: TextRun[] = [];
      let tabStops: any[] = [];
      
      let firstItemX = mergedItems[0].transform && mergedItems[0].transform.length > 4 ? Number(mergedItems[0].transform[4]) : 0;
      if (!Number.isFinite(firstItemX) || Number.isNaN(firstItemX)) firstItemX = 0;
      
      let indentLeft = Math.max(0, Math.round(firstItemX * 20)); // twips
      
      let currentX = firstItemX;

      for (let j = 0; j < mergedItems.length; j++) {
        const item = mergedItems[j];
        let scaleX = item.transform && item.transform.length > 0 ? Number(item.transform[0]) : 12;
        if (!Number.isFinite(scaleX) || Number.isNaN(scaleX)) scaleX = 12;
        
        let ptSize = Math.abs(scaleX);
        if (ptSize < 6) ptSize = 11;
        if (ptSize > 72) ptSize = 72;
        let size = Math.round(ptSize * 2);
        
        const isBold = item.fontName ? item.fontName.toLowerCase().includes('bold') : false;
        const isItalic = item.fontName ? item.fontName.toLowerCase().includes('italic') || item.fontName.toLowerCase().includes('oblique') : false;
        
        const text = (item.str || '').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
        
        // Skip purely empty nodes unless they act as significant spaces
        if (text.trim().length === 0 && text.length > 0 && j === 0) continue;

        let itemX = item.transform && item.transform.length > 4 ? Number(item.transform[4]) : 0;
        if (!Number.isFinite(itemX) || Number.isNaN(itemX)) itemX = 0;
        
        if (j > 0) {
          const gap = itemX - currentX;
          if (gap > (ptSize * 0.2)) {
            const tabPosition = Math.max(0, Math.min(Math.round(itemX * 20), 9000));
            tabStops.push({
              type: TabStopType.LEFT,
              position: tabPosition
            });
            currentParagraphRuns.push(new TextRun({ text: "\t" + text, size: size, bold: isBold, italics: isItalic }));
          } else {
            currentParagraphRuns.push(new TextRun({ text: text, size: size, bold: isBold, italics: isItalic }));
          }
        } else {
          currentParagraphRuns.push(new TextRun({ text: text, size: size, bold: isBold, italics: isItalic }));
        }
        
        currentX = itemX + (item.width || (text.length * ptSize * 0.5));
      }
      
      let spacingBefore = 0;
      if (lastY !== null) {
        const deltaY = lastY - y;
        spacingBefore = Math.max(0, Math.min(Math.round((deltaY - 12) * 20), 2000)); 
      } else {
        const topMargin = pageHeight - y;
        spacingBefore = Math.max(0, Math.min(Math.round((topMargin - 12) * 20), 2000));
      }
      
      let safeIndentLeft = Math.max(0, Math.min(indentLeft, 9000));

      children.push(new Paragraph({
        children: currentParagraphRuns,
        indent: { left: safeIndentLeft },
        spacing: { before: spacingBefore },
        tabStops: tabStops.length > 0 ? tabStops : undefined,
      }));
      
      lastY = y;
    }

    if (i < pdf.numPages) {
      children.push(new Paragraph({ children: [new TextRun("")] }));
    }
  }

  // Add E-Signature Placeholder
  children.push(new Paragraph({
    children: [
      new TextRun({ text: "\n\n\n\n\n", break: 5 }),
      new TextRun({ text: "By signing below, I agree to the terms." }),
      new TextRun({ text: "\n", break: 1 }),
      new TextRun({ text: "E-Signature: ___________________________\tDate: ________________________", bold: true }),
    ]
  }));

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          margin: {
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
          },
        },
      },
      children: children.length > 0 ? children : [new Paragraph({ children: [new TextRun("No text found")] })]
    }]
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
        tessedit_pageseg_mode: 1 as any,
        preserve_interword_spaces: '1',
      });
      ocrScheduler.addWorker(worker);
    }
  }
  return ocrScheduler;
}

async function convertPdfToDocxWithOcr(file: File): Promise<Blob> {
  const arrayBuffer = await file.arrayBuffer();
  const pdfjsLib = await getPdfjs();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  
  const scheduler = await getOcrScheduler();
  
  const children: Paragraph[] = [];
  // Use Promise.all to process pages simultaneously
  const pagePromises = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    pagePromises.push((async () => {
      const page = await pdf.getPage(i);
      const scaleFactor = 4.0;
      const viewport = page.getViewport({ scale: scaleFactor }); // Increased for better OCR
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return { i, data: null, scaleFactor: 1.0 };
      
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      await page.render({ canvasContext: ctx, viewport, canvas: canvas as any }).promise;
      
      // Tesseract Pre-processing: Grayscale and Thresholding for better OCR accuracy
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const pd = imageData.data;
      for (let p = 0; p < pd.length; p += 4) {
        const r = pd[p];
        const g = pd[p+1];
        const b = pd[p+2];
        // Convert to grayscale
        let gray = 0.299 * r + 0.587 * g + 0.114 * b;
        // High-contrast threshold
        gray = gray > 180 ? 255 : 0;
        pd[p] = pd[p+1] = pd[p+2] = gray;
      }
      ctx.putImageData(imageData, 0, 0);

      const { data } = await scheduler.addJob('recognize', canvas);
      return { i, data, scaleFactor };
    })());
  }

  const pageResults = await Promise.all(pagePromises);
  // Sort them back by page index just in case they resolve out of order
  pageResults.sort((a, b) => a.i - b.i);

  for (const result of pageResults) {
    if (!result.data) continue;
    
    let lastY: number | null = null;
    const scaleFactor = result.scaleFactor;
    
    const lines = (result.data as any)?.lines || [];
    for (const line of lines) {
      const x0 = line.bbox.x0 / scaleFactor;
      const y0 = line.bbox.y0 / scaleFactor;
      const y1 = line.bbox.y1 / scaleFactor;
      const height = y1 - y0;
      
      let ptSize = height * 0.75;
      if (ptSize < 6) ptSize = 11;
      if (ptSize > 72) ptSize = 72;
      let size = Math.round(ptSize * 2);
      
      let indentLeft = Math.max(0, Math.min(Math.round(x0 * 20), 9000));
      
      let spacingBefore = 0;
      if (lastY !== null) {
        const deltaY = y0 - lastY;
        spacingBefore = Math.max(0, Math.min(Math.round((deltaY) * 20), 2000));
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
      
      children.push(new Paragraph({
        children: currentParagraphRuns,
        indent: { left: indentLeft },
        spacing: { before: spacingBefore },
        tabStops: tabStops.length > 0 ? tabStops : undefined,
      }));
      
      lastY = y0;
    }
    
    if (result.i < pdf.numPages) {
      children.push(new Paragraph({ children: [new TextRun("")], pageBreakBefore: true }));
    }
  }
  
  // We don't terminate the scheduler so other batch conversions can reuse the worker pool

  // Add E-Signature Placeholder
  children.push(new Paragraph({
    children: [
      new TextRun({ text: "\n\n\n\n\n", break: 5 }),
      new TextRun({ text: "By signing below, I agree to the terms." }),
      new TextRun({ text: "\n", break: 1 }),
      new TextRun({ text: "E-Signature: ___________________________\tDate: ________________________", bold: true }),
    ]
  }));

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          margin: { top: 0, right: 0, bottom: 0, left: 0 },
        },
      },
      children: children.length > 0 ? children : [new Paragraph({ children: [new TextRun("No text found")] })]
    }]
  });

  return Packer.toBlob(doc);
}

async function performOcr(file: File, isPdf: boolean): Promise<Blob> {
  const scheduler = await getOcrScheduler();
  
  let text = '';
  
  if (isPdf) {
    const arrayBuffer = await file.arrayBuffer();
    const pdfjsLib = await getPdfjs();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    
    const pagePromises = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      pagePromises.push((async () => {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 2.0 });
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
          return { i, text: data?.text || '' };
        }
        return { i, text: '' };
      })());
    }
    
    const results = await Promise.all(pagePromises);
    results.sort((a, b) => a.i - b.i);
    for (const res of results) {
      if (res.text) text += res.text + '\n\n';
    }
  } else {
    const imgUrl = URL.createObjectURL(file);
    const { data } = await scheduler.addJob('recognize', imgUrl);
    text = data?.text || '';
    URL.revokeObjectURL(imgUrl);
  }
  
  return new Blob([text], { type: 'text/plain' });
}

async function extractPdfText(file: File): Promise<Blob> {
  const arrayBuffer = await file.arrayBuffer();
  const pdfjsLib = await getPdfjs();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let fullText = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    
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

export async function convertFile(file: File, toExt: string, options?: { useOcr?: boolean }): Promise<{ blob: Blob, filename: string }> {
  try {
    const fromExt = getExtension(file.name);
    const baseName = getBaseName(file.name);
    
    // Handle OCR specific extension
    const isOcr = toExt === 'txt (OCR)';
    const actualToExt = isOcr ? 'txt' : toExt;
    const newFilename = `${baseName}.${actualToExt}`;

    if (isOcr) {
      const blob = await performOcr(file, fromExt === 'pdf');
      return { blob, filename: newFilename };
    }

    if (fromExt === 'pdf' && toExt === 'txt') {
      if (options?.useOcr) {
        const blob = await performOcr(file, true);
        return { blob, filename: newFilename };
      }
      const blob = await extractPdfText(file);
      return { blob, filename: newFilename };
    }

    if (fromExt === 'pdf' && toExt === 'docx') {
      const blob = await convertPdfToDocx(file, options?.useOcr);
      return { blob, filename: newFilename };
    }

    if (toExt === 'pdf') {
      const blob = await convertToPdf(file, fromExt);
      return { blob, filename: newFilename };
    }

    if (fromExt === 'docx') {
      const blob = await convertDocx(file, toExt);
      return { blob, filename: newFilename };
    }

    if (fromExt === 'xlsx') {
      const blob = await convertSpreadsheet(file, fromExt, toExt);
      return { blob, filename: newFilename };
    }

    const imageExts = ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'gif', 'svg', 'ico'];
    
    if (imageExts.includes(fromExt) && imageExts.includes(toExt)) {
      const blob = await convertImage(file, toExt);
      return { blob, filename: newFilename };
    }
    
    const blob = await convertData(file, fromExt, toExt);
    return { blob, filename: newFilename };
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

export async function zipFiles(files: { name: string, blob: Blob }[]): Promise<Blob> {
  const zip = new JSZip();
  files.forEach(({ name, blob }) => {
    zip.file(name, blob);
  });
  return zip.generateAsync({ type: 'blob' });
}
