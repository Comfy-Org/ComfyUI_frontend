<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import { cn } from '@comfyorg/tailwind-utils'

const { name, current, available, stops } = defineProps<{
  name: string
  price?: string
  credits?: string
  seats: string
  available: boolean
  current: boolean
  /** Why the workspace cannot move to this plan, when it cannot. */
  reason?: string
  /** The credit stops a plan priced per stop offers, as ready labels. */
  stops?: { id: string; label: string }[]
}>()

const stopId = defineModel<string>('stopId')

defineEmits<{ choose: [] }>()

const { t } = useI18n()
</script>

<template>
  <li
    :class="
      cn(
        'flex flex-col rounded-xl border border-border-subtle bg-secondary-background p-4',
        current && 'border-base-foreground'
      )
    "
  >
    <h3 class="m-0 text-base font-semibold text-base-foreground">{{ name }}</h3>
    <p
      v-if="price"
      class="mt-2 mb-0 font-semibold text-base-foreground tabular-nums"
    >
      {{ price }}
    </p>
    <p v-if="credits" class="mt-1 mb-0 text-sm text-muted-foreground">
      {{ credits }}
    </p>
    <select
      v-if="stops?.length"
      v-model="stopId"
      :aria-label="t('hosted.plan.chooseStop', { plan: name })"
      class="mt-2 h-10 rounded-lg border border-border-subtle bg-base-background px-2 text-sm text-base-foreground"
    >
      <option v-for="stop in stops" :key="stop.id" :value="stop.id">
        {{ stop.label }}
      </option>
    </select>
    <p class="mt-1 mb-0 text-sm text-muted-foreground">{{ seats }}</p>
    <p v-if="current" class="mt-2 mb-0 text-sm text-base-foreground">
      {{ t('hosted.subscription.currentPlan') }}
    </p>
    <p v-if="reason" class="mt-2 mb-0 text-sm text-muted-foreground">
      {{ reason }}
    </p>
    <button
      type="button"
      :disabled="!available"
      :aria-label="t('hosted.subscription.choosePlan', { plan: name })"
      class="mt-3 h-10 w-full cursor-pointer rounded-lg bg-base-foreground px-4 text-sm font-semibold text-base-background disabled:cursor-not-allowed disabled:opacity-40"
      @click="$emit('choose')"
    >
      {{ t('hosted.subscription.choose') }}
    </button>
  </li>
</template>
