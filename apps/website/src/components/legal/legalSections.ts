import type { SectionConfig } from './types'

const p = { type: 'paragraph' as const }
const l = { type: 'list' as const }

export const privacyPolicySections: SectionConfig[] = [
  { id: 'intro', blocks: [p, p, p, p] },
  { id: 'information-we-collect', hasTitle: true, blocks: [p, p, p] },
  { id: 'personal-information', hasTitle: true, blocks: [p, l] },
  { id: 'legitimate-reasons', hasTitle: true, blocks: [p] },
  { id: 'collection-and-use', hasTitle: true, blocks: [p, l, p, l, p] },
  { id: 'security', hasTitle: true, blocks: [p, p, p] },
  { id: 'retention', hasTitle: true, blocks: [p, p] },
  { id: 'children', hasTitle: true, blocks: [p] },
  { id: 'third-parties', hasTitle: true, blocks: [p] },
  { id: 'your-rights', hasTitle: true, blocks: [p, l, p] },
  { id: 'limits', hasTitle: true, blocks: [p] },
  { id: 'changes', hasTitle: true, blocks: [p] },
  { id: 'us-state-privacy', hasTitle: true, blocks: [p, l, p] },
  { id: 'do-not-track', hasTitle: true, blocks: [p] },
  { id: 'ccpa', hasTitle: true, blocks: [p] },
  { id: 'gdpr', hasTitle: true, blocks: [p] },
  { id: 'uk-gdpr', hasTitle: true, blocks: [p] },
  { id: 'australian-privacy', hasTitle: true, blocks: [p] },
  { id: 'contact', hasTitle: true, blocks: [p, p] }
]

export const termsOfServiceSections: SectionConfig[] = [
  { id: 'intro', blocks: [p, p, p, p, p, p, p] },
  {
    id: 'definitions',
    hasTitle: true,
    blocks: [p, p, p, p, p, p, p, p, p, p, l, p, l]
  },
  { id: 'license', hasTitle: true, blocks: [p, p, p] },
  { id: 'using-services', hasTitle: true, blocks: [p, p, p] },
  { id: 'responsibilities', hasTitle: true, blocks: [p] },
  { id: 'restrictions', hasTitle: true, blocks: [p, l] },
  { id: 'accounts', hasTitle: true, blocks: [p] },
  { id: 'ip', hasTitle: true, blocks: [p] },
  { id: 'distribution', hasTitle: true, blocks: [p] },
  { id: 'fees', hasTitle: true, blocks: [p] },
  { id: 'termination', hasTitle: true, blocks: [p] },
  { id: 'warranties', hasTitle: true, blocks: [p] },
  { id: 'liability', hasTitle: true, blocks: [p] },
  { id: 'indemnification', hasTitle: true, blocks: [p] },
  { id: 'governing-law', hasTitle: true, blocks: [p] },
  { id: 'miscellaneous', hasTitle: true, blocks: [p] },
  { id: 'contact', hasTitle: true, blocks: [p] }
]
