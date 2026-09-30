<script setup lang="ts">
import {
  CircleAlert,
  CircleCheck,
  CircleDashed,
  CirclePause,
  LoaderCircle
} from '@lucide/vue'
import { computed } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import Button from '@/components/ui/button/Button.vue'
import type { DepthState } from '../../../../composables/useReshoot'
import { rc } from '../../../../lib/workshop/cinematic-studio/reshoot-copy'
import type { Locale } from '../../../../i18n/translations'

const {
  depth,
  reason,
  locale = 'en'
} = defineProps<{
  depth: Exclude<DepthState, 'ready'>
  /** Why the depth is not being read: a failure, or what stops it starting. */
  reason?: string
  locale?: Locale
}>()

const emit = defineEmits<{ retry: [] }>()

const depthStep = computed(() => {
  if (depth === 'analyzing')
    return {
      icon: LoaderCircle,
      title: rc('reshoot.pending.depth', locale),
      detail: rc('reshoot.pending.depthTime', locale),
      iconClass: 'text-primary-comfy-yellow motion-safe:animate-spin'
    }
  if (depth === 'failed')
    return {
      icon: CircleAlert,
      title: rc('reshoot.pending.depthFailed', locale),
      detail: reason,
      iconClass: 'text-primary-warm-white'
    }
  return {
    icon: CirclePause,
    title: rc('reshoot.pending.depthWaiting', locale),
    detail: reason,
    iconClass: 'text-primary-warm-gray'
  }
})
</script>

<template>
  <ol
    class="flex flex-col gap-4 rounded-2xl border border-dashed border-transparency-white-t8 p-4"
    data-testid="reshoot-aim-pending"
  >
    <li class="flex gap-3">
      <CircleCheck
        class="mt-0.5 size-4 shrink-0 text-primary-comfy-yellow"
        aria-hidden="true"
      />
      <span class="text-sm text-primary-comfy-canvas">
        {{ rc('reshoot.pending.clip', locale) }}
      </span>
    </li>
    <li
      class="flex gap-3"
      :role="depth === 'failed' ? 'alert' : 'status'"
      data-testid="reshoot-depth-step"
    >
      <component
        :is="depthStep.icon"
        :class="cn('mt-0.5 size-4 shrink-0', depthStep.iconClass)"
        aria-hidden="true"
      />
      <span class="flex min-w-0 flex-col gap-1">
        <span class="text-sm font-semibold text-primary-warm-white">
          {{ depthStep.title }}
        </span>
        <span
          v-if="depthStep.detail"
          class="text-xs/relaxed wrap-break-word text-primary-warm-gray"
        >
          {{ depthStep.detail }}
        </span>
        <Button
          v-if="depth === 'failed'"
          size="sm"
          variant="outline"
          class="mt-1 self-start rounded-full"
          data-testid="reshoot-analyze"
          @click="emit('retry')"
        >
          {{ rc('reshoot.tryAgain', locale) }}
        </Button>
      </span>
    </li>
    <li class="flex gap-3">
      <CircleDashed
        class="mt-0.5 size-4 shrink-0 text-primary-warm-gray"
        aria-hidden="true"
      />
      <span class="flex flex-col gap-1">
        <span class="text-sm text-primary-comfy-canvas">
          {{ rc('reshoot.pending.aim', locale) }}
        </span>
        <span class="text-xs/relaxed text-primary-warm-gray">
          {{ rc('reshoot.pending.aimHint', locale) }}
        </span>
      </span>
    </li>
  </ol>
</template>
