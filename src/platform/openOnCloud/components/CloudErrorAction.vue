<template>
  <Button
    v-if="flags.openOnCloudEnabled && catalogId === OUT_OF_MEMORY_CATALOG_ID"
    variant="outline"
    size="sm"
    class="my-2 w-full justify-start"
    @click="openDeployment"
  >
    <i class="icon-[lucide--cloud]" aria-hidden="true" />
    {{ $t('openOnCloud.deploySetup') }}
  </Button>
</template>

<script setup lang="ts">
import Button from '@comfyorg/design-system/button/Button'
import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { useErrorHandling } from '@/composables/useErrorHandling'
import { openDeploySetupDialog } from '@/platform/openOnCloud/openRunOnCloudDialog'
import { OUT_OF_MEMORY_CATALOG_ID } from '@/platform/workflowErrors/errorCatalog/catalogIds'

defineProps<{ catalogId?: string }>()

const { flags } = useFeatureFlags()
const { toastErrorHandler } = useErrorHandling()

function openDeployment() {
  void openDeploySetupDialog().catch(toastErrorHandler)
}
</script>
