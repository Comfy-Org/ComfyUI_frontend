import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import {
  PACK_RENDERERS,
  PACK_TAGS,
  addPackNode,
  expectPackLoaded,
  keepMixlabOffNodeDrawHooks,
  nodeValue,
  showEmptyGraphAtZoomOne
} from '@e2e/fixtures/helpers/nodes2AcceptancePacks'
import {
  NEW_LABEL,
  renameFirstInput
} from '@e2e/fixtures/helpers/nodes2AcceptancePacks.useeverywhere'

for (const renderer of PACK_RENDERERS) {
  test.describe(
    `cg-use-everywhere on ${renderer.name}`,
    { tag: [...PACK_TAGS, '@node', ...renderer.tags] },
    () => {
      test.beforeEach(async ({ comfyPage }) => {
        await expectPackLoaded(comfyPage, 'cg-use-everywhere')
        await keepMixlabOffNodeDrawHooks(comfyPage)
        await showEmptyGraphAtZoomOne(comfyPage)
      })

      test('an input slot on a Use Everywhere node can be renamed', async ({
        comfyPage
      }) => {
        const id = await addPackNode(
          comfyPage,
          'Anything Everywhere',
          [300, 200],
          [260, 80]
        )

        await renameFirstInput(comfyPage, id, 'anything')

        await expect
          .poll(() => nodeValue(comfyPage, id, ['inputs', '0', 'label']))
          .toBe(NEW_LABEL)
      })

      test('control: an input slot on an ordinary node can be renamed the same way', async ({
        comfyPage
      }) => {
        const id = await addPackNode(
          comfyPage,
          'VAEDecode',
          [300, 200],
          [260, 80]
        )

        await renameFirstInput(comfyPage, id, 'samples')

        await expect
          .poll(() => nodeValue(comfyPage, id, ['inputs', '0', 'label']))
          .toBe(NEW_LABEL)
      })
    }
  )
}
