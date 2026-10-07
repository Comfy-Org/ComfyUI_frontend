<!-- The body of the deployment switcher's panel (FE-2434): Comfy Cloud, the
     workspace's deployments, and "Use the workspace default" for a browser
     that picked for itself (BE-17480). Comfy Cloud and each deployment are
     marked with whether they can run the open workflow (BE-19373). -->
<template>
  <DeploymentSwitcherRow
    :label="$t('deploymentSwitcher.comfyCloud')"
    :caption="$t('deploymentSwitcher.comfyCloudCaption')"
    :checked="pickedDeployment === null"
    :mark="markFor(null)"
    data-testid="deployment-row-cloud"
    @click="emit('choose', null)"
  />
  <DeploymentSwitcherRow
    v-for="deployment in deployments"
    :key="deployment.deployment_id"
    :label="deploymentLabel(deployment)"
    :caption="deploymentCaption(deployment)"
    :checked="deployment.deployment_id === pickedDeploymentId"
    :mark="markFor(deployment.deployment_id)"
    :data-testid="`deployment-row-${deployment.deployment_id}`"
    @click="emit('choose', deployment.deployment_id)"
  />
  <DeploymentSwitcherRow
    v-if="canFollow"
    :label="$t('deploymentSwitcher.followWorkspace')"
    :caption="followCaption"
    :checked="null"
    data-testid="deployment-row-follow"
    @click="emit('follow')"
  />
  <p
    v-if="deployments.length === 0"
    class="m-0 px-4 py-3 text-xs text-muted-foreground"
    data-testid="deployment-switcher-empty"
  >
    {{ $t('deploymentSwitcher.noDeployments') }}
  </p>
  <p v-if="!buildsVisible" class="m-0 px-4 py-2 text-xs text-muted-foreground">
    {{ $t('deploymentSwitcher.buildsHidden') }}
  </p>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import DeploymentSwitcherRow from '@/platform/workspace/components/DeploymentSwitcherRow.vue'
import { useDeploymentCompatibility } from '@/platform/workspace/composables/useDeploymentCompatibility'
import { useDeploymentLabels } from '@/platform/workspace/composables/useDeploymentLabels'
import { useDeploymentPickStore } from '@/platform/workspace/stores/deploymentPickStore'

const emit = defineEmits<{
  choose: [deploymentId: string | null]
  follow: []
}>()

const { t } = useI18n()
const {
  deployments,
  pickedDeploymentId,
  pickedDeployment,
  defaultDeploymentId,
  followsWorkspace,
  buildsVisible
} = storeToRefs(useDeploymentPickStore())
const { deploymentLabel, deploymentCaption, defaultLabel } =
  useDeploymentLabels()
const { markFor } = useDeploymentCompatibility()

/** This browser picked for itself and can go back to the default. */
const canFollow = computed(
  () => defaultDeploymentId.value !== null && !followsWorkspace.value
)
const followCaption = computed(() =>
  t(
    'deploymentSwitcher.followWorkspaceCaption',
    { deployment: defaultLabel.value },
    { escapeParameter: false }
  )
)
</script>
