import { expect } from '@playwright/test'
import { test } from './fixtures/modelsAccount'

const equipment = [
  {
    title: 'Body',
    initial: 'Large format',
    next: 'Super 35',
    direct: 'Digital cinema',
    last: 'Handheld',
    selected: 'Large format',
    phrase: 'large format cinema camera'
  },
  {
    title: 'Lens',
    initial: 'Anamorphic',
    next: 'Vintage',
    direct: 'Spherical',
    last: 'Tilt-shift',
    selected: 'Anamorphic',
    phrase: 'anamorphic lens'
  },
  {
    title: 'Focal length',
    initial: '50mm',
    next: '85mm',
    direct: '14mm',
    last: '135mm',
    selected: '24mm',
    phrase: '24mm'
  },
  {
    title: 'Aperture',
    initial: 'f/2.8',
    next: 'f/4',
    direct: 'f/1.4',
    last: 'f/8',
    selected: 'f/2',
    phrase: 'f/2'
  }
] as const

for (const layout of ['e', 'd']) {
  test(`camera equipment carousel, direct choices and keyboard persist into review in layout ${layout}`, async ({
    page,
    context
  }) => {
    const submissions: string[] = []
    await context.route('**/v2/models/**', (route) => {
      if (route.request().method() === 'POST')
        submissions.push(route.request().url())
      return route.abort()
    })
    await page.goto(`/cinematic-studio?demo=success&ux=${layout}`)
    await page
      .getByRole('textbox', { name: 'Scene', exact: true })
      .fill('A traveler reaches the harbor at dawn.')
    await page.getByRole('button', { name: /Large format.*50mm/ }).click()
    const picker = page.getByRole('dialog', { name: 'Camera', exact: true })
    await expect(picker).toBeVisible()

    for (const group of equipment) {
      const section = picker.getByRole('region', {
        name: group.title,
        exact: true
      })
      const choices = section.getByRole('radiogroup', {
        name: group.title,
        exact: true
      })
      const radio = (name: string) =>
        choices.getByRole('radio', { name, exact: true })
      await expect(radio(group.initial)).toHaveAttribute('aria-checked', 'true')
      await section
        .getByRole('button', { name: `Next ${group.title}`, exact: true })
        .click()
      await expect(radio(group.next)).toHaveAttribute('aria-checked', 'true')
      await section
        .getByRole('button', { name: `Previous ${group.title}`, exact: true })
        .click()
      await expect(radio(group.initial)).toHaveAttribute('aria-checked', 'true')

      await radio(group.direct).click()
      await expect(radio(group.direct)).toHaveAttribute('aria-checked', 'true')
      await radio(group.direct).press('End')
      await expect(radio(group.last)).toBeFocused()
      await expect(radio(group.last)).toHaveAttribute('tabindex', '0')
      await expect(
        section.getByRole('button', {
          name: `Next ${group.title}`,
          exact: true
        })
      ).toBeDisabled()
      await radio(group.last).press('Home')
      await expect(radio('Auto')).toBeFocused()
      await expect(
        section.getByRole('button', {
          name: `Previous ${group.title}`,
          exact: true
        })
      ).toBeDisabled()
      await radio('Auto').press('ArrowRight')
      await expect(radio(group.direct)).toBeFocused()
      await radio(group.direct).press('ArrowRight')
      await expect(radio(group.selected)).toBeFocused()
      await expect(radio(group.selected)).toHaveAttribute(
        'aria-checked',
        'true'
      )
      await expect(choices.getByRole('radio', { checked: true })).toHaveCount(1)
      await expect(radio(group.direct)).toHaveAttribute('tabindex', '-1')
    }

    await picker.getByRole('button', { name: 'Done', exact: true }).click()
    await expect(picker).toBeHidden()
    await expect(
      page.getByRole('button', { name: /Large format.*24mm/ })
    ).toBeVisible()
    await page.getByRole('button', { name: 'Review shot', exact: true }).click()
    const review = page.getByRole('dialog', {
      name: 'Review your shot',
      exact: true
    })
    for (const group of equipment)
      await expect(review).toContainText(group.phrase)
    await review
      .getByRole('button', { name: 'Back to editing', exact: true })
      .click()

    await page.reload()
    await expect(
      page.getByRole('textbox', { name: 'Scene', exact: true })
    ).toHaveValue('A traveler reaches the harbor at dawn.')
    await page.getByRole('button', { name: /Large format.*24mm/ }).click()
    for (const group of equipment) {
      const choices = picker.getByRole('radiogroup', {
        name: group.title,
        exact: true
      })
      await expect(
        choices.getByRole('radio', { name: group.selected, exact: true })
      ).toHaveAttribute('aria-checked', 'true')
    }
    await picker.getByRole('button', { name: 'Done', exact: true }).click()
    await page.getByRole('button', { name: 'Review shot', exact: true }).click()
    for (const group of equipment)
      await expect(review).toContainText(group.phrase)
    expect(submissions).toEqual([])
  })
}
