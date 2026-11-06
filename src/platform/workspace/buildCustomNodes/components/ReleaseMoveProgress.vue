<template>
  <BuildDialogStep
    :title="
      $t('buildCustomNodes.moving.title', {
        deployment: session.deploymentName,
        version: release.version
      })
    "
    :description="
      $t('buildCustomNodes.moving.body', {
        deployment: session.deploymentName,
        version: release.version
      })
    "
  >
    <div class="flex flex-col gap-2 text-sm">
      <span class="font-medium">
        {{
          $t('buildCustomNodes.moving.step', {
            deployment: session.deploymentName
          })
        }}
      </span>
      <div
        role="progressbar"
        :aria-label="$t('buildCustomNodes.moving.progressLabel')"
        :aria-valuetext="
          $t('buildCustomNodes.moving.step', {
            deployment: session.deploymentName
          })
        "
        class="relative h-1.5 overflow-hidden rounded-full bg-secondary"
      >
        <div
          class="absolute inset-y-0 w-1/3 animate-pulse rounded-full bg-foreground motion-reduce:animate-none"
        />
      </div>
    </div>
    <p class="m-0 text-sm text-muted-foreground">
      {{
        $t('buildCustomNodes.moving.note', {
          version: session.build.release.version
        })
      }}
    </p>
    <template #actions>
      <Button variant="secondary" size="lg" @click="emit('close')">
        {{ $t('g.close') }}
      </Button>
    </template>
  </BuildDialogStep>
</template>

<script setup lang="ts">
import Button from '@comfyorg/design-system/button/Button'

import type { BuildSession } from '@/platform/workspace/buildCustomNodes/buildCustomNodesFlow'
import type { ReleaseBuild } from '@/platform/workspace/buildCustomNodes/buildCustomNodesTypes'
import BuildDialogStep from '@/platform/workspace/buildCustomNodes/components/BuildDialogStep.vue'

const { session, release } = defineProps<{
  session: BuildSession
  release: ReleaseBuild
}>()

const emit = defineEmits<{
  close: []
}>()
</script>
