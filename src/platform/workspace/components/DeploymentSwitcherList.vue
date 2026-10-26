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
  <DropdownMenuLabel class="px-2 pt-1.5 pb-1 text-xs text-muted-foreground">
    {{ $t('deploymentSwitcher.runOn') }}
  </DropdownMenuLabel>
  <DropdownMenuRadioGroup :model-value="pickedValue">
    <DeploymentSwitcherRow
      :value="COMFY_CLOUD_ROW"
      :title="$t('deploymentSwitcher.comfyCloud')"
      :switching="isSwitching && switchingTo === COMFY_CLOUD_ROW"
      :disabled="isSwitching"
      :mark="markFor(null)"
      data-testid="deployment-row-cloud"
      @select="choose($event, null)"
    />
    <DeploymentSwitcherRow
      v-for="deployment in deployments"
      :key="deployment.deployment_id"
      :value="deployment.deployment_id"
      :title="deploymentTitle(deployment)"
      :subtitle="deploymentRowSubtitle(deployment)"
      :tone="deploymentStatusTone(deployment.status)"
      :meta="deploymentMeta(deployment)"
      :switching="isSwitching && switchingTo === deployment.deployment_id"
      :disabled="isSwitching"
      :mark="markFor(deployment.deployment_id)"
      :data-testid="`deployment-row-${deployment.deployment_id}`"
      @select="choose($event, deployment.deployment_id)"
    />
  </DropdownMenuRadioGroup>
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
  <TextTooltip
    :text="$t('deploymentSwitcher.createCustomDeploymentTooltip')"
    side="right"
  >
    <MenuItem as-child :class="switcherItemClass">
      <a
        :href="createDeploymentUrl"
        target="_blank"
        rel="noopener noreferrer"
        class="text-foreground no-underline"
        data-testid="deployment-switcher-create"
      >
        <i
          class="icon-[lucide--plus] size-3.5 shrink-0 text-muted-foreground"
          aria-hidden="true"
        />
        {{ $t('deploymentSwitcher.createCustomDeployment') }}
        <span :class="cn('ml-auto', switcherTrailingSlotClass)">
          <i
            class="icon-[lucide--arrow-up-right] size-3.5 text-muted-foreground"
            aria-hidden="true"
          />
        </span>
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
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import MenuItem from '@/components/ui/menu/MenuItem.vue'
import MenuSeparator from '@/components/ui/menu/MenuSeparator.vue'
import TextTooltip from '@/components/ui/tooltip/TextTooltip.vue'
import { getComfyPlatformBaseUrl } from '@/config/comfyApi'
import { useSettingStore } from '@/platform/settings/settingStore'
import DeploymentSwitcherDefaultMenu from '@/platform/workspace/components/DeploymentSwitcherDefaultMenu.vue'
import DeploymentSwitcherRow from '@/platform/workspace/components/DeploymentSwitcherRow.vue'
import {
  switcherItemClass,
  switcherTrailingSlotClass
} from '@/platform/workspace/components/deploymentSwitcherStyles'
import { useDeploymentCompatibility } from '@/platform/workspace/composables/useDeploymentCompatibility'
import {
  COMFY_CLOUD_ROW,
  deploymentStatusTone,
  useDeploymentLabels
} from '@/platform/workspace/composables/useDeploymentLabels'
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
const { deploymentTitle, deploymentRowSubtitle, deploymentMeta, currentLabel } =
  useDeploymentLabels()
const { markFor } = useDeploymentCompatibility()

const createDeploymentUrl = `${getComfyPlatformBaseUrl()}/profile/deploy#builds`

const pickedValue = computed(() => pickedDeploymentId.value ?? COMFY_CLOUD_ROW)
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
