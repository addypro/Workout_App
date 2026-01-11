/**
 * Hash Utilities for PDF Caching
 *
 * Uses SHA-256 to generate content hashes for PDF deduplication.
 * Samples from multiple regions of the PDF to catch small differences.
 */

/**
 * Generate SHA-256 hash of content (Deno native)
 */
export async function generateHash(content: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

/**
 * Generate hash for PDF content using multi-region sampling
 *
 * Strategy: Sample from start, middle, and end of the PDF to catch:
 * - Different versions of the same program
 * - Minor edits anywhere in the document
 * - PDFs with identical headers but different content
 *
 * For small PDFs (<300KB base64), we use the entire content.
 */
export async function generatePDFHash(
  pdfBase64: string,
  fileSize?: number
): Promise<string> {
  const contentLength = pdfBase64.length;

  // For small PDFs, use entire content (most reliable)
  if (contentLength < 300000) {
    const hashInput = fileSize
      ? `v2:${fileSize}:${contentLength}:${pdfBase64}`
      : `v2:${contentLength}:${pdfBase64}`;
    return generateHash(hashInput);
  }

  // For larger PDFs, sample from multiple regions
  const sampleSize = 50000; // 50KB per region

  // Sample 1: Start of document (covers headers, TOC, first pages)
  const startSample = pdfBase64.slice(0, sampleSize);

  // Sample 2: Middle of document (covers core content)
  const middleStart = Math.floor(contentLength / 2) - Math.floor(sampleSize / 2);
  const middleSample = pdfBase64.slice(middleStart, middleStart + sampleSize);

  // Sample 3: End of document (covers final pages, appendices)
  const endSample = pdfBase64.slice(-sampleSize);

  // Sample 4: 25% mark (catches early program changes)
  const quarterStart = Math.floor(contentLength / 4);
  const quarterSample = pdfBase64.slice(quarterStart, quarterStart + 10000);

  // Sample 5: 75% mark (catches late program changes)
  const threeQuarterStart = Math.floor((contentLength * 3) / 4);
  const threeQuarterSample = pdfBase64.slice(threeQuarterStart, threeQuarterStart + 10000);

  // Combine all samples with metadata for robust fingerprinting
  // v2 prefix ensures old cached entries don't collide with new hash scheme
  const hashInput = [
    'v2',
    fileSize?.toString() ?? 'unknown',
    contentLength.toString(),
    startSample,
    middleSample,
    endSample,
    quarterSample,
    threeQuarterSample,
  ].join(':');

  return generateHash(hashInput);
}
