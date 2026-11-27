import type { IConfiguration } from 'dependency-cruiser'
import { escapeRegExp } from 'es-toolkit'

import jobQueue from './docs/architecture/domains/records/job-queue.domain.json' with { type: 'json' }

export default {
  forbidden: [
    {
      name: 'no-circular',
      severity: 'error',
      from: {},
      to: { circular: true }
    },
    {
      name: 'assets-core-is-independent-of-application-runtime',
      severity: 'error',
      from: { path: '^packages/assets-core/src/' },
      to: {
        path: '^(src/|packages/(api-client|account-core|account-ui|graph-model)/|node_modules/(vue|pinia|@vueuse)/|node_modules/\\.pnpm/[^/]+/node_modules/(vue|pinia|@vueuse)/)'
      }
    },
    {
      name: 'api-client-does-not-import-application',
      severity: 'error',
      from: { path: '^packages/api-client/src/' },
      to: { path: '^src/' }
    },
    {
      name: 'queue-consumers-use-public-entry-points',
      severity: 'error',
      from: { path: '^src/', pathNot: '^src/platform/queue/' },
      to: {
        path: '^src/platform/queue/',
        pathNot: jobQueue.publicEntryPoints.map(
          (path) => `^${escapeRegExp(path)}$`
        )
      }
    },
    {
      name: 'agent-feedback-through-platform-support',
      severity: 'error',
      from: { path: '^src/workbench/extensions/agent/' },
      to: { path: '^src/platform/surveys/openTypeformDialog\\.ts$' }
    },
    {
      name: 'workspace-does-not-own-billing-or-account-ui',
      severity: 'error',
      from: { path: '^src/platform/workspace/' },
      to: { path: '^src/platform/(billing|account)/' }
    },
    {
      name: 'billing-uses-workspace-ports',
      severity: 'error',
      from: { path: '^src/platform/billing/' },
      to: { path: '^src/platform/workspace/(api|stores|composables)/' }
    },
    {
      name: 'billing-does-not-own-account-ui',
      severity: 'error',
      from: { path: '^src/platform/billing/' },
      to: { path: '^src/platform/account/' }
    },
    {
      name: 'shared-ingest-is-domain-independent',
      severity: 'error',
      from: { path: '^src/platform/remote/ingest/' },
      to: { path: '^src/platform/(workspace|billing|account)/' }
    }
  ],
  options: {
    tsConfig: { fileName: 'tsconfig.json' },
    tsPreCompilationDeps: 'specify',
    doNotFollow: { path: 'node_modules' },
    exclude: {
      path: [
        '\\.(test|spec|stories)\\.ts$',
        '/__tests?__/',
        '/test/',
        '^src/__ecs_matrix__/'
      ]
    },
    enhancedResolveOptions: {
      extensions: ['.ts', '.mts', '.js', '.vue', '.json'],
      mainFields: ['module', 'main', 'types']
    }
  }
} satisfies IConfiguration
