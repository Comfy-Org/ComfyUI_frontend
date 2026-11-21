import { expect } from '@playwright/test'
import type { APIRequestContext, Page, Response } from '@playwright/test'
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

async function enableUploadRolloutForSmoke(page: Page) {
  let reported = false
  await page.route(`${cloud}/api/features`, async (route) => {
    if (route.request().method() !== 'GET') return route.fallback()
    const response = await route.fetch({ maxRedirects: 0 })
    if (!response.ok()) return route.fulfill({ response })
    const features = await response.json()
    if (!reported) {
      reported = true
      console.log(
        `Native frontend upload rollout enabled: ${features.open_on_cloud_model_upload_enabled === true}`
      )
    }
    await route.fulfill({
      response,
      json: { ...features, open_on_cloud_model_upload_enabled: true }
    })
  })
}

async function routeCustomerBootstrapToStagingApi(page: Page) {
  await page.route(`${cloud}/customers`, async (route) => {
    if (route.request().method() !== 'POST') return route.fallback()
    const response = await route.fetch({
      url: `${apiGateway}/customers`,
      maxRedirects: 0
    })
    console.log(`Staging customer bootstrap HTTP ${response.status()}`)
    await route.fulfill({ response })
  })
}

function safeRefusalCode(body: unknown): string {
  if (!body || typeof body !== 'object' || !('code' in body)) return 'unknown'
  return typeof body.code === 'string' && /^[A-Z_]{1,60}$/.test(body.code)
    ? body.code
    : 'unknown'
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
  const starts = {
    attempted: 0,
    accepted: 0,
    resumableRefused: undefined as Promise<boolean> | undefined
  }
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
      if (url.pathname === apiUpload) {
        const legacyFallback =
          starts.attempted === 1 &&
          req.postDataJSON().resumable === false &&
          (await starts.resumableRefused)
        if (starts.attempted && !legacyFallback) {
          console.log('Blocked an extra staging upload attempt')
          await route.abort('blockedbyclient')
          return
        }
        starts.attempted++
      }
    }
    const storage =
      starts.accepted === 1 &&
      url.protocol === 'https:' &&
      /(?:^|\.)storage\.googleapis\.com$/.test(url.hostname)
    if (allowed.includes(url.origin) || storage) await route.fallback()
    else await route.abort('blockedbyclient')
  })

  await enableUploadRolloutForSmoke(page)
  await routeCustomerBootstrapToStagingApi(page)
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
    if (
      url.origin === cloud &&
      url.pathname === apiUpload &&
      response.request().method() === 'POST'
    ) {
      const mode =
        response.request().postDataJSON().resumable === false
          ? 'single-request'
          : 'resumable'
      console.log(
        `Cloud ${mode} upload start responded HTTP ${response.status()}`
      )
      if (response.ok()) {
        starts.accepted++
      } else {
        const refused = response
          .json()
          .then((body: unknown) => {
            const code = safeRefusalCode(body)
            console.log(`Cloud ${mode} upload refusal: ${code}`)
            return code === 'FEATURE_DISABLED'
          })
          .catch(() => false)
        if (mode === 'resumable') starts.resumableRefused = refused
      }
    }
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
  console.log('Verified managed account and staging workspace')
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
  const refused = page.waitForResponse(
    async (response) => {
      if (response.url() !== `${cloud}${apiUpload}` || response.ok())
        return false
      if (response.request().method() !== 'POST') return false
      if (response.request().postDataJSON().resumable === false) return true
      return (
        safeRefusalCode(await response.json().catch(() => null)) !==
        'FEATURE_DISABLED'
      )
    },
    { timeout: 35_000 }
  )
  const outcome = Promise.race([
    accepted.then((response) => ({ completed: true as const, response })),
    refused.then((response) => ({ completed: false as const, response }))
  ])
  await card.getByTestId('missing-models-upload').click()
  const { completed: wasCompleted, response: completed } = await outcome
  if (!wasCompleted || !completed.ok()) {
    const code = safeRefusalCode(await completed.json().catch(() => null))
    throw new Error(
      `Staging upload ${wasCompleted ? 'completion' : 'start'} failed (HTTP ${completed.status()}, ${code})`
    )
  }
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
  expect(starts.accepted).toBe(1)
  console.log(
    'Compatibility recheck cleared the missing model and offered Open on Comfy Cloud'
  )
  await ready.screenshot({
    path: info.outputPath('staging-upload-verified.png')
  })
})
