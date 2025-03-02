import { expect } from '@playwright/test'
import fs from 'fs'

import { comfyPageFixture as test } from './fixtures/ComfyPage'

test.describe('Templates', () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.setSetting('Comfy.UseNewMenu', 'Top')
    await comfyPage.setSetting('Comfy.Workflow.ShowMissingModelsWarning', false)
  })

  test('should have a JSON workflow file for each template', async ({
    comfyPage
  }) => {
    const templates = await comfyPage.templates.getAllTemplates()
    for (const template of templates) {
      const workflowPath = comfyPage.templates.getTemplatePath(
        `${template.name}.json`
      )
      expect(
        fs.existsSync(workflowPath),
        `Missing workflow: ${template.name}`
      ).toBe(true)
    }
  })

  test('should have all required thumbnail media for each template', async ({
    comfyPage
  }) => {
    const templates = await comfyPage.templates.getAllTemplates()
    for (const template of templates) {
      const { name, mediaSubtype, thumbnailVariant } = template
      const baseMedia = `${name}-1.${mediaSubtype}`
      const basePath = comfyPage.templates.getTemplatePath(baseMedia)

      // Check base thumbnail
      expect(
        fs.existsSync(basePath),
        `Missing base thumbnail: ${baseMedia}`
      ).toBe(true)

      // Check second thumbnail for variants that need it
      if (
        thumbnailVariant === 'compareSlider' ||
        thumbnailVariant === 'hoverDissolve'
      ) {
        const secondMedia = `${name}-2.${mediaSubtype}`
        const secondPath = comfyPage.templates.getTemplatePath(secondMedia)
        expect(
          fs.existsSync(secondPath),
          `Missing second thumbnail: ${secondMedia} required for ${thumbnailVariant}`
        ).toBe(true)
      }
    }
  })

  test('Can load template workflows', async ({ comfyPage }) => {
    // Clear the workflow
    await comfyPage.menu.workflowsTab.open()
    await comfyPage.menu.workflowsTab.newBlankWorkflowButton.click()
    await expect(async () => {
      expect(await comfyPage.getGraphNodesCount()).toBe(0)
    }).toPass({ timeout: 250 })

    // Load a template
    await comfyPage.menu.workflowsTab.browseGalleryButton.click()
    await expect(comfyPage.templates.content).toBeVisible()
    await comfyPage.templates.loadTemplate('default')
    await expect(comfyPage.templates.content).toBeHidden()

    // Ensure we now have some nodes
    await expect(async () => {
      expect(await comfyPage.getGraphNodesCount()).toBeGreaterThan(0)
    }).toPass({ timeout: 250 })
  })
})
