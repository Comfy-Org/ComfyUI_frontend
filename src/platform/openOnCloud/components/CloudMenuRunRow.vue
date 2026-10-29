<template>
  <MenuItem
    :disabled="state.kind === 'checking'"
    :class="
      cn(
        switcherItemClass,
        'py-1.5 data-disabled:opacity-100 data-highlighted:bg-secondary'
      )
    "
    data-testid="cloud-menu-run"
    @select="emit('select')"
  >
    <ProgressRing
      v-if="state.kind === 'uploading'"
      :percent="state.percent"
      class="size-3.5 shrink-0"
    />
    <i
      v-else
      :class="
        cn(
          'size-3.5 text-muted-foreground',
          state.kind === 'canOpen'
            ? 'icon-[lucide--cloud-check]'
            : 'icon-[lucide--cloud]'
        )
      "
      aria-hidden="true"
    />
    <span class="flex min-w-0 flex-1 flex-col">
      <span
        :class="
          cn(
            'truncate font-medium',
            detail ? 'text-muted-foreground' : 'text-foreground'
          )
        "
      >
        {{ $t('openOnCloud.cloudMenu.runThisWorkflow') }}
      </span>
      <span
        v-if="detail"
        class="truncate text-muted-foreground"
        data-testid="cloud-menu-run-detail"
      >
        {{ detail }}
      </span>
    </span>
    <span
      v-if="action"
      class="ml-4 flex h-6 shrink-0 items-center gap-1 rounded-sm bg-secondary px-2 text-foreground"
      data-testid="cloud-menu-run-action"
    >
      <i
        v-if="action.leadingIcon"
        :class="cn(action.leadingIcon, 'size-4')"
        aria-hidden="true"
      />
      {{ action.label }}
      <i
        v-if="action.trailingIcon"
        :class="cn(action.trailingIcon, 'size-4')"
        aria-hidden="true"
      />
    </span>
  </MenuItem>
</template>

<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import MenuItem from '@comfyorg/design-system/menu/MenuItem'
import type { CloudMenuState } from '@/platform/openOnCloud/cloudMenuState'
import ProgressRing from '@/platform/openOnCloud/components/ProgressRing.vue'
import { useCloudMenuCopy } from '@/platform/openOnCloud/composables/useCloudMenuCopy'
import { switcherItemClass } from '@/platform/workspace/components/deploymentSwitcherStyles'

interface RowAction {
  label: string
  leadingIcon?: string
  trailingIcon?: string
}

const { state } = defineProps<{
  state: CloudMenuState
}>()

const emit = defineEmits<{
  select: []
}>()

const { t } = useI18n()
const { detailLabel } = useCloudMenuCopy()

const detail = computed(() => detailLabel(state))

const action = computed<RowAction | null>(() => {
  switch (state.kind) {
    case 'canOpen':
      return {
        label: t('openOnCloud.open'),
        trailingIcon: 'icon-[lucide--external-link]'
      }
    case 'convert':
      return {
        label: t('openOnCloud.cloudMenu.convert'),
        leadingIcon: 'icon-[lucide--astroid]'
      }
    case 'upload':
      return { label: t('openOnCloud.cloudMenu.upload') }
    case 'signedOut':
      return { label: t('openOnCloud.cloudMenu.signIn') }
    default:
      return null
  }
})
</script>
