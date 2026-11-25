import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'

test.describe(
  'DOM widgets with native type collisions',
  { tag: ['@vue-nodes', '@widget'] },
  () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.workflow.loadWorkflow('nodes/plaguekind_simulacrum')
    })

    test('keeps pretend media tabs interactive alongside native text widgets', async ({
      comfyPage
    }) => {
      const node = comfyPage.vueNodes.getNodeLocator('1')
      const slots = node.getByRole('group', {
        name: 'Pretend media slots (test only)'
      })
      const image = node.getByRole('combobox', {
        name: 'image_slot',
        exact: true
      })
      const video = node.getByRole('combobox', {
        name: 'video_slot',
        exact: true
      })

      await test.step('renders extension DOM instead of a string editor', async () => {
        await expect(
          slots.getByRole('button', { name: 'I1: imaginary cat' })
        ).toHaveAttribute('aria-pressed', 'true')
        await expect(image).toBeVisible()
        await expect(video).toBeHidden()
        await expect(
          node.getByRole('button', { name: 'Cardboard preview: I1' })
        ).toBeVisible()
        await expect(
          node.getByText('Forbidden potato preview: canvas only, test only.')
        ).toBeHidden()
      })

      await test.step('original DOM listeners switch the visible native slots', async () => {
        await slots.getByRole('button', { name: 'V1: stunt potato' }).click()
        await expect(video).toBeVisible()
        await expect(image).toBeHidden()
        await node
          .getByRole('button', { name: 'Cardboard preview: V1' })
          .click()
        await expect(
          node.getByRole('button', { name: 'Potato applauds: V1' })
        ).toBeVisible()

        await slots.getByRole('button', { name: 'ALL: chaos mode' }).click()
        await expect(image).toBeVisible()
        await expect(video).toBeVisible()
        await expect(
          node.getByRole('button', { name: 'Potato applauds: V1' })
        ).toBeHidden()
      })

      await test.step('core multiline input keeps its native Vue editor', async () => {
        const caption = node.getByRole('textbox', {
          name: 'caption',
          exact: true
        })
        await expect(caption).toHaveValue(
          'Test-only impersonator. No media was harmed (or loaded).'
        )
        await caption.fill('The potato has declined its close-up.')
        await expect(caption).toHaveValue(
          'The potato has declined its close-up.'
        )
      })
    })
  }
)
