import type { AnchorHTMLAttributes } from 'vue'

export function resolveRel(cta: {
  rel?: AnchorHTMLAttributes['rel']
  target?: AnchorHTMLAttributes['target']
}): AnchorHTMLAttributes['rel'] {
  return (
    cta.rel ?? (cta.target === '_blank' ? 'noopener noreferrer' : undefined)
  )
}
