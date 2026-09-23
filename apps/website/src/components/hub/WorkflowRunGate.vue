<script setup lang="ts">
import { requestWorkshopBuyCredits } from '../../config/workshop-buy-credits'
import type { Locale } from '../../i18n/translations'
import { tHub } from '../../i18n/hub'
import Button from '../ui/button/Button.vue'

// An empty wallet, said before the run rather than after it. Naming the
// workspace is what keeps a reader from topping up the wrong one, and whose
// it is decides whether adding credits is even theirs to do.
const {
  workspace,
  member,
  switching = false,
  switchFailed = false,
  locale = 'en'
} = defineProps<{
  workspace: string
  member: boolean
  switching?: boolean
  switchFailed?: boolean
  locale?: Locale
}>()

defineEmits<{ personal: [] }>()
</script>

<template>
  <div class="flex flex-col gap-1 text-center" data-testid="run-gate">
    <p class="text-sm font-bold text-content-secondary">
      {{ tHub('workshop.error.creditsTitle', locale) }}
    </p>
    <p class="text-xs text-content-secondary">
      {{
        tHub(
          member
            ? 'workshop.error.memberNoCredits'
            : 'workshop.error.noCreditsCloud',
          locale
        ).replace('{workspace}', () => workspace)
      }}
    </p>
  </div>

  <Button
    v-if="member"
    variant="outline"
    size="lg"
    class="w-full"
    :disabled="switching"
    data-testid="workflow-run-personal"
    @click="$emit('personal')"
  >
    {{
      tHub(
        switching
          ? 'workshop.run.preparingSession'
          : 'workshop.run.switchPersonal',
        locale
      )
    }}
  </Button>

  <Button
    v-else
    size="lg"
    class="w-full"
    data-testid="workflow-run-credits"
    @click="requestWorkshopBuyCredits"
  >
    {{ tHub('workshop.run.buyCredits', locale) }}
  </Button>

  <p v-if="switchFailed" class="text-xs text-primary-comfy-red" role="alert">
    {{ tHub('nav.workspaceSwitchError', locale) }}
  </p>
</template>
