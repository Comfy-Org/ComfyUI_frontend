<template>
  <template v-if="notice || changeSinceBoot">
    <div
      v-if="notice"
      role="status"
      class="flex w-0 min-w-full items-start gap-2 px-2 py-1.5 text-xs text-muted-foreground"
      data-testid="deployment-switcher-notice"
    >
      <i
        class="mt-px icon-[lucide--triangle-alert] size-3.5 shrink-0 text-warning"
        aria-hidden="true"
      />
      <span class="text-pretty">{{ notice }}</span>
    </div>
    <template v-if="changeSinceBoot">
      <p
        role="status"
        class="m-0 w-0 min-w-full px-2 py-1.5 text-xs text-pretty text-muted-foreground"
        data-testid="deployment-switcher-changed"
      >
        {{ changeMessage }}
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
        :muted="row.muted"
        :switching="row.switching"
        :disabled="row.disabled"
        :data-focus-row="row.value"
        :data-testid="row.testId"
        @select="choose($event, row.deploymentId)"
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
  <TextTooltip :text="buildsLink.tooltip" side="right">
    <MenuItem as-child :class="switcherItemClass">
      <a
        :href="buildsUrl"
        target="_blank"
        rel="noopener noreferrer"
        class="text-foreground no-underline"
        data-testid="deployment-switcher-builds"
      >
        <i
          :class="cn(buildsLink.icon, 'size-3.5 text-muted-foreground')"
          aria-hidden="true"
        />
        {{ buildsLink.label }}
      </a>
    </MenuItem>
  </TextTooltip>
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

import MenuItem from '@/components/ui/menu/MenuItem.vue'
import MenuSeparator from '@/components/ui/menu/MenuSeparator.vue'
import TextTooltip from '@/components/ui/tooltip/TextTooltip.vue'
import { getComfyPlatformBaseUrl } from '@/config/comfyApi'
import { useSettingStore } from '@/platform/settings/settingStore'
import DeploymentSwitcherDefaultMenu from '@/platform/workspace/components/DeploymentSwitcherDefaultMenu.vue'
import DeploymentSwitcherRow from '@/platform/workspace/components/DeploymentSwitcherRow.vue'
import { switcherItemClass } from '@/platform/workspace/components/deploymentSwitcherStyles'
import { useDeploymentLabels } from '@/platform/workspace/composables/useDeploymentLabels'
import { useDeploymentRows } from '@/platform/workspace/composables/useDeploymentRows'
import { useKeepRowFocus } from '@/platform/workspace/composables/useKeepRowFocus'
import { useDeploymentPickStore } from '@/platform/workspace/stores/deploymentPickStore'

const { switchingTo } = defineProps<{
  /** The row last picked; it shows progress while a switch is in flight. */
  switchingTo: string | null
}>()

const emit = defineEmits<{
  choose: [deploymentId: string | null]
  follow: [deploymentId: string]
  reload: []
  setDefault: [deploymentId: string | null]
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
  changeSinceBoot,
  followsWorkspace
} = storeToRefs(useDeploymentPickStore())
const { currentLabel } = useDeploymentLabels()
const { sections, pickedValue } = useDeploymentRows()
const sectionLabelId = useId()
useKeepRowFocus(sections)

const buildsUrl = `${getComfyPlatformBaseUrl()}/profile/builds`

const buildsLink = computed(() =>
  deployments.value.length > 0
    ? {
        label: t('deploymentSwitcher.manageDeployments'),
        tooltip: t('deploymentSwitcher.manageDeploymentsTooltip'),
        icon: 'icon-[lucide--arrow-up-right]'
      }
    : {
        label: t('deploymentSwitcher.createCustomDeployment'),
        tooltip: t('deploymentSwitcher.createCustomDeploymentTooltip'),
        icon: 'icon-[lucide--plus]'
      }
)

const listedSections = computed(() =>
  sections.value.map((section, index) => ({
    ...section,
    labelId: `${sectionLabelId}-${section.key}`,
    labelClass: index === 0 ? 'pt-1.5' : 'pt-2.5',
    rows: section.rows.map((row) => ({
      ...row,
      testId: `deployment-row-${row.deploymentId ?? 'cloud'}`,
      switching: isSwitching.value && switchingTo === row.value,
      muted: !row.pickable && !isSwitching.value,
      disabled: isSwitching.value || !row.pickable
    }))
  }))
)
const defaultGone = computed(() => goneDefaultDeploymentId.value !== null)

const notice = computed(() => {
  if (goneDeployment.value === 'pick') return t('deploymentSwitcher.pickGone')
  if (goneDeployment.value !== 'default') return null
  return canSetDefault.value
    ? t('deploymentSwitcher.defaultGoneOwner')
    : t('deploymentSwitcher.defaultGone')
})

const changeMessage = computed(() =>
  changeSinceBoot.value === 'release'
    ? t('deploymentSwitcher.releaseChanged')
    : t(
        'deploymentSwitcher.deploymentChanged',
        { deployment: currentLabel.value },
        { escapeParameter: false }
      )
)

const switchingNote = computed(() =>
  settingStore.get('Comfy.Workflow.Persist')
    ? t('deploymentSwitcher.switchingNote')
    : t('deploymentSwitcher.switchingNoteWithoutDrafts')
)

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
