<template>
  <template v-if="notice || changeSinceBootMessage">
    <div
      v-if="notice"
      role="status"
      class="flex w-0 min-w-full items-start gap-2 px-2 py-1.5 text-xs text-muted-foreground"
      data-testid="deployment-switcher-notice"
    >
      <i
        class="mt-px icon-[lucide--triangle-alert] size-3.5 text-warning"
        aria-hidden="true"
      />
      <span class="text-pretty">{{ notice }}</span>
    </div>
    <template v-if="changeSinceBootMessage">
      <p
        role="status"
        class="m-0 w-0 min-w-full px-2 py-1.5 text-xs text-pretty text-muted-foreground"
        data-testid="deployment-switcher-changed"
      >
        {{ changeSinceBootMessage }}
      </p>
      <MenuItem
        :class="switcherItemClass"
        data-testid="deployment-switcher-reload"
        :disabled="isSwitching"
        @select="emit('reload')"
      >
        <i
          class="icon-[lucide--refresh-cw] size-3.5 text-muted-foreground"
          aria-hidden="true"
        />
        {{ $t('deploymentSwitcher.reload') }}
      </MenuItem>
    </template>
    <MenuSeparator />
  </template>
  <template v-for="section in listedSections" :key="section.key">
    <DropdownMenuLabel
      :id="section.labelId"
      :class="cn('px-2 pb-1 text-xs text-muted-foreground', section.labelClass)"
    >
      {{ section.label }}
    </DropdownMenuLabel>
    <DropdownMenuRadioGroup
      :model-value="pickedValue"
      :aria-labelledby="section.labelId"
    >
      <DeploymentSwitcherRow
        v-for="row in section.rows"
        :key="row.value"
        :value="row.value"
        :title="row.title"
        :deployment="row.name"
        :detail="row.detail"
        :tooltip="row.tooltip"
        :tone="row.tone"
        :note="row.note"
        :action-label="row.actionLabel"
        :action-icon="row.actionIcon"
        :problem="row.problem"
        :muted="row.muted"
        :switching="row.switching"
        :building="row.building"
        :disabled="row.disabled"
        :unpickable="row.unpickable"
        :data-focus-row="row.value"
        :aria-label="row.ariaLabel"
        :data-testid="row.testId"
        :edit-label="row.editLabel"
        @select="chooseRow($event, row)"
        @edit="updateRow(row)"
      />
    </DropdownMenuRadioGroup>
  </template>
  <p
    v-if="!listsDeployments"
    class="m-0 w-0 min-w-full px-2 py-1.5 text-xs text-pretty text-muted-foreground"
    data-testid="deployment-switcher-empty"
  >
    {{ $t('deploymentSwitcher.noDeployments') }}
  </p>
  <MenuSeparator v-else />
  <DeploymentSwitcherDefaultMenu
    v-if="workspaceDefaultOffered && (deployments.length > 0 || defaultGone)"
    :disabled="isSwitching"
    :clear-only="!onTeamPlan"
    @set-default="emit('setDefault', $event)"
  />
  <DeploymentSwitcherBuildAction
    :has-deployments="deployments.length > 0"
    @create-custom-deployment="emit('createCustomDeployment')"
  />
  <template v-if="deployments.length > 0">
    <MenuSeparator />
    <p
      class="m-0 w-0 min-w-full px-2 py-1.5 text-xs text-pretty text-muted-foreground"
    >
      {{ switchingNote }}
    </p>
  </template>
</template>

<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { storeToRefs } from 'pinia'
import { DropdownMenuLabel, DropdownMenuRadioGroup } from 'reka-ui'
import { computed, useId } from 'vue'
import { useI18n } from 'vue-i18n'

import MenuItem from '@comfyorg/design-system/menu/MenuItem'
import MenuSeparator from '@comfyorg/design-system/menu/MenuSeparator'
import DeploymentSwitcherBuildAction from '@/platform/workspace/components/DeploymentSwitcherBuildAction.vue'
import DeploymentSwitcherDefaultMenu from '@/platform/workspace/components/DeploymentSwitcherDefaultMenu.vue'
import DeploymentSwitcherRow from '@/platform/workspace/components/DeploymentSwitcherRow.vue'
import { switcherItemClass } from '@/platform/workspace/components/deploymentSwitcherStyles'
import { useDeploymentLabels } from '@/platform/workspace/composables/useDeploymentLabels'
import type { DeploymentRow } from '@/platform/workspace/composables/useDeploymentRows'
import { useDeploymentRows } from '@/platform/workspace/composables/useDeploymentRows'
import { useKeepRowFocus } from '@/platform/workspace/composables/useKeepRowFocus'
import { switchReloadNote } from '@/platform/workspace/confirmUnsavedWorkBeforeSwitch'
import type { DeploymentRowAction } from '@/platform/workspace/deploymentStartState'
import { usePlatformFrameStore } from '@/platform/workspace/platformFrame/platformFrameStore'
import { useDeploymentPickStore } from '@/platform/workspace/stores/deploymentPickStore'
import { useDeploymentStartStore } from '@/platform/workspace/stores/deploymentStartStore'
import {
  platformSurfaceLink,
  platformLinkWindowFeatures
} from '@/platform/workspace/utils/platformLink'

const STOPPED_PICK_ACTIONS = new Set<DeploymentRowAction>([
  'start',
  'retry',
  'open'
])

const { switchingTo, onTeamPlan } = defineProps<{
  switchingTo: string | null
  onTeamPlan: boolean
}>()

const emit = defineEmits<{
  choose: [deploymentId: string | null]
  follow: [deploymentId: string]
  reload: []
  setDefault: [deploymentId: string | null]
  createCustomDeployment: []
  updateDeployment: [deploymentId: string]
}>()

const { t } = useI18n()
const {
  deployments,
  pickedDeploymentId,
  defaultDeploymentId,
  goneDefaultDeploymentId,
  goneDeployment,
  canSetDefault,
  isSwitching,
  followsWorkspace
} = storeToRefs(useDeploymentPickStore())
const { currentLabel, changeSinceBootMessage } = useDeploymentLabels()
const { sections, pickedValue, pickedRow, buildingValue, listsDeployments } =
  useDeploymentRows()
const startStore = useDeploymentStartStore()
const sectionLabelId = useId()
const frames = usePlatformFrameStore()
const updatesInEditor = computed(() => frames.isAvailable())
useKeepRowFocus(sections)

const listedSections = computed(() =>
  sections.value.map((section, index) => ({
    ...section,
    labelId: `${sectionLabelId}-${section.key}`,
    labelClass: index === 0 ? 'pt-1.5' : 'pt-2.5',
    rows: section.rows.map((row) => {
      const editLabel = updateLabel(row)
      const unpickable = row.action === 'none'
      return {
        ...row,
        testId: `deployment-row-${row.deploymentId ?? 'cloud'}`,
        muted: row.action !== 'pick' && !isSwitching.value,
        switching: isSwitching.value && switchingTo === row.value,
        building:
          row.deploymentId !== null && row.deploymentId === buildingValue.value,
        disabled: isSwitching.value || (unpickable && editLabel === null),
        unpickable,
        editLabel
      }
    })
  }))
)

function updateLabel(row: DeploymentRow): string | null {
  if (!updatesInEditor.value || !row.updatable) return null
  return t(
    'platformFrame.updateDeployment',
    { deployment: row.title },
    { escapeParameter: false }
  )
}
const defaultGone = computed(() => goneDefaultDeploymentId.value !== null)
const workspaceDefaultOffered = computed(
  () =>
    canSetDefault.value &&
    (onTeamPlan || defaultDeploymentId.value !== null || defaultGone.value)
)

const notice = computed(() => {
  if (goneDeployment.value === 'pick') return t('deploymentSwitcher.pickGone')
  const picked = pickedRow.value
  if (picked && STOPPED_PICK_ACTIONS.has(picked.action)) {
    return t(
      picked.tone === 'failed'
        ? 'deploymentSwitcher.pickFailed'
        : 'deploymentSwitcher.pickStopped',
      { deployment: currentLabel.value },
      { escapeParameter: false }
    )
  }
  if (goneDeployment.value !== 'default') return null
  return workspaceDefaultOffered.value
    ? t('deploymentSwitcher.defaultGoneOwner')
    : t('deploymentSwitcher.defaultGone')
})

const switchingNote = computed(switchReloadNote)

function chooseRow(event: Event, row: DeploymentRow) {
  if (row.action === 'pick') {
    choose(event, row.deploymentId)
    return
  }
  if (row.deploymentId === null) return
  if (row.action === 'open') {
    openDeploymentPage(row.deploymentId)
    return
  }
  event.preventDefault()
  if (row.action === 'none') return
  void startStore.start(row.deploymentId)
}

function updateRow(row: DeploymentRow) {
  if (row.deploymentId !== null) emit('updateDeployment', row.deploymentId)
}

function openDeploymentPage(deploymentId: string) {
  window.open(
    platformSurfaceLink(
      `/profile/deployments/${encodeURIComponent(deploymentId)}`,
      'deployment-switcher'
    ),
    '_blank',
    platformLinkWindowFeatures()
  )
}

function choose(event: Event, deploymentId: string | null) {
  if (
    deploymentId !== null &&
    deploymentId === defaultDeploymentId.value &&
    !followsWorkspace.value
  ) {
    event.preventDefault()
    emit('follow', deploymentId)
    return
  }
  if (deploymentId === pickedDeploymentId.value) return
  event.preventDefault()
  emit('choose', deploymentId)
}
</script>
