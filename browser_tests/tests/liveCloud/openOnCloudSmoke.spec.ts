import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'

import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import { z } from 'zod'
import {
  zBillingBalanceResponse,
  zJobDetailResponse,
  zPromptResponse
} from '@comfyorg/ingest-types/zod'

import { desktopWorkflowRelayFixture } from '@e2e/fixtures/desktopWorkflowRelayFixture'

const test = desktopWorkflowRelayFixture.extend({
  liveNetworkOrigins: async ({ cloudOrigin, liveNetworkOrigins }, use) => {
    const { hostname } = new URL(cloudOrigin)
    const preview = /^(?:fe-)?(pr-\d+)\.testenvs\.comfy\.org$/.exec(hostname)
    await use([
      ...liveNetworkOrigins,
      ...(preview ? [`https://${preview[1]}-registry.testenvs.comfy.org`] : []),
      'https://consumer.cloud.gist.build',
      'https://realtime.cloud.gist.build',
      'https://ajax.googleapis.com',
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

const creditBalance = zBillingBalanceResponse
  .pick({ amount_cents: true, currency: true, pending_charges_cents: true })
  .required({ amount_cents: true })

async function readCreditBalance(page: Page) {
  const balance = await page.evaluate(async () => {
    const app = window.app
    if (!app) throw new Error('The Cloud editor is unavailable')
    const response = await app.api.fetchApi('/billing/balance', {
      cache: 'no-store',
      timeoutMs: 10_000
    })
    if (!response.ok) {
      throw new Error(`Could not read Cloud credits (HTTP ${response.status})`)
    }
    return response.json()
  })
  return creditBalance.parse(balance)
}

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
      const evidenceDir = process.env.OPEN_ON_CLOUD_EVIDENCE_DIR
      const evidencePath = (name: string) =>
        evidenceDir ? join(evidenceDir, name) : testInfo.outputPath(name)
      const capture = async (name: string) => {
        await page.screenshot({ path: evidencePath(name) })
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

      await test.step('Complete the Cloud job with one image and no credit charge', async () => {
        const before = await readCreditBalance(page)
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

        let completedJob: z.infer<typeof jobResult> | undefined
        await expect
          .poll(
            async () => {
              const result = await page.evaluate(async (jobId) => {
                const app = window.app
                if (!app) throw new Error('The Cloud editor is unavailable')
                const response = await app.api.fetchApi(
                  `/jobs/${encodeURIComponent(jobId)}`,
                  { timeoutMs: 10_000 }
                )
                if (!response.ok) {
                  throw new Error(
                    `Could not read the submitted Cloud job (HTTP ${response.status})`
                  )
                }
                return response.json()
              }, id)
              completedJob = jobResult.parse(result)
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
        const after = await readCreditBalance(page)
        await writeFile(
          evidencePath('cloud-job-result.json'),
          JSON.stringify(
            { ...completedJob, credit_balance: { before, after } },
            null,
            2
          )
        )
        expect(
          after,
          'The completed workflow leaves Cloud credits unchanged'
        ).toEqual(before)
        await capture('03-after-cloud-execution.png')
      })
    })
  }
)
