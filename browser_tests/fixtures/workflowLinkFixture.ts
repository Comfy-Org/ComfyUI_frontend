import type { Page, Route } from '@playwright/test'

import type { UserDataFullInfo } from '@/types'
import type {
  ErrorResponse,
  WorkflowSidebarFileResponse
} from '@comfyorg/ingest-types'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import type { RemoteConfig } from '@/platform/remoteConfig/types'
import type { operations } from '@/types/comfyRegistryTypes'

import linkedWorkflow from '@e2e/assets/nodes/note_nodes.json' with { type: 'json' }
import {
  cloudAppExpect,
  cloudAppFixture,
  waitForCloudApp
} from '@e2e/fixtures/cloudAppFixture'
import {
  CLOUD_SELF_EMAIL,
  CloudAuthHelper
} from '@e2e/fixtures/helpers/CloudAuthHelper'
import {
  bootCloud,
  mockCloudBoot,
  preselectCloudUser
} from '@e2e/fixtures/utils/cloudBootMocks'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'
import type { WorkspaceStore } from '@e2e/types/globals'

const APP_URL = process.env.PLAYWRIGHT_TEST_URL || 'http://localhost:8188'
const BOOT_FEATURES = {} satisfies RemoteConfig
const BOOT_SETTINGS = {
  'Comfy.TutorialCompleted': true,
  'Comfy.Workflow.Persist': true
}

type CreateCustomerResponse =
  operations['createCustomer']['responses']['201']['content']['application/json']

export const workflowLinkScenario = {
  workflowId: '82b98188-0c8f-41d2-9b91-617b9152b809',
  path: 'workflows/links/linked-workflow.json',
  tabName: 'linked-workflow',
  notOpenedToast: enMessages.toastMessages.linkedWorkflowNotOpened
} as const

const linkedWorkflowBody = JSON.stringify(linkedWorkflow)

const listedFile: UserDataFullInfo = {
  path: workflowLinkScenario.path.slice('workflows/'.length),
  size: linkedWorkflowBody.length,
  modified: 1_793_000_000_000
}

const sidebarFile: WorkflowSidebarFileResponse = {
  ...listedFile,
  path: workflowLinkScenario.path
}

const outOfSync: ErrorResponse = {
  code: 'WORKFLOW_OUT_OF_SYNC',
  message: 'The workflow record does not match its sidebar file.',
  details: { reason: 'content_mismatch' }
}

function userdataFile(route: Route): string {
  const { pathname } = new URL(route.request().url())
  return decodeURIComponent(pathname.split('/userdata/')[1] ?? '')
}

class WorkflowLinkHelper {
  readonly linkUrl = `${APP_URL}/?workflowId=${workflowLinkScenario.workflowId}`
  private readonly savedPaths: string[] = []

  constructor(private readonly page: Page) {}

  async mockSignedIn(): Promise<void> {
    await this.mockBoot()
    await bootCloud(this.page)
  }

  async mockSignedOut(): Promise<void> {
    await this.mockBoot()
    await preselectCloudUser(this.page)
    await this.page.route('**/customers', (route) => {
      if (route.request().method() !== 'POST') return route.fallback()
      return route.fulfill({
        status: 201,
        json: { id: 'test-customer-e2e' } satisfies CreateCustomerResponse
      })
    })
    await new CloudAuthHelper(this.page).mockLiveEmailSignIn()
  }

  async serveLinkedFile(): Promise<void> {
    await this.page.route(this.sidebarFileUrl(), (route) =>
      route.fulfill(jsonRoute(sidebarFile))
    )
    await this.serveWorkflowsFolder()
  }

  async refuseLinkedFile(): Promise<void> {
    await this.page.route(this.sidebarFileUrl(), (route) =>
      route.fulfill({ status: 409, json: outOfSync })
    )
  }

  async open(url: string): Promise<void> {
    await this.page.goto(url)
    await waitForCloudApp(this.page)
  }

  async openWithRestoredTabs(): Promise<void> {
    await this.open(APP_URL)
    await this.page.reload()
    await waitForCloudApp(this.page)
  }

  async signInWithEmail(): Promise<void> {
    await cloudAppExpect(
      this.page.getByRole('heading', { name: 'Log in to your account' })
    ).toBeVisible()
    await this.page.getByRole('button', { name: 'Use email instead' }).click()
    await this.page.locator('#cloud-sign-in-email').fill(CLOUD_SELF_EMAIL)
    await this.page
      .locator('#cloud-sign-in-password')
      .fill('correct-horse-battery-staple')
    await this.page.locator('#cloud-sign-in-password').blur()
    await this.page.getByRole('button', { name: 'Sign in' }).click()
    await waitForCloudApp(this.page)
  }

  getActiveWorkflowPath(): Promise<string | undefined> {
    return this.page.evaluate(
      () =>
        (window.app!.extensionManager as WorkspaceStore).workflow.activeWorkflow
          ?.path
    )
  }

  hasLinkInUrl(): boolean {
    return new URL(this.page.url()).searchParams.has('workflowId')
  }

  getSavedWorkflowPaths(): string[] {
    return [...this.savedPaths]
  }

  private sidebarFileUrl(): string {
    return `**/api/workflows/${workflowLinkScenario.workflowId}/sidebar-file`
  }

  private async mockBoot(): Promise<void> {
    await mockCloudBoot(this.page, {
      features: BOOT_FEATURES,
      settings: BOOT_SETTINGS
    })
  }

  private async serveWorkflowsFolder(): Promise<void> {
    await this.page.route('**/api/userdata?*', (route) => {
      const request = route.request()
      const url = new URL(request.url())
      if (request.method() !== 'GET') return route.fallback()
      if (url.searchParams.get('dir') !== 'workflows') return route.fallback()
      return route.fulfill(jsonRoute([listedFile]))
    })

    await this.page.route('**/api/userdata/*', (route) => {
      const method = route.request().method()
      const file = userdataFile(route)
      if (method === 'GET' && file === workflowLinkScenario.path)
        return route.fulfill({
          contentType: 'application/json',
          body: linkedWorkflowBody
        })
      if (
        method !== 'POST' ||
        !file.startsWith('workflows/') ||
        file === 'workflows/.index.json'
      )
        return route.fallback()
      this.savedPaths.push(file)
      return route.fulfill(
        jsonRoute({ ...listedFile, path: file } satisfies UserDataFullInfo)
      )
    })
  }
}

export const workflowLinkFixture = cloudAppFixture.extend<{
  workflowLink: WorkflowLinkHelper
}>({
  workflowLink: async ({ page }, use) => {
    await use(new WorkflowLinkHelper(page))
  }
})

export { cloudAppExpect as expect }
