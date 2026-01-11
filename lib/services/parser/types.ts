import { ParsedProgram } from '@/lib/services/programs/types';

export interface ParseResult {
  success: boolean;
  data?: ParsedProgram;
  error?: string;
  metadata?: {
    source: string;
    pageCount?: number;
    processingTimeMs?: number;
  };
}

export interface ProgramParser {
  /**
   * Parse content into a structured program
   * @param content - Raw content (string for CSV, base64/url for images/pdf)
   * @param options - Optional parsing configuration
   */
  parse(content: string, options?: any): Promise<ParseResult>;
  
  /**
   * Check if this parser handles the given file type
   */
  supports(fileType: string): boolean;
}
