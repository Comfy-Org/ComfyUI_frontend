import { comfyExpect as expect } from '@e2e/fixtures/ComfyPage'
import { compositorFixture as test } from '@e2e/fixtures/compositorFixture'

test.use({ initialSettings: { 'Comfy.Queue.History.Expanded': true } })

test(
  'shows the selected concurrent job’s compositor result after a saved edit',
  {
    tag: ['@vue-nodes', '@ui']
  },
  async ({ comfyPage, compositor, queuedExecution }) => {
    const { preview } = compositor
    const { queuePanel, runButton } = comfyPage

    await test.step('arrange the dog and render the saved composition', async () => {
      const initial = await queuedExecution.capture(() => runButton.click())
      initial.start()
      initial.output('1', compositor.output('park.webp'))
      initial.finish()

      await compositor.openEditor.click()
      await compositor.dogLayer.click()
      await compositor.x.fill('12')
      await compositor.x.press('Tab')
      await expect(compositor.x).toHaveValue('12')
      await compositor.closeEditor.click()
      await expect(preview).toHaveAttribute('src', /^blob:/)

      const dog = await queuedExecution.capture(() => runButton.click())
      dog.start()
      dog.output('1', compositor.output('dog-result.webp'))
      dog.finish()
      await expect(preview).toHaveAttribute('src', /filename=dog-result\.webp/)
    })

    await test.step('keep the cat visible while the sheep run reports output', async () => {
      await compositor.prompt.fill('cat')
      const cat = await queuedExecution.capture(() => runButton.click())
      cat.start()
      await compositor.prompt.fill('sheep')
      const sheep = await queuedExecution.capture(() => runButton.click())
      sheep.start()
      await compositor.showRunningJobs(cat.id, sheep.id)

      cat.output('1', compositor.output('cat-result.webp'))
      await expect(preview).toHaveAttribute('src', /filename=cat-result\.webp/)

      sheep.output('1', compositor.output('sheep-result.webp'))
      sheep.progress('2', 4, 10)
      const sheepProgress = queuePanel.jobRow(sheep.id).getByText(': 40%')
      await expect(sheepProgress).toBeVisible()
      await expect(preview).toHaveAttribute('src', /filename=cat-result\.webp/)

      await sheepProgress.click()
      await expect(preview).toHaveAttribute(
        'src',
        /filename=sheep-result\.webp/
      )
    })
  }
)
