<script setup lang="ts">
import { computed, ref } from 'vue'

import { useAgentPersonality } from '@/platform/agent/composables/agentPersonalityState'
import { useAgentShaderBackground } from '@/platform/agent/composables/useAgentShaderBackground'
import { useSettingStore } from '@/platform/settings/settingStore'

const canvasRef = ref<HTMLCanvasElement>()
const personality = useAgentPersonality()
const reducedMotion = computed(
  () => !!useSettingStore().get('Comfy.Appearance.DisableAnimations')
)

useAgentShaderBackground(canvasRef, personality.shader, reducedMotion)
</script>

<template>
  <canvas
    ref="canvasRef"
    aria-hidden="true"
    class="pointer-events-none absolute inset-0 size-full rounded-[inherit]"
  />
</template>
