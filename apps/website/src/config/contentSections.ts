import { DEFAULT_LOCALE } from './locales'
import type { Locale } from './locales'
import { hasKey, t, translationKeys } from '../i18n/translations'

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

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function inferBlockType(
  prefix: string,
  sectionId: string,
  i: number,
  locale: Locale
): BlockType {
  const bp = `${prefix}.${sectionId}.block.${i}`

  if (hasKey(`${bp}.src`)) return 'image'
  if (hasKey(`${bp}.text`)) return 'blockquote'
  if (hasKey(`${bp}.role`)) return 'author'
  if (hasKey(`${bp}.heading`)) return 'heading'
  if (hasKey(`${bp}.ol`)) return 'ordered-list'

  // The page's own locale, never the default. In the browser only the document's
  // dictionary is loaded, so asking for English on a Chinese page throws and the
  // island fails to hydrate — the body of /zh-CN/privacy-policy/ disappeared
  // that way, server-rendered fine and then wiped by the client.
  //
  // `hasKey` is safe without it: every dictionary carries the same keys, so it
  // reads whichever one is loaded.
  const value = hasKey(bp) ? t(bp as never, locale) : ''
  if (value.includes('\n')) return 'list'
  return 'paragraph'
}

export function deriveSections(
  prefix: string,
  locale: Locale = DEFAULT_LOCALE
): SectionConfig[] {
  const labelRegex = new RegExp(`^${escapeRegex(prefix)}\\.([^.]+)\\.label$`)
  const sectionIds: string[] = []

  for (const key of translationKeys) {
    const match = key.match(labelRegex)
    if (match && !sectionIds.includes(match[1])) {
      sectionIds.push(match[1])
    }
  }

  return sectionIds.map((id) => {
    const hasTitle = hasKey(`${prefix}.${id}.title`)

    const blockRegex = new RegExp(
      `^${escapeRegex(prefix)}\\.${escapeRegex(id)}\\.block\\.(\\d+)(?:\\.|$)`
    )
    const blockIndices = new Set<number>()
    for (const key of translationKeys) {
      const match = key.match(blockRegex)
      if (match) blockIndices.add(parseInt(match[1]))
    }

    const blocks = Array.from(blockIndices)
      .sort((a, b) => a - b)
      .map((i) => ({ type: inferBlockType(prefix, id, i, locale) }))

    return { id, hasTitle, blocks }
  })
}
