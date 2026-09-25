import { expect } from '@playwright/test'

import { test } from './fixtures/modelsAccount'

for (const layout of ['e', 'd']) {
  test(`keeps palette and lighting presets independent in layout ${layout}`, async ({
    page
  }) => {
    await page.addInitScript(() => {
      localStorage.setItem(
        'cinematic-creative-presets-v1:demo',
        JSON.stringify([
          {
            name: 'Legacy combined',
            settings: {
              genre: 'horror',
              era: '1980s',
              tempo: 'auto',
              movements: [],
              palette: ['#112233'],
              paletteMain: 0,
              lights: [
                {
                  position: 'back',
                  color: '#abcdef',
                  brightness: 25,
                  diffusion: 35
                }
              ]
            }
          }
        ])
      )
    })
    await page.goto(`/cinematic-studio?demo=success&ux=${layout}`)
    const open = page.getByRole('button', {
      name: 'Creative controls',
      exact: true
    })
    await open.click()
    const editor = page.getByRole('dialog', { name: 'Creative direction' })
    const palette = editor.getByRole('region', {
      name: 'Custom palette',
      exact: true
    })
    const lighting = editor.getByRole('region', {
      name: 'Custom lighting',
      exact: true
    })
    const color = palette.getByRole('textbox', {
      name: 'Color 1 HEX',
      exact: true
    })
    const main = palette.getByRole('combobox', {
      name: 'Main color',
      exact: true
    })
    const position = lighting.getByRole('combobox', {
      name: 'Position 1',
      exact: true
    })
    const genre = editor.getByRole('combobox', { name: 'Genre', exact: true })
    const palettePresets = palette.getByRole('region', {
      name: 'Saved palettes',
      exact: true
    })
    const lightingPresets = lighting.getByRole('region', {
      name: 'Saved lighting setups',
      exact: true
    })
    const loadPalette = palettePresets.getByRole('button', {
      name: 'Load palette: Shared name',
      exact: true
    })
    const loadLighting = lightingPresets.getByRole('button', {
      name: 'Load lighting: Shared name',
      exact: true
    })
    await genre.selectOption('noir')
    await palette
      .getByRole('button', { name: 'Add color', exact: true })
      .click()
    await color.fill('#ff8800')
    await main.selectOption('0')
    await lighting
      .getByRole('button', { name: 'Add light', exact: true })
      .click()
    await position.selectOption('left')
    const lightColor = lighting.getByLabel('Color 1', { exact: true })
    const brightness = lighting.getByRole('slider', { name: /^Brightness/ })
    const diffusion = lighting.getByRole('slider', { name: /^Diffusion/ })
    await lightColor.fill('#aabbcc')
    await brightness.press('Home')
    await diffusion.press('End')
    await palettePresets
      .getByRole('textbox', { name: 'Palette preset name', exact: true })
      .fill('Shared name')
    await palettePresets
      .getByRole('button', { name: 'Save palette', exact: true })
      .click()
    await lightingPresets
      .getByRole('textbox', { name: 'Lighting preset name', exact: true })
      .fill('Shared name')
    await lightingPresets
      .getByRole('button', { name: 'Save lighting', exact: true })
      .click()
    await expect(loadPalette).toBeVisible()
    await expect(loadLighting).toBeVisible()

    await color.fill('#00aa55')
    await main.selectOption({ label: 'No main color' })
    await position.selectOption('right')
    await lightColor.fill('#ffffff')
    await brightness.press('End')
    await diffusion.press('Home')
    await genre.selectOption('drama')
    await loadPalette.click()
    await expect(color).toHaveValue('#ff8800')
    await expect(main).toHaveValue('0')
    await expect(position).toHaveValue('right')
    await expect(lightColor).toHaveValue('#ffffff')
    await expect(brightness).toHaveValue('100')
    await expect(diffusion).toHaveValue('0')
    await expect(genre).toHaveValue('drama')
    await color.fill('#00aa55')
    await loadLighting.click()
    await expect(position).toHaveValue('left')
    await expect(lightColor).toHaveValue('#aabbcc')
    await expect(brightness).toHaveValue('0')
    await expect(diffusion).toHaveValue('100')
    await expect(color).toHaveValue('#00aa55')
    await expect(genre).toHaveValue('drama')
    await editor.getByRole('button', { name: 'Apply', exact: true }).click()

    await open.click()
    await loadPalette.click()
    await position.selectOption('top')
    await editor
      .getByRole('button', { name: 'Cancel', exact: true })
      .last()
      .click()
    await open.click()
    await expect(color).toHaveValue('#00aa55')
    await expect(position).toHaveValue('left')
    await expect(genre).toHaveValue('drama')
    await editor
      .getByRole('button', { name: 'Cancel', exact: true })
      .last()
      .click()

    await page.reload()
    await open.click()
    await expect(loadPalette).toBeVisible()
    await expect(loadLighting).toBeVisible()
    await expect(color).toHaveValue('#00aa55')
    await position.selectOption('top')
    await loadPalette.click()
    await expect(color).toHaveValue('#ff8800')
    await expect(main).toHaveValue('0')
    await expect(position).toHaveValue('top')
    await loadLighting.click()
    await expect(position).toHaveValue('left')
    await expect(color).toHaveValue('#ff8800')
    await expect(genre).toHaveValue('drama')

    await editor.getByText('Combined creative presets', { exact: true }).click()
    await expect(
      editor.getByText('Legacy combined', { exact: true })
    ).toBeVisible()
    await editor
      .getByRole('button', { name: 'Load into draft', exact: true })
      .click()
    await expect(color).toHaveValue('#112233')
    await expect(main).toHaveValue('0')
    await expect(position).toHaveValue('back')
    await expect(genre).toHaveValue('horror')
    await expect(
      editor.getByRole('combobox', { name: 'Era', exact: true })
    ).toHaveValue('1980s')
    await expect(lighting.getByLabel('Color 1', { exact: true })).toHaveValue(
      '#abcdef'
    )
    await expect(
      lighting.getByRole('slider', { name: /^Brightness/ })
    ).toHaveValue('25')
    await expect(
      lighting.getByRole('slider', { name: /^Diffusion/ })
    ).toHaveValue('35')
  })
}

test('separates authored clip capabilities from unmeasured generation time', async ({
  page
}) => {
  await page.goto('/cinematic-studio?demo=success')
  await page.getByRole('button', { name: /Model · via Comfy Router:/ }).click()
  await page.getByRole('menuitem', { name: /^All models \(/ }).click()
  const catalog = page.getByRole('dialog', { name: 'All models', exact: true })
  await catalog
    .getByRole('searchbox', { name: 'Search models or providers' })
    .fill('Kling 3.0 Text-to-Video')
  await catalog
    .getByText('Capabilities & generation time', { exact: true })
    .click()
  await expect(catalog).toContainText('Clip length (seconds)')
  await expect(catalog).toContainText('Standard / Professional')
  await expect(catalog).toContainText('Generation time')
  await expect(catalog).toContainText('Not measured yet')
  await expect(catalog).toContainText('including uploads and queue time')
  await expect(catalog).not.toContainText('Typical observed time (median)')
})

test('browses the full model catalog without losing the Studio draft', async ({
  page
}) => {
  await page.goto('/cinematic-studio?demo=success')
  const scene = page.getByRole('textbox', { name: 'Scene', exact: true })
  await scene.fill('Keep this scene while browsing models.')
  await page.getByRole('button', { name: /Model · via Comfy Router:/ }).click()
  await page.getByRole('menuitem', { name: /^All models \(/ }).click()
  const catalog = page.getByRole('dialog', { name: 'All models', exact: true })
  const search = catalog.getByRole('searchbox', {
    name: 'Search models or providers'
  })
  await search.fill('Kling')
  const links = catalog.getByRole('link', { name: 'Open model page (new tab)' })
  await expect(links.first()).toHaveAttribute('href', /^\/models\//)
  await expect(links.first()).toHaveAttribute('target', '_blank')
  await expect(catalog).toContainText('Use model page controls')
  await catalog
    .getByRole('combobox', { name: 'Model type' })
    .selectOption('image')
  await expect(catalog).toContainText('No matching models')
  await search.fill('Seedream 4.5')
  await catalog.getByRole('button', { name: 'Use in Studio' }).first().click()
  await expect(catalog).not.toBeVisible()
  await expect(scene).toHaveValue('Keep this scene while browsing models.')
  await expect(
    page.getByRole('button', { name: /Model · via Comfy Router:/ })
  ).toBeFocused()
})

for (const layout of ['e', 'd']) {
  test(`reviews Kling quality and LTX Fast framing in layout ${layout}`, async ({
    page
  }) => {
    await page.goto(`/cinematic-studio?demo=success&ux=${layout}`)
    await page.getByRole('button', { name: 'Video', exact: true }).click()
    await page
      .getByRole('textbox', { name: 'Scene', exact: true })
      .fill('A train approaches in the rain.')
    await page
      .getByRole('button', { name: /Model · via Comfy Router:/ })
      .click()
    await page
      .getByRole('menuitemradio', { name: 'Kling 3.0 Text-to-Video' })
      .click()
    if (layout === 'e')
      await page.getByRole('button', { name: /^Format/ }).click()
    await page
      .getByRole('combobox', { name: 'Quality', exact: true })
      .selectOption('pro')
    await page.getByRole('combobox', { name: /^Duration/ }).selectOption('7')
    await page.getByLabel('Generate audio', { exact: true }).check()
    if (layout === 'e') await page.keyboard.press('Escape')
    await page.reload()
    await page.getByRole('button', { name: 'Review shot', exact: true }).click()
    const review = page.getByRole('dialog', { name: 'Review your shot' })
    await expect(review).toContainText('Kling 3.0 Text-to-Video')
    await expect(review).toContainText('pro · 7s')
    await review.getByRole('button', { name: 'Back to editing' }).click()
    await page
      .getByRole('button', { name: /Model · via Comfy Router:/ })
      .click()
    await page.getByRole('menuitemradio', { name: 'LTX 2.5 Fast' }).click()
    if (layout === 'e')
      await page.getByRole('button', { name: /^Format/ }).click()
    await page
      .getByRole('combobox', { name: /^Aspect ratio/ })
      .selectOption('9:16')
    await page
      .getByRole('combobox', { name: /^Resolution/ })
      .selectOption('720x1280')
    if (layout === 'e') await page.keyboard.press('Escape')
    await page.getByRole('button', { name: 'Review shot', exact: true }).click()
    await expect(review).toContainText('LTX 2.5 Fast')
    await expect(review).toContainText('720x1280')
  })

  test(`reviews a shot before generating in layout ${layout}`, async ({
    page
  }) => {
    await page.goto(`/cinematic-studio?demo=success&ux=${layout}`)
    const scene = page.getByRole('textbox', { name: 'Scene', exact: true })
    await scene.fill('A traveler arrives at a quiet station at dawn.')
    const review = page.getByRole('button', {
      name: 'Review shot',
      exact: true
    })
    await review.click()

    const dialog = page.getByRole('dialog', { name: 'Review your shot' })
    await expect(dialog).toContainText(
      'A traveler arrives at a quiet station at dawn.'
    )
    await expect(dialog).toContainText('Seedream 4.5')
    await dialog.getByRole('button', { name: 'Back to editing' }).click()
    await expect(dialog).not.toBeVisible()
    await expect(scene).toHaveValue(
      'A traveler arrives at a quiet station at dawn.'
    )
    await expect(review).toBeFocused()

    await review.click()
    await dialog
      .getByRole('button', { name: 'Generate shot', exact: true })
      .click()
    await expect(
      page.getByAltText(/A traveler arrives at a quiet station at dawn/)
    ).toBeVisible()
  })
}

for (const layout of ['e', 'd']) {
  test(`reviews and plays a video in layout ${layout}`, async ({ page }) => {
    await page.goto(`/cinematic-studio?demo=success&ux=${layout}`)
    await page.getByRole('button', { name: 'Video', exact: true }).click()
    await page
      .getByRole('textbox', { name: 'Scene', exact: true })
      .fill('A slow camera push through mountain mist.')
    if (layout === 'e')
      await page.getByRole('button', { name: /^Format/ }).click()
    await page.getByRole('combobox', { name: /^Duration/ }).selectOption('8')
    await page
      .getByRole('combobox', { name: /^Resolution/ })
      .selectOption('1080p')
    await page.getByLabel('Generate audio', { exact: true }).check()
    if (layout === 'e') await page.keyboard.press('Escape')
    await page.getByRole('button', { name: 'Review shot', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'Review your shot' })
    await expect(dialog).toContainText('1080p · 8s')
    await expect(dialog).toContainText('continuous action')
    await expect(
      page.getByLabel('Generated video', { exact: true })
    ).toHaveCount(0)
    await dialog
      .getByRole('button', { name: 'Generate shot', exact: true })
      .click()
    const video = page.getByLabel('Generated video', { exact: true })
    await expect(video).toBeVisible()
    await expect(video).toHaveAttribute('controls', '')
    await expect
      .poll(() =>
        video.evaluate(
          (element) =>
            getComputedStyle(element, '::-webkit-media-controls-panel').display
        )
      )
      .not.toBe('none')
    await expect
      .poll(() =>
        video.evaluate((element: HTMLVideoElement) => element.readyState)
      )
      .toBeGreaterThanOrEqual(2)
    await video.evaluate((element: HTMLVideoElement) => element.play())
    await expect
      .poll(() =>
        video.evaluate((element: HTMLVideoElement) => element.currentTime)
      )
      .toBeGreaterThan(0)
    await video.evaluate((element: HTMLVideoElement) => element.pause())
    await expect(page.getByRole('link', { name: /Download/ })).toHaveAttribute(
      'download',
      /\.webm$/
    )
    await page.getByRole('button', { name: 'Image', exact: true }).click()
    await expect(video).toHaveCount(0)
    await page.getByRole('button', { name: 'Video', exact: true }).click()
    await expect(video).toBeVisible()
  })
}

for (const layout of ['e', 'd']) {
  test(`saves creations and reviews image edits in layout ${layout}`, async ({
    page
  }) => {
    await page.setViewportSize(
      layout === 'e'
        ? { width: 1440, height: 900 }
        : { width: 390, height: 844 }
    )
    await page.goto(`/cinematic-studio?demo=success&ux=${layout}`)
    await page
      .getByRole('textbox', { name: 'Scene', exact: true })
      .fill('A traveler watches the ocean.')
    await page.getByRole('button', { name: 'Review shot', exact: true }).click()
    await page
      .getByRole('dialog', { name: 'Review your shot' })
      .getByRole('button', { name: 'Generate shot', exact: true })
      .click()
    await expect(
      page.getByAltText(/A traveler watches the ocean/)
    ).toBeVisible()
    await page
      .getByRole('button', { name: 'Your creations', exact: true })
      .click()
    let library = page.getByRole('dialog', { name: 'Your creations' })
    await expect(library.getByRole('article')).toHaveCount(1)
    await library.getByRole('button', { name: 'Rename', exact: true }).click()
    await library
      .getByRole('textbox', { name: 'Creation name' })
      .fill('Ocean traveler')
    await library
      .locator('form')
      .getByRole('button', { name: 'Rename', exact: true })
      .click()
    await expect(
      library.getByRole('heading', { name: 'Ocean traveler' })
    ).toBeVisible()
    await library.getByRole('button', { name: 'Favorite', exact: true }).click()
    await expect(
      library.getByRole('button', { name: 'Favorite', exact: true })
    ).toHaveAttribute('aria-pressed', 'true')
    await page.reload()
    await page
      .getByRole('button', { name: 'Your creations', exact: true })
      .click()
    library = page.getByRole('dialog', { name: 'Your creations' })
    await expect(
      library.getByRole('heading', { name: 'Ocean traveler' })
    ).toBeVisible()
    await page.screenshot({
      path: `../../temp/summaries/migration-library-${layout}.png`
    })
    const download = page.waitForEvent('download')
    await library.getByRole('link', { name: 'Download', exact: true }).click()
    expect((await download).suggestedFilename()).toMatch(/\.jpg$/)
    await library
      .getByRole('button', { name: 'Edit image', exact: true })
      .click()
    const editor = page.getByRole('dialog', { name: 'Edit this frame' })
    await editor
      .getByRole('button', { name: 'Camera view', exact: true })
      .click()
    await editor
      .getByRole('textbox', {
        name: 'Additional instruction (optional)',
        exact: true
      })
      .fill('Keep the red coat.')
    await editor
      .getByRole('combobox', { name: 'Variations', exact: true })
      .selectOption('3')
    await editor
      .getByRole('spinbutton', { name: 'Seed (optional)', exact: true })
      .fill('0')
    await editor.getByRole('button', { name: /Review/ }).click()
    const review = page.getByRole('dialog', { name: 'Review your shot' })
    await expect(review).toContainText('Keep the red coat.')
    await expect(review).toContainText(
      'Each variation is a separate paid request'
    )
    await expect(review.locator('dl')).toContainText('3')
    await expect(review.locator('dl')).toContainText('Seed (optional)0')
    await review.getByRole('button', { name: 'Back to editing' }).click()
    await expect(
      editor.getByRole('textbox', {
        name: 'Additional instruction (optional)',
        exact: true
      })
    ).toHaveValue('Keep the red coat.')
    await editor.getByRole('button', { name: /Review/ }).click()
    await review
      .getByRole('button', { name: 'Generate shot', exact: true })
      .click()
    await expect(editor).not.toBeVisible()
    await expect(page.getByAltText(/Keep the red coat/)).toBeVisible()
    await page
      .getByRole('button', { name: 'Your creations', exact: true })
      .click()
    await expect(library.getByRole('article')).toHaveCount(4)
  })
}

for (const layout of ['e', 'd']) {
  test(`crops and reuses a saved location in layout ${layout}`, async ({
    page
  }) => {
    await page.setViewportSize({
      width: layout === 'd' ? 390 : 1440,
      height: 900
    })
    await page.goto(`/cinematic-studio?demo=success&ux=${layout}`)
    await page
      .getByRole('button', { name: 'Characters, places & props', exact: true })
      .click()
    const dialog = page.getByRole('dialog', {
      name: 'Characters, places & props'
    })
    const png = await page.evaluate(() => {
      const canvas = document.createElement('canvas')
      canvas.width = 40
      canvas.height = 20
      const context = canvas.getContext('2d')!
      context.fillStyle = 'red'
      context.fillRect(0, 0, 20, 20)
      context.fillStyle = 'blue'
      context.fillRect(20, 0, 20, 20)
      return canvas.toDataURL('image/png').split(',')[1]
    })
    await dialog.getByLabel('Upload reference image').setInputFiles({
      name: 'harbor.png',
      mimeType: 'image/png',
      buffer: Buffer.from(png, 'base64')
    })
    await dialog.getByText('Crop reference', { exact: true }).click()
    await dialog.getByLabel('Left (px)', { exact: true }).fill('20')
    await dialog.getByLabel('Width (px)', { exact: true }).fill('20')
    await dialog.getByRole('button', { name: 'Apply crop to draft' }).click()
    await dialog
      .getByLabel('Reference name', { exact: true })
      .fill('Blue harbor')
    await dialog
      .getByRole('combobox', { name: /^Reference role/ })
      .selectOption('location')
    await dialog
      .getByLabel('Details to preserve')
      .fill('Keep the red lighthouse.')
    await dialog
      .getByRole('button', { name: 'Save reference', exact: true })
      .click()
    const image = dialog.getByRole('img', { name: 'Blue harbor', exact: true })
    await expect(image).toBeVisible()
    expect(
      await image.evaluate((element: HTMLImageElement) => {
        const canvas = document.createElement('canvas')
        canvas.width = element.naturalWidth
        canvas.height = element.naturalHeight
        const context = canvas.getContext('2d')!
        context.drawImage(element, 0, 0)
        return {
          width: canvas.width,
          height: canvas.height,
          pixel: [...context.getImageData(0, 0, 1, 1).data]
        }
      })
    ).toEqual({ width: 20, height: 20, pixel: [0, 0, 255, 255] })
    await page.reload()
    await page
      .getByRole('button', { name: 'Characters, places & props', exact: true })
      .click()
    await expect(
      dialog.getByRole('img', { name: 'Blue harbor', exact: true })
    ).toBeVisible()
    await dialog
      .getByRole('button', { name: 'Use reference', exact: true })
      .click()
    await page
      .getByRole('textbox', { name: 'Scene', exact: true })
      .fill('A boat reaches the harbor.')
    await page.getByRole('button', { name: 'Review shot', exact: true }).click()
    const review = page.getByRole('dialog', { name: 'Review your shot' })
    await expect(review).toContainText(
      'Use reference image 1 for the location "Blue harbor".'
    )
    await expect(review).toContainText('Keep the red lighthouse.')
    await page.screenshot({
      path: `temp/cinematic-assets-${layout}.png`,
      fullPage: true
    })
  })
}

test('reviews and edits a prompt suggestion without changing the original prematurely', async ({
  page
}) => {
  await page.goto('/cinematic-studio?demo=success')
  const scene = page.getByRole('textbox', { name: 'Scene', exact: true })
  await scene.fill('A boat reaches the harbor.')
  await page
    .getByRole('button', { name: 'Enhance prompt', exact: true })
    .click()
  const dialog = page.getByRole('dialog', { name: 'Enhance prompt' })
  await dialog
    .getByRole('button', { name: 'Review enhancement request' })
    .click()
  await dialog
    .getByRole('button', { name: 'Generate demo suggestion · no credits' })
    .click()
  await expect(page.locator('#cinematic-scene')).toHaveValue(
    'A boat reaches the harbor.'
  )
  await dialog
    .getByLabel('Editable suggestion')
    .fill('Soft sunrise reveals the weathered wooden hull.')
  await dialog.getByRole('button', { name: 'Apply suggestion' }).click()
  await expect(scene).toHaveValue(
    /A boat reaches the harbor\.[\s\S]*Soft sunrise reveals the weathered wooden hull\./
  )
})

test('keeps generated takes attached to the planned shot and imports its recipe', async ({
  page
}) => {
  await page.goto('/cinematic-studio?demo=success')
  await page
    .getByRole('textbox', { name: 'Scene', exact: true })
    .fill('A boat reaches the harbor.')
  await page.getByLabel('Seed (optional)', { exact: true }).fill('17')
  await page
    .getByRole('button', { name: 'Build your scene', exact: true })
    .click()
  const workshop = page.getByRole('dialog', { name: 'Scene workshop' })
  await workshop
    .getByRole('button', { name: 'Plan shots', exact: true })
    .click()
  await workshop
    .getByRole('button', { name: 'Use current studio settings', exact: true })
    .click()
  await workshop
    .getByRole('button', { name: 'Use this scene', exact: true })
    .first()
    .click()
  await page.getByRole('button', { name: 'Review shot', exact: true }).click()
  await page
    .getByRole('dialog', { name: 'Review your shot' })
    .getByRole('button', { name: 'Generate shot', exact: true })
    .click()
  await expect(
    page.getByAltText(/A wide establishing shot/).first()
  ).toBeVisible()
  await page
    .getByRole('button', { name: 'Build your scene', exact: true })
    .click()
  await workshop
    .getByRole('button', { name: 'Plan shots', exact: true })
    .click()
  await workshop.getByText('Saved takes · 1', { exact: true }).click()
  await expect(
    workshop.getByText('Matches these scene directions')
  ).toBeVisible()
  await workshop
    .getByLabel('Shared scene', { exact: true })
    .fill('A boat leaves the harbor.')
  await expect(
    workshop.getByText('Made with previous scene directions')
  ).toBeVisible()
  await workshop
    .getByRole('button', { name: 'Cancel', exact: true })
    .last()
    .click()
  await page
    .getByRole('button', { name: 'Your creations', exact: true })
    .click()
  const library = page.getByRole('dialog', { name: 'Your creations' })
  const downloadPromise = page.waitForEvent('download')
  await library
    .getByRole('button', { name: 'Save recipe', exact: true })
    .first()
    .click()
  const download = await downloadPromise
  const path = await download.path()
  expect(path).toBeTruthy()
  await page.keyboard.press('Escape')
  await page
    .getByRole('button', { name: 'Import a recipe', exact: true })
    .click()
  const importer = page.getByRole('dialog', { name: 'Import a recipe' })
  await importer.getByLabel('Choose recipe JSON').setInputFiles(path)
  await importer
    .getByRole('button', { name: 'Apply recipe', exact: true })
    .click()
  await expect(
    page.getByRole('textbox', { name: 'Scene', exact: true })
  ).toHaveValue(/A boat reaches the harbor/)
  await expect(
    page.getByRole('dialog', { name: 'Review your shot' })
  ).not.toBeVisible()
})

test('selects saved transition boundaries and restores both after reload', async ({
  page
}) => {
  await page.goto('/cinematic-studio?demo=success')
  for (const scene of ['The harbor at sunrise.', 'The harbor after sunset.']) {
    await page.getByRole('textbox', { name: 'Scene', exact: true }).fill(scene)
    await page.getByRole('button', { name: 'Review shot', exact: true }).click()
    await page
      .getByRole('dialog', { name: 'Review your shot' })
      .getByRole('button', { name: 'Generate shot', exact: true })
      .click()
    await expect(page.getByAltText(new RegExp(scene)).first()).toBeVisible()
  }
  await page
    .getByRole('button', { name: 'Plan a transition', exact: true })
    .click()
  const transition = page.getByRole('dialog', { name: 'Plan a transition' })
  await transition
    .getByRole('region', { name: 'First frame', exact: true })
    .getByRole('combobox')
    .selectOption({ index: 1 })
  await transition
    .getByRole('region', { name: 'Last frame', exact: true })
    .getByRole('combobox')
    .selectOption({ index: 2 })
  await expect(
    transition.getByRole('img', { name: 'First frame', exact: true })
  ).toBeVisible()
  await expect(
    transition.getByRole('img', { name: 'Last frame', exact: true })
  ).toBeVisible()
  await transition.getByRole('button', { name: 'Swap frames' }).click()
  await transition
    .getByLabel('Scene and action between the frames')
    .fill('Light slowly changes across the harbor.')
  await transition.getByRole('button', { name: 'Use these frames' }).click()
  await page.getByRole('button', { name: 'Review shot', exact: true }).click()
  const review = page.getByRole('dialog', { name: 'Review your shot' })
  await expect(
    review.getByRole('img', { name: 'Starting frame' })
  ).toBeVisible()
  await expect(review.getByRole('img', { name: 'Ending frame' })).toBeVisible()
  await review
    .getByRole('button', { name: 'Generate shot', exact: true })
    .click()
  await expect(
    page.getByLabel('Generated video', { exact: true })
  ).toBeVisible()
  await page
    .getByRole('button', { name: 'Your creations', exact: true })
    .click()
  const library = page.getByRole('dialog', { name: 'Your creations' })
  await library
    .getByRole('combobox', { name: 'All', exact: true })
    .selectOption('video')
  await expect(
    library.getByRole('button', { name: 'Reuse settings', exact: true })
  ).toBeVisible()
  await library
    .getByRole('button', {
      name: 'Review references & continuity',
      exact: true
    })
    .click()
  const referenceReview = library.getByRole('region', {
    name: 'Review references & continuity'
  })
  await expect(
    referenceReview.getByRole('img', { name: /^Starting frame:/ })
  ).toBeVisible()
  await expect(
    referenceReview.getByRole('img', { name: /^Ending frame:/ })
  ).toBeVisible()
  await expect(referenceReview.getByRole('checkbox')).toHaveCount(4)
  await page.reload()
  await page
    .getByRole('button', { name: 'Your creations', exact: true })
    .click()
  await library
    .getByRole('combobox', { name: 'All', exact: true })
    .selectOption('video')
  await library
    .getByRole('button', { name: 'Reuse settings', exact: true })
    .click()
  await page.getByRole('button', { name: 'Review shot', exact: true }).click()
  await expect(
    review.getByRole('img', { name: 'Starting frame' })
  ).toBeVisible()
  await expect(review.getByRole('img', { name: 'Ending frame' })).toBeVisible()
  await expect(review).toContainText('Light slowly changes across the harbor.')
  await page.screenshot({
    path: 'temp/cinematic-transition-restored.png',
    fullPage: true
  })
})

test('reviews separate motion clips and preserves the draft on Back', async ({
  page
}) => {
  await page.goto('/cinematic-studio?demo=success')
  await page
    .getByRole('button', { name: 'Compare camera directions', exact: true })
    .click()
  const motion = page.getByRole('dialog', { name: 'Compare camera directions' })
  await motion.getByLabel('Upload an image').setInputFiles({
    name: 'frame.png',
    mimeType: 'image/png',
    buffer: Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=',
      'base64'
    )
  })
  await motion
    .getByLabel('Scene and action for every clip')
    .fill('Clouds drift over the harbor.')
  await motion.getByLabel('Push in', { exact: true }).check()
  await motion.getByRole('button', { name: 'Review clips' }).click()
  const review = page.getByRole('dialog', { name: 'Review your shot' })
  await expect(review).toContainText(
    'Separate clips; each uses workspace credits.'
  )
  await expect(review).toContainText('Keep the camera locked in place.')
  await expect(review).toContainText('smooth physical dolly-in')
  await review.getByRole('button', { name: 'Back to editing' }).click()
  await expect(
    motion.getByLabel('Scene and action for every clip')
  ).toHaveValue('Clouds drift over the harbor.')
  await expect(motion.getByLabel('Push in', { exact: true })).toBeChecked()
  await motion.getByRole('button', { name: 'Review clips' }).click()
  await review
    .getByRole('button', { name: 'Generate shot', exact: true })
    .click()
  await expect(
    page.getByLabel('Generated video', { exact: true })
  ).toBeVisible()
  await page
    .getByRole('button', { name: 'Your creations', exact: true })
    .click()
  const library = page.getByRole('dialog', { name: 'Your creations' })
  await library
    .getByRole('combobox', { name: 'All', exact: true })
    .selectOption('video')
  await expect(
    library.getByRole('link', { name: 'Download', exact: true })
  ).toHaveCount(2)
  await page.keyboard.press('Escape')
  await page
    .getByRole('button', { name: 'Compare results', exact: true })
    .click()
  await expect(
    page.getByRole('dialog', { name: 'Compare creations' }).locator('video')
  ).toHaveCount(2)
  await page.screenshot({
    path: 'temp/cinematic-motion-comparison.png',
    fullPage: true
  })
})

test('offers original image choices with legal framing and a separate native catalog', async ({
  page
}) => {
  await page.goto('/cinematic-studio?demo=success')
  await page.getByRole('button', { name: /Model · via Comfy Router:/ }).click()
  await expect(
    page.getByRole('menuitemradio', { name: /Seedream 5/ })
  ).toBeVisible()
  await expect(
    page.getByRole('menuitemradio', { name: /FLUX 2 Max/ })
  ).toBeVisible()
  await expect(
    page.getByRole('menuitem', { name: /All models & native controls/ })
  ).toHaveAttribute('href', '/models')
  await page
    .getByRole('menuitemradio', { name: /Recraft.*4\.1/, exact: false })
    .click()
  await expect(page.getByRole('button', { name: /^Format:/ })).toContainText(
    '1:1'
  )
  await page.getByRole('button', { name: /^Format:/ }).click()
  await page.getByRole('button', { name: /Aspect ratio: 1:1/ }).click()
  await expect(page.getByRole('menuitemradio')).toHaveCount(1)
  await expect(page.getByRole('menuitemradio')).toContainText('1:1')
})

test('restores independent composer drafts and multiple named plans after reload', async ({
  page
}) => {
  await page.goto('/cinematic-studio?demo=success')
  const scene = page.getByRole('textbox', { name: 'Scene', exact: true })
  await scene.fill('Image draft at the station.')
  await page.getByRole('button', { name: 'Video', exact: true }).click()
  await scene.fill('Video draft of passing clouds.')
  await page.reload()
  await expect(scene).toHaveValue('Video draft of passing clouds.')
  await page.getByRole('button', { name: 'Image', exact: true }).click()
  await expect(scene).toHaveValue('Image draft at the station.')
  await page
    .getByRole('button', { name: 'Build your scene', exact: true })
    .click()
  const builder = page.getByRole('dialog', { name: 'Scene workshop' })
  await builder.getByLabel('Plan name', { exact: true }).fill('Station plan')
  await builder
    .getByRole('button', { name: 'New plan from current scene' })
    .click()
  await builder.getByLabel('Plan name', { exact: true }).fill('Cloud plan')
  await builder
    .getByRole('button', { name: 'Save draft in this browser' })
    .click()
  await builder
    .getByRole('combobox', { name: 'Saved plans', exact: true })
    .selectOption({ index: 0 })
  await expect(builder.getByLabel('Plan name', { exact: true })).toHaveValue(
    'Station plan'
  )
  await page.reload()
  await page
    .getByRole('button', { name: 'Build your scene', exact: true })
    .click()
  await builder
    .getByRole('combobox', { name: 'Saved plans', exact: true })
    .selectOption({ index: 1 })
  await expect(builder.getByLabel('Plan name', { exact: true })).toHaveValue(
    'Cloud plan'
  )
})

test('starts the next shot with the saved scene and the selected frame', async ({
  page
}) => {
  await page.goto('/cinematic-studio?demo=success')
  await page
    .getByRole('textbox', { name: 'Scene', exact: true })
    .fill('A train at dawn beside a quiet platform.')
  await page.getByRole('button', { name: 'Review shot', exact: true }).click()
  await page
    .getByRole('dialog', { name: 'Review your shot' })
    .getByRole('button', { name: 'Generate shot', exact: true })
    .click()
  await expect(page.getByAltText(/A train at dawn/).first()).toBeVisible()
  await page
    .getByRole('textbox', { name: 'Scene', exact: true })
    .fill('An unrelated draft.')
  await page
    .getByRole('button', { name: 'Your creations', exact: true })
    .click()
  await page
    .getByRole('dialog', { name: 'Your creations' })
    .getByRole('button', { name: 'Next shot from this frame', exact: true })
    .click()
  await expect(
    page.getByRole('textbox', { name: 'Scene', exact: true })
  ).toHaveValue('A train at dawn beside a quiet platform.')
  await page.getByRole('button', { name: 'Review shot', exact: true }).click()
  await expect(
    page.getByRole('dialog', { name: 'Review your shot' })
  ).toContainText('Keep the character from reference image 1.')
})

for (const layout of ['e', 'd']) {
  test(`reuses and animates selected comparison images in layout ${layout}`, async ({
    page
  }) => {
    await page.goto(`/cinematic-studio?demo=success&ux=${layout}`)
    const scene = page.getByRole('textbox', { name: 'Scene', exact: true })
    const prompts = [
      'A traveler waits beside the station.',
      'A traveler steps into the neon night.'
    ]
    for (const prompt of prompts) {
      await scene.fill(prompt)
      await page
        .getByRole('button', { name: 'Review shot', exact: true })
        .click()
      await page
        .getByRole('dialog', { name: 'Review your shot' })
        .getByRole('button', { name: 'Generate shot', exact: true })
        .click()
      await expect(page.getByAltText(new RegExp(prompt)).first()).toBeVisible()
    }
    await page
      .getByRole('button', { name: 'Compare results', exact: true })
      .click()
    const comparison = page.getByRole('dialog', { name: 'Compare creations' })
    const first = comparison.getByRole('region', { name: 'First creation' })
    await first.getByText('Full prompt', { exact: true }).click()
    const chosenPrompt = await first
      .locator('details')
      .first()
      .locator('p')
      .innerText()
    await first
      .getByRole('button', { name: 'Reuse settings', exact: true })
      .click()
    await expect(comparison).not.toBeVisible()
    const expectedScene = prompts.find((prompt) =>
      chosenPrompt.includes(prompt)
    )
    expect(expectedScene).toBeDefined()
    await expect(scene).toHaveValue(expectedScene ?? '')
    await page
      .getByRole('button', { name: 'Compare results', exact: true })
      .click()
    const second = comparison.getByRole('region', { name: 'Second creation' })
    await second.getByRole('button', { name: 'Animate', exact: true }).click()
    await expect(comparison).not.toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Video', exact: true })
    ).toHaveAttribute('aria-pressed', 'true')
    await scene.fill('The traveler slowly turns toward the station.')
    await page.getByRole('button', { name: 'Review shot', exact: true }).click()
    const review = page.getByRole('dialog', { name: 'Review your shot' })
    await expect(
      review.getByRole('img', { name: 'Starting frame' })
    ).toBeVisible()
  })
}

for (const layout of ['e', 'd']) {
  test(`previews light positions while preserving Apply and Cancel in layout ${layout}`, async ({
    page
  }) => {
    await page.goto(`/cinematic-studio?demo=success&ux=${layout}`)
    await page
      .getByRole('button', { name: 'Creative controls', exact: true })
      .click()
    const editor = page.getByRole('dialog', { name: 'Creative direction' })
    await editor.getByRole('button', { name: 'Add light', exact: true }).click()
    await editor
      .getByRole('combobox', { name: 'Position 1' })
      .selectOption('left')
    const diagram = editor.getByRole('img', { name: 'Lighting positions' })
    await expect(diagram).toHaveAccessibleDescription(/Light 1: Left/)
    await editor.getByRole('button', { name: 'Add light', exact: true }).click()
    await editor
      .getByRole('combobox', { name: 'Position 2' })
      .selectOption('top')
    await expect(diagram).toHaveAccessibleDescription(/Light 2: Above/)
    await editor.getByRole('button', { name: 'Apply', exact: true }).click()
    await page
      .getByRole('button', { name: 'Creative controls', exact: true })
      .click()
    await expect(diagram).toHaveAccessibleDescription(
      /Light 1: Left.*Light 2: Above/
    )
    await editor
      .getByRole('combobox', { name: 'Position 1' })
      .selectOption('right')
    await expect(diagram).toHaveAccessibleDescription(/Light 1: Right/)
    await editor
      .getByRole('button', { name: 'Cancel', exact: true })
      .last()
      .click()
    await page
      .getByRole('button', { name: 'Creative controls', exact: true })
      .click()
    await expect(diagram).toHaveAccessibleDescription(/Light 1: Left/)
    await editor
      .getByRole('button', { name: 'Remove', exact: true })
      .first()
      .click()
    await expect(diagram).toHaveAccessibleDescription(/Light 1: Above/)
    await expect(diagram).not.toHaveAccessibleDescription(/Light 2:/)
  })
}
