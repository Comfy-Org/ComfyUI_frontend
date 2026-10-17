<template>
  <Button
    v-if="state.status === 'tab_blocked'"
    variant="inverted"
    size="lg"
    class="w-full @xl:w-auto"
    as="a"
    :href="state.url"
    target="_blank"
    rel="noopener noreferrer"
    data-testid="deploy-to-comfy-api-open-builder"
    @click="emit('opened')"
  >
    {{ $t('deployToComfyApi.openBuilder') }}
    <i
      class="icon-[lucide--square-arrow-out-up-right] size-4"
      aria-hidden="true"
    />
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
import Button from '@/components/ui/button/Button.vue'
import { useInstallationDeploy } from '@/platform/workflow/deploy/composables/useInstallationDeploy'

const emit = defineEmits<{ opened: [] }>()

const { state, deploy } = useInstallationDeploy()

async function deployInstallation() {
  if (await deploy()) emit('opened')
}
</script>
