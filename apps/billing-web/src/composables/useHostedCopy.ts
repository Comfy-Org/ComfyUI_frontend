import { useI18n } from 'vue-i18n'

import type { BillingPlansData } from '@comfyorg/account-core/billing'

type CatalogPlan = Pick<BillingPlansData['plans'][number], 'tier' | 'duration'>

export interface HostedCopy {
  /**
   * Copy for a machine code the SDK or the contract produced. A code with no
   * key of its own falls back to the group's generic line.
   */
  readonly coded: (group: string, code: string | undefined) => string
  /** A catalog plan by its tier and duration, never by its slug. */
  readonly planName: (plan: CatalogPlan) => string
  /**
   * Copy for a failed billing call. A code that only names the HTTP status
   * shows the sentence the server wrote, as the app does; every other code
   * keeps billing-web's own copy.
   */
  readonly refusal: (failure: RefusedCall) => string
  readonly date: (isoDate: string) => string
  readonly money: (cents: bigint | number) => string
}

interface RefusedCall {
  readonly code: string
  readonly serverMessage?: string
}

const STATUS_ONLY_CODES: ReadonlySet<string> = new Set([
  'REQUEST_FAILED',
  'CONFLICT'
])

export function useHostedCopy(): HostedCopy {
  const { d, n, t, te } = useI18n()

  function coded(group: string, code: string | undefined): string {
    const key = `hosted.${group}.${code}`
    return code !== undefined && te(key) ? t(key) : t(`hosted.${group}.unknown`)
  }

  function refusal({ code, serverMessage }: RefusedCall): string {
    return STATUS_ONLY_CODES.has(code) && serverMessage
      ? serverMessage
      : coded('failure', code)
  }

  return {
    coded,
    planName: (plan) =>
      t('hosted.plan.name', {
        tier: coded('tier', plan.tier),
        duration: coded('duration', plan.duration)
      }),
    refusal,
    date: (isoDate) => d(new Date(isoDate), 'medium'),
    money: (cents) => n(Number(cents) / 100, 'currency')
  }
}
