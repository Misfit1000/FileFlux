import { Document, Packer, Paragraph, TextRun } from 'docx';

const doc = new Document({
  sections: [{
    properties: {},
    children: [
      new Paragraph({ children: [new TextRun({ text: "Page 1", size: -10 })] }),
    ]
  }]
});

Packer.toBuffer(doc).then(() => console.log("Success")).catch(e => console.error(e));
