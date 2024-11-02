import type { JestConfigWithTsJest } from 'ts-jest'
import baseConfig from './jest.config.base'

const jestConfig: JestConfigWithTsJest = {
  ...baseConfig,
  displayName: 'fast',
  setupFiles: ['./tests-ui/tests/fast/globalSetup.ts'],
  setupFilesAfterEnv: undefined,
  testMatch: ['**/tests-ui/tests/fast/**/*.test.ts']
}

export default jestConfig
