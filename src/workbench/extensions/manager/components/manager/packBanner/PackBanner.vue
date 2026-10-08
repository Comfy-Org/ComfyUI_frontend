<template>
  <div class="z-0 aspect-7/3 w-full overflow-hidden">
    <NodePackThumbnail
      v-if="!imgSrc"
      :name="nodePack.name ?? ''"
      :identity="nodePack.id || nodePack.name"
    />
    <div v-else :key="imgSrc" class="relative size-full">
      <div
        class="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-30"
        :style="{
          backgroundImage: `url(${imgSrc})`,
          filter: 'blur(10px)'
        }"
      ></div>
      <img
        :src="imgSrc"
        :alt="nodePack.name ?? ''"
        class="relative z-10 size-full object-contain"
        @error="onImageError"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

import NodePackThumbnail from '@/components/common/NodePackThumbnail.vue'
import type { components } from '@/types/comfyRegistryTypes'

const { nodePack } = defineProps<{
  nodePack: components['schemas']['Node']
}>()

const failedSources = ref<string[]>([])
const candidates = computed(() =>
  [nodePack.banner_url, nodePack.icon]
    .map((source) => source?.trim())
    .filter((source): source is string => !!source)
)
const imgSrc = computed(() =>
  candidates.value.find((source) => !failedSources.value.includes(source))
)

function onImageError(event: Event) {
  if (!(event.currentTarget instanceof HTMLImageElement)) return
  const source = event.currentTarget.getAttribute('src')
  if (!source || !candidates.value.includes(source)) return
  failedSources.value = Array.from(
    new Set([
      ...failedSources.value.filter((failed) =>
        candidates.value.includes(failed)
      ),
      source
    ])
  )
}
</script>
