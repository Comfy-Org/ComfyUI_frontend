import type { IConfiguration } from 'dependency-cruiser'

const config: IConfiguration = {
  options: {
    tsConfig: { fileName: 'tsconfig.json' },
    tsPreCompilationDeps: 'specify',
    doNotFollow: { path: 'node_modules' },
    exclude: {
      path: ['\\.(test|spec|stories)\\.ts$', '/__tests__/', '/test/']
    },
    enhancedResolveOptions: {
      extensions: ['.ts', '.mts', '.js', '.vue', '.json'],
      mainFields: ['module', 'main', 'types']
    }
  }
}

export default config
