import { vi } from 'vitest'
import { readonly, ref } from 'vue'

import type * as realPosthog from '../posthog'

const workshopEnabled = readonly(ref(false))
const workshopEnabledSettled = readonly(ref(true))
const workshopAuthFlag = readonly(ref(true))
const workshopTurnstileMode = readonly(ref<'off'>('off'))

const posthog: typeof realPosthog = {
  useWorkshopEnabled: vi.fn(() => workshopEnabled),
  useWorkshopWorkflowsEnabled: vi.fn(() => workshopEnabled),
  useWorkshopAppsEnabled: vi.fn(() => workshopEnabled),
  useWorkshopEnabledSettled: vi.fn(() => workshopEnabledSettled),
  useWorkshopAuthFlag: vi.fn(() => workshopAuthFlag),
  useWorkshopTurnstileMode: vi.fn(() => workshopTurnstileMode),
  initPostHog: vi.fn(),
  identifyWorkshopUser: vi.fn(),
  capturePageview: vi.fn(),
  captureWorkshopEvent: vi.fn(),
  captureDownloadClick: vi.fn(),
  captureCliConnectionTabClick: vi.fn(),
  captureCliClientTabClick: vi.fn(),
  captureMcpConnectionTabClick: vi.fn(),
  captureMcpClientTabClick: vi.fn(),
  captureRouterRoadmapCardExpanded: vi.fn(),
  captureAuthRefreshSucceeded: vi.fn(),
  captureSignupRollbackFailure: vi.fn(),
  captureAuthRefreshFailed: vi.fn(),
  captureSignupOpened: vi.fn(),
  captureAuthCompleted: vi.fn(),
  captureAuthFailed: vi.fn()
}

const {
  useWorkshopEnabled,
  useWorkshopWorkflowsEnabled,
  useWorkshopAppsEnabled,
  useWorkshopEnabledSettled,
  useWorkshopAuthFlag,
  useWorkshopTurnstileMode,
  initPostHog,
  identifyWorkshopUser,
  capturePageview,
  captureWorkshopEvent,
  captureDownloadClick,
  captureCliConnectionTabClick,
  captureCliClientTabClick,
  captureMcpConnectionTabClick,
  captureMcpClientTabClick,
  captureRouterRoadmapCardExpanded,
  captureAuthRefreshSucceeded,
  captureSignupRollbackFailure,
  captureAuthRefreshFailed,
  captureSignupOpened,
  captureAuthCompleted,
  captureAuthFailed
} = posthog

export {
  useWorkshopEnabled,
  useWorkshopWorkflowsEnabled,
  useWorkshopAppsEnabled,
  useWorkshopEnabledSettled,
  useWorkshopAuthFlag,
  useWorkshopTurnstileMode,
  initPostHog,
  identifyWorkshopUser,
  capturePageview,
  captureWorkshopEvent,
  captureDownloadClick,
  captureCliConnectionTabClick,
  captureCliClientTabClick,
  captureMcpConnectionTabClick,
  captureMcpClientTabClick,
  captureRouterRoadmapCardExpanded,
  captureAuthRefreshSucceeded,
  captureSignupRollbackFailure,
  captureAuthRefreshFailed,
  captureSignupOpened,
  captureAuthCompleted,
  captureAuthFailed
}
