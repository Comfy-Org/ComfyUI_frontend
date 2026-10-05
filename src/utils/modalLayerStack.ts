export const MODAL_Z_BASE = 1700
export const MODAL_LAYER_SELECTOR = '[data-modal-layer]'

type ModalLayer = { element: HTMLElement; zIndex: number }

let layers: ModalLayer[] = []

export function topModalZIndex(): number {
  return layers.at(-1)?.zIndex ?? 0
}

export function raiseModalLayer(element: HTMLElement) {
  layers = layers.filter((layer) => layer.element !== element)
  const zIndex = Math.max(topModalZIndex(), MODAL_Z_BASE) + 1
  layers.push({ element, zIndex })
  element.style.zIndex = String(zIndex)
  element.dataset.modalLayer = ''
}

export function releaseModalLayer(element: HTMLElement) {
  layers = layers.filter((layer) => layer.element !== element)
  element.style.zIndex = ''
  delete element.dataset.modalLayer
}
