import type { Page, Route } from '@playwright/test'

import type {
  TemplateInfo,
  WorkflowTemplates
} from '@/platform/workflow/templates/types/template'
import { TemplateIncludeOnDistributionEnum } from '@/platform/workflow/templates/types/template'
import {
  makeTemplate,
  mockTemplateIndex
} from '@e2e/fixtures/data/templateFixtures'

/**
 * Generate N deterministic templates, optionally restricted to a distribution.
 *
 * Lives here (not in `fixtures/data/`) because `fixtures/data/` is reserved
 * for static test data with no executable fixture logic.
 */
function generateTemplates(
  count: number,
  distribution?: TemplateIncludeOnDistributionEnum
): TemplateInfo[] {
  const slug = distribution ?? 'unrestricted'
  return Array.from({ length: count }, (_, i) =>
    makeTemplate({
      name: `gen-${slug}-${String(i + 1).padStart(3, '0')}`,
      title: `Generated ${slug} ${i + 1}`,
      ...(distribution ? { includeOnDistributions: [distribution] } : {})
    })
  )
}

export interface TemplateConfig {
  readonly templates: readonly TemplateInfo[]
  readonly index: readonly WorkflowTemplates[] | null
}

function emptyConfig(): TemplateConfig {
  return { templates: [], index: null }
}

export type TemplateOperator = (config: TemplateConfig) => TemplateConfig

function addTemplates(
  config: TemplateConfig,
  templates: TemplateInfo[]
): TemplateConfig {
  return { ...config, templates: [...config.templates, ...templates] }
}

export function withTemplates(templates: TemplateInfo[]): TemplateOperator {
  return (config) => addTemplates(config, templates)
}

export function withTemplate(template: TemplateInfo): TemplateOperator {
  return (config) => addTemplates(config, [template])
}

export function withCloudTemplates(count: number): TemplateOperator {
  return (config) =>
    addTemplates(
      config,
      generateTemplates(count, TemplateIncludeOnDistributionEnum.Cloud)
    )
}

export function withDesktopTemplates(count: number): TemplateOperator {
  return (config) =>
    addTemplates(
      config,
      generateTemplates(count, TemplateIncludeOnDistributionEnum.Desktop)
    )
}

export function withLocalTemplates(count: number): TemplateOperator {
  return (config) =>
    addTemplates(
      config,
      generateTemplates(count, TemplateIncludeOnDistributionEnum.Local)
    )
}

export function withUnrestrictedTemplates(count: number): TemplateOperator {
  return (config) => addTemplates(config, generateTemplates(count))
}

/**
 * Override the index payload entirely. Useful when a test needs a custom
 * `WorkflowTemplates[]` shape (e.g. multiple modules).
 */
export function withRawIndex(index: WorkflowTemplates[]): TemplateOperator {
  return (config) => ({ ...config, index })
}

export class TemplateHelper {
  private templates: TemplateInfo[]
  private index: WorkflowTemplates[] | null
  private routeHandlers: Array<{
    pattern: string
    handler: (route: Route) => Promise<void>
  }> = []

  constructor(
    private readonly page: Page,
    config: TemplateConfig = emptyConfig()
  ) {
    this.templates = [...config.templates]
    this.index = config.index ? [...config.index] : null
  }

  configure(...operators: TemplateOperator[]): void {
    const config = operators.reduce<TemplateConfig>(
      (cfg, op) => op(cfg),
      emptyConfig()
    )
    this.templates = [...config.templates]
    this.index = config.index ? [...config.index] : null
  }

  async mock(): Promise<void> {
    await this.mockIndex()
    await this.mockThumbnails()
  }

  async mockIndex(): Promise<void> {
    const indexHandler = async (route: Route) => {
      const payload = this.index ?? mockTemplateIndex(this.templates)
      await route.fulfill({
        status: 200,
        body: JSON.stringify(payload),
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store'
        }
      })
    }
    const indexPattern = '**/templates/index.json'
    this.routeHandlers.push({ pattern: indexPattern, handler: indexHandler })
    await this.page.route(indexPattern, indexHandler)
  }

  async mockThumbnails(): Promise<void> {
    const thumbnailHandler = async (route: Route) => {
      await route.fulfill({
        status: 200,
        path: 'browser_tests/assets/example.webp',
        headers: {
          'Content-Type': 'image/webp',
          'Cache-Control': 'no-store'
        }
      })
    }
    const thumbnailPattern = '**/templates/**.webp'
    this.routeHandlers.push({
      pattern: thumbnailPattern,
      handler: thumbnailHandler
    })
    await this.page.route(thumbnailPattern, thumbnailHandler)
  }

  getTemplates(): TemplateInfo[] {
    return [...this.templates]
  }

  get templateCount(): number {
    return this.templates.length
  }

  async clearMocks(): Promise<void> {
    for (const { pattern, handler } of this.routeHandlers) {
      await this.page.unroute(pattern, handler)
    }
    this.routeHandlers = []
    this.templates = []
    this.index = null
  }
}

export function createTemplateHelper(
  page: Page,
  ...operators: TemplateOperator[]
): TemplateHelper {
  const config = operators.reduce<TemplateConfig>(
    (cfg, op) => op(cfg),
    emptyConfig()
  )
  return new TemplateHelper(page, config)
}
