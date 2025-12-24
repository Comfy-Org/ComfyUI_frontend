export interface TemplateInfo {
  name: string
  /**
   * Optional title which is used as the fallback if the name is not in the locales dictionary.
   */
  title?: string
  tutorialUrl?: string
  mediaType: string
  mediaSubtype: string
  thumbnailVariant?: string
  description: string
  localizedTitle?: string
  localizedDescription?: string
  isEssential?: boolean
  sourceModule?: string
  tags?: string[]
  models?: string[]
  date?: string
  useCase?: string
  license?: string
  /**
   * Estimated VRAM requirement in bytes.
   */
  vram?: number
  size?: number
  /**
   * Whether this template uses open source models. When false, indicates partner/API node templates.
   */
  openSource?: boolean
  /**
   * Array of custom node package IDs required for this template (from Custom Node Registry).
   * Templates with this field will be hidden on local installations temporarily.
   */
  requiresCustomNodes?: string[]
  /**
   * Manual ranking boost/demotion for "Recommended" sort. Scale 1-10, default 5.
   * Higher values promote the template, lower values demote it.
   */
  searchRank?: number
  /**
   * Manage template's visibility across different distributions by specifying which distributions it should be included on.
   * If not specified, the template will be included on all distributions.
   */
  includeOnDistributions?: TemplateIncludeOnDistributionEnum[]
}

export enum TemplateIncludeOnDistributionEnum {
  Cloud = 'cloud',
  Local = 'local',
  Desktop = 'desktop',
  Mac = 'mac',
  Windows = 'windows'
}

export interface WorkflowTemplates {
  moduleName: string
  templates: TemplateInfo[]
  title: string
  localizedTitle?: string
  category?: string
  type?: string
  icon?: string
  isEssential?: boolean
}

export interface TemplateGroup {
  label: string
  icon?: string
  modules: WorkflowTemplates[]
}
