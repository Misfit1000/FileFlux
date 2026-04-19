import { Document, Packer, Paragraph, TextRun } from 'docx';

const doc = new Document({
  sections: [{
    properties: {},
    children: [
      new Paragraph({ children: [] }),
    ]
  }]
});

Packer.toBuffer(doc).then(() => console.log("Success")).catch(e => console.error(e));
