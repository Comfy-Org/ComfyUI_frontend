import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useColorPickerStore = defineStore('colorPicker', () => {
  // State
  const isOpen = ref(false)
  const selectedColor = ref({
    red: 0,
    green: 0,
    blue: 0
  })

  return {
    isOpen,
    selectedColor
  }
})
