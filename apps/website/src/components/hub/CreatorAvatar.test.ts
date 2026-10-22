import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import CreatorAvatar from './CreatorAvatar.vue'

describe('CreatorAvatar', () => {
  it.for([
    { name: 'purz', initial: 'P' },
    { name: '🎨 Studio', initial: '🎨' }
  ])(
    'shows $initial for $name when there is no avatar',
    ({ name, initial }) => {
      render(CreatorAvatar, { props: { name } })

      expect(screen.getByText(initial)).toBeTruthy()
    }
  )
})
