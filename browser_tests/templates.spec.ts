import { expect } from '@playwright/test'
import fs from 'fs'
import path from 'path'

import { CORE_TEMPLATES } from '../src/constants/coreTemplates'
import { comfyPageFixture as test } from './fixtures/ComfyPage'

test.describe('Templates', () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.setSetting('Comfy.UseNewMenu', 'Top')
    await comfyPage.setSetting('Comfy.Workflow.ShowMissingModelsWarning', false)
    await comfyPage.setSetting('Comfy.Workflow.ShowMissingNodesWarning', false)
  })

  const getTemplatePath = (filename: string) =>
    path.join('public', 'templates', filename)

  const getAllTemplates = () =>
    CORE_TEMPLATES.flatMap((category) => category.templates)

  test('Workflow files exist for all templates', async () => {
    for (const template of getAllTemplates()) {
      const { name } = template
      const workflowPath = getTemplatePath(`${name}.json`)
      expect(fs.existsSync(workflowPath), `Missing workflow: ${name}`).toBe(
        true
      )
    }
  })

  test('Template thumbnail media files exist for all templates', async () => {
    for (const template of getAllTemplates()) {
      const { name, mediaSubtype, thumbnailVariant } = template
      const baseMedia = `${name}-1.${mediaSubtype}`
      const basePath = getTemplatePath(baseMedia)

      // Check base thumbnail
      expect(
        fs.existsSync(basePath),
        `Missing base thumbnail: ${baseMedia}`
      ).toBe(true)

      // Check second thumbnail for thumbnail variants that use two images
      if (
        thumbnailVariant === 'compareSlider' ||
        thumbnailVariant === 'hoverDissolve'
      ) {
        const secondMedia = `${name}-2.${mediaSubtype}`
        const secondPath = getTemplatePath(secondMedia)
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
