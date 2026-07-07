<script setup lang="ts">
// Staged for FE-1187 host wiring (attachments are a V0 tech-design surface); built and tested, not yet wired into the shipped panel.
import type { CloudAsset } from '../../../composables/agent/useCloudAssets'

// The user's recent cloud assets; clicking one @-tags it into the message.
const { assets } = defineProps<{ assets: CloudAsset[] }>()
const emit = defineEmits<{ select: [asset: CloudAsset] }>()
</script>

<template>
  <div class="grid grid-cols-4 gap-1.5">
    <button
      v-for="asset in assets"
      :key="asset.id"
      type="button"
      :aria-label="asset.name"
      class="rounded-agent border-agent-border focus-visible:ring-agent-accent aspect-square overflow-hidden border focus-visible:ring-2 focus-visible:outline-none"
      @click="emit('select', asset)"
    >
      <img :src="asset.url" :alt="asset.name" class="size-full object-cover" />
    </button>
  </div>
</template>
