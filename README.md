# FileFlux

FileFlux is a local-first file conversion app built with Vite and React. It supports images, documents, and structured data with previews, optional OCR for PDFs, and batch zip downloads.

For production use, PDF to DOCX now supports two paths:
- `Fast local` keeps conversion in the browser.
- `High fidelity` sends PDF to a server-side conversion route for better layout preservation in DOCX output.

## Run locally

Prerequisite: Node.js 20+

1. Install dependencies:
   `npm install`
2. Start the dev server:
   `npm run dev`
3. Open:
   `http://localhost:3000`

## High-fidelity PDF to DOCX

Set `CONVERTAPI_SECRET` in your Vercel project or local environment to enable the server-backed PDF to DOCX route. Without it, the rest of the app still works and users can fall back to local conversion.

## Available scripts

- `npm run dev` starts the local development server.
- `npm run build` creates a production build.
- `npm run lint` runs TypeScript type-checking.
