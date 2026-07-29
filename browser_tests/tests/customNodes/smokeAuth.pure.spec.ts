import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import {
  SMOKE_ENV_VARS,
  missingSmokeEnvVars
} from '@e2e/fixtures/helpers/smokeAuth'

test.describe('missingSmokeEnvVars', () => {
  test('names exactly the absent or empty variables', () => {
    expect(missingSmokeEnvVars({})).toEqual([...SMOKE_ENV_VARS])
    expect(
      missingSmokeEnvVars({
        SMOKE_ACCOUNT_EMAIL: 'cloud-test@comfy.org',
        SMOKE_ACCOUNT_PASSWORD: 'secret'
      })
    ).toEqual([])
    expect(
      missingSmokeEnvVars({
        SMOKE_ACCOUNT_PASSWORD: ''
      })
    ).toEqual(['SMOKE_ACCOUNT_EMAIL', 'SMOKE_ACCOUNT_PASSWORD'])
  })
})
