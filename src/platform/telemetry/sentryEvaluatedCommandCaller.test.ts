import type { ErrorEvent } from '@sentry/vue'
import { defaultStackParser } from '@sentry/vue'
import { describe, expect, it } from 'vitest'

import { sentryBeforeSend } from './sentryBeforeSend'

const STORE_FRAME =
  'at Proxy.execute (https://cloud.comfy.org/assets/commandStore-Dy_oX36E.js:1:8533)'
const PINIA_FRAME =
  'at wrappedAction (https://cloud.comfy.org/assets/vendor-vue-core-Dx3pCY9M.js:4:16131)'

function commandErrorEvent(
  value: string,
  ...callerLines: string[]
): ErrorEvent {
  const stack = [`Error: ${value}`, STORE_FRAME, PINIA_FRAME, ...callerLines]
  return {
    type: undefined,
    exception: {
      values: [
        {
          type: 'Error',
          value,
          stacktrace: { frames: defaultStackParser(stack.join('\n')) }
        }
      ]
    }
  }
}

const UNKNOWN_COMMAND = 'Command Comfy.CloseWorkflow not found'

describe('Sentry origin of a rejected unknown command', () => {
  it.for([
    UNKNOWN_COMMAND,
    'Command  not found',
    'Command missing command not found'
  ])('marks code evaluated in the page as third party: %s', (value) => {
    const event = commandErrorEvent(value, 'at <anonymous>:1:38')

    expect(sentryBeforeSend(event, {})?.tags?.error_origin).toBe('third_party')
  })

  it.for([
    {
      name: 'a bundled caller',
      caller:
        'at HTMLButtonElement.onclick (https://cloud.comfy.org/assets/settingStore-C3KhBREl.js:207:137197)'
    },
    {
      name: 'an engine builtin called by the bundle',
      caller: 'at Array.forEach (<anonymous>)'
    }
  ])('keeps paging for $name', ({ caller }) => {
    const event = commandErrorEvent(UNKNOWN_COMMAND, caller)

    expect(sentryBeforeSend(event, {})).toEqual(event)
  })

  it('does not reclassify other errors thrown under evaluated code', () => {
    const event = commandErrorEvent('Graph not ready', 'at <anonymous>:1:38')

    expect(sentryBeforeSend(event, {})).toEqual(event)
  })

  it('keeps an unknown command with no stack', () => {
    const event: ErrorEvent = {
      type: undefined,
      exception: { values: [{ type: 'Error', value: UNKNOWN_COMMAND }] }
    }

    expect(sentryBeforeSend(event, {})).toEqual(event)
  })

  it('preserves existing tags', () => {
    const event = {
      ...commandErrorEvent(UNKNOWN_COMMAND, 'at <anonymous>:1:38'),
      tags: { surface: 'platform' }
    }

    expect(sentryBeforeSend(event, {})?.tags).toEqual({
      surface: 'platform',
      error_origin: 'third_party'
    })
  })
})
