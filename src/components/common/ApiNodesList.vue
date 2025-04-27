<template>
  <div class="flex flex-col gap-3 h-full">
    <div class="flex text-xs">
      <div>{{ t('apiNodesCostBreakdown.title') }}</div>
    </div>
    <ScrollPanel class="flex-grow h-0">
      <div class="flex flex-col gap-2">
        <div
          v-for="nodeName in nodeNames"
          :key="nodeName"
          class="flex items-center justify-between px-3 py-2 rounded-md bg-[var(--p-content-border-color)]"
        >
          <div class="flex items-center gap-2">
            <span class="text-base font-medium leading-tight">{{
              nodeName
            }}</span>
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
