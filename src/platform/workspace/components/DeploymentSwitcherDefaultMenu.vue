<template>
  <MenuSub>
    <MenuSubTrigger
      :disabled
      :class="cn(switcherItemClass, 'data-[state=open]:bg-accent')"
      data-testid="deployment-switcher-default"
    >
      <i
        class="icon-[lucide--users] size-3.5 shrink-0 text-muted-foreground"
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
      :class="
        cn(
          'max-w-[min(25rem,calc(100vw-1rem))] min-w-56',
          switcherMenuMotionClass
        )
      "
    >
      <DropdownMenuLabel class="px-2 pt-1.5 pb-1 text-xs text-muted-foreground">
        {{ $t('deploymentSwitcher.membersStartOn') }}
      </DropdownMenuLabel>
      <DropdownMenuRadioGroup :model-value="checkedValue">
        <DeploymentSwitcherRow
          :value="COMFY_CLOUD_ROW"
          :title="$t('deploymentSwitcher.comfyCloud')"
          data-testid="default-row-cloud"
          @select="choose(null)"
        />
        <DeploymentSwitcherRow
          v-for="deployment in deployments"
          :key="deployment.deployment_id"
          :value="deployment.deployment_id"
          :title="deploymentTitle(deployment)"
          :subtitle="deploymentRowSubtitle(deployment)"
          :tone="deploymentStatusTone(deployment.status)"
          :data-testid="`default-row-${deployment.deployment_id}`"
          @select="choose(deployment.deployment_id)"
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
  switcherTrailingSlotClass
} from '@/platform/workspace/components/deploymentSwitcherStyles'
import {
  COMFY_CLOUD_ROW,
  deploymentStatusTone,
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
const { deploymentTitle, deploymentRowSubtitle, defaultTitle } =
  useDeploymentLabels()

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
