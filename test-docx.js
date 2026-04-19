import fs from 'fs';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { Document, Packer, Paragraph, TextRun } from 'docx';

async function convertPdfToDocx(buffer) {
  const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const children = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    
    // Group items by their Y coordinate to form lines
    const linesMap = new Map();
    for (const item of textContent.items) {
      if (!item.str.trim() && item.str !== ' ') continue;
      
      const y = Math.round(item.transform[5]);
      
      // Allow a small tolerance for Y coordinates to group items on the same line
      let foundY = y;
      for (const existingY of linesMap.keys()) {
        if (Math.abs(existingY - y) <= 3) {
          foundY = existingY;
          break;
        }
      }
      
      if (!linesMap.has(foundY)) {
        linesMap.set(foundY, []);
      }
      linesMap.get(foundY).push(item);
    }

    // Sort Y coordinates descending (PDF coordinates go bottom to top)
    const sortedY = Array.from(linesMap.keys()).sort((a, b) => b - a);
    
    for (const y of sortedY) {
      const lineItems = linesMap.get(y);
      // Sort items by X coordinate
      lineItems.sort((a, b) => a.transform[4] - b.transform[4]);
      
      const textRuns = lineItems.map(item => {
        return new TextRun({
          text: item.str,
          size: Math.max(10, Math.round(item.transform[0] * 2)), // font size in half-points
        });
      });
      
      // Calculate indentation based on first item's X coordinate
      const firstX = lineItems[0].transform[4];
      const indent = Math.max(0, Math.round(firstX * 20)); // twips (1 point = 20 twips)
      
      children.push(new Paragraph({
        children: textRuns,
        indent: { left: indent },
      }));
    }

    if (i < pdf.numPages) {
      children.push(new Paragraph({ children: [new TextRun("")], pageBreakBefore: true }));
    }
  }

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          margin: {
            top: 1440, // 1 inch
            right: 1440,
            bottom: 1440,
            left: 1440,
          },
        },
      },
      children: children.length > 0 ? children : [new Paragraph({ children: [new TextRun("No text found")] })]
    }]
  });

  return Packer.toBuffer(doc);
}

async function run() {
  const buffer = fs.readFileSync('test.pdf');
  try {
    const docxBuffer = await convertPdfToDocx(buffer);
    fs.writeFileSync('test.docx', docxBuffer);
    console.log('Success!');
  } catch (e) {
    console.error(e);
  }
}

run();
