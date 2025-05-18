import DOMPurify from 'dompurify'
import memoize from 'lodash/memoize'
import { Renderer, marked } from 'marked'
import { type ComputedRef, type Ref, computed, ref } from 'vue'

import type { ComfyNodeDefImpl } from '@/stores/nodeDefStore'
import { NodeSourceType } from '@/types/nodeSource'

const currentHelpNode = ref<ComfyNodeDefImpl | null>(null)
const isHelpOpen = computed(() => currentHelpNode.value !== null)

function openHelp(nodeDef: ComfyNodeDefImpl) {
  currentHelpNode.value = nodeDef
}

function closeHelp() {
  currentHelpNode.value = null
}

// Compute a base URL for relative asset links in HELP markdown
const baseUrl = computed(() => {
  const node = currentHelpNode.value
  if (node?.nodeSource.type === NodeSourceType.CustomNodes) {
    const parts = node.python_module.split('.')
    const moduleName = parts[1].split('@')[0]
    const raw = `/extensions/${moduleName}`
    return raw.replace(/\/+$/, '') + '/'
  }
  return ''
})

// Allowed extra tags/attributes for sanitized markdown
const ALLOWED_TAGS = ['video', 'source']
const ALLOWED_ATTRS = [
  'controls',
  'autoplay',
  'loop',
  'muted',
  'preload',
  'poster'
]

// Regex patterns to prefix relative src attributes in media tags
const SOURCE_SRC_REGEX = /(<source[^>]*src=")(?!(?:\/|https?:\/\/))([^"\s>]+)"/g
const VIDEO_SRC_REGEX = /(<video[^>]*src=")(?!(?:\/|https?:\/\/))([^"\s>]+)"/g

/** create a marked Renderer that prefixes relative URLs with base */
function createRenderer(baseUrl?: string): Renderer {
  const normalizedBase = baseUrl ? baseUrl.replace(/\/+$/, '') : ''
  const renderer = new Renderer()
  renderer.image = ({ href, title, text }) => {
    let src = href
    if (normalizedBase && !/^(?:\/|https?:\/\/)/.test(href)) {
      src = `${normalizedBase}/${href}`
    }
    const titleAttr = title ? ` title="${title}"` : ''
    return `<img src="${src}" alt="${text}"${titleAttr} loading="lazy" />`
  }
  renderer.link = ({ href, title, text }) => {
    let url = href
    if (normalizedBase && !/^(?:\/|https?:\/\/)/.test(href)) {
      url = `${normalizedBase}/${href}`
    }
    const titleAttr = title ? ` title="${title}"` : ''
    return `<a href="${url}"${titleAttr}>${text}</a>`
  }
  return renderer
}

/** memoized markdown -> sanitized HTML */
const memoizedRender = memoize(
  (markdown: string, base: string) => {
    let html = marked.parse(markdown, {
      renderer: createRenderer(base)
    }) as string
    if (base) {
      html = html
        .replace(SOURCE_SRC_REGEX, `$1${base}$2"`)
        .replace(VIDEO_SRC_REGEX, `$1${base}$2"`)
    }
    return DOMPurify.sanitize(html, {
      ADD_TAGS: ALLOWED_TAGS,
      ADD_ATTR: ALLOWED_ATTRS
    })
  },
  // Key resolver combines base and markdown to ensure unique cache entries
  (markdown: string, base: string) => `${base}|${markdown}`
)

const MAX_MEMOIZE_CACHE_SIZE = 50
const memoizeCache = memoizedRender.cache as Map<string, string>
const originalSet = memoizeCache.set.bind(memoizeCache)
memoizeCache.set = (key: string, value: string) => {
  const result = originalSet(key, value)
  if (memoizeCache.size > MAX_MEMOIZE_CACHE_SIZE) {
    const firstKey = memoizeCache.keys().next().value
    if (firstKey !== undefined) {
      memoizeCache.delete(firstKey)
    }
  }
  return result
}

export function useNodeHelp(): {
  currentHelpNode: Ref<ComfyNodeDefImpl | null>
  isHelpOpen: ComputedRef<boolean>
  openHelp: (node: ComfyNodeDefImpl) => void
  closeHelp: () => void
  baseUrl: ComputedRef<string>
  renderedHelpHtml: ComputedRef<string>
} {
  const renderedHelpHtml = computed(() => {
    const md = currentHelpNode.value?.help || ''
    return md ? memoizedRender(md, baseUrl.value) : ''
  })
  return {
    currentHelpNode,
    isHelpOpen,
    openHelp,
    closeHelp,
    baseUrl,
    renderedHelpHtml
  }
}
