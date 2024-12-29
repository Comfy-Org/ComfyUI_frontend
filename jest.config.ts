import type { JestConfigWithTsJest } from 'ts-jest'

const jestConfig: JestConfigWithTsJest = {
  testMatch: ['**/tests-ui/**/*.test.ts'],
  testEnvironment: 'jsdom',
  moduleFileExtensions: ['js', 'jsx', 'json', 'vue', 'ts', 'tsx'],
  transform: {
    '^.+\\.vue$': '@vue/vue3-jest',
    '^.+\\.m?[tj]sx?$': [
      'ts-jest',
      {
        tsconfig: './tsconfig.json',
        babelConfig: './babel.config.json'
      }
    ]
  },
  transformIgnorePatterns: ['/node_modules/(?!(three|@three)/)'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy'
  },
  clearMocks: true,
  resetModules: true,
  setupFiles: ['./tests-ui/tests/globalSetup.ts']
}

export default jestConfig
