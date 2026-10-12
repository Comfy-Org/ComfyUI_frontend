import type { ErrorEvent } from '@sentry/vue'
import { describe, expect, it, vi } from 'vitest'

import { addVueDirectiveDiagnostics } from './vueDirectiveErrorDiagnostics'

function resource(name: string): PerformanceEntry {
  return {
    name,
    entryType: 'resource',
    startTime: 0,
    duration: 0,
    toJSON: () => ({})
  }
}

describe('addVueDirectiveDiagnostics', () => {
  it('adds the fetched module graph to a Vue directive failure', () => {
    vi.spyOn(performance, 'getEntriesByType').mockReturnValue([
      resource('http://localhost:3000/assets/vendor-vue-core.abc123.js'),
      resource('http://localhost:3000/assets/WorkflowTabs.def456.js'),
      resource('http://localhost:3000/api/user'),
      resource('https://example.com/assets/external.js')
    ])
    const event = {
      type: undefined,
      exception: {
        values: [
          {
            value: 'undefined is not a function',
            stacktrace: {
              frames: [
                {
                  filename: '/assets/vendor-vue-core.abc123.js',
                  function: 'withDirectives'
                }
              ]
            }
          }
        ]
      }
    } satisfies ErrorEvent

    expect(addVueDirectiveDiagnostics(event, {})).toMatchObject({
      tags: { diagnostic: 'vue_directive_runtime' },
      contexts: {
        vue_directive_runtime: {
          loaded_script_count: 2,
          first_party_script_paths: [
            '/assets/vendor-vue-core.abc123.js',
            '/assets/WorkflowTabs.def456.js'
          ]
        }
      }
    })
  })

  it.for([
    {
      name: 'matches a Vue-core frame with the directive failure message',
      filename: '/assets/vendor-vue-core.abc123.js',
      value: 'undefined is not a function',
      expected: 'vue_directive_runtime'
    },
    {
      name: 'ignores a Vue-core frame without the message',
      filename: '/assets/vendor-vue-core.abc123.js',
      value: 'Application failed',
      expected: undefined
    },
    {
      name: 'ignores the message outside Vue core',
      filename: '/assets/app.abc123.js',
      value: 'undefined is not a function',
      expected: undefined
    }
  ])('$name', ({ filename, value, expected }) => {
    const event = {
      type: undefined,
      exception: {
        values: [{ value, stacktrace: { frames: [{ filename }] } }]
      }
    } satisfies ErrorEvent

    expect(addVueDirectiveDiagnostics(event, {}).tags?.diagnostic).toBe(
      expected
    )
  })
})
