<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import Button from '@/components/ui/button/Button.vue'
import { usePersonalWorkspaceSwitch } from '../../../composables/usePersonalWorkspaceSwitch'
import { requestWorkshopBuyCredits } from '../../../config/workshop-buy-credits'
import { useTopUpWatch } from '../../../config/workshop-credits'
import { useWorkshopModelBalance } from '../../../config/workshop-model-balance'
import { useWorkshopSession } from '../../../config/workshop-session-state'
import type { Locale } from '../../../i18n/site'
import { t } from '../../../i18n/site'

const {
  member = false,
  retryLabel,
  locale = 'en'
} = defineProps<{
  member?: boolean
  retryLabel: string
  locale?: Locale
}>()

const emit = defineEmits<{ retry: [] }>()

const topUp = useTopUpWatch()
const personal = usePersonalWorkspaceSwitch()
const balance = useWorkshopModelBalance(useWorkshopSession().session)

const credits = computed(() =>
  balance.value.status === 'ok' ? balance.value.credits : undefined
)
const creditsWhenSkipped = ref(credits.value)
watch(credits, (value) => {
  creditsWhenSkipped.value ??= value
})
const canRetry = computed(
  () =>
    topUp.value.status === 'landed' ||
    (credits.value !== undefined &&
      creditsWhenSkipped.value !== undefined &&
      credits.value > creditsWhenSkipped.value)
)
</script>

<template>
  <span class="inline-flex flex-col items-center gap-1.5">
    <Button
      v-if="canRetry"
      size="sm"
      class="rounded-full"
      @click="emit('retry')"
    >
      {{ retryLabel }}
    </Button>
    <Button
      v-else-if="member"
      size="sm"
      variant="outline"
      class="rounded-full"
      :disabled="personal.pending.value"
      @click="personal.switchToPersonal"
    >
      {{
        t(
          personal.pending.value
            ? 'workshop.run.preparingSession'
            : 'workshop.run.switchPersonal',
          {},
          { locale: locale }
        )
      }}
    </Button>
    <Button
      v-else
      size="sm"
      class="rounded-full"
      @click="requestWorkshopBuyCredits"
    >
      {{ t('workshop.run.buyCredits', {}, { locale: locale }) }}
    </Button>
    <span
      v-if="personal.failed.value"
      role="alert"
      class="text-xs text-primary-comfy-red"
    >
      {{ t('nav.workspaceSwitchError', {}, { locale: locale }) }}
    </span>
  </span>
</template>
