<template>
  <Menu
    v-model:open="isOpen"
    :modal="false"
    align="end"
    :side-offset="8"
    :class="cn('w-max max-w-100 min-w-67', switcherMenuMotionClass)"
    @update:open="onOpenChange"
    @interact-outside="keepOpenForPrototypePanel"
  >
    <template #trigger>
      <Button
        variant="secondary"
        size="icon"
        :tooltip
        tooltip-side="bottom"
        :aria-label="tooltip"
        class="data-[state=open]:bg-accent"
        data-testid="cloud-button"
      >
        <ProgressRing
          v-if="menuState.kind === 'uploading'"
          :percent="menuState.percent"
          class="size-4"
        />
        <i v-else class="icon-[lucide--cloud]" aria-hidden="true" />
      </Button>
    </template>
    <CloudMenuRunRow :state="menuState" @select="runOnCloud" />
    <MenuSeparator class="bg-border" />
    <MenuItem
      :class="cn(switcherItemClass, 'data-highlighted:bg-secondary')"
      data-testid="cloud-menu-deploy"
      @select="deploySetup"
    >
      <i
        class="icon-[lucide--rocket] size-3.5 text-muted-foreground"
        aria-hidden="true"
      />
      <span class="min-w-0 flex-1 truncate font-medium text-foreground">
        {{ $t('openOnCloud.cloudMenu.deployLocalSetup') }}
      </span>
      <i
        class="icon-[lucide--info] text-muted-foreground"
        role="img"
        :aria-label="$t('openOnCloud.aboutDeploy')"
      />
    </MenuItem>
  </Menu>
  <CloudCheckPrototypeSwitch v-if="isDevBuild" />
  <AgentEnsuesOverlay />
</template>

<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { storeToRefs } from 'pinia'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@comfyorg/design-system/button/Button'
import Menu from '@comfyorg/design-system/menu/Menu'
import MenuItem from '@comfyorg/design-system/menu/MenuItem'
import MenuSeparator from '@comfyorg/design-system/menu/MenuSeparator'
import { useAuthDialogs } from '@/composables/auth/useAuthDialogs'
import { useErrorHandling } from '@/composables/useErrorHandling'
import { cloudMenuState } from '@/platform/openOnCloud/cloudMenuState'
import AgentEnsuesOverlay from '@/platform/openOnCloud/components/AgentEnsuesOverlay.vue'
import CloudCheckPrototypeSwitch from '@/platform/openOnCloud/components/CloudCheckPrototypeSwitch.vue'
import CloudMenuRunRow from '@/platform/openOnCloud/components/CloudMenuRunRow.vue'
import ProgressRing from '@/platform/openOnCloud/components/ProgressRing.vue'
import { useCloudMenuCopy } from '@/platform/openOnCloud/composables/useCloudMenuCopy'
import {
  openConvertDialog,
  openUploadModelsDialog
} from '@/platform/openOnCloud/openCloudMenuDialogs'
import { openDeploySetupDialog } from '@/platform/openOnCloud/openDeploySetupDialog'
import { openWorkflowOnCloud } from '@/platform/openOnCloud/openWorkflowOnCloud'
import { serializeRootGraph } from '@/platform/openOnCloud/serializeRootGraph'
import { useCloudWorkflowCheckStore } from '@/platform/openOnCloud/stores/cloudWorkflowCheckStore'
import { useModelUploadStore } from '@/platform/openOnCloud/stores/modelUploadStore'
import {
  switcherItemClass,
  switcherMenuMotionClass
} from '@/platform/workspace/components/deploymentSwitcherStyles'

const isDevBuild = import.meta.env.DEV

const { t } = useI18n()
const { toastErrorHandler } = useErrorHandling()
const { showSignInDialog } = useAuthDialogs()
const { uploadingLabel } = useCloudMenuCopy()
const checkStore = useCloudWorkflowCheckStore()
const { state: check } = storeToRefs(checkStore)
const { state: upload } = storeToRefs(useModelUploadStore())

const isOpen = ref(false)
const menuState = computed(() => cloudMenuState(check.value, upload.value))

const tooltip = computed(() =>
  menuState.value.kind === 'uploading'
    ? uploadingLabel(menuState.value.models.length, menuState.value.percent)
    : t('openOnCloud.cloudMenu.buttonTooltip')
)

function keepOpenForPrototypePanel(event: Event) {
  if (
    event.target instanceof Element &&
    event.target.closest('[data-prototype-panel]')
  )
    event.preventDefault()
}

function onOpenChange(open: boolean) {
  if (!open) return
  const workflow = serializeRootGraph()
  if (workflow) void checkStore.check(workflow)
}

function runOnCloud() {
  const state = menuState.value
  switch (state.kind) {
    case 'canOpen':
      void openWorkflowOnCloud()
      return
    case 'convert':
      openConvertDialog(state.gaps).catch(toastErrorHandler)
      return
    case 'upload':
    case 'uploading':
      openUploadModelsDialog(state.models).catch(toastErrorHandler)
      return
    case 'signedOut':
      void showSignInDialog()
      return
    case 'checking':
      return
  }
}

function deploySetup() {
  openDeploySetupDialog().catch(toastErrorHandler)
}
</script>
