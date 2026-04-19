import { Document, Packer, Paragraph, TextRun } from 'docx';

const doc = new Document({
  sections: [{
    properties: {},
    children: [
      new Paragraph({ children: [new TextRun("Page 1")] }),
      new Paragraph({ children: [new TextRun("")], pageBreakBefore: true }),
      new Paragraph({ children: [new TextRun("Page 2")] })
    ]
  }]
});

Packer.toBuffer(doc).then(() => console.log("Success")).catch(e => console.error(e));
