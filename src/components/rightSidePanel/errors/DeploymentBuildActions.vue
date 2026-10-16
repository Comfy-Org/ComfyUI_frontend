<template>
  <div
    data-testid="deployment-build-actions"
    class="flex flex-col gap-2 px-2 pb-2"
  >
    <Button
      variant="inverted"
      size="md"
      as="a"
      :href="buildUrl"
      target="_blank"
      rel="noopener noreferrer"
      class="w-full no-underline"
      data-testid="deployment-build-platform"
    >
      {{ $t('rightSidePanel.editBuildOnPlatform') }}
      <i
        class="icon-[lucide--square-arrow-out-up-right] size-4"
        aria-hidden="true"
      />
    </Button>
    <Button
      variant="secondary"
      size="md"
      :class="cn('w-full', !copied && 'gap-3')"
      data-testid="deployment-build-agent"
      :loading="isCopying"
      @click="copy(brief())"
    >
      <template v-if="copied">
        <i class="icon-[lucide--check] size-4" aria-hidden="true" />
        {{ $t('deployToComfyApi.copied') }}
      </template>
      <template v-else>
        <AgentMarks class="h-6 w-auto" />
        {{ $t('deployToComfyApi.deployWithAgent') }}
      </template>
    </Button>
  </div>
</template>

<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { computed } from 'vue'

import type { MissingPackGroup } from '@/components/rightSidePanel/errors/useErrorGroups'
import Button from '@/components/ui/button/Button.vue'
import { getComfyPlatformBaseUrl } from '@/config/comfyApi'
import type { MissingModelGroup } from '@/platform/missingModel/types'
import type { MissingNodeType } from '@/platform/nodeReplacement/types'
import AgentMarks from '@/platform/workflow/deploy/components/AgentMarks.vue'
import type { WorkspaceDeployment } from '@/platform/workspace/api/workspaceApi'
import { useBriefCopy } from '@/platform/workspace/composables/useBriefCopy'
import { deploymentBuildBrief } from '@/platform/workspace/deploymentBuildBrief'

const { deployment, missingPackGroups, missingModelGroups } = defineProps<{
  deployment: WorkspaceDeployment
  missingPackGroups: readonly MissingPackGroup[]
  missingModelGroups: readonly MissingModelGroup[]
}>()

const { isCopying, copied, copy } = useBriefCopy()

const buildsUrl = `${getComfyPlatformBaseUrl()}/profile/builds`
const buildUrl = computed(() =>
  deployment.build_id
    ? `${buildsUrl}/${encodeURIComponent(deployment.build_id)}`
    : buildsUrl
)

function nodeTypeName(nodeType: MissingNodeType): string {
  return typeof nodeType === 'string' ? nodeType : nodeType.type
}

function brief(): string {
  return deploymentBuildBrief(
    deployment,
    missingPackGroups.map((group) => ({
      packId: group.packId,
      nodeTypes: group.nodeTypes.map(nodeTypeName)
    })),
    missingModelGroups.flatMap((group) =>
      group.models.map((model) => ({
        name: model.name,
        directory: group.directory,
        url: model.representative.url
      }))
    )
  )
}
</script>
