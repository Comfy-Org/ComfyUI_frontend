import { expect } from '@playwright/test'
import type { Page, Route } from '@playwright/test'

import type {
  TemplateInfo,
  WorkflowTemplates
} from '@/platform/workflow/templates/types/template'
import { mockTemplateIndex } from '@e2e/fixtures/data/templateFixtures'
import { TestIds } from '@e2e/fixtures/selectors'

const ROUTE_PATTERN_WORKFLOW_TEMPLATES = /\/api\/workflow_templates(?:\?.*)?$/
const ROUTE_PATTERN_TEMPLATE_INDEX = /\/templates\/index\.json(?:\?.*)?$/
const ROUTE_PATTERN_TEMPLATE_THUMBNAILS = /\/templates\/.*\.webp(?:\?.*)?$/

interface TemplateConfig {
  readonly templates: readonly TemplateInfo[]
  readonly index: readonly WorkflowTemplates[] | null
}

function emptyConfig(): TemplateConfig {
  return { templates: [], index: null }
}

type TemplateOperator = (config: TemplateConfig) => TemplateConfig

function cloneTemplates(templates: readonly TemplateInfo[]): TemplateInfo[] {
  return templates.map((t) => structuredClone(t))
}

function cloneIndex(
  index: readonly WorkflowTemplates[] | null
): WorkflowTemplates[] | null {
  return index ? index.map((m) => structuredClone(m)) : null
}

function addTemplates(
  config: TemplateConfig,
  templates: TemplateInfo[]
): TemplateConfig {
  return { ...config, templates: [...config.templates, ...templates] }
}

export function withTemplates(templates: TemplateInfo[]): TemplateOperator {
  return (config) => addTemplates(config, templates)
}

export class TemplateHelper {
  private templates: TemplateInfo[]
  private index: WorkflowTemplates[] | null

  constructor(
    private readonly page: Page,
    config: TemplateConfig = emptyConfig()
  ) {
    this.templates = cloneTemplates(config.templates)
    this.index = cloneIndex(config.index)
  }

  configure(...operators: TemplateOperator[]): void {
    const config = operators.reduce<TemplateConfig>(
      (cfg, op) => op(cfg),
      emptyConfig()
    )
    this.templates = cloneTemplates(config.templates)
    this.index = cloneIndex(config.index)
  }

  async mock(): Promise<void> {
    await this.mockCustomTemplates()
    await this.mockIndex()
    await this.mockThumbnails()
  }

  async mockCustomTemplates(): Promise<void> {
    const customTemplatesHandler = async (route: Route) => {
      await route.fulfill({
        status: 200,
        body: '{}',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store'
        }
      })
    }

    await this.page.route(
      ROUTE_PATTERN_WORKFLOW_TEMPLATES,
      customTemplatesHandler
    )
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

    await this.page.route(ROUTE_PATTERN_TEMPLATE_INDEX, indexHandler)
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

    await this.page.route(ROUTE_PATTERN_TEMPLATE_THUMBNAILS, thumbnailHandler)
  }

  /** Serves `workflowPath` as the named template's graph. */
  async mockWorkflow(name: string, workflowPath: string): Promise<void> {
    await this.page.route(`**/templates/${name}.json`, (route) =>
      route.fulfill({
        status: 200,
        path: workflowPath,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store'
        }
      })
    )
  }

  /** Opens the template browser and loads the named template. */
  async load(name: string): Promise<void> {
    await this.page.evaluate(() => {
      window.app!.extensionManager.command.execute('Comfy.BrowseTemplates')
    })
    const card = this.page.getByTestId(TestIds.templates.workflowCard(name))
    await expect(card).toBeVisible()
    await card.click()
  }

  getTemplates(): TemplateInfo[] {
    return cloneTemplates(this.templates)
  }

  get templateCount(): number {
    return this.templates.length
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
