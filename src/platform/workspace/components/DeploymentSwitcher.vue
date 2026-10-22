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
      :class="cn('max-w-100 min-w-56', switcherMenuMotionClass)"
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
          <span class="relative flex">
            <DeploymentStatusIcon
              :tone="currentTone"
              icon-class="size-4"
              ring-class="ring-2 ring-secondary group-hover:ring-accent group-data-[state=open]:ring-accent"
            />
            <span
              v-if="isNew"
              class="absolute -top-0.75 -right-0.75 size-2 rounded-full bg-foreground ring-2 ring-secondary group-hover:ring-accent group-data-[state=open]:ring-accent"
              aria-hidden="true"
              data-testid="deployment-switcher-new"
            />
          </span>
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
        @create-custom-deployment="createCustomDeployment"
      />
    </Menu>
  </div>
</template>

<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { useEventListener } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import Menu from '@/components/ui/menu/Menu.vue'
import { useToast } from '@/components/ui/toast/toastStore'
import { useSettingStore } from '@/platform/settings/settingStore'
import { reportError } from '@/platform/telemetry/reportError'
import { skipLeavePromptOnce } from '@/platform/workflow/management/leavePrompt'
import DeploymentStatusIcon from '@/platform/workspace/components/DeploymentStatusIcon.vue'
import DeploymentSwitcherList from '@/platform/workspace/components/DeploymentSwitcherList.vue'
import { switcherMenuMotionClass } from '@/platform/workspace/components/deploymentSwitcherStyles'
import {
  COMFY_CLOUD_ROW,
  deploymentStatusTone,
  useDeploymentLabels
} from '@/platform/workspace/composables/useDeploymentLabels'
import {
  confirmUnsavedWorkBeforeSwitch,
  unsavedWorkflows
} from '@/platform/workspace/confirmUnsavedWorkBeforeSwitch'
import { reloadForDeploymentSwitch } from '@/platform/workspace/deploymentSwitchReload'
import { openCreateCustomDeploymentDialog } from '@/platform/workspace/openCustomDeploymentDialog'
import { useDeploymentSwitcherOffered } from '@/platform/workspace/composables/useDeploymentSwitcherOffered'
import { useDeploymentPickStore } from '@/platform/workspace/stores/deploymentPickStore'

const { t } = useI18n()
const store = useDeploymentPickStore()
const {
  deployments,
  pickedDeployment,
  isVisible,
  isSwitching,
  listingRefused
} = storeToRefs(store)
const settingStore = useSettingStore()
const isOffered = useDeploymentSwitcherOffered()
const { currentLabel, deploymentFullLabel } = useDeploymentLabels()

const isOpen = ref(false)
const switchingTo = ref<string | null>(null)

let pendingRetry: Promise<void> | undefined

onMounted(() => {
  if (!isOffered.value) return
  pendingRetry = store.loadOnce().finally(() => {
    pendingRetry = undefined
  })
})

useEventListener(window, 'focus', () => {
  if (pendingRetry || !isOffered.value) return
  if (isVisible.value || listingRefused.value) return
  pendingRetry = store.load().finally(() => {
    pendingRetry = undefined
  })
})

const markedUntilClose = ref(false)
const isNew = computed(
  () =>
    markedUntilClose.value || !settingStore.get('Comfy.DeploymentSwitcher.Seen')
)

function rememberSeen() {
  markedUntilClose.value = true
  settingStore
    .set('Comfy.DeploymentSwitcher.Seen', true)
    .catch((error: unknown) =>
      reportError(error, {
        errorType: 'error_saving_deployment_switcher_seen',
        surface: 'platform'
      })
    )
}

function onOpenChange(open: boolean) {
  if (!open) {
    markedUntilClose.value = false
    return
  }
  void store.load()
  if (!settingStore.get('Comfy.DeploymentSwitcher.Seen')) rememberSeen()
}

const currentTone = computed(() =>
  pickedDeployment.value
    ? deploymentStatusTone(pickedDeployment.value.status)
    : undefined
)
const isReady = computed(
  () => currentTone.value === undefined || currentTone.value === 'ready'
)
const statusLabel = computed(() =>
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
const triggerLabel = computed(() =>
  isNew.value
    ? t(
        'deploymentSwitcher.triggerLabelNew',
        { label: statusLabel.value },
        { escapeParameter: false }
      )
    : statusLabel.value
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

function targetLabel(deploymentId: string | null): string {
  return deploymentFullLabel(
    deployments.value.find(
      (deployment) => deployment.deployment_id === deploymentId
    ) ?? null
  )
}

async function confirmSwitchTo(deployment: string): Promise<boolean> {
  if (unsavedWorkflows().length > 0) isOpen.value = false
  return confirmUnsavedWorkBeforeSwitch(deployment)
}

async function withoutLeavePrompt(
  start: () => Promise<string | null>
): Promise<string | null> {
  const keepLeavePrompt = skipLeavePromptOnce()
  const refusal = await start()
  if (!isSwitching.value) keepLeavePrompt()
  return refusal
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

function createCustomDeployment() {
  void openCreateCustomDeploymentDialog()
}

async function reload() {
  if (isSwitching.value) return
  if (!(await confirmSwitchTo(currentLabel.value)) || isSwitching.value) return
  skipLeavePromptOnce()
  reloadForDeploymentSwitch(() => void store.load())
}
</script>
