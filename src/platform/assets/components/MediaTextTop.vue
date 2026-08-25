<template>
  <div class="relative size-full overflow-hidden rounded-sm">
    <div
      class="size-full bg-modal-card-placeholder-background transition-transform duration-300 group-hover:scale-105 group-data-[selected=true]:scale-105"
    >
      <p
        v-if="snippet"
        class="m-0 size-full overflow-hidden p-2 text-left text-xs/4 wrap-break-word whitespace-pre-wrap text-base-foreground"
      >
        {{ snippet }}
      </p>
      <div v-else class="flex size-full items-center justify-center">
        <i class="icon-[lucide--text] text-3xl text-base-foreground" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import { useTextFileContent } from '@/composables/useTextFileContent'

import type { AssetMeta } from '../schemas/mediaAssetSchema'

const MAX_SNIPPET_LENGTH = 1000

const { asset } = defineProps<{
  asset: AssetMeta
}>()

const { textContent } = useTextFileContent(() => ({
  url: asset.preview_url || asset.src
}))

const snippet = computed(() => textContent.value.slice(0, MAX_SNIPPET_LENGTH))
</script>
