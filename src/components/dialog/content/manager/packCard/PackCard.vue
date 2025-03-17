<template>
  <Card
    class="absolute inset-0 flex flex-col overflow-hidden rounded-2xl shadow-elevation-4 dark-theme:bg-dark-elevation-1 transition-all duration-200"
    :class="{
      'outline outline-[6px] outline-[var(--p-primary-color)]': isSelected
    }"
    :pt="{
      body: { class: 'p-0 flex flex-col h-full rounded-2xl' },
      content: { class: 'flex-1 flex flex-col rounded-2xl' },
      title: { class: 'p-0 m-0' },
      footer: { class: 'p-0 m-0' }
    }"
  >
    <template #title>
      <div class="flex justify-between p-5 pb-1 align-middle text-sm">
        <span class="flex items-start mt-2">
          <i
            class="pi pi-box text-muted text-2xl ml-1 mr-5"
            style="opacity: 0.5"
          />
          <span class="text-lg relative top-[.25rem]">{{
            $t('manager.nodePack')
          }}</span>
        </span>
        <div class="flex items-center gap-2.5">
          <div
            v-if="nodePack.downloads"
            class="flex items-center text-sm text-muted tracking-tighter"
          >
            <i class="pi pi-download mr-2" />
            {{ $n(nodePack.downloads) }}
          </div>
          <template v-if="isPackInstalled">
            <PackEnableToggle :node-pack="nodePack" />
          </template>
          <template v-else>
            <PackInstallButton :node-packs="[nodePack]" />
          </template>
        </div>
      </div>
    </template>
    <template #content>
      <ContentDivider />
      <div
        class="self-stretch px-4 py-3 inline-flex justify-start items-start cursor-pointer"
      >
        <PackIcon :node-pack="nodePack" />
        <div
          class="px-4 inline-flex flex-col justify-start items-start overflow-hidden"
        >
          <span
            class="text-sm font-bold truncate overflow-hidden text-ellipsis"
            :title="nodePack.name"
          >
            {{ nodePack.name }}
          </span>
          <div
            class="self-stretch inline-flex justify-center items-center gap-2.5"
          >
            <p
              v-if="nodePack.description"
              class="flex-1 justify-start text-muted text-sm font-medium leading-3 break-words overflow-hidden min-h-12 line-clamp-3"
              :title="nodePack.description"
            >
              {{ nodePack.description }}
            </p>
          </div>
          <div
            class="self-stretch inline-flex justify-start items-center gap-2"
          >
            <div
              v-if="nodesCount"
              class="px-2 py-1 flex justify-center text-sm items-center gap-1"
            >
              <div class="text-center justify-center font-medium leading-3">
                {{ nodesCount }} {{ $t('g.nodes') }}
              </div>
            </div>
            <div class="px-2 py-1 flex justify-center items-center gap-1">
              <div
                v-if="isUpdateAvailable"
                class="w-4 h-4 relative overflow-hidden"
              >
                <i class="pi pi-arrow-circle-up text-blue-600" />
              </div>
              <PackVersionBadge :node-pack="nodePack" />
            </div>
          </div>
        </div>
      </div>
    </template>
    <template #footer>
      <ContentDivider :width="0.1" />
      <PackCardFooter :node-pack="nodePack" />
    </template>
  </Card>
</template>

<script setup lang="ts">
import Card from 'primevue/card'
import { computed } from 'vue'

import ContentDivider from '@/components/common/ContentDivider.vue'
import PackVersionBadge from '@/components/dialog/content/manager/PackVersionBadge.vue'
import PackEnableToggle from '@/components/dialog/content/manager/button/PackEnableToggle.vue'
import PackInstallButton from '@/components/dialog/content/manager/button/PackInstallButton.vue'
import PackCardFooter from '@/components/dialog/content/manager/packCard/PackCardFooter.vue'
import PackIcon from '@/components/dialog/content/manager/packIcon/PackIcon.vue'
import { useComfyManagerStore } from '@/stores/comfyManagerStore'
import type { components } from '@/types/comfyRegistryTypes'
import { compareVersions, isSemVer } from '@/utils/formatUtil'

const { nodePack, isSelected = false } = defineProps<{
  nodePack: components['schemas']['Node']
  isSelected?: boolean
}>()

const { isPackInstalled, getInstalledPackVersion } = useComfyManagerStore()

const isInstalled = computed(() => isPackInstalled(nodePack?.id))
const isUpdateAvailable = computed(() => {
  if (!isInstalled.value) return false

  const latestVersion = nodePack.latest_version?.version
  if (!latestVersion) return false

  const installedVersion = getInstalledPackVersion(nodePack.id)

  // Consider nightly GitHub packs as always update-able
  if (installedVersion && !isSemVer(installedVersion)) return true

  return compareVersions(latestVersion, installedVersion) > 0
})

// TODO: remove type assertion once comfy_nodes is added to node (pack) info type in backend
const nodesCount = computed(() => (nodePack as any).comfy_nodes?.length)
</script>
