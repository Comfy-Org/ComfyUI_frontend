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

export function withoutHiddenMarkup(html: string): string {
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

const PLACEHOLDER_LABEL = /^(?:Output|Sample \d+)$/

function attributeOf(tag: string, name: string): string | undefined {
  const quoted = new RegExp(`\\s${name}="([^"]*)"`).exec(tag)?.[1]
  if (quoted !== undefined) return quoted
  return new RegExp(`\\s${name}(?=[\\s/>])`).test(tag) ? '' : undefined
}

export function auditMediaLabels(html: string): string[] {
  const live = withoutHiddenMarkup(html)
  const images = [...live.matchAll(/<img\b[^>]*>/g)].flatMap(([tag]) => {
    const alt = attributeOf(tag, 'alt')
    const src = attributeOf(tag, 'src')
    if (alt === undefined) return [`has an image without alt: ${src}`]
    return PLACEHOLDER_LABEL.test(alt)
      ? [`has an image with alt "${alt}": ${src}`]
      : []
  })
  const videos = [...live.matchAll(/<video\b[^>]*>/g)].flatMap(([tag]) => {
    const label = attributeOf(tag, 'aria-label')
    return label !== undefined && PLACEHOLDER_LABEL.test(label)
      ? [`has a video labelled "${label}": ${attributeOf(tag, 'src')}`]
      : []
  })
  return [...images, ...videos]
}
