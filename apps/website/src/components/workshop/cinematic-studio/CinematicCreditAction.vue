<script setup lang="ts">
import Button from '@/components/ui/button/Button.vue'
import { usePersonalWorkspaceSwitch } from '../../../composables/usePersonalWorkspaceSwitch'
import { requestWorkshopBuyCredits } from '../../../config/workshop-buy-credits'
import { useTopUpWatch } from '../../../config/workshop-credits'
import type { Locale } from '../../../i18n/translations'
import { t } from '../../../i18n/translations'

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
</script>

<template>
  <span class="inline-flex flex-col items-center gap-1.5">
    <Button
      v-if="topUp.status === 'landed'"
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
          locale
        )
      }}
    </Button>
    <Button
      v-else
      size="sm"
      class="rounded-full"
      @click="requestWorkshopBuyCredits"
    >
      {{ t('workshop.run.buyCredits', locale) }}
    </Button>
    <span
      v-if="personal.failed.value"
      role="alert"
      class="text-xs text-primary-comfy-red"
    >
      {{ t('nav.workspaceSwitchError', locale) }}
    </span>
  </span>
</template>
