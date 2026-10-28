<template>
  <Button
    v-if="state.status === 'ready'"
    variant="inverted"
    size="lg"
    class="w-full @xl:w-auto"
    as="a"
    :href="state.url"
    target="_blank"
    rel="noopener noreferrer"
    data-testid="deploy-to-comfy-api-open-builder"
    @click="openBuilder"
    @auxclick.middle="openBuilder"
  >
    {{ $t('deployToComfyApi.openBuilder') }}
    <i class="icon-[lucide--square-arrow-out-up-right]" aria-hidden="true" />
  </Button>
  <Button
    v-else
    variant="inverted"
    size="lg"
    class="w-full @xl:w-auto"
    :loading="state.status === 'uploading'"
    data-testid="deploy-to-comfy-api-platform"
    @click="deployInstallation"
  >
    {{ $t('deployToComfyApi.deployOnPlatform') }}
  </Button>
</template>

<script setup lang="ts">
import Button from '@comfyorg/design-system/button/Button'
import { useTelemetry } from '@/platform/telemetry'
import { useInstallationDeploy } from '@/platform/workflow/deploy/composables/useInstallationDeploy'

const emit = defineEmits<{ opened: [] }>()

const { state, deploy } = useInstallationDeploy()

function track(buttonId: string) {
  useTelemetry()?.trackUiButtonClicked({
    button_id: buttonId,
    element_group: 'deploy_to_comfy_api'
  })
}

function openBuilder() {
  track('deploy_to_comfy_api_builder_opened')
  emit('opened')
}

async function deployInstallation() {
  track('deploy_to_comfy_api_platform_clicked')
  await deploy()
}
</script>
