<template>
  <SwitchDeploymentCard
    v-if="offer.kind === 'switch'"
    :choices="offer.choices"
    :missing="missing"
  />
  <CustomDeploymentCard
    v-else
    :pitch="pitch"
    hands-over-workflow
    :offers-agent="false"
    :frame-request="NEW_DEPLOYMENT_FOR_WORKFLOW"
    :frame-entry="entry"
    @platform-clicked="trackDeploymentLinkClicked('build_on_platform')"
  />
</template>

<script setup lang="ts">
import type { CustomDeploymentEntry } from '@comfyorg/telemetry/types'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useMissingModelStore } from '@/platform/workflowErrors/missingModel/missingModelStore'
import { useMissingNodesErrorStore } from '@/platform/workflowErrors/nodeReplacement/missingNodesErrorStore'
import CustomDeploymentCard from '@/platform/workspace/components/CustomDeploymentCard.vue'
import SwitchDeploymentCard from '@/platform/workspace/components/SwitchDeploymentCard.vue'
import { useDeploymentCompatibility } from '@/platform/workspace/composables/useDeploymentCompatibility'
import { customDeploymentPitch } from '@/platform/workspace/customDeploymentPitch'
import type {
  CustomDeploymentPitch,
  MissingItemsRow
} from '@/platform/workspace/customDeploymentPitch'
import type { MissingBuildModel } from '@/platform/workspace/deploymentBuildBrief'
import {
  missingModelsOf,
  missingPacksOf,
  nodesNeedingDeployment
} from '@/platform/workspace/missingForDeployment'
import { openWorkflowForCheck } from '@/platform/workspace/openWorkflowForCheck'
import { trackDeploymentLinkClicked } from '@/platform/workspace/platformFrame/customDeploymentTelemetry'
import { NEW_DEPLOYMENT_FOR_WORKFLOW } from '@/platform/workspace/platformFrame/platformFrameWaysIn'
import { useDeploymentPickStore } from '@/platform/workspace/stores/deploymentPickStore'
import { workflowDeploymentOffer } from '@/platform/workspace/workflowDeploymentOffer'

const { entry = 'workflow_dialog' } = defineProps<{
  entry?: CustomDeploymentEntry
}>()

const { t } = useI18n()
const { markFor } = useDeploymentCompatibility()
const missingModelStore = useMissingModelStore()

const missingNodes = nodesNeedingDeployment(
  useMissingNodesErrorStore().missingNodesError?.nodeTypes ?? []
)
const packs = missingPacksOf(missingNodes)
const workflowStore = useWorkflowStore()
const openedWorkflow = workflowStore.activeWorkflow
const models = computed<MissingBuildModel[]>((modelsWhenLastActive) =>
  modelsWhenLastActive && workflowStore.activeWorkflow !== openedWorkflow
    ? modelsWhenLastActive
    : missingModelsOf(missingModelStore.visibleMissingModelCandidates ?? [])
)

const offer = workflowDeploymentOffer(
  useDeploymentPickStore().deployments,
  markFor,
  openWorkflowForCheck(missingNodes)
)

function row(key: string, names: readonly string[]): MissingItemsRow[] {
  const [name, ...rest] = names
  if (name === undefined) return []
  return [
    {
      label: t(key, names.length),
      name,
      ...(rest.length > 0 && {
        more: t('deploymentSwitcher.workflowNeedsDeployment.more', {
          count: rest.length
        }),
        others: rest.join(', ')
      })
    }
  ]
}

const missing = computed<MissingItemsRow[]>(() => [
  ...row(
    'deploymentSwitcher.workflowNeedsDeployment.missingPacks',
    packs.flatMap((pack) => (pack.packId === null ? [] : [pack.packId]))
  ),
  ...row(
    'deploymentSwitcher.workflowNeedsDeployment.missingNodes',
    packs.flatMap((pack) => (pack.packId === null ? pack.nodeTypes : []))
  ),
  ...row(
    'deploymentSwitcher.workflowNeedsDeployment.missingModels',
    models.value.map((model) => model.name)
  )
])

const pitch = computed<CustomDeploymentPitch>(() => ({
  ...customDeploymentPitch(),
  title: t('deploymentSwitcher.workflowNeedsDeployment.createTitle'),
  body: undefined,
  points: [
    t('deploymentSwitcher.customDeployment.pointNodes'),
    t('deploymentSwitcher.customDeployment.pointGpu'),
    t('deploymentSwitcher.workflowNeedsDeployment.pointBilling')
  ],
  platformLabel: t(
    'deploymentSwitcher.workflowNeedsDeployment.createCustomBuild'
  ),
  missing: missing.value
}))
</script>
