<!-- One row of the deployment switcher's list (FE-2434): a label, a caption,
     and a check on the row this browser runs on. `checked: null` makes it an
     action row rather than a choice. `mark` says whether the deployment can
     run the open workflow (BE-19373); without one the row says nothing. -->
<template>
  <button
    type="button"
    :role="checked === null ? 'menuitem' : 'menuitemradio'"
    :aria-checked="checked ?? undefined"
    :class="
      cn(
        'flex w-full cursor-pointer appearance-none items-center gap-2 border-0 border-b border-border-default bg-transparent px-4 py-3 text-left',
        'hover:bg-secondary-background-hover disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent',
        checked && 'bg-secondary-background'
      )
    "
  >
    <div class="flex min-w-0 flex-1 flex-col items-start gap-0.5">
      <span class="truncate text-sm text-base-foreground">{{ label }}</span>
      <span class="text-xs text-muted-foreground">{{ caption }}</span>
      <span
        v-if="mark"
        :class="
          cn(
            'flex items-center gap-1 text-xs',
            mark.kind === 'runs' && 'text-success-background',
            mark.kind === 'missing' && 'text-warning-background',
            mark.kind === 'unknown' && 'text-muted-foreground'
          )
        "
        :title="mark.kind === 'missing' ? mark.nodeTypes.join(', ') : undefined"
        data-testid="deployment-row-mark"
      >
        <i
          v-if="mark.kind === 'runs'"
          aria-hidden="true"
          class="icon-[lucide--circle-check] size-3 shrink-0"
        />
        <i
          v-else-if="mark.kind === 'missing'"
          aria-hidden="true"
          class="icon-[lucide--triangle-alert] size-3 shrink-0"
        />
        {{ markText }}
      </span>
    </div>
    <i
      v-if="checked"
      class="pi pi-check shrink-0 text-sm text-base-foreground"
    />
  </button>
</template>

<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type { DeploymentCompatibilityMark } from '@/platform/workspace/composables/useDeploymentCompatibility'

const {
  label,
  caption,
  checked,
  mark = null
} = defineProps<{
  label: string
  caption: string
  checked: boolean | null
  mark?: DeploymentCompatibilityMark | null
}>()

const { t } = useI18n()

const markText = computed(() => {
  if (mark === null) return ''
  if (mark.kind === 'runs') return t('deploymentSwitcher.runsThisWorkflow')
  if (mark.kind === 'missing') {
    return t('deploymentSwitcher.missingNodes', mark.nodeTypes.length)
  }
  return t('deploymentSwitcher.notChecked')
})
</script>
