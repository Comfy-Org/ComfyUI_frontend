import { $el } from '../../ui'
import { ComfyDialog } from '../dialog'

export class ComfyAsyncDialog extends ComfyDialog<HTMLDialogElement> {
  // @ts-expect-error fixme ts strict error
  #resolve: (value: any) => void

  constructor(actions?: Array<string | { value?: any; text: string }>) {
    super(
      'dialog.comfy-dialog.comfyui-dialog',
      // @ts-expect-error fixme ts strict error
      actions?.map((opt) => {
        if (typeof opt === 'string') {
          opt = { text: opt }
        }
        return $el('button.comfyui-button', {
          type: 'button',
          textContent: opt.text,
          onclick: () => this.close(opt.value ?? opt.text)
        })
      })
    )
  }

  override show(html: string | HTMLElement | HTMLElement[]) {
    this.element.addEventListener('close', () => {
      this.close()
    })

    super.show(html)

    return new Promise((resolve) => {
      this.#resolve = resolve
    })
  }

  showModal(html: string | HTMLElement | HTMLElement[]) {
    this.element.addEventListener('close', () => {
      this.close()
    })

    super.show(html)
    this.element.showModal()

    return new Promise((resolve) => {
      this.#resolve = resolve
    })
  }

  override close(result = null) {
    this.#resolve(result)
    this.element.close()
    super.close()
  }

  static async prompt({
    title = null,
    message,
    actions
  }: {
    title: string | null
    message: string
    actions: Array<string | { value?: any; text: string }>
  }) {
    const dialog = new ComfyAsyncDialog(actions)
    const content = [$el('span', message)]
    if (title) {
      content.unshift($el('h3', title))
    }
    const res = await dialog.showModal(content)
    dialog.element.remove()
    return res
  }
}
