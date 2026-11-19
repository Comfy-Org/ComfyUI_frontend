<template>
  <Button
    v-if="flags.openOnCloudEnabled && catalogId === OUT_OF_MEMORY_CATALOG_ID"
    variant="outline"
    size="sm"
    class="my-2 w-full justify-start"
    @click="openFromError"
  >
    <i class="icon-[lucide--cloud]" aria-hidden="true" />
    {{ $t('openOnCloud.deploySetup') }}
  </Button>
</template>

<script setup lang="ts">
import Button from '@comfyorg/design-system/button/Button'
import { useTelemetry } from '@comfyorg/telemetry'
import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { openDeploySetupDialog } from '@/platform/openOnCloud/openRunOnCloudDialog'
import { OUT_OF_MEMORY_CATALOG_ID } from '@/platform/workflowErrors/errorCatalog/catalogIds'

defineProps<{ catalogId?: string }>()

const { flags } = useFeatureFlags()
let pendingOpen: Promise<boolean> | null = null

async function openOnce(): Promise<boolean> {
  if (pendingOpen) return false
  pendingOpen = openDeploySetupDialog()
  try {
    return await pendingOpen
  } finally {
    pendingOpen = null
  }
}

async function openFromError() {
  useTelemetry()?.trackUiButtonClicked({
    button_id: 'error_tab_run_on_cloud_clicked',
    element_group: 'errors_panel'
  })
  if (await openOnce())
    useTelemetry()?.trackRunOnCloudEvent({
      name: 'app:run_on_cloud_dialog_shown',
      properties: { state: 'deploy_setup', source: 'errors_panel' }
    })
}
</script>
