import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'

export interface MarkdownHostContext {
  sourceWidget: IBaseWidget
  /** Live read so a source that swaps its element is still mirrored. */
  getSourceElement: () => HTMLElement
  /** The host clone root (a copy of the comfy-markdown source element). */
  element: HTMLElement
  cloneTextarea: HTMLTextAreaElement
  signal: AbortSignal
}

export function isMarkdownHostElement(element: HTMLElement): boolean {
  return element.classList.contains('comfy-markdown')
}

/**
 * A comfy-markdown root renders Tiptap markup with a textarea for editing,
 * and the clone carries none of the source's listeners. Replay the editing
 * affordances on the clone, push its textarea edits through the source value
 * (whose callback sync updates the source element and every other host), and
 * expose a preview refresh that rebuilds the static cloned view from the
 * source's children while keeping the live textarea.
 */
export function attachMarkdownHostEditing(
  context: MarkdownHostContext,
  setRefreshPreview: (refresh: () => void) => void
): void {
  const { sourceWidget, getSourceElement, element, cloneTextarea, signal } =
    context

  const refreshPreview = () => {
    if (element.classList.contains('editing')) return
    const rebuilt = getSourceElement().cloneNode(true) as HTMLElement
    const staleTextarea = rebuilt.querySelector('textarea')
    if (staleTextarea) rebuilt.replaceChild(cloneTextarea, staleTextarea)
    else rebuilt.append(cloneTextarea)
    element.replaceChildren(...rebuilt.childNodes)
  }
  setRefreshPreview(refreshPreview)

  element.addEventListener(
    'dblclick',
    () => {
      element.classList.add('editing')
      cloneTextarea.focus()
    },
    { signal }
  )
  cloneTextarea.addEventListener(
    'blur',
    () => {
      element.classList.remove('editing')
      refreshPreview()
    },
    { signal }
  )
  element.addEventListener('keydown', (event) => event.stopPropagation(), {
    signal
  })
  const pushCloneEdits = () => {
    sourceWidget.value = cloneTextarea.value
  }
  cloneTextarea.addEventListener('input', pushCloneEdits, { signal })
  cloneTextarea.addEventListener('change', pushCloneEdits, { signal })
}
