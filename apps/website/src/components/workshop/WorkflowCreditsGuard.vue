<script setup lang="ts">
import { computed } from 'vue'

import Button from '@/components/ui/button/Button.vue'
import { usePersonalWorkspaceSwitch } from '../../composables/usePersonalWorkspaceSwitch'
import { requestWorkshopBuyCredits } from '../../config/workshop-buy-credits'
import { t } from '../../i18n/translations'
import type { WorkflowCreditsGate } from '../../lib/workshop/workflow-credits-gate'

const { gate, workspaceName = '' } = defineProps<{
  gate: WorkflowCreditsGate
  workspaceName?: string
}>()
const { pending, failed, switchToPersonal } = usePersonalWorkspaceSwitch()
const note = computed(() =>
  t(
    gate === 'memberNoCredits'
      ? 'workshop.error.memberNoCredits'
      : 'workshop.error.noCreditsCloud',
    'en',
    { workspace: workspaceName }
  )
)
</script>

<template>
  <slot v-if="gate === 'run'" />
  <template v-else>
    <p class="text-sm text-content-secondary">{{ note }}</p>
    <Button
      v-if="gate === 'noCredits'"
      type="button"
      size="lg"
      class="w-full"
      data-testid="workflow-run"
      data-gate="noCredits"
      @click="requestWorkshopBuyCredits"
      >{{ t('workshop.run.buyCredits') }}</Button
    >
    <Button
      v-else
      type="button"
      variant="outline"
      size="lg"
      class="w-full"
      :disabled="pending"
      data-testid="workflow-run"
      data-gate="memberNoCredits"
      @click="switchToPersonal"
      >{{
        t(
          pending
            ? 'workshop.run.preparingSession'
            : 'workshop.run.switchPersonal'
        )
      }}</Button
    >
    <p v-if="failed" role="alert" class="text-xs text-primary-comfy-red">
      {{ t('nav.workspaceSwitchError') }}
    </p>
  </template>
</template>
