import { useChainCallback } from '@/composables/functional/useChainCallback'
import type { INodeInputSlot, LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import type { WidgetId } from '@/types/widgetId'

export interface PromotedHostWidgetContext {
  subgraphNode: LGraphNode
  input: INodeInputSlot
  widgetId: WidgetId
  sourceWidget: Readonly<IBaseWidget>
}

/**
 * True once the host node is settled in its graph. Clone/configure run with a
 * transient id, and materializing a DOM host then would detach the shared
 * element from its owner or leak duplicate widgets.
 */
export function isHostNodeSettled(node: LGraphNode): boolean {
  const graph = node.graph
  return !!graph && graph.getNodeById(node.id) === node
}

// Which host widget currently owns mounting an interior element: the first
// host shares the live node, later hosts get clones.
const claimedElements = new WeakMap<Element, symbol>()

export interface ClaimedHostElement {
  element: HTMLElement
  shared: boolean
  release: () => void
}

/**
 * The first promoted host of an interior element claims and shares it, so
 * in-place DOM updates stay live on it; later hosts for the same element fall
 * back to a clone. The claim releases when the sharing host is removed.
 */
export function claimOrCloneHostElement(
  sourceElement: HTMLElement
): ClaimedHostElement {
  const claim = Symbol('promoted-dom-host')
  const shared = !claimedElements.has(sourceElement)
  if (shared) claimedElements.set(sourceElement, claim)
  return {
    element: shared
      ? sourceElement
      : (sourceElement.cloneNode(true) as HTMLElement),
    shared,
    release: () => {
      if (shared && claimedElements.get(sourceElement) === claim)
        claimedElements.delete(sourceElement)
    }
  }
}

type SourceCallbackRegistration = {
  syncs: Set<() => void>
  previousCallback: IBaseWidget['callback']
  dispatcher: IBaseWidget['callback']
}

// Multiple promoted hosts can resolve the same interior widget from a shared
// Subgraph definition, so the callback wrapper is shared and the original
// callback is restored only when the last host releases its sync.
const sourceCallbackSyncs = new WeakMap<
  IBaseWidget,
  SourceCallbackRegistration
>()

/**
 * Chains `sync` onto the interior widget's callback so setter-driven value
 * changes reach every promoted host. Returns a releaser restoring the original
 * callback once the last host unsubscribes.
 */
export function addSourceCallbackSync(
  source: IBaseWidget,
  sync: () => void
): () => void {
  let registration = sourceCallbackSyncs.get(source)
  if (!registration) {
    const syncs = new Set<() => void>()
    const previousCallback = source.callback
    const dispatcher = useChainCallback(previousCallback, () => {
      for (const fn of syncs) fn()
    })
    registration = { syncs, previousCallback, dispatcher }
    sourceCallbackSyncs.set(source, registration)
    source.callback = dispatcher
  }
  const activeRegistration = registration
  activeRegistration.syncs.add(sync)
  let released = false
  return () => {
    if (released) return
    released = true
    activeRegistration.syncs.delete(sync)
    if (activeRegistration.syncs.size === 0) {
      if (source.callback === activeRegistration.dispatcher) {
        source.callback = activeRegistration.previousCallback
      }
      sourceCallbackSyncs.delete(source)
    }
  }
}

const attributeNames = (node: Element) =>
  Array.from(node.attributes, (attribute) => attribute.name)

const classesOf = (value: string | null) =>
  new Set((value ?? '').split(/\s+/).filter(Boolean))

/**
 * Mirrors in-place subtree mutations from the source element into a clone:
 * streaming display panels swap `<img src>` or rewrite text with no value
 * write or input event for the value/callback syncs to catch. Canvas bitmap
 * draws are invisible to the DOM and follow only structural rebuilds.
 * Returns a disposer.
 */
export function installInPlaceMirror(
  sourceElement: HTMLElement,
  clone: HTMLElement
): () => void {
  const sourcePath = (node: Node): number[] | undefined => {
    const path: number[] = []
    let current = node
    while (current !== sourceElement) {
      const parent = current.parentNode
      if (!parent) return undefined
      path.unshift(Array.prototype.indexOf.call(parent.childNodes, current))
      current = parent
    }
    return path
  }
  const inClone = (path: number[]): Node | undefined =>
    path.reduce<Node | undefined>(
      (current, index) => current?.childNodes[index],
      clone as Node
    )
  const rebuild = () =>
    clone.replaceChildren(
      ...(sourceElement.cloneNode(true) as HTMLElement).childNodes
    )

  // class is jointly owned: the source owns its classes, DomWidget.vue adds
  // layout classes to the host element. Everything else on the root belongs
  // to the source and must follow it in both directions.
  const sourceOwned = new Set(attributeNames(sourceElement))
  let mirroredClasses = classesOf(sourceElement.getAttribute('class'))
  const syncRootAttributes = () => {
    const hostClasses = new Set(clone.classList)
    for (const name of mirroredClasses) hostClasses.delete(name)
    mirroredClasses = classesOf(sourceElement.getAttribute('class'))
    clone.setAttribute('class', [...mirroredClasses, ...hostClasses].join(' '))
    for (const name of attributeNames(sourceElement))
      if (name !== 'class')
        clone.setAttribute(name, sourceElement.getAttribute(name) ?? '')
    for (const name of sourceOwned)
      if (name !== 'class' && !sourceElement.hasAttribute(name))
        clone.removeAttribute(name)
    for (const name of attributeNames(sourceElement)) sourceOwned.add(name)
  }

  const observer = new MutationObserver((records) => {
    for (const record of records) {
      if (record.type === 'attributes' || record.type === 'characterData') {
        if (record.target === sourceElement) {
          syncRootAttributes()
          continue
        }
        const path = sourcePath(record.target)
        const mirror = path === undefined ? undefined : inClone(path)
        if (!mirror) {
          rebuild()
          break
        }
        if (record.type === 'characterData') {
          mirror.nodeValue = record.target.nodeValue
          continue
        }
        const mirrorElement = mirror as Element
        for (const attribute of (record.target as Element).attributes)
          mirrorElement.setAttribute(attribute.name, attribute.value)
        for (const name of attributeNames(mirrorElement))
          if (!(record.target as Element).hasAttribute(name))
            mirrorElement.removeAttribute(name)
        continue
      }
      rebuild()
      break
    }
  })
  observer.observe(sourceElement, {
    childList: true,
    subtree: true,
    attributes: true,
    characterData: true
  })
  return () => observer.disconnect()
}
