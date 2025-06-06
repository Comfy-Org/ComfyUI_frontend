<template>
  <Card
    class="w-full h-full inline-flex flex-col justify-between items-start overflow-hidden rounded-2xl shadow-elevation-3 dark-theme:bg-dark-elevation-2 transition-all duration-200"
    :class="{
      'outline outline-[6px] outline-[var(--p-primary-color)]': isSelected,
      'opacity-60': isDisabled
    }"
    :pt="{
      body: { class: 'p-0 flex flex-col w-full h-full rounded-2xl gap-0' },
      content: { class: 'flex-1 flex flex-col rounded-2xl min-h-0' },
      title: { class: 'w-full h-full rounded-t-lg cursor-pointer' },
      footer: { class: 'p-0 m-0' }
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
        <div
          class="self-stretch inline-flex flex-col justify-start items-start"
        >
          <div
            class="px-4 py-3 inline-flex justify-start items-start cursor-pointer w-full"
          >
            <div
              class="inline-flex flex-col justify-start items-start overflow-hidden gap-y-3 w-full"
            >
              <span
                class="text-base font-bold truncate overflow-hidden text-ellipsis"
              >
                {{ nodePack.name }}
              </span>
              <p
                v-if="nodePack.description"
                class="flex-1 justify-start text-muted text-sm font-medium break-words overflow-hidden min-h-12 line-clamp-3 my-0 leading-5"
              >
                {{ nodePack.description }}
              </p>
              <div class="flex flex-col gap-y-2">
                <div
                  class="self-stretch inline-flex justify-start items-center gap-1"
                >
                  <div
                    v-if="nodesCount"
                    class="pr-2 py-1 flex justify-center text-sm items-center gap-1"
                  >
                    <div
                      class="text-center justify-center font-medium leading-3"
                    >
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
import { useI18n } from 'vue-i18n'

import ContentDivider from '@/components/common/ContentDivider.vue'
import PackVersionBadge from '@/components/dialog/content/manager/PackVersionBadge.vue'
import PackBanner from '@/components/dialog/content/manager/packBanner/PackBanner.vue'
import PackCardFooter from '@/components/dialog/content/manager/packCard/PackCardFooter.vue'
import { usePackUpdateStatus } from '@/composables/nodePack/usePackUpdateStatus'
import { useComfyManagerStore } from '@/stores/comfyManagerStore'
import { IsInstallingKey } from '@/types/comfyManagerTypes'
import type { components } from '@/types/comfyRegistryTypes'

const { nodePack, isSelected = false } = defineProps<{
  nodePack: components['schemas']['Node']
  isSelected?: boolean
}>()

const { d } = useI18n()

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
