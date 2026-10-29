<template>
  <MenuSub>
    <MenuSubTrigger
      :disabled
      :class="cn(switcherItemClass, 'data-[state=open]:bg-accent')"
      data-testid="deployment-switcher-default"
    >
      <i
        class="icon-[lucide--users] size-3.5 text-muted-foreground"
        aria-hidden="true"
      />
      <span>{{ $t('deploymentSwitcher.workspaceDefault') }}</span>
      <span
        :class="
          cn(
            'ml-auto truncate pl-4',
            defaultGone ? 'text-warning' : 'text-muted-foreground'
          )
        "
        data-testid="deployment-switcher-default-current"
      >
        {{ currentDefault }}
      </span>
      <span :class="switcherTrailingSlotClass">
        <i
          class="icon-[lucide--chevron-right] size-3.5 text-muted-foreground group-data-[state=open]:text-foreground"
          aria-hidden="true"
        />
      </span>
    </MenuSubTrigger>
    <MenuSubContent
      :side-offset="2"
      :align-offset="-5"
      :class="cn(switcherMenuWidthClass, switcherMenuMotionClass)"
    >
      <DropdownMenuLabel class="px-2 pt-1.5 pb-1 text-xs text-muted-foreground">
        {{ $t('deploymentSwitcher.membersStartOn') }}
      </DropdownMenuLabel>
      <DropdownMenuRadioGroup :model-value="checkedValue">
        <DeploymentSwitcherRow
          v-for="row in rows"
          :key="row.value"
          :value="row.value"
          :title="row.title"
          :deployment="row.name"
          :detail="row.detail"
          :tooltip="row.tooltip"
          :tone="row.tone"
          :data-testid="`default-row-${row.deploymentId ?? 'cloud'}`"
          @select="choose(row.deploymentId)"
        />
      </DropdownMenuRadioGroup>
    </MenuSubContent>
  </MenuSub>
</template>

<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { storeToRefs } from 'pinia'
import { DropdownMenuLabel, DropdownMenuRadioGroup } from 'reka-ui'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import MenuSub from '@comfyorg/design-system/menu/MenuSub'
import MenuSubContent from '@comfyorg/design-system/menu/MenuSubContent'
import MenuSubTrigger from '@comfyorg/design-system/menu/MenuSubTrigger'
import DeploymentSwitcherRow from '@/platform/workspace/components/DeploymentSwitcherRow.vue'
import {
  switcherItemClass,
  switcherMenuMotionClass,
  switcherMenuWidthClass,
  switcherTrailingSlotClass
} from '@/platform/workspace/components/deploymentSwitcherStyles'
import {
  COMFY_CLOUD_ROW,
  useDeploymentLabels
} from '@/platform/workspace/composables/useDeploymentLabels'
import { useDeploymentPickStore } from '@/platform/workspace/stores/deploymentPickStore'

const { disabled } = defineProps<{
  disabled: boolean
}>()

const emit = defineEmits<{
  setDefault: [deploymentId: string | null]
}>()

const { t } = useI18n()
const { deployments, defaultDeploymentId, goneDefaultDeploymentId } =
  storeToRefs(useDeploymentPickStore())
const { deploymentRowLabels, defaultTitle } = useDeploymentLabels()

const rows = computed(() => [
  deploymentRowLabels(null),
  ...deployments.value.map((deployment) => deploymentRowLabels(deployment))
])

const defaultGone = computed(() => goneDefaultDeploymentId.value !== null)
const checkedValue = computed(() => {
  if (defaultDeploymentId.value !== null) return defaultDeploymentId.value
  return defaultGone.value ? '' : COMFY_CLOUD_ROW
})
function choose(deploymentId: string | null) {
  if ((deploymentId ?? COMFY_CLOUD_ROW) === checkedValue.value) return
  emit('setDefault', deploymentId)
}

const currentDefault = computed(() => {
  if (defaultGone.value) return t('deploymentSwitcher.defaultDeleted')
  return defaultTitle.value ?? t('deploymentSwitcher.comfyCloud')
})
</script>
