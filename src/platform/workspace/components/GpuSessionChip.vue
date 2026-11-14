<template>
  <div
    v-if="settings"
    class="flex shrink-0 items-center gap-1"
    data-testid="gpu-session"
  >
    <label
      class="flex cursor-pointer items-center gap-2 px-1 text-sm"
      :title="ownerOnlyHint"
    >
      <Switch
        :model-value="settings.on"
        :disabled="saving || !canChange"
        @update:model-value="report(store.setOn($event))"
      />
      <span>{{ t('gpuSession.switch') }}</span>
    </label>
    <Menu :items="optionItems" :modal="false" align="end" :side-offset="8">
      <template #trigger>
        <Button
          variant="muted-textonly"
          size="icon"
          :aria-label="t('gpuSession.options')"
          :disabled="saving"
        >
          <i class="icon-[lucide--chevron-down] size-3" aria-hidden="true" />
        </Button>
      </template>
    </Menu>
    <PopoverRoot v-if="status">
      <PopoverTrigger as-child>
        <Button variant="muted-textonly" size="md" class="gap-1.5">
          <DeploymentStatusIcon
            :tone="STATUS_TONES[status]"
            icon-class="size-4"
          />
          {{ t(STATUS_LABELS[status]) }}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" class="w-96 p-3">
        <GpuSessionPanel />
      </PopoverContent>
    </PopoverRoot>
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { PopoverRoot, PopoverTrigger } from 'reka-ui'
import { computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@comfyorg/design-system/button/Button'
import type { MenuItem } from '@comfyorg/design-system/lib/menu/types'
import Menu from '@comfyorg/design-system/menu/Menu'
import PopoverContent from '@comfyorg/design-system/popover/PopoverContent'
import Switch from '@comfyorg/design-system/switch/Switch'
import { useToast } from '@/components/ui/toast/toastStore'
import DeploymentStatusIcon from '@/platform/workspace/components/DeploymentStatusIcon.vue'
import GpuSessionPanel from '@/platform/workspace/components/GpuSessionPanel.vue'
import type { DeploymentStatusTone } from '@/platform/workspace/composables/useDeploymentLabels'
import { IDLE_CHOICES } from '@/platform/workspace/gpuSession'
import type {
  GpuChangeRefusal,
  GpuStatus
} from '@/platform/workspace/stores/gpuSessionStore'
import { useGpuSessionStore } from '@/platform/workspace/stores/gpuSessionStore'

const STATUS_LABELS: Record<GpuStatus, string> = {
  starting: 'gpuSession.starting',
  on: 'gpuSession.on',
  unavailable: 'gpuSession.unavailable'
}

const STATUS_TONES: Record<GpuStatus, DeploymentStatusTone> = {
  starting: 'pending',
  on: 'ready',
  unavailable: 'failed'
}

const { t } = useI18n()
const store = useGpuSessionStore()
const { available, canChange, settings, status, saving } = storeToRefs(store)

const ownerOnlyHint = computed(() =>
  canChange.value ? undefined : t('gpuSession.ownerOnly')
)

watch(
  available,
  (shown) => {
    if (shown) store.install()
  },
  { immediate: true }
)

function report(saved: Promise<GpuChangeRefusal | null>) {
  void saved.then((refusal) => {
    if (refusal === 'ownerOnly') useToast().error(t('gpuSession.ownerOnly'))
    else if (refusal === 'failed') useToast().error(t('gpuSession.saveFailed'))
  })
}

const optionItems = computed<MenuItem[]>(() => {
  const current = settings.value
  if (!current) return []
  return [
    {
      label: t('gpuSession.ownerOnly'),
      disabled: true,
      visible: !canChange.value
    },
    {
      label: t('gpuSession.idleLabel'),
      disabled: saving.value || !canChange.value,
      radioGroup: {
        value: String(current.idleMinutes),
        options: IDLE_CHOICES.map((minutes) => ({
          value: String(minutes),
          label:
            minutes === 0
              ? t('gpuSession.idleNever')
              : t('gpuSession.idleAfter', minutes),
          command: () => report(store.setIdleMinutes(minutes))
        }))
      }
    },
    {
      label: t('gpuSession.closeLabel'),
      disabled: saving.value || !canChange.value,
      presentation: 'switch',
      checked: current.endOnClose,
      command: () => report(store.setEndOnClose(!current.endOnClose))
    }
  ]
})
</script>
