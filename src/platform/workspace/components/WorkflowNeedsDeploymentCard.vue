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
    :frame-request="NEW_DEPLOYMENT_FOR_WORKFLOW"
    frame-entry="workflow_dialog"
    @platform-clicked="trackDeploymentLinkClicked('build_on_platform')"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { handoffFileName } from '@/platform/workflow/deploy/utils/agentHandoff'
import type { ComfyWorkflow } from '@/platform/workflow/management/stores/comfyWorkflow'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useMissingModelStore } from '@/platform/workflowErrors/missingModel/missingModelStore'
import { useMissingNodesErrorStore } from '@/platform/workflowErrors/nodeReplacement/missingNodesErrorStore'
import CustomDeploymentCard from '@/platform/workspace/components/CustomDeploymentCard.vue'
import SwitchDeploymentCard from '@/platform/workspace/components/SwitchDeploymentCard.vue'
import { useDeploymentCompatibility } from '@/platform/workspace/composables/useDeploymentCompatibility'
import { customDeploymentPitch } from '@/platform/workspace/customDeploymentPitch'
import type {
  BriefWorkflow,
  CustomDeploymentPitch,
  MissingItemsRow
} from '@/platform/workspace/customDeploymentPitch'
import { workflowDeploymentBrief } from '@/platform/workspace/deploymentBuildBrief'
import type { MissingBuildModel } from '@/platform/workspace/deploymentBuildBrief'
import {
  missingModelsOf,
  missingPacksOf,
  nodesNeedingDeployment
} from '@/platform/workspace/missingForDeployment'
import { openWorkflowForCheck } from '@/platform/workspace/openWorkflowForCheck'
import { trackDeploymentLinkClicked } from '@/platform/workspace/platformFrame/customDeploymentTelemetry'
import { usePlatformFrameStore } from '@/platform/workspace/platformFrame/platformFrameStore'
import { NEW_DEPLOYMENT_FOR_WORKFLOW } from '@/platform/workspace/platformFrame/platformFrameWaysIn'
import { useDeploymentPickStore } from '@/platform/workspace/stores/deploymentPickStore'
import { workflowDeploymentOffer } from '@/platform/workspace/workflowDeploymentOffer'

const NAMES_SHOWN = 3

const { t } = useI18n()
const frames = usePlatformFrameStore()
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

const briefWorkflow = briefWorkflowOf(openedWorkflow)

function browserKeptFileName(name: string): string {
  return name.replace(/[^\p{L}\p{M}\p{N} ._()-]+/gu, '_').replace(/^\.+/, '')
}

function briefWorkflowOf(
  workflow: ComfyWorkflow | null
): BriefWorkflow | undefined {
  if (!workflow) return
  return {
    fileName: handoffFileName(
      browserKeptFileName(workflow.filename.replace(/\.json$/i, ''))
    ),
    serialize: () => {
      workflow.changeTracker?.prepareForSave()
      return workflow.activeState === null
        ? null
        : JSON.stringify(workflow.activeState, null, 2)
    }
  }
}

const offer = workflowDeploymentOffer(
  useDeploymentPickStore().deployments,
  markFor,
  openWorkflowForCheck(missingNodes)
)

function listed(names: readonly string[]): string {
  const shown = names.slice(0, NAMES_SHOWN).join(', ')
  const more = names.length - NAMES_SHOWN
  return more > 0
    ? t(
        'deploymentSwitcher.workflowNeedsDeployment.andMore',
        { names: shown, count: more },
        { escapeParameter: false }
      )
    : shown
}

function row(key: string, names: readonly string[]): MissingItemsRow[] {
  if (names.length === 0) return []
  return [{ label: t(key, names.length), names: listed(names) }]
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

function noneRunItCopy() {
  if (!frames.isAvailable())
    return {
      title: t('deploymentSwitcher.workflowNeedsDeployment.titleNoneRunIt'),
      platformLabel: t(
        'deploymentSwitcher.workflowNeedsDeployment.buildOnPlatform'
      )
    }
  return {
    title: t(
      'deploymentSwitcher.workflowNeedsDeployment.titleNoneRunItCustomBuild'
    ),
    platformLabel: t(
      'deploymentSwitcher.workflowNeedsDeployment.createCustomBuild'
    )
  }
}

const pitch = computed<CustomDeploymentPitch>(() => ({
  ...customDeploymentPitch(),
  body: t('deploymentSwitcher.workflowNeedsDeployment.installBody'),
  platformLabel: t(
    'deploymentSwitcher.workflowNeedsDeployment.buildOnPlatform'
  ),
  brief: workflowDeploymentBrief(packs, models.value, briefWorkflow?.fileName),
  workflow: briefWorkflow,
  missing: missing.value,
  ...(offer.kind === 'noneRunIt'
    ? {
        ...noneRunItCopy(),
        note: t('deploymentSwitcher.workflowNeedsDeployment.noneRunIt')
      }
    : { title: t('deploymentSwitcher.workflowNeedsDeployment.installTitle') })
}))
</script>
