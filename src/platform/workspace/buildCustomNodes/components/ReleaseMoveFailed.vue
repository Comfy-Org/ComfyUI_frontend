<template>
  <BuildDialogStep
    :title="
      $t('buildCustomNodes.moveFailed.title', {
        deployment: session.deploymentName,
        version: release.version
      })
    "
    :description="
      $t('buildCustomNodes.moveFailed.bodyPlatform', {
        deployment: session.deploymentName,
        version: release.version,
        current: session.build.release.version
      })
    "
  >
    <template #icon>
      <BuildFailureIcon />
    </template>
    <template #actions>
      <Button variant="secondary" size="lg" @click="emit('close')">
        {{ $t('g.close') }}
      </Button>
      <FixOnPlatformLink
        :path="`/profile/deployments/${session.deploymentId}`"
      />
    </template>
  </BuildDialogStep>
</template>

<script setup lang="ts">
import Button from '@comfyorg/design-system/button/Button'

import type { BuildSession } from '@/platform/workspace/buildCustomNodes/buildCustomNodesFlow'
import type { ReleaseBuild } from '@/platform/workspace/buildCustomNodes/buildCustomNodesTypes'
import BuildDialogStep from '@/platform/workspace/buildCustomNodes/components/BuildDialogStep.vue'
import BuildFailureIcon from '@/platform/workspace/buildCustomNodes/components/BuildFailureIcon.vue'
import FixOnPlatformLink from '@/platform/workspace/buildCustomNodes/components/FixOnPlatformLink.vue'

const { session, release } = defineProps<{
  session: BuildSession
  release: ReleaseBuild
}>()

const emit = defineEmits<{
  close: []
}>()
</script>
