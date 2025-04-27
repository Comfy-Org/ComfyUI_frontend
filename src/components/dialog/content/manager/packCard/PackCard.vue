<template>
  <Card
    class="w-full h-full inline-flex flex-col justify-between items-start overflow-hidden rounded-2xl shadow-elevation-3 dark-theme:bg-dark-elevation-2 transition-all duration-200"
    :class="{
      'outline outline-[6px] outline-[var(--p-primary-color)]': isSelected,
      'opacity-60': isDisabled
    }"
    :pt="{
      body: { class: 'p-0 flex flex-col w-full h-full rounded-2xl gap-0' },
      content: { class: 'flex-1 flex flex-col rounded-2xl' },
      title: {
        class:
          'self-stretch w-full px-4 py-3 inline-flex justify-start items-center gap-6'
      },
      footer: { class: 'p-0 m-0' }
    }"
  >
    <template #title>
      <PackCardHeader :node-pack="nodePack" />
    </template>
    <template #content>
      <ContentDivider />
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
        <div
          class="self-stretch px-4 py-3 inline-flex justify-start items-start cursor-pointer"
        >
          <PackIcon :node-pack="nodePack" />
          <div
            class="px-4 inline-flex flex-col justify-start items-start overflow-hidden"
          >
            <span
              class="text-sm font-bold truncate overflow-hidden text-ellipsis"
            >
              {{ nodePack.name }}
            </span>
            <div
              class="self-stretch inline-flex justify-center items-center gap-2.5"
            >
              <p
                v-if="nodePack.description"
                class="flex-1 justify-start text-muted text-sm font-medium leading-3 break-words overflow-hidden min-h-12 line-clamp-3"
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
    </template>
    <template #footer>
      <ContentDivider :width="0.1" />
      <PackCardFooter :node-pack="nodePack" />
    </template>
  </Card>
</template>

<script setup lang="ts">
import { whenever } from '@vueuse/core'
import Card from 'primevue/card'
import ProgressSpinner from 'primevue/progressspinner'
import { computed, provide, ref } from 'vue'

import ContentDivider from '@/components/common/ContentDivider.vue'
import PackVersionBadge from '@/components/dialog/content/manager/PackVersionBadge.vue'
import PackCardFooter from '@/components/dialog/content/manager/packCard/PackCardFooter.vue'
import PackIcon from '@/components/dialog/content/manager/packIcon/PackIcon.vue'
import { usePackUpdateStatus } from '@/composables/nodePack/usePackUpdateStatus'
import { useComfyManagerStore } from '@/stores/comfyManagerStore'
import { IsInstallingKey } from '@/types/comfyManagerTypes'
import type { components } from '@/types/comfyRegistryTypes'

const { nodePack, isSelected = false } = defineProps<{
  nodePack: components['schemas']['Node']
  isSelected?: boolean
}>()

const isInstalling = ref(false)
provide(IsInstallingKey, isInstalling)

const { isPackInstalled, isPackEnabled } = useComfyManagerStore()
const { isUpdateAvailable } = usePackUpdateStatus(nodePack)

const isInstalled = computed(() => isPackInstalled(nodePack?.id))
const isDisabled = computed(
  () => isInstalled.value && !isPackEnabled(nodePack?.id)
)

whenever(isInstalled, () => (isInstalling.value = false))

// TODO: remove type assertion once comfy_nodes is added to node (pack) info type in backend
const nodesCount = computed(() => (nodePack as any).comfy_nodes?.length)
</script>
