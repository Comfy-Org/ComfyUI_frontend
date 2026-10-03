import type { ErrorEvent } from '@sentry/vue'
import { afterEach, describe, expect, it } from 'vitest'

import { prepareSentryEvent } from './vueDirectiveErrorDiagnostics'

afterEach(() => {
  document.head.querySelectorAll('script').forEach((script) => script.remove())
})

describe('prepareSentryEvent', () => {
  it('adds runtime and asset evidence to a Vue directive failure', () => {
    const script = document.createElement('script')
    Object.defineProperty(script, 'src', {
      value: 'http://localhost:3000/assets/vendor-vue-core.abc123.js'
    })
    document.head.append(script)
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

    const prepared = prepareSentryEvent(event, {})

    expect(prepared).toMatchObject({
      tags: {
        diagnostic: 'vue_directive_runtime',
        array_iterator_callable: true,
        array_iterator_unchanged: true
      },
      contexts: {
        vue_directive_runtime: {
          array_iterator_native: true,
          first_party_script_paths: ['/assets/vendor-vue-core.abc123.js']
        }
      }
    })
  })

  it('leaves unrelated errors unchanged', () => {
    const event = {
      type: undefined,
      exception: { values: [{ value: 'Application failed' }] }
    } satisfies ErrorEvent

    expect(prepareSentryEvent(event, {})).toBe(event)
  })
})
