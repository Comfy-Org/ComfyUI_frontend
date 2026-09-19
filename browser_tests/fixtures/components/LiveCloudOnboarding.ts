import { expect } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'

export class LiveCloudOnboarding {
  public readonly survey: Locator
  public readonly canvas: Locator
  public readonly next: Locator
  public readonly submit: Locator
  public readonly option: Locator
  public readonly text: Locator

  constructor(private readonly page: Page) {
    this.survey = page.getByRole('heading', {
      name: "Let's get to know you",
      exact: true
    })
    this.canvas = page.locator('#graph-canvas')
    this.next = page.getByRole('button', { name: 'Next', exact: true })
    this.submit = page.getByRole('button', { name: 'Submit', exact: true })
    this.option = page
      .getByRole('button', { pressed: false })
      .and(page.locator('[aria-pressed="false"]:not([id$="-other"])'))
      .first()
    this.text = page.getByRole('textbox')
  }

  async completeSurveyIfNeeded(frontend: string) {
    const { survey, canvas, next, submit } = this
    await expect(survey.or(canvas)).toBeVisible()
    if (await survey.isVisible()) {
      for (let step = 0; step < 20; step++) {
        if (await this.answerSurveyQuestion(next, submit)) break
      }
      await expect(
        submit,
        'Complete Cloud onboarding within 20 questions'
      ).toBeEnabled()
      const [response] = await Promise.all([
        this.page.waitForResponse(
          (response) =>
            response.url() === `${frontend}/api/settings` &&
            response.request().method() === 'POST'
        ),
        submit.click()
      ])
      expect(response.status(), 'Save Cloud onboarding survey').toBe(200)
      await expect(survey).toBeHidden()
    }
    await expect(canvas).toBeVisible()
  }

  private async answerSurveyQuestion(next: Locator, submit: Locator) {
    const { option, text } = this
    await expect(option.or(text)).toBeVisible()
    const control = (await option.isVisible()) ? option : text
    const id = await control.getAttribute('id')
    if (!id) throw new Error('Cloud survey control has no ID')
    const answered = this.page.locator(`[id=${JSON.stringify(id)}]`)
    if (await option.isVisible()) await control.click()
    else await control.fill('Automated billing E2E')
    await expect
      .poll(
        async () =>
          !(await answered.isVisible()) ||
          ((await next.isVisible()) && (await next.isEnabled())) ||
          ((await submit.isVisible()) && (await submit.isEnabled()))
      )
      .toBe(true)
    if ((await submit.isVisible()) && (await submit.isEnabled())) return true
    if ((await next.isVisible()) && (await next.isEnabled())) await next.click()
    await expect(answered).toBeHidden()
    return false
  }
}
