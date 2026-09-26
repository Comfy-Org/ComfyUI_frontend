<script setup lang="ts">
import { CircleAlert, CircleStop, Coins, ShieldAlert } from '@lucide/vue'
import { computed } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import Button from '@/components/ui/button/Button.vue'
import CopyTextButton from '@/components/ui/copy-text-button/CopyTextButton.vue'
import type { Take } from '../../../lib/workshop/cinematic-studio/reel'
import { failureLabelKey } from '../../../lib/workshop/failure-label'
import type { Locale } from '../../../i18n/translations'
import { t } from '../../../i18n/translations'
import { tc } from '../../../lib/workshop/cinematic-studio/copy'
import CinematicCreditAction from './CinematicCreditAction.vue'

type Settled = Extract<Take, { status: 'failed' | 'cancelled' }>

const {
  take,
  otherModel,
  memberWorkspace,
  locale = 'en'
} = defineProps<{
  take: Settled
  otherModel?: { slug: string; name: string }
  /** The team workspace paying for runs, when the viewer is a member. */
  memberWorkspace?: string
  locale?: Locale
}>()

const emit = defineEmits<{
  retry: []
  switchModel: [slug: string]
  editScene: []
}>()

const kind = computed(() => {
  if (take.status === 'cancelled') return 'cancelled'
  if (take.reason === 'noCredits') return 'noCredits'
  if (take.reason === 'policy') return 'blocked'
  if (take.reason === 'validation') return 'rejected'
  return 'failed'
})

const NOTICE = {
  cancelled: { icon: CircleStop, tone: 'text-primary-comfy-canvas' },
  noCredits: { icon: Coins, tone: 'text-primary-comfy-yellow' },
  blocked: { icon: ShieldAlert, tone: 'text-primary-comfy-orange' },
  rejected: { icon: ShieldAlert, tone: 'text-primary-comfy-orange' },
  failed: { icon: CircleAlert, tone: 'text-primary-comfy-red' }
} as const

const title = computed(() => {
  if (kind.value === 'cancelled') return tc('cinematic.state.cancelled', locale)
  if (kind.value === 'noCredits') return tc('cinematic.state.noCredits', locale)
  if (kind.value === 'blocked') return tc('cinematic.state.blocked', locale)
  return tc('cinematic.state.failed', locale)
})
const body = computed(() => {
  if (take.status === 'cancelled') return t('workshop.output.cancelled', locale)
  if (kind.value === 'noCredits' && memberWorkspace !== undefined)
    return t('workshop.error.memberNoCredits', locale, {
      workspace: memberWorkspace
    })
  return t(failureLabelKey[take.reason], locale)
})
const requestId = computed(() =>
  take.status === 'failed' ? take.requestId : undefined
)
</script>

<template>
  <figcaption
    role="status"
    class="absolute inset-0 flex flex-col items-center justify-center gap-3 overflow-y-auto px-6 py-8 text-center sm:px-16"
  >
    <component
      :is="NOTICE[kind].icon"
      :class="cn('size-5 shrink-0', NOTICE[kind].tone)"
      aria-hidden="true"
    />
    <span class="text-lg font-semibold text-primary-warm-white">
      {{ title }}
    </span>
    <span class="max-w-md text-sm/relaxed text-primary-comfy-canvas">
      {{ body }}
    </span>
    <div class="mt-1 flex flex-wrap items-center justify-center gap-2.5">
      <CinematicCreditAction
        v-if="kind === 'noCredits'"
        :member="memberWorkspace !== undefined"
        :retry-label="t('workshop.error.retry', locale)"
        :locale
        @retry="emit('retry')"
      />
      <Button
        v-else-if="kind === 'blocked' || kind === 'rejected'"
        size="sm"
        class="rounded-full"
        @click="emit('editScene')"
      >
        {{ tc('cinematic.state.editScene', locale) }}
      </Button>
      <template v-else>
        <Button size="sm" class="rounded-full" @click="emit('retry')">
          {{ t('workshop.error.retry', locale) }}
        </Button>
        <Button
          v-if="kind === 'failed' && otherModel"
          size="sm"
          variant="outline"
          class="rounded-full border-transparency-white-t20 text-primary-warm-white"
          @click="emit('switchModel', otherModel.slug)"
        >
          {{
            tc('cinematic.state.tryOn', locale).replace(
              '{model}',
              otherModel.name
            )
          }}
        </Button>
      </template>
    </div>
    <span
      v-if="requestId"
      class="flex items-center gap-1 font-mono text-[11px] text-primary-warm-gray"
    >
      {{ t('workshop.run.requestId', locale) }} {{ requestId }}
      <CopyTextButton
        :value="requestId"
        :label="t('workshop.run.copyRequestId', locale)"
        :copied-label="t('workshop.api.copied', locale)"
        icon-class="size-3"
        class="h-6 min-w-6 rounded-md px-1"
      />
    </span>
  </figcaption>
</template>
