import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import formidable from 'formidable';
import ConvertAPI from 'convertapi';

export const config = {
  api: {
    bodyParser: false,
  },
};

const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;

async function parseForm(req) {
  const uploadDir = path.join(os.tmpdir(), 'fileflux-uploads');
  await fs.mkdir(uploadDir, { recursive: true });
  const form = formidable({
    multiples: false,
    maxFiles: 1,
    maxFileSize: MAX_FILE_SIZE_BYTES,
    uploadDir,
    keepExtensions: true,
  });

  return new Promise((resolve, reject) => {
    form.parse(req, (error, fields, files) => {
      if (error) {
        reject(error);
        return;
      }
      resolve({ fields, files });
    });
  });
}

function pickUploadedFile(files) {
  const input = files?.file;
  if (Array.isArray(input)) {
    return input[0];
  }
  return input;
}

function getResultUrl(result) {
  if (result?.file?.url) return result.file.url;
  if (Array.isArray(result?.files) && result.files[0]?.url) return result.files[0].url;
  return null;
}

function safeOutputName(originalName) {
  const base = path.basename(originalName || 'converted.pdf', path.extname(originalName || ''));
  return `${base.replace(/[^\w.-]+/g, '_') || 'converted'}.docx`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ error: 'Method not allowed.' });
    return;
  }

  if (!process.env.CONVERTAPI_SECRET) {
    res.status(503).json({ error: 'High-fidelity conversion is not configured on this deployment.' });
    return;
  }

  let uploadedFile;

  try {
    const { fields, files } = await parseForm(req);
    uploadedFile = pickUploadedFile(files);

    if (!uploadedFile) {
      res.status(400).json({ error: 'No PDF file was uploaded.' });
      return;
    }

    const mimetype = uploadedFile.mimetype || '';
    const ext = path.extname(uploadedFile.originalFilename || uploadedFile.newFilename || '').toLowerCase();
    if (mimetype !== 'application/pdf' && ext !== '.pdf') {
      res.status(400).json({ error: 'Only PDF files are supported by the high-fidelity route.' });
      return;
    }

    const convertApi = new ConvertAPI(process.env.CONVERTAPI_SECRET, {
      conversionTimeout: 120,
      uploadTimeout: 120,
      downloadTimeout: 120,
      keepAlive: true,
    });

    const result = await convertApi.convert(
      'docx',
      {
        File: uploadedFile.filepath,
        Wysiwyg: true,
        OcrMode: typeof fields.ocrMode === 'string' ? fields.ocrMode : 'auto',
        StoreFile: false,
        Annotations: 'textBox',
      },
      'pdf',
    );

    const resultUrl = getResultUrl(result);
    if (!resultUrl) {
      throw new Error('No converted file was returned by the conversion service.');
    }

    const convertedResponse = await fetch(resultUrl);
    if (!convertedResponse.ok) {
      throw new Error(`Failed to download converted DOCX (${convertedResponse.status}).`);
    }

    const buffer = Buffer.from(await convertedResponse.arrayBuffer());
    const outputName = safeOutputName(uploadedFile.originalFilename || uploadedFile.newFilename);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${outputName}"`);
    res.setHeader('X-Output-Filename', outputName);
    res.status(200).send(buffer);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Conversion failed.';
    res.status(500).json({ error: message });
  } finally {
    if (uploadedFile?.filepath) {
      await fs.unlink(uploadedFile.filepath).catch(() => {});
    }
  }
}
