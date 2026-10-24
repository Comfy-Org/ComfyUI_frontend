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
