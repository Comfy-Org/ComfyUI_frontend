import { reactive } from 'vue'

interface ConfirmStoreState {
  isOpen: boolean
  title: null | string
  message: null | string
  resolve: ((result: boolean) => void) | null
  buttons: {
    yes?: string | false
    no?: string | false
    cancel?: string | false
    delete?: string | false
  }
}

const state = reactive<ConfirmStoreState>({
  isOpen: false,
  title: null,
  message: null,
  resolve: null,
  buttons: {
    yes: false,
    no: false,
    cancel: false,
    delete: false
  }
})

interface Options {
  title?: string | null
  message?: string | null
  buttons?: {
    yes?: string | false
    no?: string | false
    cancel?: string | false
    delete?: string | false
  }
}

export const useConfirm = () => {
  const confirm = (options: Options = {}) => {
    state.isOpen = true
    state.title = options.title || ''
    state.message = options.message || ''
    state.buttons = options.buttons || {}

    if (options.buttons?.yes) {
      state.buttons.yes = options.buttons.yes
    }

    if (options.buttons?.no) {
      state.buttons.no = options.buttons.no
    }

    if (options.buttons?.cancel) {
      state.buttons.cancel = options.buttons.cancel
    }

    return new Promise<boolean>((resolve) => {
      state.resolve = resolve
    })
  }

  const answer = (bool: boolean) => {
    if (state.resolve) state.resolve(bool)
    close()
  }

  const close = () => {
    if (state.resolve) state.resolve(false)
    state.isOpen = false
  }

  return {
    state,
    answer,
    confirm,
    close
  }
}
