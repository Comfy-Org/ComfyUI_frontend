<template>
  <Card
    class="w-full h-full inline-flex flex-col justify-between items-start overflow-hidden rounded-lg shadow-elevation-3 dark-theme:bg-dark-elevation-2 transition-all duration-200"
    :class="{
      'selected-card': isSelected,
      'opacity-60': isDisabled
    }"
    :pt="{
      body: { class: 'p-0 flex flex-col w-full h-full rounded-lg gap-0' },
      content: { class: 'flex-1 flex flex-col rounded-lg min-h-0' },
      title: { class: 'w-full h-full rounded-t-lg cursor-pointer' },
      footer: {
        class: 'p-0 m-0 flex flex-col gap-0',
        style: {
          borderTop: isLightTheme ? '1px solid #f4f4f4' : '1px solid #2C2C2C'
        }
      }
    }"
  >
    <template #title>
      <PackBanner :node-pack="nodePack" />
    </template>
    <template #content>
      <template v-if="isInstalling">
        <div
          class="self-stretch inline-flex flex-col justify-center items-center gap-2 h-full"
        >
          <ProgressSpinner />
          <div
            class="self-stretch text-center justify-start text-sm font-medium leading-none"
          >
            {{ $t('g.installing') }}...
          </div>
        </div>
      </template>
      <template v-else>
        <div class="pt-4 px-4 pb-3 w-full h-full">
          <div class="flex flex-col gap-y-1 w-full h-full">
            <span
              class="text-sm font-bold truncate overflow-hidden text-ellipsis"
            >
              {{ nodePack.name }}
            </span>
            <p
              v-if="nodePack.description"
              class="flex-1 text-muted text-xs font-medium break-words overflow-hidden min-h-12 line-clamp-3 my-0 leading-4 mb-1 overflow-hidden"
            >
              {{ nodePack.description }}
            </p>
            <div class="flex flex-col gap-y-2">
              <div class="flex-1 flex items-center gap-2">
                <div v-if="nodesCount" class="p-2 pl-0 text-xs">
                  {{ nodesCount }} {{ $t('g.nodes') }}
                </div>
                <PackVersionBadge
                  :node-pack="nodePack"
                  :is-selected="isSelected"
                  :fill="false"
                />
                <div
                  v-if="formattedLatestVersionDate"
                  class="px-2 py-1 flex justify-center items-center gap-1 text-xs text-muted font-medium"
                >
                  {{ formattedLatestVersionDate }}
                </div>
              </div>
              <div class="flex">
                <span
                  v-if="publisherName"
                  class="text-xs text-muted font-medium leading-3 max-w-40 truncate"
                >
                  {{ publisherName }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </template>
    </template>
    <template #footer>
      <PackCardFooter :node-pack="nodePack" />
    </template>
  </Card>
</template>

<script setup lang="ts">
import { whenever } from '@vueuse/core'
import Card from 'primevue/card'
import ProgressSpinner from 'primevue/progressspinner'
import { computed, provide, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import PackVersionBadge from '@/components/dialog/content/manager/PackVersionBadge.vue'
import PackBanner from '@/components/dialog/content/manager/packBanner/PackBanner.vue'
import PackCardFooter from '@/components/dialog/content/manager/packCard/PackCardFooter.vue'
import { useComfyManagerStore } from '@/stores/comfyManagerStore'
import { useColorPaletteStore } from '@/stores/workspace/colorPaletteStore'
import {
  IsInstallingKey,
  type MergedNodePack,
  type RegistryPack,
  isMergedNodePack
} from '@/types/comfyManagerTypes'

const { nodePack, isSelected = false } = defineProps<{
  nodePack: MergedNodePack | RegistryPack
  isSelected?: boolean
}>()

const { d } = useI18n()

const colorPaletteStore = useColorPaletteStore()
const isLightTheme = computed(
  () => colorPaletteStore.completedActivePalette.light_theme
)

const isInstalling = ref(false)
provide(IsInstallingKey, isInstalling)

const { isPackInstalled, isPackEnabled } = useComfyManagerStore()

const isInstalled = computed(() => isPackInstalled(nodePack?.id))
const isDisabled = computed(
  () => isInstalled.value && !isPackEnabled(nodePack?.id)
)

whenever(isInstalled, () => (isInstalling.value = false))

const nodesCount = computed(() =>
  isMergedNodePack(nodePack) ? nodePack.comfy_nodes?.length : undefined
)
const publisherName = computed(() => {
  if (!nodePack) return null

  const { publisher, author } = nodePack
  return publisher?.name ?? publisher?.id ?? author
})

const formattedLatestVersionDate = computed(() => {
  if (!nodePack.latest_version?.createdAt) return null

  return d(new Date(nodePack.latest_version.createdAt), {
    dateStyle: 'medium'
  })
})
</script>

<style scoped>
.selected-card {
  position: relative;
}

.selected-card::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  border: 4px solid var(--p-primary-color);
  border-radius: 0.5rem;
  pointer-events: none;
  z-index: 100;
}
</style>
