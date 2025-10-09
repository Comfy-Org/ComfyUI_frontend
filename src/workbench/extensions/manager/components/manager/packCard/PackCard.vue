<template>
  <Card
    class="shadow-elevation-3 inline-flex h-full w-full flex-col items-start justify-between overflow-hidden rounded-lg transition-all duration-200 dark-theme:bg-dark-elevation-2"
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
      <div class="h-full w-full px-4 pt-4 pb-3">
        <div class="flex h-full w-full flex-col gap-y-1">
          <span
            class="truncate overflow-hidden text-sm font-bold text-ellipsis"
          >
            {{ nodePack.name }}
          </span>
          <p
            v-if="nodePack.description"
            class="my-0 mb-1 line-clamp-3 min-h-12 flex-1 overflow-hidden text-xs leading-4 font-medium break-words text-muted"
          >
            {{ nodePack.description }}
          </p>
          <div class="flex flex-col gap-y-2">
            <div class="flex flex-1 items-center gap-2">
              <div v-if="nodesCount" class="p-2 pl-0 text-xs">
                {{ nodesCount }} {{ $t('g.nodes') }}
              </div>
              <PackVersionBadge
                :node-pack="nodePack"
                :is-selected="isSelected"
                :fill="false"
                :class="isInstalling ? 'pointer-events-none' : ''"
              />
              <div
                v-if="formattedLatestVersionDate"
                class="flex items-center justify-center gap-1 px-2 py-1 text-xs font-medium text-muted"
              >
                {{ formattedLatestVersionDate }}
              </div>
            </div>
            <div class="flex">
              <span
                v-if="publisherName"
                class="max-w-40 truncate text-xs leading-3 font-medium text-muted"
              >
                {{ publisherName }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </template>
    <template #footer>
      <PackCardFooter :node-pack="nodePack" :is-installing="isInstalling" />
    </template>
  </Card>
</template>

<script setup lang="ts">
import Card from 'primevue/card'
import { computed, provide } from 'vue'
import { useI18n } from 'vue-i18n'

import { useColorPaletteStore } from '@/stores/workspace/colorPaletteStore'
import PackVersionBadge from '@/workbench/extensions/manager/components/manager/PackVersionBadge.vue'
import PackBanner from '@/workbench/extensions/manager/components/manager/packBanner/PackBanner.vue'
import PackCardFooter from '@/workbench/extensions/manager/components/manager/packCard/PackCardFooter.vue'
import { useComfyManagerStore } from '@/workbench/extensions/manager/stores/comfyManagerStore'
import {
  IsInstallingKey,
  isMergedNodePack
} from '@/workbench/extensions/manager/types/comfyManagerTypes'
import type {
  MergedNodePack,
  RegistryPack
} from '@/workbench/extensions/manager/types/comfyManagerTypes'

const { nodePack, isSelected = false } = defineProps<{
  nodePack: MergedNodePack | RegistryPack
  isSelected?: boolean
}>()

const { d } = useI18n()

const colorPaletteStore = useColorPaletteStore()
const isLightTheme = computed(
  () => colorPaletteStore.completedActivePalette.light_theme
)

const { isPackInstalled, isPackEnabled, isPackInstalling } =
  useComfyManagerStore()

const isInstalling = computed(() => isPackInstalling(nodePack?.id))
provide(IsInstallingKey, isInstalling)

const isInstalled = computed(() => isPackInstalled(nodePack?.id))
const isDisabled = computed(
  () => isInstalled.value && !isPackEnabled(nodePack?.id)
)

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
