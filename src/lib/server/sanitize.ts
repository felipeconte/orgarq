/**
 * ==============================================================================
 * ORGARQ - Input Sanitization & Anti-XSS Helper
 * ==============================================================================
 */

/**
 * Escapa caracteres HTML perigosos para evitar ataques de Cross-Site Scripting (XSS).
 */
export function sanitizeHtml(input: string): string {
  if (!input || typeof input !== 'string') return ''

  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
}

/**
 * Limpa strings de texto livre (nomes, observações, briefings) removendo tags maliciosas.
 */
export function sanitizeText(input: string | null | undefined): string {
  if (!input) return ''
  // Remove tags script, iframe e atributos inline javascript
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/on\w+\s*=\s*(?:["'][^"']*["']|[^\s>]+)/gi, '')
    .trim()
}
