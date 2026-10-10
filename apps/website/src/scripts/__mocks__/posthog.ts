import { vi } from 'vitest'
import { readonly, ref } from 'vue'

import type * as realPosthog from '@/scripts/posthog'

const workshopEnabled = readonly(ref(false))
const workshopEnabledSettled = readonly(ref(true))
const workshopAuthFlag = readonly(ref(true))
const workshopTurnstileMode = readonly(ref<'off'>('off'))

const posthog: typeof realPosthog = {
  useWorkshopEnabled: vi.fn(() => workshopEnabled),
  useWorkshopWorkflowsEnabled: vi.fn(() => workshopEnabled),
  useWorkshopAppsEnabled: vi.fn(() => workshopEnabled),
  useWorkshopFlag: vi.fn(() => workshopEnabled),
  readFlagVariant: vi.fn(() => undefined),
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
  captureAgentFaqExpanded: vi.fn(),
  captureAgentUsecaseVideoPlayed: vi.fn(),
  captureNavFeaturedCardViewed: vi.fn(),
  captureNavFeaturedCardClicked: vi.fn(),
  captureAuthRefreshSucceeded: vi.fn(),
  captureSignupRollbackFailure: vi.fn(),
  captureAuthRefreshFailed: vi.fn(),
  captureSignupOpened: vi.fn(),
  captureAuthCompleted: vi.fn(),
  captureAuthFailed: vi.fn(),
  captureWebSessionEvent: vi.fn()
}

const {
  useWorkshopEnabled,
  useWorkshopWorkflowsEnabled,
  useWorkshopAppsEnabled,
  useWorkshopFlag,
  readFlagVariant,
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
  captureAgentFaqExpanded,
  captureAgentUsecaseVideoPlayed,
  captureNavFeaturedCardViewed,
  captureNavFeaturedCardClicked,
  captureAuthRefreshSucceeded,
  captureSignupRollbackFailure,
  captureAuthRefreshFailed,
  captureSignupOpened,
  captureAuthCompleted,
  captureAuthFailed,
  captureWebSessionEvent
} = posthog

export {
  useWorkshopEnabled,
  useWorkshopWorkflowsEnabled,
  useWorkshopAppsEnabled,
  useWorkshopFlag,
  readFlagVariant,
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
  captureAgentFaqExpanded,
  captureAgentUsecaseVideoPlayed,
  captureNavFeaturedCardViewed,
  captureNavFeaturedCardClicked,
  captureAuthRefreshSucceeded,
  captureSignupRollbackFailure,
  captureAuthRefreshFailed,
  captureSignupOpened,
  captureAuthCompleted,
  captureAuthFailed,
  captureWebSessionEvent
}
