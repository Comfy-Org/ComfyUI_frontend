function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs?: Record<string, string>,
  ...children: (string | Node)[]
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag)
  if (attrs) {
    for (const [key, value] of Object.entries(attrs)) {
      element.setAttribute(key, value)
    }
  }
  for (const child of children) {
    if (typeof child === 'string') {
      element.appendChild(document.createTextNode(child))
    } else {
      element.appendChild(child)
    }
  }
  return element
}

function qs<T extends HTMLElement>(
  selector: string,
  parent: ParentNode = document
): T {
  const found = parent.querySelector<T>(selector)
  if (!found) throw new Error(`Element not found: ${selector}`)
  return found
}

function qsa<T extends HTMLElement>(
  selector: string,
  parent: ParentNode = document
): T[] {
  return Array.from(parent.querySelectorAll<T>(selector))
}

function setHtml(element: HTMLElement, html: string): void {
  element.innerHTML = html
}

export { el, qs, qsa, setHtml }
