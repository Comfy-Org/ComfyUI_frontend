<template>
  <div class="flex flex-col gap-2">
    <span class="text-sm font-semibold text-base-foreground">
      {{ planName }}
    </span>
    <div class="flex items-baseline gap-2">
      <span class="text-2xl font-semibold text-base-foreground tabular-nums">
        ${{ heroPrice }}
      </span>
      <span class="text-base text-base-foreground">
        {{ usdPerMonth }}
      </span>
    </div>
    <span v-for="line in details" :key="line" class="text-muted-foreground">
      {{ line }}
    </span>
  </div>

  <div class="flex flex-col gap-2 pt-10">
    <span
      v-if="heading"
      class="text-xs font-semibold tracking-wide text-muted-foreground uppercase"
    >
      {{ heading }}
    </span>
    <div class="flex items-center justify-between">
      <span class="text-base-foreground">{{ refillLabel }}</span>
      <div class="flex items-center gap-1">
        <i class="icon-[lucide--coins] size-4 shrink-0 bg-credit" />
        <span class="font-bold text-base-foreground tabular-nums">{{
          refillCredits
        }}</span>
      </div>
    </div>
    <span v-if="note" class="text-sm text-muted-foreground">
      {{ note }}
    </span>
  </div>
</template>

<script setup lang="ts">
/**
 * The plan-change confirm's plan block: the plan switched to, when it takes
 * effect, and the credits it refills — with the "after that" heading a
 * scheduled change carries.
 */
const {
  planName,
  heroPrice,
  usdPerMonth,
  details,
  heading = '',
  refillLabel,
  refillCredits,
  note = ''
} = defineProps<{
  planName: string
  heroPrice: string
  usdPerMonth: string
  details: readonly string[]
  heading?: string
  refillLabel: string
  refillCredits: string
  note?: string
}>()
</script>
