import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useSearchBoxStore = defineStore('searchBox', () => {
  const visible = ref(false)
  function toggleVisible() {
    visible.value = !visible.value
  }

  return {
    visible,
    toggleVisible
  }
})
