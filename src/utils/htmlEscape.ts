const HTML_ESCAPE_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
}

/**
 * Escapes HTML-significant characters (`& < > " '`) so a raw string displays
 * literally instead of being parsed as markup.
 * @param text - The string to escape
 * @returns The escaped string, safe to feed into an HTML parser as plain text
 * @example
 * escapeHtml('<lora:my_style_v2:0.8>') // returns '&lt;lora:my_style_v2:0.8&gt;'
 */
export function escapeHtml(text: string): string {
  if (!text) return ''
  return text.replace(/[&<>"']/g, (char) => HTML_ESCAPE_MAP[char])
}
