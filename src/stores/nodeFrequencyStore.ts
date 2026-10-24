import axios from 'axios'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { reportError } from '@/platform/telemetry/reportError'

export const useNodeFrequencyStore = defineStore('nodeFrequency', () => {
  const nodeFrequencyLookup = ref<Record<string, number>>({})
  const nodeNamesByFrequency = computed(() =>
    Object.keys(nodeFrequencyLookup.value)
  )
  const isLoaded = ref(false)

  const loadNodeFrequencies = async () => {
    if (!isLoaded.value) {
      try {
        const response = await axios.get('assets/sorted-custom-node-map.json')
        nodeFrequencyLookup.value = response.data
        isLoaded.value = true
      } catch (error) {
        reportError(error, {
          errorType: 'node_frequency_load_failure',
          surface: 'workspace'
        })
      }
    }
  }

  const getNodeFrequencyByName = (nodeName: string) => {
    return nodeFrequencyLookup.value[nodeName] ?? 0
  }

  const getNodeFrequency = (nodeDef: { name: string }) => {
    return getNodeFrequencyByName(nodeDef.name)
  }

  return {
    nodeNamesByFrequency,
    isLoaded,
    loadNodeFrequencies,
    getNodeFrequency,
    getNodeFrequencyByName
  }
})
