export type FirstRunSuggestionId = 'animate' | 'upscale' | 'restyle'

export interface FirstRunSuggestion {
  id: FirstRunSuggestionId
  templateId: string
  titleKey: string
  detailKey: string
  icon: string
  /** A qualifier on the action itself, such as the upscale's multiplier. */
  badgeKey?: string
  /** Marks the action a paid plan is required to run, so the card says so. */
  paid?: boolean
}

/**
 * The continuations the discovery card offers, in the order it lists them.
 * Kept beside the card rather than inside it so the suites covering the card
 * read the ids it actually renders instead of retyping them.
 */
export const FIRST_RUN_SUGGESTIONS: readonly FirstRunSuggestion[] = [
  {
    id: 'animate',
    templateId: 'video_minimax_h3_i2v_continuation',
    titleKey: 'onboardingCoachmarks.firstRun.nudge.animate.title',
    detailKey: 'onboardingCoachmarks.firstRun.nudge.animate.detail',
    icon: 'icon-[lucide--film]'
  },
  {
    id: 'upscale',
    templateId: 'utility_seedvr2_7b_int8_upscale_image',
    titleKey: 'onboardingCoachmarks.firstRun.nudge.upscale.title',
    detailKey: 'onboardingCoachmarks.firstRun.nudge.upscale.detail',
    icon: 'icon-[lucide--maximize-2]',
    badgeKey: 'onboardingCoachmarks.firstRun.nudge.upscale.badge'
  },
  {
    id: 'restyle',
    templateId: 'api_google_nano_banana2_image_edit_continuation',
    titleKey: 'onboardingCoachmarks.firstRun.nudge.restyle.title',
    detailKey: 'onboardingCoachmarks.firstRun.nudge.restyle.detail',
    icon: 'icon-[ph--swatches]',
    paid: true
  }
]
