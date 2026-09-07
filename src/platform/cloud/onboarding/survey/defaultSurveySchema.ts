import type {
  OnboardingSurvey,
  OnboardingSurveyOption
} from '@/platform/remoteConfig/types'

const optionsFor = (
  fieldId: string,
  values: string[],
  icons: Record<string, string> = {}
): OnboardingSurveyOption[] =>
  values.map((value) => ({
    value,
    labelKey: `cloudOnboarding.survey.options.${fieldId}.${value}`,
    ...(icons[value] ? { icon: icons[value] } : {})
  }))

export const defaultOnboardingSurvey: OnboardingSurvey = {
  version: 3,
  introKey: 'cloudOnboarding.survey.intro',
  fields: [
    {
      id: 'intent',
      type: 'single',
      labelKey: 'cloudSurvey_steps_intent',
      required: true,
      allowOther: true,
      otherFieldId: 'intentOther',
      options: optionsFor(
        'intent',
        ['images', 'video', 'workflows', 'apps_api', 'exploring', 'other'],
        {
          images: 'icon-[lucide--image]',
          video: 'icon-[lucide--video]',
          workflows: 'icon-[lucide--workflow]',
          apps_api: 'icon-[lucide--blocks]',
          exploring: 'icon-[lucide--compass]',
          other: 'icon-[lucide--pencil]'
        }
      )
    },
    {
      id: 'experience',
      type: 'single',
      labelKey: 'cloudSurvey_steps_experience',
      required: true,
      options: optionsFor('experience', ['new', 'some', 'pro'], {
        new: 'icon-[lucide--sprout]',
        some: 'icon-[lucide--map]',
        pro: 'icon-[lucide--rocket]'
      })
    },
    {
      id: 'focus',
      type: 'single',
      labelKey: 'cloudSurvey_steps_focus',
      required: true,
      showWhen: { field: 'intent', equals: ['workflows', 'apps_api'] },
      options: optionsFor('focus', ['custom_nodes', 'pipelines', 'products'])
    },
    {
      id: 'source',
      type: 'single',
      labelKey: 'cloudSurvey_steps_source',
      required: true,
      randomize: true,
      allowOther: true,
      otherFieldId: 'sourceOther',
      options: optionsFor('source', [
        'social',
        'friend',
        'search',
        'community',
        'other'
      ])
    },
    {
      id: 'source_social',
      type: 'single',
      labelKey: 'cloudSurvey_steps_source_social',
      required: true,
      randomize: true,
      showWhen: { field: 'source', equals: 'social' },
      options: optionsFor('source_social', [
        'youtube',
        'reddit',
        'twitter',
        'instagram',
        'tiktok',
        'linkedin',
        'discord'
      ])
    }
  ]
}
