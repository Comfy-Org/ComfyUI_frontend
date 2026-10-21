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
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { useMissingModelStore } from '@/platform/missingModel/missingModelStore'
import { useMissingNodesErrorStore } from '@/platform/nodeReplacement/missingNodesErrorStore'
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
import { useDeploymentPickStore } from '@/platform/workspace/stores/deploymentPickStore'
import { workflowDeploymentOffer } from '@/platform/workspace/workflowDeploymentOffer'

const NAMES_SHOWN = 3

const { t } = useI18n()
const missingNodesErrorStore = useMissingNodesErrorStore()
const missingModelStore = useMissingModelStore()
const { markFor } = useDeploymentCompatibility()

const packs = computed(() =>
  missingPacksOf(
    nodesNeedingDeployment(
      missingNodesErrorStore.missingNodesError?.nodeTypes ?? []
    )
  )
)

const offer = workflowDeploymentOffer(
  useDeploymentPickStore().deployments,
  markFor,
  packs.value.flatMap((pack) => pack.nodeTypes)
)
const models = computed<MissingBuildModel[]>(() =>
  uniqBy(
    missingModelStore.visibleMissingModelCandidates ?? [],
    (candidate) => candidate.name
  ).map((candidate) => ({
    name: candidate.name,
    directory: candidate.directory ?? null,
    url: candidate.url
  }))
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

const missing = computed<MissingItemsRow[]>(() => [
  ...row(
    'deploymentSwitcher.workflowNeedsDeployment.missingPacks',
    packs.value.flatMap((pack) => (pack.packId === null ? [] : [pack.packId]))
  ),
  ...row(
    'deploymentSwitcher.workflowNeedsDeployment.missingNodes',
    packs.value.flatMap((pack) => (pack.packId === null ? pack.nodeTypes : []))
  ),
  ...row(
    'deploymentSwitcher.workflowNeedsDeployment.missingModels',
    models.value.map((model) => model.name)
  )
])

const pitch = computed<CustomDeploymentPitch>(() => ({
  ...customDeploymentPitch(),
  brief: workflowDeploymentBrief(packs.value, models.value),
  missing: missing.value,
  ...(offer.kind === 'noneRunIt'
    ? {
        title: t('deploymentSwitcher.workflowNeedsDeployment.titleNoneRunIt'),
        note: t('deploymentSwitcher.workflowNeedsDeployment.noneRunIt')
      }
    : { title: t('deploymentSwitcher.workflowNeedsDeployment.title') })
}))
</script>
