import { useTelemetry } from '@/platform/telemetry'
import type {
  FirstRunTourMetadata,
  OnboardingTourStage
} from '@/platform/telemetry/types'

/** Distinguishes this tour from the App Mode coachmarks on the shared events. */
const TOUR = 'firstRun'

export function trackFirstRunTour(
  stage: OnboardingTourStage,
  metadata: Omit<FirstRunTourMetadata, 'tour'> = {}
): void {
  const payload: FirstRunTourMetadata = { tour: TOUR, ...metadata }
  useTelemetry()?.trackOnboardingTour(stage, payload)
}
