/**
 * Color Utilities
 *
 * Helper functions for color manipulation and opacity handling.
 * Replaces string concatenation patterns like `color + '20'` with type-safe functions.
 */

// ============================================
// HEX/RGB CONVERSION
// ============================================

interface RGB {
  r: number;
  g: number;
  b: number;
}

/**
 * Convert hex color to RGB components
 */
export function hexToRgb(hex: string): RGB | null {
  // Remove # if present
  const cleanHex = hex.replace(/^#/, '');

  // Handle shorthand hex (e.g., #FFF)
  const fullHex =
    cleanHex.length === 3
      ? cleanHex
          .split('')
          .map((c) => c + c)
          .join('')
      : cleanHex;

  if (fullHex.length !== 6) return null;

  const result = /^([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(fullHex);
  if (!result) return null;

  return {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
  };
}

/**
 * Convert RGB components to hex color
 */
export function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => {
    const hex = Math.max(0, Math.min(255, Math.round(n))).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

// ============================================
// OPACITY HANDLING
// ============================================

/**
 * Apply opacity to a hex color, returning rgba() string.
 * Replaces the `color + '20'` pattern with proper opacity handling.
 *
 * @param color Hex color string (with or without #)
 * @param opacity Opacity value (0-1)
 * @returns rgba() string
 *
 * @example
 * withOpacity('#FF0000', 0.5) // 'rgba(255, 0, 0, 0.5)'
 * withOpacity(colors.tint, 0.2) // 'rgba(0, 122, 255, 0.2)'
 */
export function withOpacity(color: string, opacity: number): string {
  const rgb = hexToRgb(color);
  if (!rgb) {
    // Fallback for non-hex colors (already rgb/rgba)
    return color;
  }

  const clampedOpacity = Math.max(0, Math.min(1, opacity));
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${clampedOpacity})`;
}

/**
 * Convert hex opacity suffix to proper opacity value.
 * Maps 2-character hex suffix to decimal (e.g., '20' -> 0.125, 'B3' -> 0.7)
 *
 * @param hexSuffix Two-character hex opacity (00-FF)
 * @returns Decimal opacity (0-1)
 */
export function hexOpacityToDecimal(hexSuffix: string): number {
  const value = parseInt(hexSuffix, 16);
  if (isNaN(value)) return 1;
  return value / 255;
}

/**
 * Common opacity presets (hex suffix to decimal)
 */
export const OPACITY = {
  /** 5% opacity (hex: 0D) */
  subtle: 0.05,
  /** 10% opacity (hex: 1A) */
  faint: 0.1,
  /** 12.5% opacity (hex: 20) */
  muted: 0.125,
  /** 20% opacity (hex: 33) */
  light: 0.2,
  /** 30% opacity (hex: 4D) */
  medium: 0.3,
  /** 50% opacity (hex: 80) */
  half: 0.5,
  /** 70% opacity (hex: B3) */
  strong: 0.7,
  /** 85% opacity (hex: D9) */
  heavy: 0.85,
} as const;

// ============================================
// COLOR MANIPULATION
// ============================================

/**
 * Lighten a color by a percentage
 */
export function lighten(color: string, percent: number): string {
  const rgb = hexToRgb(color);
  if (!rgb) return color;

  const factor = percent / 100;
  return rgbToHex(
    rgb.r + (255 - rgb.r) * factor,
    rgb.g + (255 - rgb.g) * factor,
    rgb.b + (255 - rgb.b) * factor
  );
}

/**
 * Darken a color by a percentage
 */
export function darken(color: string, percent: number): string {
  const rgb = hexToRgb(color);
  if (!rgb) return color;

  const factor = 1 - percent / 100;
  return rgbToHex(rgb.r * factor, rgb.g * factor, rgb.b * factor);
}

/**
 * Mix two colors together
 */
export function mix(color1: string, color2: string, weight: number = 0.5): string {
  const rgb1 = hexToRgb(color1);
  const rgb2 = hexToRgb(color2);

  if (!rgb1 || !rgb2) return color1;

  const w = Math.max(0, Math.min(1, weight));
  return rgbToHex(
    rgb1.r * w + rgb2.r * (1 - w),
    rgb1.g * w + rgb2.g * (1 - w),
    rgb1.b * w + rgb2.b * (1 - w)
  );
}

// ============================================
// SEMANTIC COLOR UTILITIES
// ============================================

/**
 * Create a tinted background color from a primary color.
 * Common pattern: `colors.tintMuted` or `colors.tint + '20'`
 */
export function tintedBackground(color: string, opacity: number = OPACITY.muted): string {
  return withOpacity(color, opacity);
}

/**
 * Create a pressed state color
 */
export function pressedColor(color: string, isDark: boolean = false): string {
  return isDark ? lighten(color, 10) : darken(color, 10);
}

/**
 * Create a disabled state color
 */
export function disabledColor(color: string, opacity: number = OPACITY.half): string {
  return withOpacity(color, opacity);
}

// ============================================
// ACCESSIBILITY HELPERS
// ============================================

/**
 * Calculate relative luminance of a color
 */
export function luminance(color: string): number {
  const rgb = hexToRgb(color);
  if (!rgb) return 0;

  const toLinear = (c: number) => {
    const srgb = c / 255;
    return srgb <= 0.03928 ? srgb / 12.92 : Math.pow((srgb + 0.055) / 1.055, 2.4);
  };

  return 0.2126 * toLinear(rgb.r) + 0.7152 * toLinear(rgb.g) + 0.0722 * toLinear(rgb.b);
}

/**
 * Calculate contrast ratio between two colors (WCAG)
 * Returns ratio from 1 (no contrast) to 21 (max contrast)
 */
export function contrastRatio(color1: string, color2: string): number {
  const l1 = luminance(color1);
  const l2 = luminance(color2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Check if colors meet WCAG contrast requirements
 * AA requires 4.5:1 for normal text, 3:1 for large text
 * AAA requires 7:1 for normal text, 4.5:1 for large text
 */
export function meetsContrastRequirement(
  foreground: string,
  background: string,
  level: 'AA' | 'AAA' = 'AA',
  isLargeText: boolean = false
): boolean {
  const ratio = contrastRatio(foreground, background);
  const requirements = {
    AA: { normal: 4.5, large: 3 },
    AAA: { normal: 7, large: 4.5 },
  };

  const required = isLargeText ? requirements[level].large : requirements[level].normal;
  return ratio >= required;
}

/**
 * Suggest whether to use light or dark text on a background
 */
export function suggestTextColor(background: string): 'light' | 'dark' {
  const bgLuminance = luminance(background);
  return bgLuminance > 0.179 ? 'dark' : 'light';
}
