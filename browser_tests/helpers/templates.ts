import { Locator, Page } from '@playwright/test'
import path from 'path'

import { CORE_TEMPLATES } from '../../src/constants/coreTemplates'
import { TemplateInfo } from '../../src/types/workflowTemplateTypes'

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

  getAllTemplates(): TemplateInfo[] {
    return CORE_TEMPLATES.flatMap((category) => category.templates)
  }

  getTemplatePath(filename: string): string {
    return path.join('public', 'templates', filename)
  }
}
