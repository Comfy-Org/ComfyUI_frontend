<script setup lang="ts">
import { Check, Lock } from '@lucide/vue'

import { cn } from '@comfyorg/tailwind-utils'

import { rc } from '../../../../lib/workshop/cinematic-studio/reshoot-copy'
import type { Locale } from '../../../../i18n/translations'

const {
  step,
  canAim,
  locale = 'en'
} = defineProps<{
  step: 1 | 2
  canAim: boolean
  locale?: Locale
}>()

const emit = defineEmits<{ go: [step: 1 | 2] }>()

const STEPS = [
  { n: 1, label: 'reshoot.step1' },
  { n: 2, label: 'reshoot.step2' }
] as const

const ARROW = {
  1: 'polygon(0 0, calc(100% - 14px) 0, 100% 50%, calc(100% - 14px) 100%, 0 100%)',
  2: 'polygon(0 0, calc(100% - 14px) 0, 100% 50%, calc(100% - 14px) 100%, 0 100%, 14px 50%)'
} as const

const reachable = (n: 1 | 2) => n === 1 || canAim

function tone(n: 1 | 2): string {
  if (step === n) return 'bg-primary-comfy-yellow text-primary-comfy-ink'
  if (n < step)
    return 'bg-transparency-white-t8 text-primary-warm-white hover:bg-transparency-white-t20'
  if (reachable(n))
    return 'bg-transparency-white-t8 text-primary-comfy-canvas hover:bg-transparency-white-t20'
  return 'bg-transparency-white-t4 text-primary-warm-gray'
}
</script>

<template>
  <ol
    class="flex w-full min-w-0"
    :aria-label="rc('reshoot.step', locale).replace('{n}', String(step))"
  >
    <li
      v-for="item in STEPS"
      :key="item.n"
      :class="cn('min-w-0 flex-1', item.n === 2 && '-ml-2')"
    >
      <button
        type="button"
        :aria-current="step === item.n ? 'step' : undefined"
        :disabled="!reachable(item.n)"
        :class="
          cn(
            'flex h-11 w-full items-center gap-2.5 pr-6 text-left transition-colors disabled:cursor-not-allowed',
            item.n === 1 ? 'rounded-l-xl pl-3.5' : 'pl-7',
            tone(item.n)
          )
        "
        :style="{ clipPath: ARROW[item.n] }"
        @click="emit('go', item.n)"
      >
        <Check
          v-if="item.n < step"
          class="size-4 shrink-0"
          aria-hidden="true"
        />
        <Lock
          v-else-if="!reachable(item.n)"
          class="size-3.5 shrink-0"
          aria-hidden="true"
        />
        <span class="flex min-w-0 flex-col leading-tight">
          <span
            class="text-[10px] font-bold tracking-wider uppercase opacity-70"
          >
            {{ rc('reshoot.step', locale).replace('{n}', String(item.n)) }}
          </span>
          <span class="truncate text-[13px] font-semibold">
            {{ rc(item.label, locale) }}
          </span>
        </span>
      </button>
    </li>
  </ol>
</template>
