import { comfyPageFixture } from '@e2e/fixtures/ComfyPage'
import { PublishedBlueprintHelper } from '@e2e/fixtures/helpers/PublishedBlueprintHelper'
import { UserDataHelper } from '@e2e/fixtures/helpers/UserDataHelper'

export const publishedBlueprintFixture = comfyPageFixture.extend<{
  publishedBlueprint: PublishedBlueprintHelper
}>({
  publishedBlueprint: async ({ comfyPage }, use) => {
    const blueprint = new PublishedBlueprintHelper(
      comfyPage.page,
      new UserDataHelper(comfyPage.request, comfyPage.id, comfyPage.url)
    )
    await use(blueprint)
    await blueprint.teardown()
  }
})
