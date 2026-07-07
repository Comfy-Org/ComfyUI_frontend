import { default as DOMPurify } from 'dompurify'
import { marked } from 'marked'

// Open every rendered link in a new tab, safely. Registered once at module load so the
// panel never has to remember to set these on each anchor.
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node instanceof Element && node.tagName === 'A') {
    node.setAttribute('target', '_blank')
    node.setAttribute('rel', 'noopener noreferrer')
  }
})

/**
 * Render agent markdown to sanitized HTML. marked produces the HTML; DOMPurify strips
 * anything unsafe (scripts, event handlers, javascript: URLs) so a compromised or
 * mischievous agent reply cannot inject active content into the panel. This is the ONE
 * markdown entry point - message rendering never hand-builds HTML.
 */
export function renderMarkdownToHtml(md: string): string {
  const html = marked.parse(md, { async: false }) as string
  return DOMPurify.sanitize(html)
}
