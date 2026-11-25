import type {
  AutoTopUpCardCopy,
  AutoTopUpMemberBlockCopy
} from '@comfyorg/account-ui/billing'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const k = 'workspacePanel.billingTab.autoTopUp'

/** The Billing tab auto top-up card strings in the app locale. */
export function useAutoTopUpCardCopy() {
  const { t } = useI18n()
  return computed<AutoTopUpCardCopy>(() => ({
    title: t(`${k}.title`),
    unavailable: t(`${k}.unavailable`),
    tryAgain: t('workspacePanel.billingTab.tryAgain'),
    status: {
      failed: t(`${k}.status.failed`),
      turnedOff: t(`${k}.status.turnedOff`),
      off: t(`${k}.status.off`),
      on: t(`${k}.status.on`),
      onHold: t(`${k}.status.onHold`),
      limitReached: t(`${k}.status.limitReached`),
      maximumReached: t(`${k}.status.maximumReached`)
    },
    actions: {
      addPaymentMethod: t(`${k}.actions.addPaymentMethod`),
      manage: t(`${k}.actions.manage`),
      turnOn: t(`${k}.actions.turnOn`),
      updatePayment: t(`${k}.actions.updatePayment`)
    },
    failed: t(`${k}.failed`),
    turnedOff: t(`${k}.turnedOff`),
    off: t(`${k}.off`),
    noPaymentMethod: t(`${k}.noPaymentMethod`),
    noDefaultPaymentMethod: t(`${k}.noDefaultPaymentMethod`),
    onHold: t(`${k}.onHold`),
    rule: (target, threshold) => t(`${k}.rule`, { target, threshold }),
    limit: (spent, limit) => t(`${k}.limit`, { spent, limit }),
    limitTooltip: (date) => t(`${k}.limitTooltip`, { date }),
    limitTooltipNoDate: t(`${k}.limitTooltipNoDate`),
    paused: (date) => t(`${k}.paused`, { date }),
    pausedNoDate: t(`${k}.pausedNoDate`),
    pausedByRemainder: (date) => t(`${k}.pausedByRemainder`, { date }),
    pausedByRemainderNoDate: t(`${k}.pausedByRemainderNoDate`),
    maximumReached: (date) => t(`${k}.maximumReached`, { date }),
    maximumReachedNoDate: t(`${k}.maximumReachedNoDate`)
  }))
}

/** The Billing tab auto top-up member block strings in the app locale. */
export function useAutoTopUpMemberBlockCopy() {
  const { t } = useI18n()
  return computed<AutoTopUpMemberBlockCopy>(() => ({
    title: t(`${k}.title`),
    body: t(`${k}.member`),
    status: {
      failed: t(`${k}.status.failed`),
      turnedOff: t(`${k}.status.turnedOff`),
      off: t(`${k}.status.off`),
      on: t(`${k}.status.on`),
      onHold: t(`${k}.status.onHold`),
      limitReached: t(`${k}.status.limitReached`),
      maximumReached: t(`${k}.status.maximumReached`)
    },
    on: (target, threshold) => t(`${k}.memberStatus.on`, { target, threshold }),
    limitReached: (date) => t(`${k}.memberStatus.limitReached`, { date }),
    limitReachedNoDate: t(`${k}.memberStatus.limitReachedNoDate`),
    maximumReached: (date) => t(`${k}.memberStatus.maximumReached`, { date }),
    maximumReachedNoDate: t(`${k}.memberStatus.maximumReachedNoDate`),
    failed: t(`${k}.memberStatus.failed`),
    turnedOff: t(`${k}.memberStatus.turnedOff`),
    onHold: t(`${k}.memberStatus.onHold`)
  }))
}
