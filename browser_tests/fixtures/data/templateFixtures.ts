import type {
  TemplateInfo,
  WorkflowTemplates
} from '@/platform/workflow/templates/types/template'

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
