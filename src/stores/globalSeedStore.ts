import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useGlobalSeedStore = defineStore('globalSeed', () => {
  // Global seed value that linked controls will use
  const globalSeed = ref(Math.floor(Math.random() * 1000000))

  const setGlobalSeed = (value: number) => {
    globalSeed.value = value
  }

  return {
    globalSeed,
    setGlobalSeed
  }
})
