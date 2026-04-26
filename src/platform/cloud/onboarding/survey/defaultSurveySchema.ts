import type { OnboardingSurvey } from '@/platform/remoteConfig/types'

export const defaultOnboardingSurvey: OnboardingSurvey = {
  version: 1,
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
        { value: 'new', label: 'Never used it' },
        { value: 'starting', label: 'Following tutorials' },
        { value: 'basics', label: 'Comfortable with basics' },
        { value: 'advanced', label: 'Build and edit workflows' },
        { value: 'expert', label: 'Expert — I help others' }
      ]
    },
    {
      id: 'role',
      type: 'single',
      labelKey: 'cloudSurvey_steps_role',
      required: true,
      randomize: true,
      showWhen: { field: 'usage', equals: ['work', 'education'] },
      options: [
        { value: 'creative_technologist', label: 'Creative Technologist' },
        { value: 'creative_director', label: 'Creative Director' },
        { value: 'ai_researcher', label: 'AI Researcher' },
        { value: 'concept_artist', label: 'Concept Artist / Illustrator' },
        { value: 'pipeline_td', label: 'Pipeline TD / Technical Artist' },
        { value: 'producer', label: 'Producer' },
        { value: 'engineer', label: 'Engineer' },
        { value: 'student', label: 'Student' },
        { value: 'leadership', label: 'Leadership' },
        { value: 'content_creator', label: 'Content Creator' },
        { value: 'educator', label: 'Educator' },
        { value: 'marketing', label: 'Marketing' },
        { value: 'other', label: 'Other' }
      ]
    },
    {
      id: 'teamSize',
      type: 'single',
      labelKey: 'cloudSurvey_steps_teamSize',
      required: true,
      showWhen: { field: 'usage', equals: 'work' },
      options: [
        { value: 'solo', label: 'Just me' },
        { value: 'small', label: '2–5' },
        { value: 'studio', label: '6–20' },
        { value: 'midsize', label: '21–100' },
        { value: 'enterprise', label: '100+' }
      ]
    },
    {
      id: 'industry',
      type: 'single',
      labelKey: 'cloudSurvey_steps_industry',
      required: true,
      randomize: true,
      allowOther: true,
      otherFieldId: 'industryOther',
      showWhen: { field: 'usage', equals: 'work' },
      options: [
        { value: 'film_tv', label: 'Film, TV & animation' },
        { value: 'vfx_post', label: 'VFX & post-production' },
        { value: 'advertising', label: 'Advertising & marketing' },
        { value: 'gaming', label: 'Gaming' },
        { value: 'fashion', label: 'Fashion' },
        {
          value: 'design',
          label: 'Design (product / graphic / architectural / industrial)'
        },
        { value: 'software', label: 'Software / AI / tech' },
        { value: 'other', label: 'Other' }
      ]
    },
    {
      id: 'making',
      type: 'multi',
      labelKey: 'cloudSurvey_steps_making',
      required: true,
      randomize: true,
      options: [
        { value: 'video', label: 'Video' },
        { value: 'images', label: 'Images' },
        { value: '3d', label: '3D assets' },
        { value: 'custom_nodes', label: 'Custom Nodes' },
        { value: 'audio', label: 'Audio / music' }
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
