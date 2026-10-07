import type {
  ReshootJob,
  ReshootQuote,
  ReshootTransport
} from '@/lib/workshop/cinematic-studio/reshoot-engine/transport'
import { ReshootError } from '@/lib/workshop/cinematic-studio/reshoot-engine/transport'

/**
 * A stand-in backend that lives in the page, for building the interface before
 * a deployment exists. No model runs: a "result" is the uploaded clip handed
 * back unchanged. `?sample=` picks which answer the app proxy would give.
 */
const SAMPLE_SCENARIOS = [
  'free',
  'paid',
  'exhausted',
  'no-credits',
  'unavailable',
  'fails'
] as const
type SampleScenario = (typeof SAMPLE_SCENARIOS)[number]

const ALLOWANCE = { runs: 5, period: 'P1D', period_seconds: 86_400 }
const PRICE = 60

const QUOTES: Readonly<Record<SampleScenario, ReshootQuote | undefined>> = {
  free: {
    free_runs_allowance: ALLOWANCE,
    free_runs_remaining: 3,
    resets_at: null,
    price_credits: PRICE,
    next_run: 'free'
  },
  fails: {
    free_runs_allowance: ALLOWANCE,
    free_runs_remaining: 3,
    resets_at: null,
    price_credits: PRICE,
    next_run: 'free'
  },
  paid: {
    free_runs_allowance: ALLOWANCE,
    free_runs_remaining: 0,
    resets_at: null,
    price_credits: PRICE,
    next_run: 'paid'
  },
  exhausted: {
    free_runs_allowance: ALLOWANCE,
    free_runs_remaining: 0,
    resets_at: new Date(Date.now() + 5 * 3_600_000).toISOString(),
    price_credits: 0,
    next_run: 'blocked',
    blocked_reason: 'free_runs_exhausted'
  },
  'no-credits': {
    free_runs_allowance: ALLOWANCE,
    free_runs_remaining: 0,
    resets_at: null,
    price_credits: PRICE,
    next_run: 'blocked',
    blocked_reason: 'insufficient_credits'
  },
  unavailable: undefined
}

/** Polls a job answers `queued`, then `running`, before it settles. */
const QUEUED_POLLS = 1
const RUNNING_POLLS = 2

export function sampleScenario(search: string): SampleScenario {
  const asked = new URLSearchParams(search).get('sample')
  return SAMPLE_SCENARIOS.find((scenario) => scenario === asked) ?? 'free'
}

/** `pick` is asked on each call: the page's address is only there in a browser. */
export function sampleTransport(pick: () => SampleScenario): ReshootTransport {
  const uploads = new Map<string, File>()
  const polls = new Map<string, number>()
  let lastVideo: File | undefined

  return {
    async quote() {
      const scenario = pick()
      if (scenario === 'unavailable') throw new ReshootError('app_unavailable')
      return QUOTES[scenario]
    },
    async upload(file) {
      const name = `sample-${uploads.size + 1}-${file.name}`
      uploads.set(name, file)
      if (file.type.startsWith('video/')) lastVideo = file
      return name
    },
    async submit(): Promise<ReshootJob> {
      const id = `sample-job-${polls.size + 1}`
      polls.set(id, 0)
      return { id, status: 'queued' }
    },
    async job(id): Promise<ReshootJob> {
      const seen = (polls.get(id) ?? 0) + 1
      polls.set(id, seen)
      if (seen <= QUEUED_POLLS) return { id, status: 'queued' }
      if (seen <= QUEUED_POLLS + RUNNING_POLLS) return { id, status: 'running' }
      if (pick() === 'fails') return { id, status: 'failed' }
      return {
        id,
        status: 'succeeded',
        outputs: [{ id: 'result', filename: 'openjutsu/result_00001_.mp4' }]
      }
    },
    async output() {
      if (!lastVideo) throw new ReshootError('missing_output')
      return lastVideo
    },
    async cancel() {
      // nothing is running anywhere, so there is nothing to stop
    }
  }
}
