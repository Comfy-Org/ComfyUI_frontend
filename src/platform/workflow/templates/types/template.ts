export interface LogoInfo {
  /** Provider name(s) matching index_logo.json. String for single, array for stacked logos. */
  provider: string | string[]
  /** Tailwind positioning classes */
  position?: string
}

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
  /**
   * Whether App Mode is this template's default view, from the workflow's own
   * `extra.linearMode`. Supplied by `templates/index.json`; absent means a node
   * graph. Do not fall back to the `.app` filename suffix, which is wrong in
   * both directions (see the App badge in WorkflowTemplateSelectorDialog).
   */
  isApp?: boolean
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
   * Curator override applied to search relevance and the "Recommended" sort.
   * Anything from -5 to 5, and an absent value, is neutral; promotion starts at
   * 6 and demotion at -6, both saturating at a magnitude of 1000.
   * See docs/TEMPLATE_RANKING.md.
   */
  searchRank?: number
  /**
   * Usage score based on real world usage statistics.
   * Used for popular templates sort and for "Recommended" sort boost.
   */
  usage?: number
  /**
   * Manage template's visibility across different distributions by specifying which distributions it should be included on.
   * If not specified, the template will be included on all distributions.
   */
  includeOnDistributions?: TemplateIncludeOnDistributionEnum[]
  /**
   * Logo overlays to display on the template thumbnail.
   */
  logos?: LogoInfo[]
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

export type TemplateTypeFilter = 'all' | 'nodeGraph' | 'apps'
