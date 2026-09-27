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
