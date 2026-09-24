import { expect } from '@playwright/test'

import { test } from './fixtures/blockExternalMedia'

test.use({ javaScriptEnabled: false })

test('Comfy Agent preview supports keyboard FAQ disclosure and product navigation @smoke', async ({
  page
}) => {
  await page.goto('/comfy-agent')
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    'content',
    'noindex, nofollow'
  )
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Comfy Agent: The first agent for craft'
  )

  const answer = page.getByText(
    'Yes. Open any workflow and the agent reads the whole graph.',
    { exact: false }
  )
  const question = page.getByText('Does it work with my existing workflows?', {
    exact: true
  })
  await expect(answer).toBeHidden()
  await question.focus()
  await page.keyboard.press('Enter')
  await expect(answer).toBeVisible()
  await page.keyboard.press('Enter')
  await expect(answer).toBeHidden()

  await page
    .getByRole('navigation', { name: 'Breadcrumb' })
    .getByRole('link', { name: 'Products' })
    .click()
  await expect(page).toHaveURL(/#products$/)
  await expect(
    page.getByRole('link', { name: /Comfy Desktop Run ComfyUI/ })
  ).toBeVisible()
})

test('the product workflow animates without a picker or JavaScript @smoke', async ({
  page
}) => {
  await page.goto('/agent')
  const examples = page.getByRole('region', {
    name: 'Comfy Agent building workflows',
    exact: true
  })
  const videoExample = examples.locator('[data-example="conditioner"]')
  await expect(examples.getByRole('radio')).toHaveCount(0)
  await expect(examples.locator('.wf-example')).toHaveCount(1)
  await expect(videoExample).toBeVisible()
  await expect(examples.getByRole('checkbox')).toHaveCount(0)
  await expect(examples.locator('.wf-captions')).toHaveCount(0)

  const animationCount = await videoExample.evaluate((element) => {
    const duration = Number.parseFloat(
      getComputedStyle(element).getPropertyValue('--wf-duration')
    )
    const animations = element.getAnimations({ subtree: true })
    for (const animation of animations) {
      animation.pause()
      animation.currentTime = duration * 1000 - 1000
    }
    return animations.length
  })
  expect(animationCount).toBeGreaterThan(0)
  await expect(videoExample.locator('.wf-scene')).toBeVisible()
  await expect(videoExample.locator('.wf-node')).toHaveCount(9)
  await expect
    .poll(() =>
      videoExample
        .locator('.wf-node')
        .evaluateAll(
          (nodes) =>
            nodes.filter((node) => getComputedStyle(node).opacity === '1')
              .length
        )
    )
    .toBe(9)
  await expect(videoExample.locator('video')).toHaveCount(2)
  const finalVideo = videoExample.getByLabel(
    'Final purple fig conditioner video ad'
  )
  await expect(finalVideo).toHaveAttribute(
    'poster',
    'https://media.comfy.org/website/comfy-agent/conditioner/keyframe-purple.webp'
  )
  await expect(finalVideo).not.toHaveAttribute('src')
  await expect(finalVideo).toHaveCSS('opacity', '1')
  await expect(
    videoExample.getByRole('img', { name: /Generated product scene for/ })
  ).toHaveCount(3)
  await expect(
    videoExample.locator('[data-node="keyframe-purple"] .wf-selection')
  ).toHaveCSS('opacity', '1')
  const finalSize = await videoExample
    .locator('[data-node="result-purple"]')
    .evaluate((node) => {
      const bounds = node.getBoundingClientRect()
      return { width: bounds.width, height: bounds.height }
    })
  const keyframeSize = await videoExample
    .locator('[data-node="keyframe-purple"]')
    .evaluate((node) => {
      const bounds = node.getBoundingClientRect()
      return { width: bounds.width, height: bounds.height }
    })
  const referenceSize = await videoExample
    .locator('[data-node="motionref"]')
    .evaluate((node) => {
      const bounds = node.getBoundingClientRect()
      return {
        width: bounds.width,
        height: bounds.height,
        right: bounds.right,
        top: bounds.top
      }
    })
  const keyframeSizes = await videoExample
    .locator('[data-node^="keyframe-"]')
    .evaluateAll((nodes) =>
      nodes.map((node) => {
        const bounds = node.getBoundingClientRect()
        return { width: bounds.width, height: bounds.height }
      })
    )
  const generationPosition = await videoExample
    .locator('[data-node="videogen"]')
    .evaluate((node) => {
      const bounds = node.getBoundingClientRect()
      return { left: bounds.left, top: bounds.top }
    })
  expect(finalSize.width).toBeGreaterThan(referenceSize.width)
  expect(finalSize.height).toBeGreaterThan(referenceSize.height)
  expect(keyframeSizes).toEqual([keyframeSize, keyframeSize, keyframeSize])
  expect(keyframeSize.width).toBeLessThan(referenceSize.width)
  expect(keyframeSize.height).toBeLessThan(referenceSize.height)
  expect(generationPosition.left).toBeGreaterThan(referenceSize.right)
  expect(generationPosition.top).toBeGreaterThan(
    referenceSize.top + referenceSize.height / 2
  )
  await expect(
    videoExample.getByRole('img', {
      name: 'Grayscale bottle scene with pillars and floating particle spheres'
    })
  ).toBeVisible()
  const motionReference = videoExample.getByLabel(
    'Grayscale bottle animation used as the motion reference'
  )
  await expect(motionReference).toHaveAttribute(
    'poster',
    'https://media.comfy.org/website/comfy-agent/conditioner/motion-reference-poster.webp'
  )
  await expect(motionReference).not.toHaveAttribute('src')
  await expect(motionReference).toHaveCSS('opacity', '1')
  await expect(videoExample.locator('.wf-pending')).toHaveCount(0)
  await expect(videoExample.locator('.wf-typed-character')).toHaveCount(0)
  await expect(
    videoExample.getByText(
      'Use the motion reference and keyframe to render a video ad.',
      { exact: true }
    )
  ).toHaveCSS('opacity', '1')
})
