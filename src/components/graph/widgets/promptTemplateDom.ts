import type {
  PromptSegment,
  PromptTemplate
} from '@/platform/prompts/promptTemplate'

export const CHIP_SELECTOR = '[data-chip-name]'

const CHIP_CLASS =
  'prompt-chip mx-0.5 inline-flex items-center rounded-sm px-1 align-baseline select-none cursor-default bg-primary-background/50 text-base-foreground'

function isChipElement(node: Node): node is HTMLElement {
  return (
    node.nodeType === Node.ELEMENT_NODE &&
    (node as HTMLElement).hasAttribute('data-chip-name')
  )
}

export function createChipElement(name: string): HTMLSpanElement {
  const el = document.createElement('span')
  el.className = CHIP_CLASS
  el.contentEditable = 'false'
  el.setAttribute('data-chip-name', name)
  el.textContent = `@${name}`
  return el
}

/** Builds a flat fragment of text nodes + chips for a template. */
function createTemplateFragment(template: PromptTemplate): DocumentFragment {
  const fragment = document.createDocumentFragment()
  for (const segment of template) {
    fragment.append(
      segment.type === 'text'
        ? document.createTextNode(segment.value)
        : createChipElement(segment.name)
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
      segments.push({
        type: 'var',
        name: child.getAttribute('data-chip-name') ?? ''
      })
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
