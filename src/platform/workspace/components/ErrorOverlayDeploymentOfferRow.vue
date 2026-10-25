<template>
  <div
    v-if="first"
    class="flex w-full items-center gap-2 pr-8"
    data-testid="error-overlay-deployment-offer"
  >
    <span class="size-4 shrink-0" aria-hidden="true" />
    <span class="min-w-0 flex-1 truncate text-sm text-foreground">
      {{ t('errorOverlay.runsOn', { deployment: first.label }) }}
    </span>
    <Button
      v-if="moreCount > 0"
      variant="muted-textonly"
      size="unset"
      class="min-h-8 shrink-0 rounded-lg px-2 py-2 text-xs font-normal"
      @click="openSwitcher()"
    >
      {{ t('errorOverlay.moreDeployments', { count: moreCount }) }}
    </Button>
    <Button
      variant="secondary"
      size="unset"
      class="min-h-8 shrink-0 rounded-lg px-3 py-2 text-xs font-normal"
      :disabled="isSwitching"
      @click="choose(first.deploymentId)"
    >
      {{ t('errorOverlay.switchDeployment') }}
    </Button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import { useMissingNodeDeploymentOffer } from '@/platform/workspace/composables/useMissingNodeDeploymentOffer'

const { t } = useI18n()
const { offer, choose, isSwitching, openSwitcher } =
  useMissingNodeDeploymentOffer()

const choices = computed(() =>
  offer.value?.kind === 'choices' ? offer.value.choices : []
)
const first = computed(() => choices.value[0])
const moreCount = computed(() => choices.value.length - 1)
</script>
