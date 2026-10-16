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
          :disabled="isSwitching || isSettling"
          :tooltip="hoverTooltip"
          tooltip-side="bottom"
          :aria-label="triggerLabel"
          class="group h-8 gap-1 rounded-lg pr-1.5 pl-2 data-[state=open]:bg-secondary-background-hover"
          data-testid="deployment-switcher-trigger"
        >
          <span class="relative flex">
            <DeploymentStatusIcon
              :tone="currentTone"
              icon-class="size-4"
              ring-class="ring-2 ring-secondary-background group-hover:ring-secondary-background-hover group-data-[state=open]:ring-secondary-background-hover"
            />
            <span
              v-if="isNew"
              class="absolute -top-0.75 -right-0.75 size-2 rounded-full bg-base-foreground ring-2 ring-secondary-background group-hover:ring-secondary-background-hover group-data-[state=open]:ring-secondary-background-hover"
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
        @create-custom-deployment="openCreateCustomDeploymentDialog"
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
import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { isCloud } from '@/platform/distribution/types'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import DeploymentStatusIcon from '@/platform/workspace/components/DeploymentStatusIcon.vue'
import DeploymentSwitcherList from '@/platform/workspace/components/DeploymentSwitcherList.vue'
import { switcherMenuMotionClass } from '@/platform/workspace/components/deploymentSwitcherStyles'
import {
  COMFY_CLOUD_ROW,
  deploymentStatusTone,
  useDeploymentLabels
} from '@/platform/workspace/composables/useDeploymentLabels'
import type { DiscardedWork } from '@/platform/workspace/deploymentSwitchReload'
import {
  NOTHING_DISCARDED,
  reloadForDeploymentSwitch
} from '@/platform/workspace/deploymentSwitchReload'
import { openCreateCustomDeploymentDialog } from '@/platform/workspace/openCustomDeploymentDialog'
import { settleUnsavedWorkBeforeSwitch } from '@/platform/workspace/settleUnsavedWorkBeforeSwitch'
import { useDeploymentPickStore } from '@/platform/workspace/stores/deploymentPickStore'

const { t } = useI18n()
const store = useDeploymentPickStore()
const {
  deployments,
  pickedDeployment,
  changeSinceBoot,
  isVisible,
  isSwitching,
  listingRefused
} = storeToRefs(store)
const workflowStore = useWorkflowStore()
const settingStore = useSettingStore()
const { isApiKeyLogin } = useCurrentUser()
const isOffered = computed(() => isCloud && !isApiKeyLogin.value)
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

const isNew = computed(() => !settingStore.get('Comfy.DeploymentSwitcher.Seen'))

function onOpenChange(open: boolean) {
  if (open) void store.load()
  else if (isNew.value)
    void settingStore.set('Comfy.DeploymentSwitcher.Seen', true)
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

const isSettling = ref(false)

async function settleBeforeSwitch(
  deployment: string
): Promise<DiscardedWork | null> {
  if (isSettling.value) return null
  if (workflowStore.modifiedWorkflows.length > 0) isOpen.value = false
  isSettling.value = true
  try {
    return await settleUnsavedWorkBeforeSwitch(deployment)
  } finally {
    isSettling.value = false
  }
}

function reloadOnto(discarded: DiscardedWork) {
  reloadForDeploymentSwitch(discarded, () => void store.load())
}

function landWhenNothingSwitched(discarded: DiscardedWork) {
  if (isSwitching.value) return
  switchingTo.value = null
  isOpen.value = false
  if (changeSinceBoot.value !== null) reloadOnto(discarded)
}

async function switchTo(
  deploymentId: string | null,
  discarded: DiscardedWork,
  start: () => Promise<string | null>
) {
  switchingTo.value = deploymentId ?? COMFY_CLOUD_ROW
  const refusal = await start()
  report(t('deploymentSwitcher.failedToSwitch'), refusal)
  if (refusal === null) landWhenNothingSwitched(discarded)
}

async function choose(deploymentId: string | null) {
  const discarded = await settleBeforeSwitch(targetLabel(deploymentId))
  if (discarded === null) return
  await switchTo(deploymentId, discarded, () =>
    store.pick(deploymentId, discarded)
  )
}

async function follow(deploymentId: string) {
  const discarded =
    deploymentId === pickedDeployment.value?.deployment_id
      ? NOTHING_DISCARDED
      : await settleBeforeSwitch(targetLabel(deploymentId))
  if (discarded === null) return
  await switchTo(deploymentId, discarded, () =>
    store.followWorkspace(discarded)
  )
}

async function changeDefault(deploymentId: string | null) {
  const discarded = store.defaultMovesThisBrowser(deploymentId)
    ? await settleBeforeSwitch(targetLabel(deploymentId))
    : NOTHING_DISCARDED
  if (discarded === null) return
  switchingTo.value = null
  report(
    t('deploymentSwitcher.failedToSetDefault'),
    await store.setDefault(deploymentId, discarded)
  )
}

async function reload() {
  if (isSwitching.value) return
  const discarded = await settleBeforeSwitch(currentLabel.value)
  if (discarded !== null) reloadOnto(discarded)
}
</script>
