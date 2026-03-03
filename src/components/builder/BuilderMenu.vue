<template>
  <Popover :show-arrow="false" class="min-w-56 p-3">
    <template #button>
      <button
        :class="
          cn(
            'absolute left-4 top-[calc(var(--workflow-tabs-height)+16px)] z-1000 inline-flex h-10 cursor-pointer items-center gap-2.5 rounded-lg py-2 pr-2 pl-3 shadow-interface transition-colors border-none',
            'bg-secondary-background hover:bg-secondary-background-hover',
            'data-[state=open]:bg-secondary-background-hover'
          )
        "
        :aria-label="t('linearMode.appModeToolbar.appBuilder')"
      >
        <i class="icon-[lucide--hammer] size-4" />
        <span class="text-sm font-medium">
          {{ t('linearMode.appModeToolbar.appBuilder') }}
        </span>
        <i class="icon-[lucide--chevron-down] size-4 text-muted-foreground" />
      </button>
    </template>
    <template #default="{ close }">
      <button
        :class="
          cn(
            'flex w-full items-center gap-3 rounded-md bg-transparent px-3 py-2 text-sm border-none',
            hasOutputs
              ? 'cursor-pointer hover:bg-secondary-background-hover'
              : 'opacity-50 pointer-events-none'
          )
        "
        :disabled="!hasOutputs"
        @click="onSave(close)"
      >
        <i class="icon-[lucide--save] size-4" />
        {{ t('builderMenu.saveApp') }}
      </button>
      <div class="my-1 border-t border-border-default" />
      <button
        class="flex w-full cursor-pointer items-center gap-3 rounded-md bg-transparent px-3 py-2 text-sm border-none hover:bg-secondary-background-hover"
        @click="onExitBuilder(close)"
      >
        <i class="icon-[lucide--square-pen] size-4" />
        {{ t('builderMenu.exitAppBuilder') }}
      </button>
    </template>
  </Popover>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'

import Popover from '@/components/ui/Popover.vue'
import { useAppModeStore } from '@/stores/appModeStore'
import { cn } from '@/utils/tailwindUtil'

import { useBuilderSave } from './useBuilderSave'

const { t } = useI18n()
const appModeStore = useAppModeStore()
const { hasOutputs } = storeToRefs(appModeStore)
const { setSaving } = useBuilderSave()

function onSave(close: () => void) {
  setSaving(true)
  close()
}

function onExitBuilder(close: () => void) {
  void appModeStore.exitBuilder()
  close()
}
</script>
