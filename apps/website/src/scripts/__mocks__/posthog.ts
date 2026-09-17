import { vi } from 'vitest'
import { readonly, ref } from 'vue'

import type * as real from '../posthog'

const workshopEnabled: ReturnType<typeof real.useWorkshopEnabled> = readonly(
  ref(false)
)
const workshopEnabledSettled: ReturnType<
  typeof real.useWorkshopEnabledSettled
> = readonly(ref(true))
const workshopAuthFlag: ReturnType<typeof real.useWorkshopAuthFlag> = readonly(
  ref(true)
)
const workshopTurnstileMode: ReturnType<typeof real.useWorkshopTurnstileMode> =
  readonly(ref('off'))

export const useWorkshopEnabled = vi.fn(() => workshopEnabled)
export const useWorkshopEnabledSettled = vi.fn(() => workshopEnabledSettled)
export const useWorkshopAuthFlag = vi.fn(() => workshopAuthFlag)
export const useWorkshopTurnstileMode = vi.fn(() => workshopTurnstileMode)

export const initPostHog = vi.fn<typeof real.initPostHog>()
export const identifyWorkshopUser = vi.fn<typeof real.identifyWorkshopUser>()
export const capturePageview = vi.fn<typeof real.capturePageview>()
export const captureWorkshopEvent = vi.fn<typeof real.captureWorkshopEvent>()
export const captureDownloadClick = vi.fn<typeof real.captureDownloadClick>()
export const captureCliConnectionTabClick =
  vi.fn<typeof real.captureCliConnectionTabClick>()
export const captureCliClientTabClick =
  vi.fn<typeof real.captureCliClientTabClick>()
export const captureMcpConnectionTabClick =
  vi.fn<typeof real.captureMcpConnectionTabClick>()
export const captureMcpClientTabClick =
  vi.fn<typeof real.captureMcpClientTabClick>()
export const captureAuthRefreshSucceeded =
  vi.fn<typeof real.captureAuthRefreshSucceeded>()
export const captureSignupRollbackFailure =
  vi.fn<typeof real.captureSignupRollbackFailure>()
export const captureAuthRefreshFailed =
  vi.fn<typeof real.captureAuthRefreshFailed>()
export const captureSignupOpened = vi.fn<typeof real.captureSignupOpened>()
export const captureAuthCompleted = vi.fn<typeof real.captureAuthCompleted>()
export const captureAuthFailed = vi.fn<typeof real.captureAuthFailed>()
