import type {
  ActivePathPointer,
  DraftIndexV2,
  DraftPayloadV2,
  OpenPathsPointer
} from '@/platform/workflow/persistence/base/draftTypes'
import { StorageKeys } from '@/platform/workflow/persistence/base/storageKeys'
import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import { installCustomNodeBlankStartup } from '@e2e/fixtures/utils/customNodeSuite'

test('preseeds a restorable blank workflow before first boot', async ({
  page
}) => {
  const path = 'workflows/Custom Nodes E2E Blank Workflow.json'
  const draftKey = StorageKeys.draftKey(path)
  const keys = {
    index: StorageKeys.draftIndex('personal'),
    payload: StorageKeys.draftPayload(path, 'personal'),
    active: StorageKeys.lastActivePath('personal'),
    open: StorageKeys.lastOpenPaths('personal')
  }
  await installCustomNodeBlankStartup(page)
  await page.route('http://guard.test/', (route) =>
    route.fulfill({ contentType: 'text/html', body: '<html></html>' })
  )
  await page.goto('http://guard.test/')

  const state = await page.evaluate(
    ({ keys, path }) => {
      const index = JSON.parse(
        localStorage.getItem(keys.index)!
      ) as DraftIndexV2
      const payload = JSON.parse(
        localStorage.getItem(keys.payload)!
      ) as DraftPayloadV2
      return {
        storedKeys: Object.keys(localStorage)
          .filter((key) => key.startsWith('Comfy.Workflow.'))
          .sort(),
        index,
        payload,
        active: JSON.parse(
          localStorage.getItem(keys.active)!
        ) as ActivePathPointer,
        open: JSON.parse(localStorage.getItem(keys.open)!) as OpenPathsPointer,
        path
      }
    },
    { keys, path }
  )

  const { updatedAt } = state.index
  expect(state.storedKeys).toEqual(Object.values(keys).sort())
  expect(updatedAt).toEqual(expect.any(Number))
  expect(state.index).toEqual({
    v: 2,
    updatedAt,
    order: [draftKey],
    entries: {
      [draftKey]: {
        path,
        name: 'Custom Nodes E2E Blank Workflow.json',
        isTemporary: true,
        updatedAt
      }
    }
  })
  expect(state.payload).toEqual({
    data: JSON.stringify({
      last_node_id: 0,
      last_link_id: 0,
      nodes: [],
      links: [],
      groups: [],
      config: {},
      extra: {},
      version: 0.4
    }),
    updatedAt
  })
  expect(state.active).toEqual({ workspaceId: 'personal', path })
  expect(state.open).toEqual({
    workspaceId: 'personal',
    paths: [path],
    activeIndex: 0
  })
})
