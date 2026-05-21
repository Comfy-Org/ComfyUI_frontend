import type { OnboardingSurvey } from '@/platform/remoteConfig/types'

const optionsFor = (
  fieldId: string,
  values: string[]
): { value: string; labelKey: string }[] =>
  values.map((value) => ({
    value,
    labelKey: `cloudOnboarding.survey.options.${fieldId}.${value}`
  }))

export const defaultOnboardingSurvey: OnboardingSurvey = {
  version: 2,
  introKey: 'cloudOnboarding.survey.intro',
  fields: [
    {
      id: 'usage',
      type: 'single',
      labelKey: 'cloudSurvey_steps_usage',
      required: true,
      options: optionsFor('usage', ['personal', 'work', 'education'])
    },
    {
      id: 'familiarity',
      type: 'single',
      labelKey: 'cloudSurvey_steps_familiarity',
      required: true,
      options: optionsFor('familiarity', [
        'new',
        'starting',
        'basics',
        'advanced',
        'expert'
      ])
    },
    {
      id: 'intent',
      type: 'multi',
      labelKey: 'cloudSurvey_steps_intent',
      required: true,
      randomize: true,
      options: optionsFor('intent', [
        'workflows',
        'custom_nodes',
        'videos',
        'images',
        '3d_game',
        'audio',
        'apps',
        'api',
        'not_sure'
      ])
    },
    {
      id: 'source',
      type: 'single',
      labelKey: 'cloudSurvey_steps_source',
      required: true,
      randomize: true,
      options: optionsFor('source', [
        'youtube',
        'reddit',
        'twitter',
        'instagram',
        'linkedin',
        'friend',
        'search',
        'newsletter',
        'conference',
        'discord',
        'github',
        'other'
      ])
    }
  ]
}
