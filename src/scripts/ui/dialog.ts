import { $el } from '../ui'

export class ComfyDialog<
  T extends HTMLElement = HTMLElement
> extends EventTarget {
  element: T
  textElement!: HTMLElement
  #buttons: HTMLElement[] | null

  constructor(type = 'div', buttons: HTMLElement[] | null = null) {
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

  show(html?: string | HTMLElement | HTMLElement[]) {
    if (typeof html === 'string') {
      this.textElement.innerHTML = html
    } else if (html) {
      this.textElement.replaceChildren(
        ...(html instanceof Array ? html : [html])
      )
    }
    this.element.style.display = 'flex'
  }
}
