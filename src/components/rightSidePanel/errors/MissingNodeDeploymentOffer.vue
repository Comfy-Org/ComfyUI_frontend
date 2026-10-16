<!-- Under the missing-nodes message, the workspace's deployments that have
     every node type the open workflow uses, Comfy Cloud included, each a
     button that picks it through the deployment switcher (BE-19374). Up to
     three are named; "and N more" opens the switcher. When each was checked
     and none has them all, it says so. Renders nothing where the user popover
     does not offer the switcher (useDeploymentSwitcherOffered), where the
     deployment listing hides it, or before the check answers. -->
<template>
  <div
    v-if="offer !== null"
    class="pb-3"
    data-testid="missing-node-deployment-offer"
  >
    <p
      v-if="offer.kind === 'none'"
      class="m-0 text-xs/relaxed text-muted-foreground"
    >
      {{ t('rightSidePanel.missingNodePacks.noDeploymentRunsIt') }}
    </p>
    <div v-else class="flex flex-wrap items-center gap-1.5">
      <span class="text-xs text-muted-foreground">
        {{ t('rightSidePanel.missingNodePacks.runsOn') }}
      </span>
      <Button
        v-for="choice in offer.choices.slice(0, NAMED)"
        :key="choice.deploymentId ?? 'comfy-cloud'"
        variant="secondary"
        size="sm"
        :disabled="isSwitching"
        @click="choose(choice.deploymentId)"
      >
        {{ choice.label }}
      </Button>
      <Button
        v-if="offer.choices.length > NAMED"
        variant="muted-textonly"
        size="sm"
        @click="openSwitcher()"
      >
        {{
          t('rightSidePanel.missingNodePacks.andMore', {
            count: offer.choices.length - NAMED
          })
        }}
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import { useMissingNodeDeploymentOffer } from '@/platform/workspace/composables/useMissingNodeDeploymentOffer'

const NAMED = 3

const { t } = useI18n()
const { offer, choose, isSwitching, openSwitcher } =
  useMissingNodeDeploymentOffer()
</script>
