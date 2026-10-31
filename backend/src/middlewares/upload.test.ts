import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import express, { Express } from 'express';
import {
  uploadSingleReport,
  validateUploadedDocument,
  setScannerHook,
  resetScannerHook,
  MAX_REPORT_FILE_SIZE,
} from './upload';
import { errorHandler } from './errorHandler';
import { sendSuccess } from '../utils/apiResponse';

describe('Task 5.1: File Upload Engine with Security Scanning Hook', () => {
  let app: Express;

  beforeEach(() => {
    resetScannerHook();

    app = express();

    app.post(
      '/api/test/upload',
      (req, res, next) => {
        uploadSingleReport(req, res, (err) => {
          if (err) return next(err);
          next();
        });
      },
      validateUploadedDocument,
      (req, res) => {
        sendSuccess(res, {
          filename: req.file?.originalname,
          size: req.file?.size,
          mimetype: req.file?.mimetype,
          message: 'File uploaded and verified successfully',
        });
      }
    );

    app.use(errorHandler);
  });

  afterEach(() => {
    resetScannerHook();
  });

  // Helper buffers
  const validPdfBuffer = Buffer.concat([
    Buffer.from('%PDF-1.4\n'),
    Buffer.from('Medical Report Content for Patient RS-10475'),
  ]);

  const validPngBuffer = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    Buffer.from('PNG IHDR chunk and data'),
  ]);

  const validJpegBuffer = Buffer.concat([
    Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
    Buffer.from('JFIF JPEG Medical Scan Data'),
  ]);

  const executableDisguisedAsPdf = Buffer.concat([
    Buffer.from([0x4d, 0x5a, 0x90, 0x00]), // Windows MZ Executable magic bytes
    Buffer.from('Malicious PE binary payload'),
  ]);

  it('accepts a valid PDF file with authentic %PDF magic bytes', async () => {
    const res = await request(app)
      .post('/api/test/upload')
      .attach('file', validPdfBuffer, {
        filename: 'cbc_report.pdf',
        contentType: 'application/pdf',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.filename).toBe('cbc_report.pdf');
    expect(res.body.data.mimetype).toBe('application/pdf');
  });

  it('accepts a valid PNG image with authentic PNG magic bytes', async () => {
    const res = await request(app)
      .post('/api/test/upload')
      .attach('file', validPngBuffer, {
        filename: 'scan_report.png',
        contentType: 'image/png',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.mimetype).toBe('image/png');
  });

  it('accepts a valid JPEG image with authentic JPEG magic bytes', async () => {
    const res = await request(app)
      .post('/api/test/upload')
      .attach('file', validJpegBuffer, {
        filename: 'scan.jpg',
        contentType: 'image/jpeg',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('strictly rejects disguised executable (.exe disguised as .pdf)', async () => {
    const res = await request(app)
      .post('/api/test/upload')
      .attach('file', executableDisguisedAsPdf, {
        filename: 'fake_report.pdf',
        contentType: 'application/pdf',
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error?.message).toContain('Disguised binary/executable file detected');
  });

  it('rejects unsupported extensions (e.g. .exe, .sh, .docx)', async () => {
    const res = await request(app)
      .post('/api/test/upload')
      .attach('file', Buffer.from('script contents'), {
        filename: 'malicious.exe',
        contentType: 'application/octet-stream',
      });

    expect(res.status).toBe(400);
    expect(res.body.error?.message).toContain('Unsupported file extension');
  });

  it('rejects upload when no file is attached', async () => {
    const res = await request(app).post('/api/test/upload').send({});

    expect(res.status).toBe(400);
    expect(res.body.error?.message).toContain('No lab report file was provided');
  });

  it('enforces 10MB maximum file size limit', async () => {
    // Generate buffer exceeding 10MB
    const oversizedBuffer = Buffer.alloc(MAX_REPORT_FILE_SIZE + 1024, 0x20);
    // Write valid PDF signature at start so it only fails on size
    oversizedBuffer.write('%PDF-1.4\n', 0);

    const res = await request(app)
      .post('/api/test/upload')
      .attach('file', oversizedBuffer, {
        filename: 'giant_scan.pdf',
        contentType: 'application/pdf',
      });

    // Multer rejects with LIMIT_FILE_SIZE (500 or 400 depending on handler)
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it('triggers security scanning hook and blocks file if scanner returns false', async () => {
    // Register custom antivirus scanner hook that flags a virus
    setScannerHook(async () => {
      return { clean: false, reason: 'Trojan.MedicalReportExploit signature detected' };
    });

    const res = await request(app)
      .post('/api/test/upload')
      .attach('file', validPdfBuffer, {
        filename: 'infected.pdf',
        contentType: 'application/pdf',
      });

    expect(res.status).toBe(400);
    expect(res.body.error?.code).toBe('SECURITY_SCAN_FAILED');
    expect(res.body.error?.message).toContain('Trojan.MedicalReportExploit');
  });
});
