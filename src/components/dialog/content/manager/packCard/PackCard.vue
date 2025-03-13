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
      <div class="flex flex-1 p-5 mt-3 cursor-pointer">
        <div class="flex-shrink-0 mr-4">
          <PackIcon :node-pack="nodePack" />
        </div>
        <div class="flex flex-col flex-1 min-w-0">
          <span
            class="text-lg font-bold pb-4 truncate overflow-hidden text-ellipsis"
            :title="nodePack.name"
          >
            {{ nodePack.name }}
          </span>
          <div class="flex-1">
            <p
              v-if="nodePack.description"
              class="text-sm text-color-secondary m-0 line-clamp-3 overflow-hidden"
              :title="nodePack.description"
            >
              {{ nodePack.description }}
            </p>
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
import PackEnableToggle from '@/components/dialog/content/manager/button/PackEnableToggle.vue'
import PackInstallButton from '@/components/dialog/content/manager/button/PackInstallButton.vue'
import PackCardFooter from '@/components/dialog/content/manager/packCard/PackCardFooter.vue'
import PackIcon from '@/components/dialog/content/manager/packIcon/PackIcon.vue'
import { useComfyManagerStore } from '@/stores/comfyManagerStore'
import type { components } from '@/types/comfyRegistryTypes'

const { nodePack, isSelected = false } = defineProps<{
  nodePack: components['schemas']['Node']
  isSelected?: boolean
}>()

const managerStore = useComfyManagerStore()

const isPackInstalled = computed(() =>
  managerStore.isPackInstalled(nodePack?.id)
)
</script>
