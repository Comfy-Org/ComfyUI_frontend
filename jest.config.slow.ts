import type { JestConfigWithTsJest } from 'ts-jest'
import baseConfig from './jest.config.base'

const jestConfig: JestConfigWithTsJest = {
  ...baseConfig,
  displayName: 'slow (DOM)',
  testTimeout: 10000,
  testMatch: ['**/tests-ui/tests/slow/**/*.test.ts']
}

export default jestConfig
