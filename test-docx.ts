import { Document, Packer, Paragraph, TextRun, TabStopType } from 'docx';
import fs from 'fs';

const doc = new Document({
  sections: [{
    properties: {
      page: {
        margin: { top: 0, right: 0, bottom: 0, left: 0 },
      },
    },
    children: [
      new Paragraph({
        indent: { left: 1440 }, // 1 inch
        spacing: { before: 1440 }, // 1 inch down
        children: [new TextRun({ text: "Hello", size: 24 })],
      }),
      new Paragraph({
        indent: { left: 1440 },
        spacing: { before: 720 }, // 0.5 inch down
        tabStops: [
          { type: TabStopType.LEFT, position: 2880 } // 2 inches
        ],
        children: [
          new TextRun({ text: "World", size: 24 }),
          new TextRun({ text: "\tTabbed", size: 24 }),
        ],
      })
    ]
  }]
});

Packer.toBuffer(doc).then((buffer) => {
  fs.writeFileSync("test.docx", buffer);
  console.log("Done");
});
