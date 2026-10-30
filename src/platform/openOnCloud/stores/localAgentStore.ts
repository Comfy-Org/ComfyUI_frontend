import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

type PrototypeLocalAgent = 'found' | 'notFound' | 'hidden'

/** A stand-in for the local agent that Convert hands the workflow to. */
export const useLocalAgentStore = defineStore('openOnCloudLocalAgent', () => {
  const prototypeAgent = ref<PrototypeLocalAgent>('found')
  const isFound = computed(() => prototypeAgent.value === 'found')
  const isOffered = computed(() => prototypeAgent.value !== 'hidden')
  const isConverting = ref(false)

  function convert() {
    isConverting.value = true
  }

  function stop() {
    isConverting.value = false
  }

  return { prototypeAgent, isFound, isOffered, isConverting, convert, stop }
})
