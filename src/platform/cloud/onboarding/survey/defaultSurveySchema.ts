import type { OnboardingSurvey } from '@/platform/remoteConfig/types'

export const defaultOnboardingSurvey: OnboardingSurvey = {
  version: 2,
  introKey: 'cloudOnboarding.survey.intro',
  fields: [
    {
      id: 'usage',
      type: 'single',
      labelKey: 'cloudSurvey_steps_usage',
      required: true,
      options: [
        { value: 'personal', label: 'Personal use' },
        { value: 'work', label: 'Work' },
        { value: 'education', label: 'Education (student or educator)' }
      ]
    },
    {
      id: 'familiarity',
      type: 'single',
      labelKey: 'cloudSurvey_steps_familiarity',
      required: true,
      options: [
        { value: 'new', label: 'New — never used it' },
        { value: 'starting', label: 'Beginner — following tutorials' },
        { value: 'basics', label: 'Intermediate — comfortable with basics' },
        { value: 'advanced', label: 'Advanced — build and edit workflows' },
        { value: 'expert', label: 'Expert — I help others' }
      ]
    },
    {
      id: 'intent',
      type: 'multi',
      labelKey: 'cloudSurvey_steps_intent',
      required: true,
      randomize: true,
      options: [
        { value: 'workflows', label: 'Custom workflows or pipelines' },
        { value: 'custom_nodes', label: 'Custom nodes' },
        { value: 'videos', label: 'Videos' },
        { value: 'images', label: 'Images' },
        { value: '3d_game', label: '3D assets / game assets' },
        { value: 'audio', label: 'Audio / music' },
        { value: 'apps', label: 'Simplified Apps from workflows' },
        { value: 'api', label: 'API endpoints to run workflows' },
        { value: 'not_sure', label: 'Not sure' }
      ]
    },
    {
      id: 'source',
      type: 'single',
      labelKey: 'cloudSurvey_steps_source',
      required: true,
      randomize: true,
      options: [
        { value: 'youtube', label: 'YouTube' },
        { value: 'reddit', label: 'Reddit' },
        { value: 'twitter', label: 'Twitter / X' },
        { value: 'instagram', label: 'Instagram' },
        { value: 'friend', label: 'Friend or colleague' },
        { value: 'search', label: 'Google / search' },
        { value: 'newsletter', label: 'Newsletter or blog' },
        { value: 'conference', label: 'Conference or event' },
        { value: 'discord', label: 'Discord / community' },
        { value: 'github', label: 'GitHub' },
        { value: 'other', label: 'Other' }
      ]
    }
  ]
}
