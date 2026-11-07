<template>
  <div v-if="availability.kind !== 'hidden'">
    <Button
      :variant
      :size
      :class="buttonClass"
      :disabled="availability.kind === 'disabled'"
      :aria-describedby="reason ? reasonId : undefined"
      @click="emit('click')"
    >
      <slot />
    </Button>
    <p
      v-if="reason"
      :id="reasonId"
      :class="cn('m-0 text-muted-foreground', reasonClass)"
    >
      {{ reason }}
    </p>
  </div>
</template>

<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { computed, useId } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@comfyorg/design-system/button/Button'
import type { ButtonVariants } from '@comfyorg/design-system/button.variants'
import type { AddCreditsAvailability } from '@comfyorg/account-core/billing'

const { availability } = defineProps<{
  availability: AddCreditsAvailability
  variant?: ButtonVariants['variant']
  size?: ButtonVariants['size']
  buttonClass?: string
  reasonClass?: string
}>()

const emit = defineEmits<{
  click: []
}>()

const { t } = useI18n()

const reasonId = useId()
const reason = computed(() =>
  availability.kind === 'disabled' ? t(availability.reasonKey) : null
)
</script>
