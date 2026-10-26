import { IdentityPersistenceHelper } from '@e2e/fixtures/helpers/IdentityPersistenceHelper'
import { networkIsolationFixture as base } from '@e2e/fixtures/networkIsolationFixture'

export const identityPersistenceFixture = base.extend<{
  identityPersistence: IdentityPersistenceHelper
}>({
  identityPersistence: async ({ page }, use) => {
    await use(new IdentityPersistenceHelper(page))
  }
})
