const ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'"
}

function textOf(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&(?:amp|lt|gt|quot|#39);/g, (entity) => ENTITIES[entity])
    .replace(/\s+/g, ' ')
    .trim()
}

function withoutHiddenMarkup(html: string): string {
  return html.replace(/<(template|noscript|script|style)\b[\s\S]*?<\/\1>/g, '')
}

export function auditModelPage(html: string, modelName: string): string[] {
  const errors: string[] = []
  const live = withoutHiddenMarkup(html)
  const h1s = [...live.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/g)].map(
    ([, inner]) => textOf(inner)
  )
  if (h1s.length !== 1 || h1s[0] !== modelName)
    errors.push(`expected one h1 "${modelName}", found ${JSON.stringify(h1s)}`)
  if (textOf(html).includes('Grok Imagine in ComfyUI'))
    errors.push('contains the Grok Imagine showcase')
  const beforeRelated = live.split('data-testid="related-models"')[0]
  if (
    !modelName.includes('Grok') &&
    textOf(beforeRelated).includes('Grok Imagine')
  )
    errors.push('names Grok Imagine outside the related models')
  if (live.includes('data-testid="workshop-loading"'))
    errors.push('paints a loader in place of the model')
  return errors
}
