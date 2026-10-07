<template>
  <PackCardLayout
    :name="nodePack.name ?? ''"
    :description="nodePack.description"
    :is-selected
    :disabled="isDisabled"
  >
    <template #banner>
      <PackBanner :node-pack="nodePack" />
    </template>
    <div class="flex flex-col gap-y-2">
      <div class="flex flex-1 items-center gap-2">
        <div v-if="nodesLabel" class="p-2 pl-0 text-xs">
          {{ nodesLabel }}
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
          class="max-w-40 truncate text-xs/3 font-medium text-muted"
        >
          {{ publisherName }}
        </span>
      </div>
    </div>
    <template #footer>
      <PackCardFooter :node-pack="nodePack" :is-installing="isInstalling" />
    </template>
  </PackCardLayout>
</template>

<script setup lang="ts">
import { computed, provide } from 'vue'
import { useI18n } from 'vue-i18n'

import PackVersionBadge from '@/workbench/extensions/manager/components/manager/PackVersionBadge.vue'
import PackBanner from '@/workbench/extensions/manager/components/manager/packBanner/PackBanner.vue'
import PackCardFooter from '@/workbench/extensions/manager/components/manager/packCard/PackCardFooter.vue'
import PackCardLayout from '@/components/common/PackCardLayout.vue'
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

const { d, t } = useI18n()

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
const nodesLabel = computed(() =>
  nodesCount.value ? t('g.nodesCount', nodesCount.value) : ''
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
