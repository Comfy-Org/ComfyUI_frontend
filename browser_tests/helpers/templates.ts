import { Locator, Page } from '@playwright/test'
import path from 'path'

import {
  TemplateInfo,
  WorkflowTemplates
} from '../../src/types/workflowTemplateTypes'

export class ComfyTemplates {
  readonly content: Locator

  constructor(readonly page: Page) {
    this.content = page.getByTestId('template-workflows-content')
  }

  async loadTemplate(id: string) {
    await this.content
      .getByTestId(`template-workflow-${id}`)
      .getByRole('img')
      .click()
  }

  async getAllTemplates(): Promise<TemplateInfo[]> {
    const templates: WorkflowTemplates[] = await this.page.evaluate(() =>
      window['app'].api.getCoreWorkflowTemplates()
    )
    return templates.flatMap((t) => t.templates)
  }

  getTemplatePath(filename: string): string {
    return path.join('public', 'templates', filename)
  }
}
