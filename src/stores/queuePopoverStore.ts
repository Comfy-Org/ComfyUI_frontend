import { defineStore } from 'pinia'

export const useQueuePopoverStore = defineStore('queuePopover', {
  state: () => ({
    activeJobDetailsId: null as string | null
  }),
  actions: {
    setActive(id: string) {
      this.activeJobDetailsId = id
    },
    clear() {
      this.activeJobDetailsId = null
    }
  }
})
