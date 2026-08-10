/** `scripts/ui.js` — `$el` is the only export packs use in any volume. */
export function $el(tag, propsOrChildren, childrenArg) {
  const [name, ...classes] = String(tag).split('.')
  const element = document.createElement(name || 'div')
  if (classes.length) element.classList.add(...classes)

  const props = Array.isArray(propsOrChildren) ? {} : (propsOrChildren ?? {})
  const children = Array.isArray(propsOrChildren)
    ? propsOrChildren
    : (childrenArg ?? [])

  for (const [key, value] of Object.entries(props)) {
    if (key === 'parent') value?.append(element)
    else if (key === 'style') Object.assign(element.style, value)
    else if (key === 'dataset') Object.assign(element.dataset, value)
    else if (key.startsWith('on')) element.addEventListener(key.slice(2), value)
    else if (key in element) element[key] = value
    else element.setAttribute(key, value)
  }
  for (const child of [children].flat()) {
    if (child) element.append(child)
  }
  return element
}

export class ComfyDialog {
  constructor() {
    this.element = document.createElement('div')
  }
  show() {}
  close() {}
}

export default { $el, ComfyDialog }
