import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import ImageModule from "docxtemplater-image-module-free";
import { fileURLToPath } from 'url';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { exec, execSync } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import crypto from "crypto";
import os from "os";

// Removed unused/deprecated PDF engines as requested by user (mammoth, pdfmake, html-to-pdfmake)

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function findLibreOfficeBinary(): string | null {
  const candidates = [
    "soffice",
    "libreoffice",
    "/usr/bin/soffice",
    "/usr/bin/libreoffice",
    "/opt/libreoffice/program/soffice"
  ];

  console.log("[PDF Conversion] Ejecutando validación previa:");
  try {
    const outSoffice = execSync("which soffice").toString().trim();
    console.log(`[PDF Conversion] which soffice: ${outSoffice}`);
  } catch (e: any) {
    console.log(`[PDF Conversion] which soffice: not found`);
  }

  try {
    const outLibre = execSync("which libreoffice").toString().trim();
    console.log(`[PDF Conversion] which libreoffice: ${outLibre}`);
  } catch (e: any) {
    console.log(`[PDF Conversion] which libreoffice: not found`);
  }

  for (const candidate of candidates) {
    try {
      execSync(`${candidate} --version`, { stdio: "ignore" });
      return candidate;
    } catch {}
  }

  return null;
}

interface StampConfig {
  useCustomStamp: boolean;
  customStampName: string;
  lema: string;
  orgName: string;
  orgRut: string;
  stampStyle?: 'circular_double' | 'circular_horizontal' | 'circular_dots' | 'oval' | 'square';
}

async function compositeSignatureWithStamp(
  signatureBase64: string,
  cfg: StampConfig
): Promise<Buffer> {
  const W = 400;
  const H = 400;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d') as any;
  ctx.clearRect(0, 0, W, H);

  const cx = W / 2;
  const cy = H / 2;
  const stampColor = '#4338ca'; // Indigo 700
  const style = cfg.stampStyle || 'circular_double';

  // --- STAMP DRAWING ---
  ctx.save();
  ctx.globalAlpha = 0.25;
  ctx.strokeStyle = stampColor;
  ctx.lineWidth = 2.5;

  // Main Shape
  if (style === 'square') {
    const size = 340;
    const radius = 20;
    ctx.beginPath();
    ctx.moveTo(cx - size / 2 + radius, cy - size / 2);
    ctx.lineTo(cx + size / 2 - radius, cy - size / 2);
    ctx.quadraticCurveTo(cx + size / 2, cy - size / 2, cx + size / 2, cy - size / 2 + radius);
    ctx.lineTo(cx + size / 2, cy + size / 2 - radius);
    ctx.quadraticCurveTo(cx + size / 2, cy + size / 2, cx + size / 2 - radius, cy + size / 2);
    ctx.lineTo(cx - size / 2 + radius, cy + size / 2);
    ctx.quadraticCurveTo(cx - size / 2, cy + size / 2, cx - size / 2, cy + size / 2 - radius);
    ctx.lineTo(cx - size / 2, cy - size / 2 + radius);
    ctx.quadraticCurveTo(cx - size / 2, cy - size / 2, cx - size / 2 + radius, cy - size / 2);
    ctx.stroke();
  } else if (style === 'oval') {
    ctx.beginPath();
    ctx.ellipse(cx, cy, 180, 130, 0, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    // Circular styles
    if (style === 'circular_dots') {
      ctx.setLineDash([5, 10]);
    }
    ctx.beginPath();
    ctx.arc(cx, cy, 160, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]); // Reset dash

    if (style === 'circular_double') {
      ctx.beginPath();
      ctx.arc(cx, cy, 145, 0, Math.PI * 2);
      ctx.stroke();
    }
    
    if (style === 'circular_horizontal') {
      ctx.beginPath();
      ctx.moveTo(cx - 150, cy);
      ctx.lineTo(cx + 150, cy);
      ctx.stroke();
    }
  }

  // Top Curved Text (Organization Name)
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = stampColor;
  ctx.font = 'bold 24px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const title = (cfg.useCustomStamp ? cfg.customStampName : cfg.orgName).toUpperCase();
  const subText = (cfg.lema || "CERTIFICACIÓN DIGITAL").toUpperCase();
  
  if (style === 'oval' || style.startsWith('circular')) {
    const titleR = style === 'oval' ? 140 : 150;
    const arcLen = Math.PI * 0.8;
    const startAngle = -Math.PI / 2 - arcLen / 2;
    
    for (let i = 0; i < title.length; i++) {
      const angle = startAngle + (i + 0.5) * (arcLen / title.length);
      ctx.save();
      const xOffset = style === 'oval' ? titleR * 1.2 * Math.cos(angle) : titleR * Math.cos(angle);
      const yOffset = style === 'oval' ? titleR * 0.9 * Math.sin(angle) : titleR * Math.sin(angle);
      ctx.translate(cx + xOffset, cy + yOffset);
      ctx.rotate(angle + Math.PI / 2);
      ctx.fillText(title[i], 0, 0);
      ctx.restore();
    }

    // Bottom Curved Text
    ctx.font = '18px Arial, sans-serif';
    const subStartAngle = Math.PI / 2 - arcLen / 2;
    for (let i = 0; i < subText.length; i++) {
        const angle = subStartAngle + (i + 0.5) * (arcLen / subText.length);
        ctx.save();
        const xOffset = style === 'oval' ? titleR * 1.2 * Math.cos(angle) : titleR * Math.cos(angle);
        const yOffset = style === 'oval' ? titleR * 0.9 * Math.sin(angle) : titleR * Math.sin(angle);
        ctx.translate(cx + xOffset, cy + yOffset);
        ctx.rotate(angle - Math.PI / 2);
        ctx.fillText(subText[i], 0, 0);
        ctx.restore();
    }
  } else if (style === 'square') {
    ctx.font = 'bold 22px Arial, sans-serif';
    ctx.fillText(title, cx, cy - 120);
    ctx.font = '16px Arial, sans-serif';
    ctx.fillText(subText, cx, cy + 120);
  }

  // Center Static Text
  ctx.globalAlpha = 0.6;
  if (style === 'circular_horizontal') {
    ctx.font = 'bold 18px Arial, sans-serif';
    ctx.fillText('FIRMA', cx, cy - 30);
    ctx.font = '14px Arial, sans-serif';
    ctx.fillText(cfg.orgRut || '', cx, cy + 30);
  } else {
    ctx.font = 'bold 16px Arial, sans-serif';
    ctx.fillText(cfg.orgRut || 'RUT INSTITUCIONAL', cx, cy + (style === 'square' ? 30 : 0));
  }

  ctx.restore();

  // --- SIGNATURE DRAWING ---
  if (signatureBase64 && signatureBase64.length > 10) {
    const sigData = signatureBase64.includes(',')
      ? signatureBase64.split(',')[1] : signatureBase64;
    const sigBuffer = Buffer.from(sigData, 'base64');
    const sigImg = await loadImage(sigBuffer);
    
    // Fit signature within the stamp area, with some padding and offset
    const sigW = 320;
    const sigH = sigW / (sigImg.width / sigImg.height);
    ctx.drawImage(sigImg, cx - sigW / 2, cy - sigH / 2, sigW, sigH);
  }

  return canvas.toBuffer('image/png') as unknown as Buffer;
}

async function generateRenderedDocx(templateBase64: string, data: any, images: any, stampConfig: StampConfig): Promise<Buffer> {
  const base64Data = templateBase64.includes(',')
    ? templateBase64.split(',')[1]
    : templateBase64;

  if (!base64Data) throw new Error("No template data received");

  const content = Buffer.from(base64Data, 'base64');

  let zip: any;
  try {
    zip = new PizZip(content);
  } catch (zipErr: any) {
    throw new Error("El archivo no es un .docx válido: " + zipErr.message);
  }

  const signatureBase64 = images.FIRMA_OTEC || images.FIRMA || '';

  // Generar imagen compuesta firma + timbre
  let firmaSelloBase64 = '';
  try {
    const buf = await compositeSignatureWithStamp(signatureBase64, stampConfig);
    firmaSelloBase64 = 'data:image/png;base64,' + buf.toString('base64');
  } catch (e) {
    console.error('❌ Error generando firma+timbre:', e);
  }

  const processedImages: Record<string, string> = {
    QR: images.QR || '',
    FIRMA_OTEC: firmaSelloBase64,
    FIRMA: firmaSelloBase64,
    TIMBRE: '', 
  };

  const imageBoxSizes: Record<string, [number, number]> = {};

  Object.keys(zip.files).forEach((fileName: string) => {
    if (fileName.endsWith('.xml')) {
      const xmlContent = zip.files[fileName].asText();
      const markers = ['QR', 'FIRMA_OTEC', 'FIRMA', 'TIMBRE'];
      markers.forEach(marker => {
        const markerIdx = xmlContent.indexOf('{{' + marker + '}}');
        if (markerIdx === -1) return;
        const txbxStart = xmlContent.lastIndexOf('<w:txbxContent>', markerIdx);
        if (txbxStart === -1) return;
        const chunkBefore = xmlContent.substring(0, txbxStart);
        const extentMatch = chunkBefore.match(
          /.*<(?:wp:extent|a:ext)\s+cx="(\d+)"\s+cy="(\d+)"[^/]*\/>/s
        );
        if (!extentMatch) return;
        const cxEmu = parseInt(extentMatch[1]);
        const cyEmu = parseInt(extentMatch[2]);
        const paddingH = (91440 + 91440) / 9525;
        const paddingV = (45720 + 45720) / 9525;
        let pxW = Math.round(cxEmu / 9525 - paddingH);
        let pxH = Math.round(cyEmu / 9525 - paddingV);
        if (marker === 'QR') {
          pxW = Math.round(pxW * 0.95);
          pxH = Math.round(pxH * 0.95);
          const side = Math.min(pxW, pxH);
          pxW = side; pxH = side;
        }
        if (marker === 'FIRMA_OTEC' || marker === 'FIRMA') {
          pxW = Math.round(pxW * 0.95);
          pxH = Math.round(pxH * 0.95);
        }
        imageBoxSizes[marker] = [pxW, pxH];
      });
    }
  });

  const imageTagsWithData = Object.keys(processedImages).filter(tag => {
    const val = processedImages[tag];
    return val && val.length > 0;
  });

  Object.keys(zip.files).forEach((fileName: string) => {
    if (fileName.endsWith('.xml')) {
      let xmlContent = zip.files[fileName].asText();
      xmlContent = xmlContent.replace(
        /(<w:txbxContent>)([\s\S]*?)(<\/w:txbxContent>)/g,
        (_match: string, open: string, inner: string, close: string) => {
          const cleaned = inner.replace(
            /<w:p\s[^>]*>\s*<w:pPr>[\s\S]*?<\/w:pPr>\s*<\/w:p>\s*/g,
            ''
          );
          return open + cleaned + close;
        }
      );
      zip.file(fileName, xmlContent);
    }
  });

  Object.keys(zip.files).forEach((fileName: string) => {
    if (fileName.endsWith('.xml')) {
      let xmlContent = zip.files[fileName].asText();
      ['QR', 'FIRMA_OTEC', 'FIRMA', 'TIMBRE'].forEach(tag => {
        const regex = new RegExp(`\\{\\{\\s*${tag}\\s*\\}\\}`, 'g');
        xmlContent = xmlContent.replace(regex, imageTagsWithData.includes(tag) ? `{{%${tag}}}` : '');
      });
      zip.file(fileName, xmlContent);
    }
  });

  const imageOptions = {
    centered: false,
    getImage(tagValue: string) {
      const imgBase64 = processedImages[tagValue];
      if (!imgBase64 || !imgBase64.length) return null;
      const raw = imgBase64.includes(',') ? imgBase64.split(',')[1] : imgBase64;
      if (!raw) return null;
      try { return Buffer.from(raw, 'base64'); } catch { return null; }
    },
    getSize(_img: Buffer, tagValue: string) {
      if (imageBoxSizes[tagValue]) {
        const [targetW, targetH] = imageBoxSizes[tagValue];
        if (tagValue === 'FIRMA' || tagValue === 'FIRMA_OTEC') {
          // Maintain 1:1 aspect ratio for the stamp+signature composite
          const side = Math.min(targetW, targetH);
          return [side, side];
        }
        return [targetW, targetH];
      }
      if (tagValue === 'QR') return [89, 62];
      if (tagValue === 'FIRMA' || tagValue === 'FIRMA_OTEC') return [94, 62];
      return [100, 100];
    }
  };

  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    delimiters: { start: '{{', end: '}}' },
    modules: [new ImageModule(imageOptions)]
  });

  doc.render(data);
  return doc.getZip().generate({ type: "nodebuffer", compression: "DEFLATE" });
}

async function convertDocxToPdf(docxBuffer: Buffer): Promise<Buffer> {
  const uniqueId = crypto.randomBytes(16).toString("hex");
  const tempDir = os.tmpdir();
  const inputPath = path.join(tempDir, `temp_${uniqueId}.docx`);
  const outputPath = path.join(tempDir, `temp_${uniqueId}.pdf`);

  // Log paths
  console.log(`[PDF Conversion] Ruta del DOCX temporal: ${inputPath}`);
  console.log(`[PDF Conversion] Ruta de salida PDF esperada: ${outputPath}`);

  try {
    // 1. Write the processed dynamic DOCX file to the temporary area
    await fs.writeFile(inputPath, docxBuffer);

    // 2. Perform validation to find the available LibreOffice binary
    const libreOfficeBinary = findLibreOfficeBinary();

    if (!libreOfficeBinary) {
      throw new Error(
        "LibreOffice no está instalado en el servidor. Instálalo con: sudo apt update && sudo apt install -y libreoffice. " +
        "Nota: En entornos sandboxed o serverless (como Google AI Studio, Vercel, Firebase Hosting, Netlify), " +
        "LibreOffice no está disponible de forma nativa. Para producción, debes desplegar este backend en un servidor propio, VPS, " +
        "Cloud Run con Docker, Render, Railway o servidor Ubuntu donde puedas instalar LibreOffice."
      );
    }

    console.log(`[PDF Conversion] Binario LibreOffice usado: ${libreOfficeBinary}`);

    // Assemble the conversion command
    const command = `"${libreOfficeBinary}" --headless --convert-to pdf --outdir "${tempDir}" "${inputPath}"`;
    console.log(`[PDF Conversion] Comando ejecutado: ${command}`);

    // Convert docx directly to PDF using the located LibreOffice binary
    try {
      await execAsync(command);
    } catch (err: any) {
      console.error("[PDF Conversion] Error durante la ejecución del comando:", err);
      throw new Error(`LibreOffice conversion process error. Details: ${err.message}`);
    }

    // Check if output file exists
    try {
      await fs.access(outputPath);
    } catch {
      throw new Error(`El archivo PDF convertido no se encontró en la ruta esperada: ${outputPath}`);
    }

    // 3. Read the beautifully converted high-fidelity PDF from disk
    const pdfBuffer = await fs.readFile(outputPath);
    console.log(`[PDF Conversion] Conversión exitosa. Tamaño del PDF: ${pdfBuffer.length} bytes`);
    return pdfBuffer;

  } catch (err: any) {
    console.error("❌ High-fidelity LibreOffice conversion failed:", err);
    throw new Error(`Failed to convert certificate DOCX to PDF: ${err.message}`);
  } finally {
    // 4. Secure resources by unlinking temporary inputs and outputs
    console.log("[PDF Conversion] Iniciando limpieza de archivos temporales...");
    await fs.unlink(inputPath).catch((e) => console.log(`[PDF Conversion Cleanup] No se pudo borrar ${inputPath}: ${e.message}`));
    await fs.unlink(outputPath).catch((e) => console.log(`[PDF Conversion Cleanup] No se pudo borrar ${outputPath}: ${e.message}`));
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));

  app.post("/api/generate-certificate-pdf", async (req, res) => {
    try {
      const { templateBase64, data, images, stampConfig } = req.body;
      const cfg: StampConfig = stampConfig || {
        useCustomStamp: false,
        customStampName: '',
        lema: '',
        orgName: (data as Record<string, string>).EMPRESA_OTEC || 'OTEC',
        orgRut: (data as Record<string, string>).RUT_EMPRESA_OTEC || '',
      };

      const docxBuf = await generateRenderedDocx(templateBase64, data, images, cfg);
      const pdfBuf = await convertDocxToPdf(docxBuf);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename=certificate.pdf');
      res.send(pdfBuf);

    } catch (err: any) {
      console.error("Critical PDF Error:", err);
      res.status(500).json({ error: "PDF conversion failed", details: err.message });
    }
  });

  app.post("/api/generate-certificate", async (req, res) => {
    try {
      const { templateBase64, data, images, stampConfig } = req.body;
      const cfg: StampConfig = stampConfig || {
        useCustomStamp: false,
        customStampName: '',
        lema: '',
        orgName: (data as Record<string, string>).EMPRESA_OTEC || 'OTEC',
        orgRut: (data as Record<string, string>).RUT_EMPRESA_OTEC || '',
      };

      const out = await generateRenderedDocx(templateBase64, data, images, cfg);

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', 'attachment; filename=certificate.docx');
      res.send(out);

    } catch (err: any) {
      console.error("Critical Error:", err);
      let message = "Generation failed";
      if (err.name === "TemplateError") message = "Error en la plantilla: " + err.message;
      else if (err.message?.includes("end of central directory")) message = "Archivo .docx inválido o corrupto.";
      res.status(500).json({ error: message, details: err.message });
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => res.sendFile(path.join(distPath, 'index.html')));
  }

  app.listen(PORT, "0.0.0.0", () => console.log(`Server running on http://localhost:${PORT}`));
}

startServer();
