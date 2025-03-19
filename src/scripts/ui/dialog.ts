import { $el } from '../ui'

export class ComfyDialog<
  T extends HTMLElement = HTMLElement
> extends EventTarget {
  element: T
  // @ts-expect-error fixme ts strict error
  textElement: HTMLElement
  #buttons: HTMLButtonElement[] | null

  constructor(type = 'div', buttons = null) {
    super()
    this.#buttons = buttons
    this.element = $el(type + '.comfy-modal', { parent: document.body }, [
      $el('div.comfy-modal-content', [
        $el('p', { $: (p) => (this.textElement = p) }),
        ...this.createButtons()
      ])
    ]) as T
  }

  createButtons() {
    return (
      this.#buttons ?? [
        $el('button', {
          type: 'button',
          textContent: 'Close',
          onclick: () => this.close()
        })
      ]
    )
  }

  close() {
    this.element.style.display = 'none'
  }

  // @ts-expect-error fixme ts strict error
  show(html) {
    if (typeof html === 'string') {
      this.textElement.innerHTML = html
    } else {
      this.textElement.replaceChildren(
        ...(html instanceof Array ? html : [html])
      )
    }
    this.element.style.display = 'flex'
  }
}
