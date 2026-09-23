import { describe, expect, it } from 'vitest'

import { pushedRanges } from './lint-pushed'

const nullSha = '0'.repeat(40)

describe('pushedRanges', () => {
  it.for([
    ['nothing', '', []],
    [
      'an update of a branch the remote already has',
      `refs/heads/feature abc123 refs/heads/feature def456\n`,
      [{ localSha: 'abc123', remoteSha: 'def456' }]
    ],
    [
      'a new branch, which has no remote sha to diff against',
      `refs/heads/feature abc123 refs/heads/feature ${nullSha}\n`,
      [{ localSha: 'abc123', remoteSha: undefined }]
    ],
    [
      'a branch deletion, which pushes no commits',
      `(delete) ${nullSha} refs/heads/feature def456\n`,
      []
    ],
    [
      'several refs in one push',
      [
        `refs/heads/a 111 refs/heads/a 222`,
        `refs/heads/b 333 refs/heads/b ${nullSha}`
      ].join('\n'),
      [
        { localSha: '111', remoteSha: '222' },
        { localSha: '333', remoteSha: undefined }
      ]
    ]
  ] as const)('reads %s', ([, input, expected]) => {
    expect(pushedRanges(input)).toEqual(expected)
  })
})
