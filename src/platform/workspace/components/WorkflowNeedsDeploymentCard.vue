<template>
  <SwitchDeploymentCard
    v-if="offer.kind === 'switch'"
    :choices="offer.choices"
    :missing="missing"
  />
  <CustomDeploymentCard v-else :pitch="pitch" />
</template>

<script setup lang="ts">
import { uniqBy } from 'es-toolkit'
import { useI18n } from 'vue-i18n'

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
import { workflowDeploymentBrief } from '@/platform/workspace/deploymentBuildBrief'
import type { MissingBuildModel } from '@/platform/workspace/deploymentBuildBrief'
import {
  missingPacksOf,
  nodesNeedingDeployment
} from '@/platform/workspace/missingForDeployment'
import { openWorkflowForCheck } from '@/platform/workspace/openWorkflowForCheck'
import { useDeploymentPickStore } from '@/platform/workspace/stores/deploymentPickStore'
import { workflowDeploymentOffer } from '@/platform/workspace/workflowDeploymentOffer'

const NAMES_SHOWN = 3

const { t } = useI18n()
const { markFor } = useDeploymentCompatibility()

const missingNodes = nodesNeedingDeployment(
  useMissingNodesErrorStore().missingNodesError?.nodeTypes ?? []
)
const packs = missingPacksOf(missingNodes)
const models: MissingBuildModel[] = uniqBy(
  useMissingModelStore().visibleMissingModelCandidates ?? [],
  (candidate) => candidate.name
).map((candidate) => ({
  name: candidate.name,
  directory: candidate.directory ?? null,
  url: candidate.url
}))

const offer = workflowDeploymentOffer(
  useDeploymentPickStore().deployments,
  markFor,
  openWorkflowForCheck(missingNodes)
)

function listed(names: readonly string[]): string {
  const shown = names.slice(0, NAMES_SHOWN).join(', ')
  const more = names.length - NAMES_SHOWN
  return more > 0
    ? t('deploymentSwitcher.workflowNeedsDeployment.andMore', {
        names: shown,
        count: more
      })
    : shown
}

function row(key: string, names: readonly string[]): MissingItemsRow[] {
  if (names.length === 0) return []
  return [{ label: t(key, names.length), names: listed(names) }]
}

const missing: MissingItemsRow[] = [
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
    models.map((model) => model.name)
  )
]

const pitch: CustomDeploymentPitch = {
  ...customDeploymentPitch(),
  brief: workflowDeploymentBrief(packs, models),
  missing,
  ...(offer.kind === 'noneRunIt'
    ? {
        title: t('deploymentSwitcher.workflowNeedsDeployment.titleNoneRunIt'),
        note: t('deploymentSwitcher.workflowNeedsDeployment.noneRunIt')
      }
    : { title: t('deploymentSwitcher.workflowNeedsDeployment.title') })
}
</script>
