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

const SITE_ORIGIN = 'https://comfy.org'
const JSON_LD_BLOCK =
  /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g

interface JsonLdNode {
  '@type'?: string
  numberOfItems?: number
  itemListElement?: { url: string }[]
}

function jsonLdNodes(html: string): JsonLdNode[] {
  return [...html.matchAll(JSON_LD_BLOCK)].flatMap(([, json]) => {
    const parsed = JSON.parse(json)
    return parsed['@graph'] ?? [parsed]
  })
}

function directoryHrefs(html: string): string[] {
  const directory =
    html.split('data-testid="models-directory"')[1]?.split('</section>')[0] ??
    ''
  return [...directory.matchAll(/<a\b[^>]*\shref="([^"]*)"/g)].map(
    ([, href]) => href
  )
}

export function auditModelsHub(
  html: string,
  isListed: (href: string) => boolean
): string[] {
  const nodes = jsonLdNodes(html)
  const ofType = (type: string) =>
    nodes.filter((node) => node['@type'] === type)
  const links = directoryHrefs(html)
  const expected = links.filter(isListed)
  const expectedCounts = {
    CollectionPage: 1,
    BreadcrumbList: 1,
    ItemList: expected.length > 0 ? 1 : 0
  }
  const errors = Object.entries(expectedCounts).flatMap(([type, count]) => {
    const found = ofType(type).length
    return found === count ? [] : [`expected ${count} ${type}, found ${found}`]
  })
  if (links.length === 0) errors.push('renders no model links in the directory')
  const itemList = ofType('ItemList').at(0)
  if (!itemList) return errors
  const listed = (itemList.itemListElement ?? []).map(({ url }) => url)
  const expectedUrls = expected.map((href) => new URL(href, SITE_ORIGIN).href)
  if (itemList.numberOfItems !== expected.length)
    errors.push(
      `ItemList numberOfItems ${itemList.numberOfItems} does not match ${expected.length} directory links`
    )
  if (listed.join() !== expectedUrls.join())
    errors.push('ItemList URLs differ from the directory links or their order')
  return errors
}
