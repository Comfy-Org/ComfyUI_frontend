import { writeFile } from 'node:fs/promises'

import type { Request } from '@playwright/test'
import { expect } from '@playwright/test'
import { z } from 'zod'
import { zJobDetailResponse, zPromptResponse } from '@comfyorg/ingest-types/zod'

import { desktopWorkflowRelayFixture } from '@e2e/fixtures/desktopWorkflowRelayFixture'

const test = desktopWorkflowRelayFixture.extend({
  liveNetworkOrigins: async ({ cloudOrigin, liveNetworkOrigins }, use) => {
    const { hostname } = new URL(cloudOrigin)
    const preview = /^(?:fe-)?(pr-\d+)\.testenvs\.comfy\.org$/.exec(hostname)
    await use([
      ...liveNetworkOrigins,
      ...(preview ? [`https://${preview[1]}-registry.testenvs.comfy.org`] : []),
      'https://consumer.cloud.gist.build',
      'https://mp.comfy.org',
      'https://e2.sy-d.io'
    ])
  }
})

const jobResult = zJobDetailResponse.pick({
  id: true,
  status: true,
  outputs_count: true
})

const firebaseSignInError = z.object({
  error: z.object({
    message: z.enum([
      'CAPTCHA_CHECK_FAILED',
      'EMAIL_NOT_FOUND',
      'INVALID_LOGIN_CREDENTIALS',
      'INVALID_PASSWORD',
      'INVALID_RECAPTCHA_TOKEN',
      'MISSING_RECAPTCHA_TOKEN',
      'OPERATION_NOT_ALLOWED',
      'TOO_MANY_ATTEMPTS_TRY_LATER',
      'USER_DISABLED'
    ])
  })
})

async function getJobResult(origin: string, id: string, submission: Request) {
  const headers = new Headers()
  for (const name of ['authorization', 'cookie', 'x-comfy-workspace-id']) {
    const value = await submission.headerValue(name)
    if (value) headers.set(name, value)
  }
  const response = await fetch(new URL(`/api/jobs/${id}`, origin), {
    headers,
    redirect: 'error',
    signal: AbortSignal.timeout(10_000)
  })
  if (!response.ok) {
    throw new Error(
      `Could not read the submitted Cloud job (HTTP ${response.status})`
    )
  }
  return jobResult.parse(await response.json())
}

test.use({ billingNewUx: false, trace: 'off', video: 'off', screenshot: 'off' })

test.describe(
  'Open on Cloud with the smoke account',
  { tag: ['@cloud-live', '@smoke', '@ui'] },
  () => {
    test('imports the Desktop workflow after sign-in and completes a Cloud job', async ({
      cloudOrigin,
      comfyPage,
      relayTransfer,
      toast
    }, testInfo) => {
      test.setTimeout(240_000)
      const email = process.env.SMOKE_ACCOUNT_EMAIL
      const password = process.env.SMOKE_ACCOUNT_PASSWORD
      if (!email || !password) {
        throw new Error('Set SMOKE_ACCOUNT_EMAIL and SMOKE_ACCOUNT_PASSWORD')
      }
      const { page, actionbar } = comfyPage
      const capture = async (name: string) => {
        await page.screenshot({ path: testInfo.outputPath(name) })
      }
      const receiverFlagResponses: Array<{
        authorized: boolean
        enabled: boolean
      }> = []
      page.on('response', async (response) => {
        if (response.url() !== `${cloudOrigin}/api/features` || !response.ok())
          return
        const features = z
          .object({ open_on_cloud_enabled: z.boolean() })
          .safeParse(await response.json().catch(() => undefined))
        if (!features.success) return
        const authorized = Boolean(
          await response
            .request()
            .headerValue('authorization')
            .catch(() => null)
        )
        receiverFlagResponses.push({
          authorized,
          enabled: features.data.open_on_cloud_enabled
        })
      })

      await test.step('Follow the Desktop relay and sign in on the Cloud preview', async () => {
        await page.goto(relayTransfer.url, { waitUntil: 'domcontentloaded' })
        await expect(page).toHaveURL((url) => url.origin === cloudOrigin)
        await expect(
          page.getByRole('heading', {
            name: 'Log in to your account',
            exact: true
          })
        ).toBeVisible()
        await capture('01-hosted-sign-in.png')
        await page
          .getByRole('button', { name: 'Use email instead', exact: true })
          .click()
        await page
          .getByRole('textbox', { name: 'Email', exact: true })
          .fill(email)
        await page.getByLabel('Password', { exact: true }).fill(password)
        const [login] = await Promise.all([
          page.waitForResponse((response) => {
            const url = new URL(response.url())
            return (
              url.origin === 'https://identitytoolkit.googleapis.com' &&
              url.pathname === '/v1/accounts:signInWithPassword' &&
              response.request().method() === 'POST'
            )
          }),
          page.getByRole('button', { name: 'Sign in', exact: true }).click()
        ])
        if (!login.ok()) {
          const error = firebaseSignInError.safeParse(
            await login.json().catch(() => undefined)
          )
          const code = error.success ? ` ${error.data.error.message}` : ''
          throw new Error(
            `Firebase rejected the smoke account (HTTP ${login.status()}${code})`
          )
        }
      })

      await test.step('Restore the transferred workflow in the authenticated editor', async () => {
        const graphNodeTypes = () =>
          page
            .evaluate(() =>
              window.app?.graph.nodes.map((node) => node.type).toSorted()
            )
            .catch(() => undefined)
        try {
          await Promise.all([
            expect(
              toast.withText('Opened from ComfyUI on your computer')
            ).toBeVisible(),
            expect.poll(graphNodeTypes).toEqual(['EmptyImage', 'SaveImage'])
          ])
        } catch (error) {
          const { origin, pathname } = new URL(page.url())
          const graph = await graphNodeTypes()
          const workflowMissing = await toast
            .withText("Your workflow didn't arrive")
            .isVisible()
          if (origin === cloudOrigin && (await comfyPage.canvas.isVisible())) {
            await capture('02-cloud-editor-after-sign-in.png')
          }
          throw new Error(
            `Cloud could not confirm workflow import: ${JSON.stringify({ pathname, graph, workflowMissing, receiverFlagResponses })}`,
            { cause: error }
          )
        }
        await capture('02-imported-workflow.png')
      })

      await test.step('Run the imported workflow and confirm its Cloud output', async () => {
        const [submission] = await Promise.all([
          page.waitForResponse(
            (response) =>
              response.url() === `${cloudOrigin}/api/prompt` &&
              response.request().method() === 'POST'
          ),
          actionbar.queueButton.primaryButton.click()
        ])
        expect(submission.ok(), 'Cloud accepts the run from the editor').toBe(
          true
        )
        const { prompt_id: id } = zPromptResponse.parse(await submission.json())
        if (!id) throw new Error('Cloud did not return a job ID')

        let completedJob: Awaited<ReturnType<typeof getJobResult>> | undefined
        await expect
          .poll(
            async () => {
              completedJob = await getJobResult(
                cloudOrigin,
                id,
                submission.request()
              )
              return completedJob.status
            },
            { timeout: 120_000, intervals: [1000, 2000, 5000] }
          )
          .toMatch(/^(completed|failed|cancelled)$/)
        expect(completedJob).toMatchObject({
          id,
          status: 'completed',
          outputs_count: 1
        })
        await writeFile(
          testInfo.outputPath('cloud-job-result.json'),
          JSON.stringify(completedJob, null, 2)
        )
        await capture('03-after-cloud-execution.png')
      })
    })
  }
)
