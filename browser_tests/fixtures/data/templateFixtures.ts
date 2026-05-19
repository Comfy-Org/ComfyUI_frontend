import type {
  TemplateInfo,
  WorkflowTemplates
} from '@/platform/workflow/templates/types/template'
import { TemplateIncludeOnDistributionEnum } from '@/platform/workflow/templates/types/template'

const Cloud = TemplateIncludeOnDistributionEnum.Cloud
const Desktop = TemplateIncludeOnDistributionEnum.Desktop
const Local = TemplateIncludeOnDistributionEnum.Local

export function makeTemplate(
  overrides: Partial<TemplateInfo> & Pick<TemplateInfo, 'name'>
): TemplateInfo {
  return {
    description: overrides.name,
    mediaType: 'image',
    mediaSubtype: 'webp',
    ...overrides
  }
}

export function mockTemplateIndex(
  templates: TemplateInfo[]
): WorkflowTemplates[] {
  return [
    {
      moduleName: 'default',
      title: 'Test Templates',
      type: 'image',
      templates
    }
  ]
}

export const STABLE_CLOUD_TEMPLATE: TemplateInfo = makeTemplate({
  name: 'cloud-stable',
  title: 'Cloud Stable',
  includeOnDistributions: [Cloud]
})

export const STABLE_DESKTOP_TEMPLATE: TemplateInfo = makeTemplate({
  name: 'desktop-stable',
  title: 'Desktop Stable',
  includeOnDistributions: [Desktop]
})

export const STABLE_LOCAL_TEMPLATE: TemplateInfo = makeTemplate({
  name: 'local-stable',
  title: 'Local Stable',
  includeOnDistributions: [Local]
})

export const STABLE_UNRESTRICTED_TEMPLATE: TemplateInfo = makeTemplate({
  name: 'unrestricted-stable',
  title: 'Unrestricted Stable'
})

export const ALL_DISTRIBUTION_TEMPLATES: TemplateInfo[] = [
  STABLE_CLOUD_TEMPLATE,
  STABLE_DESKTOP_TEMPLATE,
  STABLE_LOCAL_TEMPLATE,
  STABLE_UNRESTRICTED_TEMPLATE
]
