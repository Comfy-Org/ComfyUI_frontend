import en from '@/locales/en/main.json' with { type: 'json' }

type BlockType =
  | 'paragraph'
  | 'list'
  | 'ordered-list'
  | 'heading'
  | 'image'
  | 'blockquote'
  | 'author'

interface BlockConfig {
  type: BlockType
}

interface SectionConfig {
  id: string
  hasTitle: boolean
  blocks: BlockConfig[]
}

interface MessageGroup {
  [key: string]: string | MessageGroup
}

function isMessageGroup(value: unknown): value is MessageGroup {
  return typeof value === 'object' && value !== null
}

function inferBlockType(block: string | MessageGroup): BlockType {
  if (typeof block === 'string') {
    return block.includes('\n') ? 'list' : 'paragraph'
  }
  if (typeof block.src === 'string') return 'image'
  if (typeof block.text === 'string') return 'blockquote'
  if (typeof block.role === 'string') return 'author'
  if (typeof block.heading === 'string') return 'heading'
  if (typeof block.ol === 'string') return 'ordered-list'
  return 'paragraph'
}

export function deriveSections(prefix: string): SectionConfig[] {
  const catalog: unknown = en
  if (!isMessageGroup(catalog) || !isMessageGroup(catalog[prefix])) return []

  return Object.entries(catalog[prefix]).flatMap(([id, section]) => {
    if (!isMessageGroup(section) || typeof section.label !== 'string') return []
    const blocks = isMessageGroup(section.block)
      ? Object.entries(section.block)
          .sort(([a], [b]) => Number(a) - Number(b))
          .map(([, block]) => ({ type: inferBlockType(block) }))
      : []
    return [{ id, hasTitle: typeof section.title === 'string', blocks }]
  })
}
