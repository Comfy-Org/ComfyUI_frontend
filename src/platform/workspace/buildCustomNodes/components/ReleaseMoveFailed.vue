<template>
  <BuildDialogStep
    :title="
      $t('buildCustomNodes.moveFailed.title', {
        deployment: session.deploymentName,
        version: release.version
      })
    "
    :description="
      $t('buildCustomNodes.moveFailed.body', {
        deployment: session.deploymentName,
        version: release.version,
        current: session.build.release.version
      })
    "
  >
    <p
      v-if="message"
      role="alert"
      class="m-0 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
    >
      {{ message }}
    </p>
    <template #actions>
      <Button variant="secondary" size="lg" @click="emit('close')">
        {{ $t('g.close') }}
      </Button>
      <Button variant="inverted" size="lg" @click="emit('retry')">
        {{ $t('buildCustomNodes.moveFailed.retry') }}
      </Button>
    </template>
  </BuildDialogStep>
</template>

<script setup lang="ts">
import Button from '@comfyorg/design-system/button/Button'

import type { BuildSession } from '@/platform/workspace/buildCustomNodes/buildCustomNodesFlow'
import type { ReleaseBuild } from '@/platform/workspace/buildCustomNodes/buildCustomNodesTypes'
import BuildDialogStep from '@/platform/workspace/buildCustomNodes/components/BuildDialogStep.vue'

const { session, release, message } = defineProps<{
  session: BuildSession
  release: ReleaseBuild
  message: string | null
}>()

const emit = defineEmits<{
  close: []
  retry: []
}>()
</script>
