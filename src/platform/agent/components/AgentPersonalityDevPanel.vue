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
      hueRange: [40, 0, 180, 1],
      speed: [0.6, 0, 2, 0.01],
      scale: [3, 0.5, 10, 0.1],
      intensity: [0.8, 0, 1, 0.01],
      glow: [0.5, 0, 1, 0.01]
    },
    hover: {
      scale: [1.06, 1, 1.5, 0.01],
      stiffness: [260, 50, 600, 1],
      damping: [20, 1, 60, 1]
    },
    idle: {
      amplitude: [0.015, 0, 0.1, 0.001],
      period: [4, 1, 12, 0.1]
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
