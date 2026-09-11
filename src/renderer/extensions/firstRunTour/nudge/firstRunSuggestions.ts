export type SuggestionId = 'animate' | 'upscale' | 'restyle'

export interface Suggestion {
  id: SuggestionId
  templateId: string
  titleKey: string
  detailKey: string
  icon: string
  /** A qualifier on the action itself, such as the upscale's multiplier. */
  badgeKey?: string
  /** Marks the action a paid plan is required to run, so the card says so. */
  paid?: boolean
}

export const SUGGESTIONS: Suggestion[] = [
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
