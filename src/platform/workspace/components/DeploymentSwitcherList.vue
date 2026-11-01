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
        :disabled="row.disabled"
        :data-focus-row="row.value"
        :aria-label="row.ariaLabel"
        :data-testid="row.testId"
        @select="chooseRow($event, row)"
      />
    </DropdownMenuRadioGroup>
  </template>
  <p
    v-if="deployments.length === 0"
    class="m-0 w-0 min-w-full px-2 py-1.5 text-xs text-pretty text-muted-foreground"
    data-testid="deployment-switcher-empty"
  >
    {{ $t('deploymentSwitcher.noDeployments') }}
  </p>
  <MenuSeparator v-else />
  <DeploymentSwitcherDefaultMenu
    v-if="canSetDefault && (deployments.length > 0 || defaultGone)"
    :disabled="isSwitching"
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
import { getComfyPlatformBaseUrl } from '@/config/comfyApi'
import { useSettingStore } from '@/platform/settings/settingStore'
import DeploymentSwitcherBuildAction from '@/platform/workspace/components/DeploymentSwitcherBuildAction.vue'
import DeploymentSwitcherDefaultMenu from '@/platform/workspace/components/DeploymentSwitcherDefaultMenu.vue'
import DeploymentSwitcherRow from '@/platform/workspace/components/DeploymentSwitcherRow.vue'
import { switcherItemClass } from '@/platform/workspace/components/deploymentSwitcherStyles'
import { useDeploymentLabels } from '@/platform/workspace/composables/useDeploymentLabels'
import type { DeploymentRow } from '@/platform/workspace/composables/useDeploymentRows'
import { useDeploymentRows } from '@/platform/workspace/composables/useDeploymentRows'
import { useKeepRowFocus } from '@/platform/workspace/composables/useKeepRowFocus'
import type { DeploymentRowAction } from '@/platform/workspace/deploymentStartState'
import { useDeploymentPickStore } from '@/platform/workspace/stores/deploymentPickStore'
import { useDeploymentStartStore } from '@/platform/workspace/stores/deploymentStartStore'

const STOPPED_PICK_ACTIONS = new Set<DeploymentRowAction>([
  'start',
  'retry',
  'open'
])

const { switchingTo } = defineProps<{
  switchingTo: string | null
}>()

const emit = defineEmits<{
  choose: [deploymentId: string | null]
  follow: [deploymentId: string]
  reload: []
  setDefault: [deploymentId: string | null]
  createCustomDeployment: []
}>()

const { t } = useI18n()
const settingStore = useSettingStore()
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
const { sections, pickedValue, pickedRow } = useDeploymentRows()
const startStore = useDeploymentStartStore()
const sectionLabelId = useId()
useKeepRowFocus(sections)

const platformUrl = getComfyPlatformBaseUrl()

const listedSections = computed(() =>
  sections.value.map((section, index) => ({
    ...section,
    labelId: `${sectionLabelId}-${section.key}`,
    labelClass: index === 0 ? 'pt-1.5' : 'pt-2.5',
    rows: section.rows.map((row) => ({
      ...row,
      testId: `deployment-row-${row.deploymentId ?? 'cloud'}`,
      muted: row.action !== 'pick' && !isSwitching.value,
      switching: isSwitching.value && switchingTo === row.value,
      disabled: isSwitching.value || row.action === 'none'
    }))
  }))
)
const defaultGone = computed(() => goneDefaultDeploymentId.value !== null)

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
  return canSetDefault.value
    ? t('deploymentSwitcher.defaultGoneOwner')
    : t('deploymentSwitcher.defaultGone')
})

const switchingNote = computed(() =>
  settingStore.get('Comfy.Workflow.Persist')
    ? t('deploymentSwitcher.switchingNote')
    : t('deploymentSwitcher.switchingNoteWithoutDrafts')
)

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

function openDeploymentPage(deploymentId: string) {
  window.open(
    `${platformUrl}/profile/deployments/${encodeURIComponent(deploymentId)}`,
    '_blank',
    'noopener,noreferrer'
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
