<script setup lang="ts">
import { DropdownMenuItemIndicator, DropdownMenuRadioItem } from 'reka-ui'
import { useI18n } from 'vue-i18n'

import { useWorkflowTabActivityStore } from '@/stores/workflowTabActivityStore'

import type { ActiveTab } from '../../../types/activeTab'

const { label, tabs, selectingTabPath, disabled } = defineProps<{
  label?: string
  tabs: ActiveTab[]
  selectingTabPath: string | null
  disabled: boolean
}>()
const { t } = useI18n()
const tabActivity = useWorkflowTabActivityStore()
</script>

<template>
  <div role="group" :aria-label="label">
    <div
      v-if="label"
      aria-hidden="true"
      class="px-1.5 py-1 text-[11px]/4 font-medium text-muted-foreground"
    >
      {{ label }}
    </div>
    <DropdownMenuRadioItem
      v-for="tab in tabs"
      :key="tab.path"
      :value="tab.path"
      :disabled="disabled || selectingTabPath !== null"
      :aria-busy="selectingTabPath === tab.path || undefined"
      class="box-border flex h-7 w-full cursor-pointer items-center gap-1.5 rounded-lg px-1.5 py-1 text-[14px]/5 font-normal text-base-foreground outline-none data-highlighted:bg-secondary-background-hover"
      @select.prevent
    >
      <span
        v-if="selectingTabPath === tab.path"
        role="status"
        class="flex size-4 shrink-0 items-center justify-center"
      >
        <span
          class="icon-[lucide--loader-circle] size-4 text-muted-foreground motion-safe:animate-spin"
          aria-hidden="true"
        />
        <span class="sr-only">{{ t('agent.savingWorkflow') }}</span>
      </span>
      <span
        v-else-if="tabActivity.editingTabPath === tab.path"
        role="img"
        :aria-label="t('g.agentWorking')"
        class="icon-[lucide--loader-circle] size-4 shrink-0 text-muted-foreground motion-safe:animate-spin"
      />
      <span
        v-else
        class="icon-[comfy--workflow] size-4 shrink-0 text-muted-foreground"
      />
      <span class="min-w-0 truncate">{{ tab.name }}</span>
      <span
        v-if="tabActivity.unseenModifiedPaths.has(tab.path)"
        role="img"
        :aria-label="t('g.agentModified')"
        class="flex size-4 shrink-0 items-center justify-center"
      >
        <span class="size-2 rounded-full bg-primary-background" />
      </span>
      <span
        v-else-if="tab.isPersisted === false || tab.modified"
        data-testid="unsaved-dot"
        class="flex size-4 shrink-0 items-center justify-center"
      >
        <span class="size-2 rounded-full bg-base-foreground" />
      </span>
      <span class="ml-auto flex size-4 shrink-0 items-center justify-center">
        <DropdownMenuItemIndicator
          class="flex size-4 items-center justify-center"
        >
          <span
            aria-hidden="true"
            class="icon-[comfy--comfy-c] size-2.5 text-brand-yellow"
          />
        </DropdownMenuItemIndicator>
      </span>
    </DropdownMenuRadioItem>
  </div>
</template>
