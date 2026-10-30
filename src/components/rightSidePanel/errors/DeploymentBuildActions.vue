<template>
  <div
    data-testid="deployment-build-actions"
    class="flex flex-col gap-2 px-2 pb-2"
  >
    <template v-if="changeSinceBootMessage">
      <p
        role="status"
        class="m-0 text-xs text-pretty text-muted-foreground"
        data-testid="deployment-build-changed"
      >
        {{ changeSinceBootMessage }}
      </p>
      <Button
        variant="secondary"
        size="md"
        class="w-full"
        data-testid="deployment-build-reload"
        :disabled="isSwitching"
        @click="reloadOntoCurrent()"
      >
        <i class="icon-[lucide--refresh-cw]" aria-hidden="true" />
        {{ $t('deploymentSwitcher.reload') }}
      </Button>
    </template>
    <template v-else>
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
        {{
          deployment.build_id
            ? $t('rightSidePanel.editBuildOnPlatform')
            : $t('rightSidePanel.openBuildsOnPlatform')
        }}
        <i
          class="icon-[lucide--square-arrow-out-up-right]"
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
          <i class="icon-[lucide--check]" aria-hidden="true" />
          {{ $t('deployToComfyApi.copied') }}
        </template>
        <template v-else>
          <AgentMarks class="h-6 w-auto" />
          {{ $t('deployToComfyApi.deployWithAgent') }}
        </template>
      </Button>
    </template>
  </div>
</template>

<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { useEventListener } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { computed } from 'vue'

import type { MissingPackGroup } from '@/components/rightSidePanel/errors/useErrorGroups'
import Button from '@/components/ui/button/Button.vue'
import { getComfyPlatformBaseUrl } from '@/config/comfyApi'
import type { MissingModelGroup } from '@/platform/workflowErrors/missingModel/types'
import type { MissingNodeType } from '@/platform/workflowErrors/nodeReplacement/types'
import AgentMarks from '@/platform/workflow/deploy/components/AgentMarks.vue'
import { DEPLOYMENT_LISTING_FOCUS_RETRY_MS } from '@/platform/workspace/api/deploymentListingTimeouts'
import type { WorkspaceDeployment } from '@/platform/workspace/api/workspaceApi'
import { useBriefCopy } from '@/platform/workspace/composables/useBriefCopy'
import { useDeploymentLabels } from '@/platform/workspace/composables/useDeploymentLabels'
import { useDeploymentSwitchGuard } from '@/platform/workspace/composables/useDeploymentSwitchGuard'
import type { MissingBuildPack } from '@/platform/workspace/deploymentBuildBrief'
import { deploymentBuildBrief } from '@/platform/workspace/deploymentBuildBrief'
import { useDeploymentPickStore } from '@/platform/workspace/stores/deploymentPickStore'

const { deployment, missingPackGroups, missingModelGroups } = defineProps<{
  deployment: WorkspaceDeployment
  missingPackGroups: readonly MissingPackGroup[]
  missingModelGroups: readonly MissingModelGroup[]
}>()

const deploymentPick = useDeploymentPickStore()
const { isSwitching } = storeToRefs(deploymentPick)
const { changeSinceBootMessage } = useDeploymentLabels()
const { reloadOntoCurrent } = useDeploymentSwitchGuard()
const { isCopying, copied, copy } = useBriefCopy()

let lastListingRefreshAt = -Infinity
useEventListener(window, 'focus', () => {
  if (Date.now() - lastListingRefreshAt < DEPLOYMENT_LISTING_FOCUS_RETRY_MS)
    return
  lastListingRefreshAt = Date.now()
  void deploymentPick.load()
})

const buildsUrl = `${getComfyPlatformBaseUrl()}/profile/builds`
const buildUrl = computed(() =>
  deployment.build_id
    ? `${buildsUrl}/${encodeURIComponent(deployment.build_id)}`
    : buildsUrl
)

function nodeTypeName(nodeType: MissingNodeType): string {
  return typeof nodeType === 'string' ? nodeType : nodeType.type
}

function buildPack(group: MissingPackGroup): MissingBuildPack {
  const pack = {
    packId: group.packId,
    nodeTypes: group.nodeTypes.map(nodeTypeName)
  }
  const unsupported =
    group.packId !== null
      ? deploymentPick.unsupportedPackFor(group.packId)
      : undefined
  return unsupported
    ? { ...pack, loadFailure: { cause: unsupported.cause } }
    : pack
}

function brief(): string {
  return deploymentBuildBrief(
    deployment,
    missingPackGroups.map(buildPack),
    missingModelGroups.flatMap((group) =>
      group.models.map((model) => ({
        name: model.name,
        directory: model.representative.directory || group.directory,
        url: model.representative.url
      }))
    )
  )
}
</script>
