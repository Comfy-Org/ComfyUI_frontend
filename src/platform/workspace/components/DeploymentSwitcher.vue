<template>
  <div
    v-if="isOffered && isVisible"
    ref="switcher"
    class="flex shrink-0 items-center"
    data-testid="deployment-switcher"
  >
    <Menu
      :key="menuMounts"
      v-model:open="isOpen"
      :modal="false"
      :side-offset="8"
      :class="cn(switcherMenuWidthClass, switcherMenuMotionClass)"
    >
      <template #trigger>
        <Button
          variant="secondary"
          size="unset"
          :disabled="isSwitching"
          :tooltip="buildStatus?.text ?? hoverTooltip"
          tooltip-side="bottom"
          :aria-label="triggerLabel"
          class="group h-8 gap-1 rounded-lg pr-1.5 pl-2 data-[state=open]:bg-accent"
          data-testid="deployment-switcher-trigger"
        >
          <span class="relative flex">
            <i
              v-if="buildStatus"
              class="icon-[lucide--loader-circle] animate-spin"
              aria-hidden="true"
              data-testid="deployment-switcher-building"
            />
            <DeploymentStatusIcon
              v-else
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
          <span
            v-if="pickedRow && !buildStatus"
            class="max-w-24 truncate text-sm"
            data-testid="deployment-switcher-build-name"
            >{{ pickedRow.title }}</span
          >
          <i
            class="icon-[lucide--chevron-down] size-3 text-muted-foreground transition-transform duration-150 group-data-[state=open]:rotate-180"
            aria-hidden="true"
          />
          <template v-if="buildStatus" #tooltip>
            {{ buildStatus.stage
            }}<span
              v-if="buildStatus.step"
              class="opacity-50"
              data-testid="deployment-switcher-build-step"
              >{{ ` ${buildStatus.step}` }}</span
            >
          </template>
        </Button>
      </template>
      <DeploymentSwitcherList
        :switching-to
        :on-team-plan
        @choose="choose"
        @follow="follow"
        @set-default="changeDefault"
        @reload="reload"
        @create-custom-deployment="createCustomDeployment"
        @update-deployment="updateDeployment"
      />
    </Menu>
  </div>
</template>

<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { useEventListener, useIntervalFn } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import {
  computed,
  onMounted,
  onUnmounted,
  ref,
  useTemplateRef,
  watch
} from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@comfyorg/design-system/button/Button'
import Menu from '@comfyorg/design-system/menu/Menu'
import { useToast } from '@/components/ui/toast/toastStore'
import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { useSettingStore } from '@/platform/settings/settingStore'
import { reportError } from '@comfyorg/telemetry/reportError'
import {
  DEPLOYMENT_LISTING_FOCUS_RETRY_MS,
  DEPLOYMENT_START_POLL_MS
} from '@/platform/workspace/api/deploymentListingTimeouts'
import DeploymentStatusIcon from '@/platform/workspace/components/DeploymentStatusIcon.vue'
import DeploymentSwitcherList from '@/platform/workspace/components/DeploymentSwitcherList.vue'
import {
  switcherMenuMotionClass,
  switcherMenuWidthClass
} from '@/platform/workspace/components/deploymentSwitcherStyles'
import {
  COMFY_CLOUD_ROW,
  useDeploymentLabels
} from '@/platform/workspace/composables/useDeploymentLabels'
import { useDeploymentRows } from '@/platform/workspace/composables/useDeploymentRows'
import { useDeploymentSwitchGuard } from '@/platform/workspace/composables/useDeploymentSwitchGuard'
import { useDeploymentVersionWatch } from '@/platform/workspace/composables/useDeploymentVersionWatch'
import {
  confirmUnsavedWorkBeforeSwitch,
  unsavedWorkflows
} from '@/platform/workspace/confirmUnsavedWorkBeforeSwitch'
import type { UnsavedWorkPrompt } from '@/platform/workspace/confirmUnsavedWorkBeforeSwitch'
import { openCreateCustomDeploymentDialog } from '@/platform/workspace/openCustomDeploymentDialog'
import type { BuildStage } from '@/platform/workspace/platformFrame/platformFrameBuild'
import { usePlatformFrameStore } from '@/platform/workspace/platformFrame/platformFrameStore'
import { NEW_DEPLOYMENT_FROM_NODES } from '@/platform/workspace/platformFrame/platformFrameWaysIn'
import { useDeploymentSwitcherOffered } from '@/platform/workspace/composables/useDeploymentSwitcherOffered'
import { useDeploymentPickStore } from '@/platform/workspace/stores/deploymentPickStore'

const { onTeamPlan = false } = defineProps<{
  onTeamPlan?: boolean
}>()

const { t } = useI18n()
const store = useDeploymentPickStore()
const {
  pickedDeployment,
  isVisible,
  isSwitching,
  listingRefused,
  switcherOpenAsks
} = storeToRefs(store)
const settingStore = useSettingStore()
const isOffered = useDeploymentSwitcherOffered()
const { currentLabel } = useDeploymentLabels()
const { targetLabel, withoutLeavePrompt, reloadOntoCurrent } =
  useDeploymentSwitchGuard()
const { pickedRow, isAnyStarting } = useDeploymentRows()
const { flags } = useFeatureFlags()
const isWatchingVersion = useDeploymentVersionWatch({
  active: () =>
    isOffered.value && isVisible.value && flags.customDeploymentsEditorEnabled,
  reload
})
const frames = usePlatformFrameStore()
const { build } = storeToRefs(frames)

const isOpen = ref(false)
const switchingTo = ref<string | null>(null)

const menuMounts = ref(0)

function openOnFreshMenu() {
  if (!isOpen.value) menuMounts.value++
  isOpen.value = true
}

watch(switcherOpenAsks, () => {
  if (!isOffered.value || !isVisible.value) return
  openOnFreshMenu()
})

let pendingRetry: Promise<void> | undefined
let lastFocusRetryAt = -Infinity

onMounted(() => {
  store.switcherMounts++
})
onUnmounted(() => {
  store.switcherMounts--
})

onMounted(() => {
  if (!isOffered.value) return
  pendingRetry = store.loadOnce().finally(() => {
    pendingRetry = undefined
  })
})

useEventListener(window, 'focus', () => {
  if (pendingRetry || !isOffered.value) return
  if (listingRefused.value || isWatchingVersion.value) return
  if (Date.now() - lastFocusRetryAt < DEPLOYMENT_LISTING_FOCUS_RETRY_MS) return
  lastFocusRetryAt = Date.now()
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

watch(isOpen, (open) => {
  if (!open) {
    markedUntilClose.value = false
    return
  }
  void store.load()
  if (!settingStore.get('Comfy.DeploymentSwitcher.Seen')) rememberSeen()
})

let pendingPoll: Promise<void> | undefined
const startPoll = useIntervalFn(
  () => {
    if (pendingPoll) return
    pendingPoll = store.load().finally(() => {
      pendingPoll = undefined
    })
  },
  DEPLOYMENT_START_POLL_MS,
  { immediate: false }
)
watch(
  () =>
    (isOpen.value && isAnyStarting.value) ||
    pickedRow.value?.tone === 'pending',
  (polling) => (polling ? startPoll.resume() : startPoll.pause()),
  { immediate: true }
)

const currentTone = computed(() => pickedRow.value?.tone)
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
  const action = pickedRow.value?.action
  if (action === 'start' || action === 'retry') {
    return currentTone.value === 'failed'
      ? 'deploymentSwitcher.failedStartTooltip'
      : 'deploymentSwitcher.stoppedStartTooltip'
  }
  return currentTone.value === 'stopped' &&
    pickedDeployment.value?.status === 'stopped'
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

async function confirmSwitchTo(
  deployment: string,
  prompt?: UnsavedWorkPrompt
): Promise<boolean> {
  if (unsavedWorkflows().length > 0) isOpen.value = false
  return confirmUnsavedWorkBeforeSwitch(deployment, prompt)
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

const SHOWN_STAGES: ReadonlySet<BuildStage> = new Set(['building', 'deploying'])

const buildStatus = computed(() => {
  const current = build.value
  if (!current || !SHOWN_STAGES.has(current.stage)) return null
  const stage = t(
    current.stage === 'building'
      ? 'platformFrame.building'
      : 'platformFrame.deploying',
    { deployment: current.deploymentName },
    { escapeParameter: false }
  )
  const progress = current.stage === 'building' ? current.progress : null
  const step = progress ? t('platformFrame.buildStep', progress) : null
  return { stage, step, text: step ? `${stage} ${step}` : stage }
})

const switcher = useTemplateRef<HTMLElement>('switcher')

function focusTrigger() {
  switcher.value?.querySelector('button')?.focus()
}

function createCustomDeployment() {
  if (frames.isAvailable()) focusTrigger()
  if (frames.open(NEW_DEPLOYMENT_FROM_NODES, 'run_on_row')) return
  void openCreateCustomDeploymentDialog()
}

function updateDeployment(deploymentId: string) {
  focusTrigger()
  isOpen.value = false
  frames.open({ step: 'update', deploymentId }, 'pencil')
}

function reload() {
  return reloadOntoCurrent(confirmSwitchTo)
}
</script>
