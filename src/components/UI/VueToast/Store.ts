// @ts-nocheck
import { reactive } from 'vue'

type ToastOption = {
  id: string
  type: string
  message: string
  sticky: boolean
}
const state = reactive({
  id: 0,
  list: [] as ToastOption[]
})

export const useToast = () => {
  const toast = {
    success(message, sticky = false) {
      const id = state.id++
      state.list.unshift({
        id: 'toast' + id,
        type: 'success',
        message: message,
        sticky: sticky
      })
    },

    warning(message, sticky = false) {
      const id = state.id++
      state.list.unshift({
        id: 'toast' + id,
        type: 'warning',
        message: message,
        sticky: sticky
      })
    },

    error(message, sticky = false) {
      const id = state.id++
      state.list.unshift({
        id: 'toast' + id,
        type: 'error',
        message: message,
        sticky: sticky
      })
    }
  }

  const remove = (toast) => {
    const i = state.list.findIndex((x) => x.id === toast.id)
    if (i > -1) state.list.splice(i, 1)
  }

  return {
    state,
    toast,
    remove
  }
}
