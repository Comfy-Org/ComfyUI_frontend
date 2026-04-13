<template>
  <div class="flex h-full flex-col gap-3">
    <div class="flex text-xs">
      <div>{{ t('apiNodesCostBreakdown.title') }}</div>
    </div>
    <ScrollPanel class="h-0 grow">
      <div class="flex flex-col gap-2">
        <div
          v-for="nodeName in nodeNames"
          :key="nodeName"
          class="flex items-center justify-between rounded-md bg-(--p-content-border-color) px-3 py-2"
        >
          <div class="flex items-center gap-2">
            <span class="text-base/tight font-medium">{{ nodeName }}</span>
          </div>
        </div>
      </div>
    </ScrollPanel>
  </div>
</template>

<script setup lang="ts">
import ScrollPanel from 'primevue/scrollpanel'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const { nodeNames } = defineProps<{ nodeNames: string[] }>()
</script>
