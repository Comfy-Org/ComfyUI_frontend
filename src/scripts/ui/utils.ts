type Props = {
  parent?: HTMLElement
  $?: (el: HTMLElement) => void
  dataset?: DOMStringMap
  style?: Partial<CSSStyleDeclaration>
  for?: string
  textContent?: string
  [key: string]: unknown
}

type Children = Element[] | Element | string | string[]

type ElementType<K extends string> = K extends keyof HTMLElementTagNameMap
  ? HTMLElementTagNameMap[K]
  : HTMLElement

export function $el<TTag extends string>(
  tag: TTag,
  propsOrChildren?: Children | Props,
  children?: Children
): ElementType<TTag> {
  const split = tag.split('.')
  const element = document.createElement(split.shift() as string)
  if (split.length > 0) {
    element.classList.add(...split)
  }

  if (propsOrChildren) {
    if (typeof propsOrChildren === 'string') {
      propsOrChildren = { textContent: propsOrChildren }
    } else if (propsOrChildren instanceof Element) {
      propsOrChildren = [propsOrChildren]
    }
    if (Array.isArray(propsOrChildren)) {
      element.append(...propsOrChildren)
    } else {
      const { parent, $: cb, dataset, style, ...rest } = propsOrChildren

      if (rest.for) {
        element.setAttribute('for', rest.for)
      }

      if (style) {
        Object.assign(element.style, style)
      }

      if (dataset) {
        Object.assign(element.dataset, dataset)
      }

      Object.assign(element, rest)
      if (children) {
        element.append(...(Array.isArray(children) ? children : [children]))
      }

      if (parent) {
        parent.append(element)
      }

      if (cb) {
        cb(element)
      }
    }
  }
  return element as ElementType<TTag>
}

export type ClassList = string | string[] | Record<string, boolean>

export function applyClasses(
  element: HTMLElement,
  classList: ClassList,
  ...requiredClasses: string[]
) {
  let str: string
  if (typeof classList === 'string') {
    str = classList
  } else if (classList instanceof Array) {
    str = classList.join(' ')
  } else {
    str = Object.entries(classList).reduce((p, c) => {
      if (c[1]) {
        p += (p.length ? ' ' : '') + c[0]
      }
      return p
    }, '')
  }
  element.className = str
  element.classList.add(...requiredClasses)
}

export function toggleElement<T>(
  element: HTMLElement,
  {
    onHide,
    onShow
  }: {
    onHide?: (el: HTMLElement) => void
    onShow?: (el: HTMLElement, value: NonNullable<T>) => void
  } = {}
) {
  let placeholder: Comment | undefined
  return (value: T) => {
    if (value) {
      if (placeholder) {
        placeholder.replaceWith(element)
        placeholder = undefined
      }
      onShow?.(element, value)
    } else {
      placeholder ??= document.createComment('')
      element.replaceWith(placeholder)
      onHide?.(element)
    }
  }
}
