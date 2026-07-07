<script setup lang="ts">
import { watch } from 'vue'

import { DialRoot, useDialKit } from 'dialkit/vue'

import 'dialkit/styles.css'

import { setAgentPersonality } from '@/platform/agent/composables/agentPersonalityState'

const params = useDialKit(
  'Agent Personality',
  {
    shader: {
      hueBase: [45, 0, 360, 1],
      hueRange: [22, 0, 180, 1],
      speed: [1.61, 0, 2, 0.01],
      scale: [2.8, 0.5, 10, 0.1],
      intensity: [0.47, 0, 1, 0.01],
      glow: [0.12, 0, 1, 0.01]
    },
    hover: {
      scale: [1, 1, 1.5, 0.01],
      stiffness: [50, 50, 600, 1],
      damping: [1, 1, 60, 1]
    },
    idle: {
      amplitude: [0, 0, 0.1, 0.001],
      period: [1, 1, 12, 0.1]
    },
    shimmer: {
      speed: [2.7, 0.5, 5, 0.1],
      spread: [10, 5, 50, 1],
      opacity: [0.24, 0, 1, 0.01]
    }
  },
  { id: 'agent-personality', persist: true }
)

watch(params, (values) => setAgentPersonality(values), {
  deep: true,
  immediate: true
})
</script>

<template>
  <DialRoot />
</template>
