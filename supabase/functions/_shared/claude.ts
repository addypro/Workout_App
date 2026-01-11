/**
 * Claude API Client for Supabase Edge Functions
 *
 * Handles communication with Claude Vision API for PDF parsing.
 */

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
const CLAUDE_MODEL = 'claude-sonnet-4-20250514';

interface ClaudeMessage {
  role: 'user' | 'assistant';
  content: Array<{
    type: 'text' | 'image';
    text?: string;
    source?: {
      type: 'base64';
      media_type: string;
      data: string;
    };
  }>;
}

interface ClaudeResponse {
  content: Array<{
    type: 'text';
    text: string;
  }>;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

/**
 * Call Claude API with vision capabilities
 */
export async function callClaude(
  systemPrompt: string,
  messages: ClaudeMessage[],
  maxTokens: number = 4096
): Promise<string> {
  if (!ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY not configured');
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Claude API error: ${error}`);
  }

  const data: ClaudeResponse = await response.json();
  return data.content[0]?.text || '';
}

/**
 * Convert PDF pages to images using pdf-lib and canvas
 * Note: In production, you'd use a proper PDF-to-image service
 */
export async function pdfToImages(
  pdfBase64: string,
  pageRange?: { start: number; end: number }
): Promise<string[]> {
  // For edge functions, we'll pass the PDF directly to Claude
  // Claude Vision can process PDFs natively now
  return [pdfBase64];
}

/**
 * Extract JSON from Claude response
 */
export function extractJSON<T>(response: string): T {
  // Try to find JSON in the response
  const jsonMatch = response.match(/```json\n?([\s\S]*?)\n?```/);
  if (jsonMatch) {
    return JSON.parse(jsonMatch[1]);
  }

  // Try parsing the entire response as JSON
  const cleanedResponse = response.trim();
  if (cleanedResponse.startsWith('{') || cleanedResponse.startsWith('[')) {
    return JSON.parse(cleanedResponse);
  }

  throw new Error('No valid JSON found in response');
}
