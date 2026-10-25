<template>
  <div
    v-if="isOffered && isVisible"
    class="flex shrink-0 items-center"
    data-testid="deployment-switcher"
  >
    <Menu
      v-model:open="isOpen"
      :modal="false"
      :side-offset="8"
      :class="
        cn(
          'max-w-[min(25rem,calc(100vw-1rem))] min-w-56',
          switcherMenuMotionClass
        )
      "
      @update:open="onOpenChange"
    >
      <template #trigger>
        <Button
          variant="secondary"
          size="unset"
          :disabled="isSwitching"
          :tooltip="hoverTooltip"
          tooltip-side="bottom"
          :aria-label="triggerLabel"
          class="group h-8 gap-1 rounded-lg pr-1.5 pl-2 data-[state=open]:bg-accent"
          data-testid="deployment-switcher-trigger"
        >
          <DeploymentStatusIcon
            :tone="currentTone"
            icon-class="size-4"
            ring-class="ring-2 ring-secondary group-hover:ring-accent group-data-[state=open]:ring-accent"
          />
          <i
            class="icon-[lucide--chevron-down] size-3 shrink-0 text-muted-foreground transition-transform duration-150 group-data-[state=open]:rotate-180"
            aria-hidden="true"
          />
        </Button>
      </template>
      <DeploymentSwitcherList
        :switching-to
        @choose="choose"
        @follow="follow"
        @set-default="changeDefault"
        @reload="reload"
      />
    </Menu>
  </div>
</template>

<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { useEventListener } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import Menu from '@/components/ui/menu/Menu.vue'
import { useToast } from '@/components/ui/toast/toastStore'
import { skipLeavePromptOnce } from '@/platform/workflow/management/leavePrompt'
import { DEPLOYMENT_LISTING_FOCUS_RETRY_MS } from '@/platform/workspace/api/deploymentListingTimeouts'
import DeploymentStatusIcon from '@/platform/workspace/components/DeploymentStatusIcon.vue'
import DeploymentSwitcherList from '@/platform/workspace/components/DeploymentSwitcherList.vue'
import { switcherMenuMotionClass } from '@/platform/workspace/components/deploymentSwitcherStyles'
import {
  COMFY_CLOUD_ROW,
  deploymentStatusTone,
  useDeploymentLabels
} from '@/platform/workspace/composables/useDeploymentLabels'
import { useDeploymentSwitchGuard } from '@/platform/workspace/composables/useDeploymentSwitchGuard'
import { useDeploymentSwitcherOffered } from '@/platform/workspace/composables/useDeploymentSwitcherOffered'
import {
  confirmUnsavedWorkBeforeSwitch,
  unsavedWorkflows
} from '@/platform/workspace/confirmUnsavedWorkBeforeSwitch'
import { reloadForDeploymentSwitch } from '@/platform/workspace/deploymentSwitchReload'
import { useDeploymentPickStore } from '@/platform/workspace/stores/deploymentPickStore'

const { t } = useI18n()
const store = useDeploymentPickStore()
const {
  pickedDeployment,
  isVisible,
  isSwitching,
  listingRefused,
  switcherOpenAsks
} = storeToRefs(store)
const isOffered = useDeploymentSwitcherOffered()
const { currentLabel } = useDeploymentLabels()
const { targetLabel, withoutLeavePrompt } = useDeploymentSwitchGuard()

const isOpen = ref(false)
const switchingTo = ref<string | null>(null)

watch(switcherOpenAsks, () => {
  if (!isOffered.value || !isVisible.value) return
  isOpen.value = true
  void store.load()
})

let pendingRetry: Promise<void> | undefined
let lastFocusRetryAt = -Infinity

onMounted(() => {
  if (!isOffered.value) return
  pendingRetry = store.loadOnce().finally(() => {
    pendingRetry = undefined
  })
})

useEventListener(window, 'focus', () => {
  if (pendingRetry || !isOffered.value) return
  if (isVisible.value || listingRefused.value) return
  if (Date.now() - lastFocusRetryAt < DEPLOYMENT_LISTING_FOCUS_RETRY_MS) return
  lastFocusRetryAt = Date.now()
  pendingRetry = store.load().finally(() => {
    pendingRetry = undefined
  })
})

function onOpenChange(open: boolean) {
  if (open) void store.load()
}

const currentTone = computed(() =>
  pickedDeployment.value
    ? deploymentStatusTone(pickedDeployment.value.status)
    : undefined
)
const isReady = computed(
  () => currentTone.value === undefined || currentTone.value === 'ready'
)
const triggerLabel = computed(() =>
  isReady.value
    ? t(
        'deploymentSwitcher.triggerLabel',
        { deployment: currentLabel.value },
        { escapeParameter: false }
      )
    : t(
        'deploymentSwitcher.triggerLabelNotReady',
        { status: hoverTooltip.value },
        { escapeParameter: false }
      )
)
function tooltipKey(): string {
  if (isReady.value) return 'deploymentSwitcher.currentTooltip'
  return pickedDeployment.value?.status === 'stopped'
    ? 'deploymentSwitcher.stoppedTooltip'
    : 'deploymentSwitcher.notReadyTooltip'
}
const hoverTooltip = computed(() =>
  t(
    tooltipKey(),
    { deployment: currentLabel.value },
    { escapeParameter: false }
  )
)

function report(summary: string, refusal: string | null) {
  if (refusal === null) return
  switchingTo.value = null
  isOpen.value = false
  useToast().error(summary, { description: refusal, duration: 8000 })
}

async function confirmSwitchTo(deployment: string): Promise<boolean> {
  if (unsavedWorkflows().length > 0) isOpen.value = false
  return confirmUnsavedWorkBeforeSwitch(deployment)
}

async function choose(deploymentId: string | null) {
  if (!(await confirmSwitchTo(targetLabel(deploymentId)))) return
  switchingTo.value = deploymentId ?? COMFY_CLOUD_ROW
  report(
    t('deploymentSwitcher.failedToSwitch'),
    await withoutLeavePrompt(() => store.pick(deploymentId))
  )
}

async function follow(deploymentId: string) {
  const reloads = deploymentId !== pickedDeployment.value?.deployment_id
  if (reloads && !(await confirmSwitchTo(targetLabel(deploymentId)))) return
  switchingTo.value = deploymentId
  report(
    t('deploymentSwitcher.failedToSwitch'),
    await withoutLeavePrompt(() => store.followWorkspace())
  )
}

async function changeDefault(deploymentId: string | null) {
  const reloads = store.defaultMovesThisBrowser(deploymentId)
  if (reloads && !(await confirmSwitchTo(targetLabel(deploymentId)))) return
  switchingTo.value = null
  report(
    t('deploymentSwitcher.failedToSetDefault'),
    await withoutLeavePrompt(() => store.setDefault(deploymentId))
  )
}

async function reload() {
  if (isSwitching.value) return
  if (!(await confirmSwitchTo(currentLabel.value)) || isSwitching.value) return
  skipLeavePromptOnce()
  reloadForDeploymentSwitch(() => void store.load())
}
</script>
