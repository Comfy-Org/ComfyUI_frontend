import { $el } from '../../ui'
import { ComfyDialog } from '../dialog'

type DialogAction<T> = string | { value?: T; text: string }

export class ComfyAsyncDialog<
  T = string
> extends ComfyDialog<HTMLDialogElement> {
  #resolve!: (value: T | string | null) => void

  constructor(actions?: Array<DialogAction<T>>) {
    super(
      'dialog.comfy-dialog.comfyui-dialog',
      actions?.map((opt) => {
        const option = typeof opt === 'string' ? { text: opt } : opt
        return $el('button.comfyui-button', {
          type: 'button',
          textContent: option.text,
          onclick: () => this.close(option.value ?? option.text)
        })
      })
    )
  }

  override show(
    html: string | HTMLElement | HTMLElement[]
  ): Promise<T | string | null> {
    this.element.addEventListener('close', () => {
      this.close()
    })

    super.show(html)

    return new Promise((resolve) => {
      this.#resolve = resolve
    })
  }

  showModal(
    html: string | HTMLElement | HTMLElement[]
  ): Promise<T | string | null> {
    this.element.addEventListener('close', () => {
      this.close()
    })

    super.show(html)
    this.element.showModal()

    return new Promise((resolve) => {
      this.#resolve = resolve
    })
  }

  override close(result: T | string | null = null): void {
    this.#resolve(result)
    this.element.close()
    super.close()
  }

  static async prompt<U = string>({
    title = null,
    message,
    actions
  }: {
    title: string | null
    message: string
    actions: Array<DialogAction<U>>
  }): Promise<U | string | null> {
    const dialog = new ComfyAsyncDialog<U>(actions)
    const content = [$el('span', message)]
    if (title) {
      content.unshift($el('h3', title))
    }
    const res = await dialog.showModal(content)
    dialog.element.remove()
    return res
  }
}
