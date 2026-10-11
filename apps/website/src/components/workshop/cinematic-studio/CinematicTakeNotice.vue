<script setup lang="ts">
import { CircleAlert, CircleStop, Coins, ShieldAlert } from '@lucide/vue'
import { computed } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import Button from '@/components/ui/button/Button.vue'
import CopyTextButton from '@/components/ui/copy-text-button/CopyTextButton.vue'
import { refusesRealFaces } from '@/config/workshop-model-restrictions'
import type { Take } from '@/lib/workshop/cinematic-studio/reel'
import { failureLabelKey } from '@/lib/workshop/failure-label'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
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
const { t } = translationsFor(locale)

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
  cancelled: {
    icon: CircleStop,
    tone: 'text-primary-comfy-canvas',
    error: false
  },
  noCredits: { icon: Coins, tone: 'text-primary-comfy-yellow', error: false },
  blocked: {
    icon: ShieldAlert,
    tone: 'text-primary-comfy-orange',
    error: true
  },
  rejected: {
    icon: ShieldAlert,
    tone: 'text-primary-comfy-orange',
    error: true
  },
  failed: { icon: CircleAlert, tone: 'text-primary-comfy-red', error: true }
} as const

const title = computed(() => {
  if (kind.value === 'cancelled') return t('cinematic.state.cancelled')
  if (kind.value === 'noCredits') return t('cinematic.state.noCredits')
  if (kind.value === 'blocked') return t('cinematic.state.blocked')
  return t('cinematic.state.failed')
})
const body = computed(() => {
  if (take.status === 'cancelled') return t('workshop.output.cancelled')
  if (kind.value === 'noCredits' && memberWorkspace !== undefined)
    return t('workshop.error.memberNoCredits', {
      workspace: memberWorkspace
    })
  if (kind.value === 'rejected') return t('workshop.error.inputRejected')
  if (
    kind.value === 'blocked' &&
    take.status === 'failed' &&
    take.runSlug &&
    refusesRealFaces(take.runSlug)
  )
    return t('workshop.error.policyRealFaces')
  return t(failureLabelKey[take.reason])
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
    <span
      :class="
        cn(
          'max-w-md text-sm/relaxed text-primary-comfy-canvas',
          NOTICE[kind].error && 'text-base/relaxed text-primary-comfy-red'
        )
      "
    >
      {{ body }}
    </span>
    <div class="mt-1 flex flex-wrap items-center justify-center gap-2.5">
      <CinematicCreditAction
        v-if="kind === 'noCredits'"
        :member="memberWorkspace !== undefined"
        :retry-label="t('workshop.error.retry')"
        :locale
        @retry="emit('retry')"
      />
      <Button
        v-else-if="kind === 'blocked' || kind === 'rejected'"
        size="sm"
        class="rounded-full"
        @click="emit('editScene')"
      >
        {{ t('cinematic.state.editScene') }}
      </Button>
      <template v-else>
        <Button size="sm" class="rounded-full" @click="emit('retry')">
          {{ t('workshop.error.retry') }}
        </Button>
        <Button
          v-if="kind === 'failed' && otherModel"
          size="sm"
          variant="outline"
          class="rounded-full border-transparency-white-t20 text-primary-warm-white"
          @click="emit('switchModel', otherModel.slug)"
        >
          {{ t('cinematic.state.tryOn', { model: otherModel.name }) }}
        </Button>
      </template>
    </div>
    <span
      v-if="requestId"
      class="flex items-center gap-1 font-mono text-[11px] text-primary-warm-gray"
    >
      {{ t('workshop.run.requestId') }} {{ requestId }}
      <CopyTextButton
        :value="requestId"
        :label="t('workshop.run.copyRequestId')"
        :copied-label="t('workshop.api.copied')"
        icon-class="size-3"
        class="h-6 min-w-6 rounded-md px-1"
      />
    </span>
  </figcaption>
</template>
