import {
  ComfyPage,
  comfyPageFixture as test,
  comfyExpect as expect
} from '@e2e/fixtures/ComfyPage'

test('normalizes the setup API base used by ComfyPage requests', async ({
  comfyPage,
  page,
  request
}) => {
  const setupApiUrl = process.env.PLAYWRIGHT_SETUP_API_URL
  const observedUrls: string[] = []
  const observedRequest = new Proxy(request, {
    get(target, property, receiver) {
      if (property !== 'post') return Reflect.get(target, property, receiver)

      return async (...args: Parameters<typeof request.post>) => {
        observedUrls.push(args[0])
        return await target.post(...args)
      }
    }
  })

  process.env.PLAYWRIGHT_SETUP_API_URL = `${comfyPage.apiUrl}/`
  try {
    const trailingSlashPage = new ComfyPage(page, observedRequest)
    await trailingSlashPage.setupSettings({ userId: comfyPage.id })
  } finally {
    if (setupApiUrl === undefined) delete process.env.PLAYWRIGHT_SETUP_API_URL
    else process.env.PLAYWRIGHT_SETUP_API_URL = setupApiUrl
  }

  expect(observedUrls).toEqual([
    `${comfyPage.apiUrl}/api/devtools/set_settings`
  ])
})
