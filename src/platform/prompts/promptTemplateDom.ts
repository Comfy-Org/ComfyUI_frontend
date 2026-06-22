import type {
  PromptSegment,
  PromptTemplate
} from '@/platform/prompts/schemas/promptTypes'

export const CHIP_SELECTOR = '[data-chip-type]'

const CHIP_CLASS =
  'prompt-chip mx-0.5 inline-flex items-center rounded-sm px-1 align-baseline select-none cursor-default bg-secondary-background text-secondary-foreground'

function isChipElement(node: Node): node is HTMLElement {
  return (
    node.nodeType === Node.ELEMENT_NODE &&
    (node as HTMLElement).hasAttribute('data-chip-type')
  )
}

function chipSegment(el: HTMLElement): PromptSegment | null {
  const type = el.getAttribute('data-chip-type')
  const name = el.getAttribute('data-chip-name') ?? ''
  if (type === 'asset') {
    return { type: 'asset', id: el.getAttribute('data-chip-id') ?? '', name }
  }
  if (type === 'var') {
    return { type: 'var', name }
  }
  return null
}

export function createChipElement(
  segment: Extract<PromptSegment, { type: 'asset' | 'var' }>
): HTMLSpanElement {
  const el = document.createElement('span')
  el.className = CHIP_CLASS
  el.contentEditable = 'false'
  el.setAttribute('data-chip-type', segment.type)
  el.setAttribute('data-chip-name', segment.name)
  if (segment.type === 'asset') el.setAttribute('data-chip-id', segment.id)
  el.textContent = `@${segment.name}`
  return el
}

/** Builds a flat fragment of text nodes + chips for a template. */
export function createTemplateFragment(
  template: PromptTemplate
): DocumentFragment {
  const fragment = document.createDocumentFragment()
  for (const segment of template) {
    fragment.append(
      segment.type === 'text'
        ? document.createTextNode(segment.value)
        : createChipElement(segment)
    )
  }
  return fragment
}

/** Renders a template into a contenteditable host as flat text nodes + chips. */
export function renderTemplateToElement(
  host: HTMLElement,
  template: PromptTemplate
): void {
  host.replaceChildren(createTemplateFragment(template))
}

/** Reconstructs a template from the contenteditable host's current DOM. */
export function parseElementToTemplate(host: HTMLElement): PromptTemplate {
  const segments: PromptSegment[] = []
  appendNode(host, segments)
  return mergeText(segments)
}

function appendNode(node: Node, segments: PromptSegment[]): void {
  for (const child of Array.from(node.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE) {
      const value = child.textContent ?? ''
      if (value) segments.push({ type: 'text', value })
    } else if (isChipElement(child)) {
      const segment = chipSegment(child)
      if (segment) segments.push(segment)
    } else if (child.nodeName === 'BR') {
      segments.push({ type: 'text', value: '\n' })
    } else {
      // Stray wrappers (e.g. from paste): treat block elements as line breaks.
      if (isBlockElement(child)) segments.push({ type: 'text', value: '\n' })
      appendNode(child, segments)
    }
  }
}

function isBlockElement(node: Node): boolean {
  return node.nodeName === 'DIV' || node.nodeName === 'P'
}

function mergeText(segments: PromptSegment[]): PromptTemplate {
  const merged: PromptSegment[] = []
  for (const segment of segments) {
    const previous = merged.at(-1)
    if (segment.type === 'text' && previous?.type === 'text') {
      previous.value += segment.value
    } else {
      merged.push(segment)
    }
  }
  return merged
}
