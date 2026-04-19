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
        tabStops: [
          { type: TabStopType.LEFT, position: 2880 } // 2 inches from margin
        ],
        children: [
          new TextRun({ text: "1 inch", size: 24 }),
          new TextRun({ text: "\t2 inches", size: 24 }),
        ],
      })
    ]
  }]
});

Packer.toBuffer(doc).then((buffer) => {
  fs.writeFileSync("test2.docx", buffer);
  console.log("Done");
});
