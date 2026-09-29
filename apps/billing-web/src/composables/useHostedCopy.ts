import { useI18n } from 'vue-i18n'

import type { BillingPlansData } from '@comfyorg/account-core/billing'

type CatalogPlan = Pick<BillingPlansData['plans'][number], 'tier' | 'duration'>

export interface HostedCopy {
  /**
   * Copy for a machine code the SDK or the contract produced. A code with no
   * key of its own falls back to the group's generic line, so nothing the
   * server chose reaches the screen as text.
   */
  readonly coded: (group: string, code: string | undefined) => string
  /** A catalog plan by its tier and duration, never by its slug. */
  readonly planName: (plan: CatalogPlan) => string
  readonly date: (isoDate: string) => string
  readonly money: (cents: bigint | number) => string
}

export function useHostedCopy(): HostedCopy {
  const { d, n, t, te } = useI18n()

  function coded(group: string, code: string | undefined): string {
    const key = `hosted.${group}.${code}`
    return code !== undefined && te(key) ? t(key) : t(`hosted.${group}.unknown`)
  }

  return {
    coded,
    planName: (plan) =>
      t('hosted.plan.name', {
        tier: coded('tier', plan.tier),
        duration: coded('duration', plan.duration)
      }),
    date: (isoDate) => d(new Date(isoDate), 'medium'),
    money: (cents) => n(Number(cents) / 100, 'currency')
  }
}
