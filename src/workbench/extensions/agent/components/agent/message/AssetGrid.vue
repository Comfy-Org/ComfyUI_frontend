<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import type { FilePart } from '../../../services/agent/agentMessageParts'

import AssetCard from './AssetCard.vue'
import Lightbox from './Lightbox.vue'

const { assets } = defineProps<{ assets: FilePart[] }>()
const { t } = useI18n()

const open = ref(false)
const active = ref<FilePart | null>(null)

function show(asset: FilePart): void {
  active.value = asset
  open.value = true
}

const activeIsVideo = computed(
  () => active.value?.mediaType.startsWith('video') ?? false
)
</script>

<template>
  <div>
    <div class="grid grid-cols-2 gap-2">
      <AssetCard
        v-for="(asset, index) in assets"
        :key="index"
        :url="asset.url"
        :filename="asset.filename"
        :media-type="asset.mediaType"
        @click="show(asset)"
      />
    </div>
    <p class="text-agent-fg-subtle mt-1.5 text-xs">
      {{ t('agent.savedToAssets') }}
    </p>
    <Lightbox
      v-model:open="open"
      :url="active?.url"
      :filename="active?.filename"
      :is-video="activeIsVideo"
    />
  </div>
</template>
