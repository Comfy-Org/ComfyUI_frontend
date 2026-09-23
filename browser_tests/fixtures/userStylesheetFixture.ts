import type { Request, Response } from '@playwright/test'

import { comfyPageFixture as base } from '@e2e/fixtures/ComfyPage'
import { UserDataHelper } from '@e2e/fixtures/helpers/UserDataHelper'

const FILES = ['user.css', 'ecs-pixel.png']

export interface StylesheetRequestEvidence {
  url: string
  resourceType: string
  comfyUser: string | undefined
  status: number | undefined
}

export interface UserStylesheetProbe {
  requests: StylesheetRequestEvidence[]
}

export const userStylesheetFixture = base.extend<{
  userStylesheetProbe: UserStylesheetProbe
}>({
  userStylesheetProbe: async ({ comfyPage }, use) => {
    const userData = new UserDataHelper(
      comfyPage.request,
      comfyPage.id,
      comfyPage.apiUrl
    )
    const requests = new Map<Request, StylesheetRequestEvidence>()
    const onRequest = (request: Request) => {
      if (!request.url().includes('/api/userdata/ecs-')) return
      requests.set(request, {
        url: request.url(),
        resourceType: request.resourceType(),
        comfyUser: request.headers()['comfy-user'],
        status: undefined
      })
    }
    const onResponse = (response: Response) => {
      const evidence = requests.get(response.request())
      if (evidence) evidence.status = response.status()
    }

    try {
      await userData.write(
        'user.css',
        [
          "@import url('data:text/css,:root%7B--ecs-imported-stylesheet:loaded%7D');",
          ':root { --ecs-main-stylesheet: loaded; }',
          "body::after { content: ''; position: fixed; inset: 0; border: 12px solid rgb(34, 102, 238); background: url('/api/userdata/ecs-pixel.png') 20px 20px / 32px 32px no-repeat; pointer-events: none; z-index: 2147483647; }"
        ].join('\n')
      )
      await userData.write(
        'ecs-pixel.png',
        Buffer.from(
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z/D/PwAG/gL+DHWJ3gAAAABJRU5ErkJggg==',
          'base64'
        )
      )

      comfyPage.page.on('request', onRequest)
      comfyPage.page.on('response', onResponse)
      await comfyPage.workflow.reloadAndWaitForApp()
      await use({
        get requests() {
          return [...requests.values()]
        }
      })
    } finally {
      comfyPage.page.off('request', onRequest)
      comfyPage.page.off('response', onResponse)
      await Promise.all(FILES.map((file) => userData.delete(file)))
    }
  }
})
