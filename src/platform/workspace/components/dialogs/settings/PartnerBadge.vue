<template>
  <span
    class="flex size-5 shrink-0 items-center justify-center rounded-[5px] text-2xs font-semibold text-white"
    :style="{ backgroundColor: color }"
  >
    {{ initial }}
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const { partner } = defineProps<{ partner: string }>()

// Approximate brand colors; a neutral fallback covers any new partner. Real
// brand marks can be swapped in for these initial badges later.
const BRAND_COLORS: Record<string, string> = {
  Anthropic: '#D97757',
  BFL: '#2A2A2A',
  Kling: '#0EA5A0',
  ByteDance: '#325AB4',
  Luma: '#7C3AED',
  Grok: '#1A1A1A',
  Gemini: '#4285F4',
  ElevenLabs: '#111111',
  Tencent: '#1479D7',
  Bria: '#FF5A5F',
  Ideogram: '#6366F1',
  LTXV: '#F59E0B',
  HitPaw: '#22C55E',
  Beeble: '#8B5CF6',
  Krea: '#0B0B0B'
}

const initial = computed(() => partner.charAt(0).toUpperCase())
const color = computed(() => BRAND_COLORS[partner] ?? '#4B5563')
</script>
