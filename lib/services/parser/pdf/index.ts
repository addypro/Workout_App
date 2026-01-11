/**
 * PDF Parser Module
 *
 * Vision-first PDF parsing for workout programs.
 * Handles the chaos of different PDF creators with AI-powered extraction.
 */

export * from './types';
export * from './normalizer';
export {
  parsePDF,
  parsePDFWithSelection,
  analyzePDF,
  extractProgram,
  readPDFAsBase64,
  isPDFParsingAvailable,
} from './service';
