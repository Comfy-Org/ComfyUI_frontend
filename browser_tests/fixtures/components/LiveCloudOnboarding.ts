import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'

export class LiveCloudOnboarding {
  constructor(private readonly page: Page) {}

  async dismissTutorialsWhenVisible() {
    for (const testId of ['coach-landing', 'coach-card']) {
      await this.page.addLocatorHandler(
        this.page.getByTestId(testId),
        async (dialog) => {
          await dialog
            .getByRole('button', { name: 'Skip', exact: true })
            .click()
        }
      )
    }
  }

  async completeSurveyIfNeeded(frontend: string) {
    const survey = this.page.getByRole('heading', {
      name: "Let's get to know you",
      exact: true
    })
    const canvas = this.page.locator('#graph-canvas')
    await expect(survey.or(canvas)).toBeVisible()
    if (await survey.isVisible()) {
      const next = this.page.getByRole('button', { name: 'Next', exact: true })
      const submit = this.page.getByRole('button', {
        name: 'Submit',
        exact: true
      })
      for (let step = 0; step < 20; step++) {
        const option = this.page
          .getByRole('button', { pressed: false })
          .and(this.page.locator(':not([id$="-other"])'))
          .first()
        const text = this.page.getByRole('textbox')
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
        if ((await submit.isVisible()) && (await submit.isEnabled())) break
        if ((await next.isVisible()) && (await next.isEnabled()))
          await next.click()
        await expect(answered).toBeHidden()
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
}
