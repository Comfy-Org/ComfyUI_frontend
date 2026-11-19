import { expect } from '@playwright/test'
import type { APIRequestContext, Response } from '@playwright/test'
import { join } from 'node:path'

import { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { SignInDialog } from '@e2e/fixtures/components/SignInDialog'
import { networkIsolationFixture as test } from '@e2e/fixtures/networkIsolationFixture'

const editor = 'http://127.0.0.1:8188'
const cloud = 'https://testcloud.comfy.org'
const apiGateway = 'https://testapi.comfy.org'
const firebaseAuth = 'https://identitytoolkit.googleapis.com'
const filename = 'dplat3611-staging-smoke-20261119-172601.safetensors'

function smokeInputs() {
  const email = process.env.SMOKE_ACCOUNT_EMAIL
  const password = process.env.SMOKE_ACCOUNT_PASSWORD
  const localFixture = process.env.STAGING_SMOKE_FIXTURE
  if (!email || !password || !localFixture)
    throw new Error('Managed smoke sign-in or model fixture is unavailable')

  return { email, password, localFixture }
}

async function readStagingFirebaseKey(request: APIRequestContext) {
  const config = await request.get(`${cloud}/api/features`, { maxRedirects: 0 })
  expect(config.status()).toBe(200)
  const features = await config.json()
  if (features.comfy_api_base_url !== apiGateway)
    throw new Error('Cloud and API test environments do not match')
  const firebase = features.firebase_config
  if (
    firebase?.projectId !== 'dreamboothy-dev' ||
    typeof firebase?.apiKey !== 'string'
  )
    throw new Error('Staging Firebase project could not be verified')
  return firebase.apiKey as string
}

async function verifyWorkspace(request: APIRequestContext, features: Response) {
  const auth = await features.request().headerValue('authorization')
  if (!auth) throw new Error('Workspace authorization unavailable')
  const current = await request.get(`${cloud}/api/workspaces/current`, {
    headers: { Authorization: auth },
    maxRedirects: 0
  })
  if (!current.ok())
    throw new Error(
      `Staging workspace could not be verified (HTTP ${current.status()})`
    )
  const workspace = await current.json()
  if (workspace.type !== 'personal' || workspace.role !== 'owner')
    throw new Error(
      'The managed account must be scoped to its own staging workspace'
    )
  const folders = (await features.json()).model_upload_folders
  if (!Array.isArray(folders) || !folders.includes('loras'))
    throw new Error('LoRA uploads are disabled for the staging smoke account')
  if (typeof workspace.id !== 'string')
    throw new Error('No staging workspace ID')
  return { auth, id: workspace.id }
}

async function requestBelongsToWorkspace(
  request: APIRequestContext,
  auth: string,
  workspaceId: string
): Promise<boolean> {
  try {
    const response = await request.get(`${cloud}/api/workspaces/current`, {
      headers: { Authorization: auth },
      maxRedirects: 0,
      timeout: 10_000
    })
    if (!response.ok()) {
      console.log(
        `Upload authorization could not be scoped (HTTP ${response.status()})`
      )
      return false
    }
    return (await response.json()).id === workspaceId
  } catch {
    return false
  }
}

const allowed = [
  editor,
  cloud,
  apiGateway,
  firebaseAuth,
  'https://securetoken.googleapis.com',
  'https://dreamboothy-dev.firebaseapp.com',
  'https://www.gstatic.com',
  'https://apis.google.com',
  'https://fonts.googleapis.com',
  'https://fonts.gstatic.com',
  'https://media.comfy.org',
  'https://testplatform.comfy.org',
  'https://storage.googleapis.com'
]

test.use({
  baseURL: editor,
  serviceWorkers: 'block',
  billingNewUx: false,
  liveNetworkOrigins: allowed
})

test('stores one synthetic model in the managed staging smoke workspace', async ({
  context,
  page,
  request
}, info) => {
  test.setTimeout(240_000)
  const { email, password, localFixture } = smokeInputs()
  const firebaseKey = await readStagingFirebaseKey(request)

  const workspace = { id: undefined as string | undefined }
  const verifiedAuthorizations = new Set<string>()
  let starts = 0
  const apiUpload = '/api/assets/uploads'

  await context.route('**/*', async (route) => {
    const req = route.request()
    const url = new URL(req.url())
    if (
      url.origin === firebaseAuth &&
      url.searchParams.get('key') !== firebaseKey
    ) {
      await route.abort('blockedbyclient')
      return
    }
    if (url.pathname.startsWith(apiUpload) && req.method() === 'POST') {
      const auth = await req.headerValue('authorization')
      const workspaceId = workspace.id
      if (url.origin !== cloud || !auth || !workspaceId) {
        console.log('Blocked model upload without verified staging scope')
        await route.abort('blockedbyclient')
        return
      }
      if (!verifiedAuthorizations.has(auth)) {
        if (!(await requestBelongsToWorkspace(request, auth, workspaceId))) {
          console.log('Blocked model upload for a different workspace')
          await route.abort('blockedbyclient')
          return
        }
        verifiedAuthorizations.add(auth)
      }
      if (url.pathname === apiUpload && starts++ !== 0) {
        await route.abort('blockedbyclient')
        return
      }
    }
    const storage =
      starts === 1 &&
      url.protocol === 'https:' &&
      /(?:^|\.)storage\.googleapis\.com$/.test(url.hostname)
    if (allowed.includes(url.origin) || storage) await route.fallback()
    else await route.abort('blockedbyclient')
  })

  const comfyPage = new ComfyPage(page, request)
  await comfyPage.goto()
  await comfyPage.waitForAppReady()
  const templates = page.getByRole('dialog', {
    name: 'Get Started with a Template',
    exact: true
  })
  if (await templates.isVisible())
    await templates
      .getByRole('button', { name: 'Close dialog', exact: true })
      .press('Escape')
  await comfyPage.workflow.loadWorkflow('openOnCloud/dplat3611-staging-upload')

  await page.getByTestId('cloud-button').click()
  const card = page.getByTestId('missing-models-card')
  await expect(card.getByText(filename)).toBeVisible()
  await card
    .getByRole('button', { name: 'Sign in to upload', exact: true })
    .click()
  const signIn = new SignInDialog(page)
  await signIn.emailInput.fill(email)
  await signIn.passwordInput.fill(password)
  const workspaceFeatures = new Array<Response>()
  page.on('response', (response) => {
    const url = new URL(response.url())
    if (url.origin === cloud && url.pathname === '/api/features') {
      console.log(`Staging feature response HTTP ${response.status()}`)
      if (!response.ok()) {
        void response
          .json()
          .then((body) => {
            const code = body?.code
            if (typeof code === 'string' && /^[A-Z_]{1,50}$/.test(code))
              console.log(`Staging feature error code: ${code}`)
          })
          .catch(() => {})
      }
      workspaceFeatures.push(response)
    }
    if (url.origin === cloud && url.pathname === apiUpload)
      console.log(`Cloud upload start responded HTTP ${response.status()}`)
  })
  page.on('requestfailed', (request) => {
    const url = new URL(request.url())
    if (url.origin === cloud || url.origin === firebaseAuth)
      console.log(
        `Browser request failed for ${url.origin}${url.pathname}: ${request.failure()?.errorText ?? 'unknown'}`
      )
  })
  const loginResponse = page.waitForResponse(
    (response) =>
      new URL(response.url()).origin === firebaseAuth &&
      new URL(response.url()).pathname === '/v1/accounts:signInWithPassword' &&
      response.request().method() === 'POST',
    { timeout: 25_000 }
  )
  await signIn.signInButton.click()
  const login = await loginResponse
  console.log(`Staging Firebase sign-in responded HTTP ${login.status()}`)
  if (!login.ok())
    throw new Error(`Managed staging sign-in failed (HTTP ${login.status()})`)
  await expect(signIn.emailInput).toBeHidden({ timeout: 25_000 })
  console.log('Local editor accepted the sign-in')
  let features: Response | undefined
  await expect
    .poll(
      async () => {
        for (const response of workspaceFeatures) {
          if (await response.request().headerValue('authorization')) {
            features = response
            return response.status()
          }
        }
      },
      { timeout: 25_000, message: 'Authorized staging API features' }
    )
    .toBe(200)
  if (!features) throw new Error('No authorized staging feature response')
  const verified = await verifyWorkspace(request, features)
  console.log('Verified managed account and eligible staging workspace')
  workspace.id = verified.id
  verifiedAuthorizations.add(verified.auth)

  await expect(
    card.getByRole('heading', { name: 'Upload 1 model', exact: true })
  ).toBeVisible()
  await card
    .getByLabel(`Choose file for ${filename}`)
    .setInputFiles(join(localFixture, filename))
  const accepted = page.waitForResponse(
    (response) =>
      new URL(response.url()).origin === cloud &&
      new URL(response.url()).pathname.startsWith(`${apiUpload}/`) &&
      new URL(response.url()).pathname.endsWith('/complete') &&
      response.request().method() === 'POST',
    { timeout: 35_000 }
  )
  await card.getByTestId('missing-models-upload').click()
  const completed = await accepted
  if (!completed.ok())
    throw new Error(`Staging completion failed (HTTP ${completed.status()})`)
  const { task_id: taskId } = await completed.json()
  if (typeof taskId !== 'string')
    throw new Error('Staging returned no storage task')
  console.log('Staging accepted the synthetic model upload')
  await page.waitForResponse(
    async (response) =>
      response.ok() &&
      response.url() === `${cloud}/api/tasks/${encodeURIComponent(taskId)}` &&
      (await response.json()).status === 'completed',
    { timeout: 90_000 }
  )
  console.log('Staging confirmed the stored model')
  const ready = page.getByTestId('run-on-cloud-card')
  await expect(ready).toBeVisible()
  expect(starts).toBe(1)
  await ready.screenshot({
    path: info.outputPath('staging-upload-verified.png')
  })
})
