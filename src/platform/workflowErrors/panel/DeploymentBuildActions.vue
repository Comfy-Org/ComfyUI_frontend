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
        :rel="platformLinkRel()"
        class="w-full no-underline"
        data-testid="deployment-build-platform"
        @click="addMissingModelsOnClick"
      >
        {{
          addsMissingModels
            ? $t('rightSidePanel.addMissingModelsToBuild')
            : deployment.build_id
              ? $t('rightSidePanel.editBuildOnPlatform')
              : $t('rightSidePanel.openBuildsOnPlatform')
        }}
        <i
          class="icon-[lucide--square-arrow-out-up-right]"
          aria-hidden="true"
        />
      </Button>
    </template>
  </div>
</template>

<script setup lang="ts">
import { useEventListener } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { computed } from 'vue'

import type { MissingPackGroup } from '@/platform/workflowErrors/panel/useErrorGroups'
import Button from '@comfyorg/design-system/button/Button'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import type { MissingModelGroup } from '@/platform/workflowErrors/missingModel/types'
import { useMissingNodesErrorStore } from '@/platform/workflowErrors/nodeReplacement/missingNodesErrorStore'
import { DEPLOYMENT_LISTING_FOCUS_RETRY_MS } from '@/platform/workspace/api/deploymentListingTimeouts'
import type { WorkspaceDeployment } from '@/platform/workspace/api/workspaceApi'
import { useDeploymentLabels } from '@/platform/workspace/composables/useDeploymentLabels'
import { useDeploymentSwitchGuard } from '@/platform/workspace/composables/useDeploymentSwitchGuard'
import { usePlatformFrameStore } from '@/platform/workspace/platformFrame/platformFrameStore'
import { openPlatformFrameOnClick } from '@/platform/workspace/platformFrame/platformFrameWaysIn'
import { preinstallRequest } from '@/platform/workspace/platformFrame/useDeploymentModelsFrame'
import { useDeploymentPickStore } from '@/platform/workspace/stores/deploymentPickStore'
import {
  platformSurfaceLink,
  platformLinkRel
} from '@/platform/workspace/utils/platformLink'

const { deployment, missingPackGroups, missingModelGroups } = defineProps<{
  deployment: WorkspaceDeployment
  missingPackGroups: readonly MissingPackGroup[]
  missingModelGroups: readonly MissingModelGroup[]
}>()

const deploymentPick = useDeploymentPickStore()
const { isSwitching } = storeToRefs(deploymentPick)
const { changeSinceBootMessage } = useDeploymentLabels()
const { reloadOntoCurrent } = useDeploymentSwitchGuard()

let lastListingRefreshAt = -Infinity
useEventListener(window, 'focus', () => {
  if (Date.now() - lastListingRefreshAt < DEPLOYMENT_LISTING_FOCUS_RETRY_MS)
    return
  lastListingRefreshAt = Date.now()
  void deploymentPick.load()
})

const platformFrames = usePlatformFrameStore()
const workflows = useWorkflowStore()
const missingNodes = useMissingNodesErrorStore()
const workflowLacksNodes = computed(
  () =>
    missingNodes.missingNodesError !== null ||
    !!workflows.activeWorkflow?.pendingWarnings?.missingNodeTypes?.length
)
const addsMissingModels = computed(
  () =>
    missingPackGroups.length === 0 &&
    !workflowLacksNodes.value &&
    missingModelGroups.length > 0 &&
    platformFrames.isAvailable()
)

function addMissingModelsOnClick(event: MouseEvent) {
  if (!addsMissingModels.value) return
  openPlatformFrameOnClick(
    event,
    preinstallRequest(deployment.deployment_id),
    'errors_panel'
  )
}

const buildUrl = computed(() =>
  platformSurfaceLink(
    deployment.build_id
      ? `/profile/builds/${encodeURIComponent(deployment.build_id)}`
      : '/profile/builds',
    'deployment-build-actions'
  )
)
</script>
