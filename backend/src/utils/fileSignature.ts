/**
 * Medical Document Magic-Byte / File Signature Verification
 * Prevents extension spoofing attacks (e.g. executable or script disguised as .pdf or .png)
 */

export type AllowedMimeType = 'application/pdf' | 'image/png' | 'image/jpeg' | 'text/plain';

export interface FileSignatureValidationResult {
  isValid: boolean;
  detectedMime: AllowedMimeType | 'unknown' | 'executable';
  error?: string;
}

/**
 * Known magic bytes signatures
 */
const SIGNATURES = {
  // PDF: %PDF (0x25, 0x50, 0x44, 0x46)
  PDF: [0x25, 0x50, 0x44, 0x46],
  // PNG: \x89PNG\r\n\x1a\n (0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A)
  PNG: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  // JPEG / JPG: FF D8 FF
  JPEG: [0xff, 0xd8, 0xff],
  // Windows DOS/PE Executable (MZ): 0x4D 0x5A
  EXE_MZ: [0x4d, 0x5a],
  // Linux ELF Executable: 0x7F 0x45 0x4C 0x46
  ELF: [0x7f, 0x45, 0x4c, 0x46],
};

function matchesBytes(buffer: Buffer, signature: number[]): boolean {
  if (buffer.length < signature.length) return false;
  for (let i = 0; i < signature.length; i++) {
    if (buffer[i] !== signature[i]) {
      return false;
    }
  }
  return true;
}

/**
 * Detect MIME type strictly from the file buffer magic bytes
 */
export const detectBufferMimeType = (
  buffer: Buffer
): AllowedMimeType | 'executable' | 'unknown' => {
  if (!buffer || buffer.length < 4) {
    return 'unknown';
  }

  // Check dangerous executable headers first
  if (matchesBytes(buffer, SIGNATURES.EXE_MZ) || matchesBytes(buffer, SIGNATURES.ELF)) {
    return 'executable';
  }

  // Check valid allowed healthcare document types
  if (matchesBytes(buffer, SIGNATURES.PDF)) {
    return 'application/pdf';
  }

  if (matchesBytes(buffer, SIGNATURES.PNG)) {
    return 'image/png';
  }

  if (matchesBytes(buffer, SIGNATURES.JPEG)) {
    return 'image/jpeg';
  }

  // Check for plain text (all bytes printable or common whitespace, no null bytes)
  const sampleLen = Math.min(buffer.length, 512);
  let isText = true;
  for (let i = 0; i < sampleLen; i++) {
    const byte = buffer[i];
    if (byte === 0 || (byte < 7 && byte !== 9 && byte !== 10 && byte !== 13)) {
      isText = false;
      break;
    }
  }
  if (isText) {
    return 'text/plain';
  }

  return 'unknown';
};

/**
 * Validates that the buffer's true signature matches the claimed MIME type.
 * Returns failure if file is disguised or of unsupported type.
 */
export const validateFileSignature = (
  buffer: Buffer,
  claimedMime: string
): FileSignatureValidationResult => {
  const detected = detectBufferMimeType(buffer);

  if (detected === 'executable') {
    return {
      isValid: false,
      detectedMime: 'executable',
      error: 'Security alert: Disguised binary/executable file detected and rejected.',
    };
  }

  const normalizedClaimed =
    claimedMime === 'image/jpg' ? 'image/jpeg' : claimedMime.toLowerCase().trim();

  if (detected === 'unknown') {
    return {
      isValid: false,
      detectedMime: 'unknown',
      error: 'Invalid file format. File signature does not match any allowed medical document type (PDF, PNG, JPG).',
    };
  }

  if (detected !== normalizedClaimed) {
    return {
      isValid: false,
      detectedMime: detected,
      error: `File signature mismatch. Claimed type was '${claimedMime}', but actual content is '${detected}'.`,
    };
  }

  return {
    isValid: true,
    detectedMime: detected,
  };
};

/**
 * Antivirus / Security scanner hook interface
 */
export type BufferScannerHook = (buffer: Buffer, filename?: string) => Promise<{ clean: boolean; reason?: string }>;

/**
 * Default scanner hook: validates no malicious script tags in raw text & clean status
 */
export const defaultScanBuffer: BufferScannerHook = async (buffer: Buffer): Promise<{ clean: boolean; reason?: string }> => {
  // Check for obvious embedded script exploit signatures
  const headerPreview = buffer.slice(0, 1024).toString('utf-8', 0, 1024).toLowerCase();
  if (headerPreview.includes('<script') || headerPreview.includes('javascript:') || headerPreview.includes('powershell')) {
    return {
      clean: false,
      reason: 'Malicious script payload detected in document header.',
    };
  }

  return { clean: true };
};
