<script setup lang="ts">
import { computed } from 'vue'

import { useSignInHref } from '../../composables/useSignInHref'
import { leaveForSignIn } from '../../config/workshop-return'
import type { Locale } from '../../i18n/translations'
import type { HubKey } from '../../i18n/hub'
import { tHub } from '../../i18n/hub'
import type {
  FailureAction,
  RunWayOut,
  WorkflowFailure
} from '../../lib/hub/run-failure'
import { failureAction } from '../../lib/hub/run-failure'
import Button from '../ui/button/Button.vue'

// Why a run stopped, and the one thing worth pressing about it. Each refusal
// asks for something different, and some ask for nothing at all: pressing
// again would be refused the same way.
const {
  reason,
  message,
  jobId,
  memberWorkspace,
  locale = 'en'
} = defineProps<{
  reason: WorkflowFailure
  /** The page's own words, where it stopped the run before Cloud saw it. */
  message?: string
  /** A run that may still be out there, and is worth going back to. */
  jobId?: string
  /**
   * The workspace whose credits this run would spend, named only when the
   * reader is a member of it rather than its owner: buying is then somebody
   * else's to do, and naming it is what makes that visible.
   */
  memberWorkspace?: string
  locale?: Locale
}>()

defineEmits<{ press: [RunWayOut] }>()

// The four the model half words around a model rather than a workflow are
// said again in the Hub's own copy; the rest is the same sentence either way.
const saying: Record<WorkflowFailure, HubKey> = {
  validation: 'workshop.v2.run.rejected',
  upload: 'workshop.error.upload',
  network: 'workshop.error.network',
  client: 'workshop.error.client',
  concurrency: 'workshop.error.concurrency',
  rateLimit: 'workshop.error.rateLimit',
  policy: 'workshop.v2.run.blocked',
  noCredits: 'workshop.error.noCredits',
  unavailable: 'workshop.v2.run.unavailable',
  timeout: 'workshop.error.timeout',
  provider: 'workshop.v2.run.failed',
  signedOut: 'workshop.v2.run.expired'
}

const trouble = computed(() => {
  if (message) return message
  if (reason === 'noCredits' && memberWorkspace !== undefined)
    return tHub('workshop.error.memberNoCredits', locale).replace(
      '{workspace}',
      () => memberWorkspace
    )
  return tHub(saying[reason], locale)
})

// A run that may still be running outranks everything else on offer: a second
// one would be a second charge to find out what the first did.
const offer = computed<'resume' | FailureAction>(() =>
  jobId ? 'resume' : failureAction(reason, memberWorkspace !== undefined)
)

const signInHref = useSignInHref(locale)

const PRESSING: Record<RunWayOut, { key: HubKey; testid: string }> = {
  resume: { key: 'workshop.v2.run.resume', testid: 'workflow-run-resume' },
  credits: { key: 'nav.buyCredits', testid: 'workflow-run-credits' },
  personal: {
    key: 'workshop.run.switchPersonal',
    testid: 'workflow-run-personal'
  },
  retry: { key: 'workshop.error.retry', testid: 'workflow-run-retry' }
}

const pressable = (offer: 'resume' | FailureAction): offer is RunWayOut =>
  offer in PRESSING

const press = computed<
  { act: RunWayOut; key: HubKey; testid: string } | undefined
>(() => {
  const way = offer.value
  return pressable(way) ? { act: way, ...PRESSING[way] } : undefined
})
</script>

<template>
  <div
    class="flex flex-col items-start gap-3 rounded-xl border border-primary-comfy-red/40 p-4"
    data-testid="workflow-run-error"
    :data-reason="reason"
  >
    <p class="text-sm text-primary-comfy-red">{{ trouble }}</p>

    <Button
      v-if="offer === 'signIn'"
      as="a"
      variant="outline"
      size="sm"
      :href="signInHref"
      data-testid="workflow-run-signin-again"
      @click="leaveForSignIn($event, signInHref)"
    >
      {{ tHub('workshop.run.signIn', locale) }}
    </Button>

    <Button
      v-else-if="press"
      variant="outline"
      size="sm"
      :data-testid="press.testid"
      @click="$emit('press', press.act)"
    >
      {{ tHub(press.key, locale) }}
    </Button>
  </div>
</template>
