import DOMPurify from 'dompurify'
import { Renderer, marked } from 'marked'
import { type ComputedRef, type Ref, computed, ref, watch } from 'vue'

import { api } from '@/scripts/api'
import type { ComfyNodeDefImpl } from '@/stores/nodeDefStore'

const currentHelpNode = ref<ComfyNodeDefImpl | null>(null)
const isHelpOpen = computed(() => currentHelpNode.value !== null)

function openHelp(nodeDef: ComfyNodeDefImpl) {
  currentHelpNode.value = nodeDef
}

function closeHelp() {
  currentHelpNode.value = null
}

// Base URL for relative assets in node docs markdown
const baseUrl = computed(() => {
  const node = currentHelpNode.value
  if (!node) return ''
  return `/docs/${node.name}/`
})

const helpContent = ref<string>('')
const isLoading = ref<boolean>(false)
const errorMsg = ref<string | null>(null)

// Watch for help node changes and fetch its docs markdown
watch(
  () => currentHelpNode.value,
  async (node) => {
    helpContent.value = ''
    errorMsg.value = null
    if (node) {
      isLoading.value = true
      try {
        const mdUrl = `/docs/${node.name}/en.md`
        const res = await fetch(api.fileURL(mdUrl))
        if (!res.ok) throw new Error(res.statusText)
        helpContent.value = await res.text()
      } catch (e: any) {
        errorMsg.value = e.message
        helpContent.value = node.description || ''
      } finally {
        isLoading.value = false
      }
    }
  },
  { immediate: true }
)

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

// Regex pattern to prefix relative src attributes in <source> or <video> tags
const MEDIA_SRC_REGEX =
  /(<(?:source|video)[^>]*\ssrc=['"])(?!(?:\/|https?:\/\/))([^'"\s>]+)['"]/gi

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
    return `<img src="${src}" alt="${text}"${titleAttr} />`
  }
  return renderer
}

export function useNodeHelp(): {
  currentHelpNode: Ref<ComfyNodeDefImpl | null>
  isHelpOpen: ComputedRef<boolean>
  openHelp: (node: ComfyNodeDefImpl) => void
  closeHelp: () => void
  baseUrl: ComputedRef<string>
  renderedHelpHtml: ComputedRef<string>
  isLoading: Ref<boolean>
  error: Ref<string | null>
} {
  const renderedHelpHtml = computed(() => {
    const md = helpContent.value || ''
    if (!md) return ''
    let html = marked.parse(md, {
      renderer: createRenderer(baseUrl.value)
    }) as string
    if (baseUrl.value) {
      html = html.replace(MEDIA_SRC_REGEX, `$1${baseUrl.value}$2"`)
    }
    return DOMPurify.sanitize(html, {
      ADD_TAGS: ALLOWED_TAGS,
      ADD_ATTR: ALLOWED_ATTRS
    })
  })
  return {
    currentHelpNode,
    isHelpOpen,
    openHelp,
    closeHelp,
    baseUrl,
    renderedHelpHtml,
    isLoading,
    error: errorMsg
  }
}
