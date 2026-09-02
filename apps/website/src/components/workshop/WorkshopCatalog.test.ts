// @vitest-environment happy-dom
import { render, screen } from '@testing-library/vue'
import { afterEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'

import { usePrototypeTweaks } from '../../composables/usePrototypeTweaks'
import WorkshopCatalog from './WorkshopCatalog.vue'

const { entry } = usePrototypeTweaks()

afterEach(() => {
  entry.value = 'hub'
})

describe('WorkshopCatalog', () => {
  it('starts on the Hub-style entry and swaps to the models catalog when the tweak asks', async () => {
    render(WorkshopCatalog, { props: { models: [] } })
    expect(screen.getByTestId('workshop-hub')).toBeTruthy()
    expect(screen.queryByTestId('workshop-hero')).toBeNull()

    entry.value = 'workshop'
    await nextTick()
    expect(screen.getByTestId('workshop-hero')).toBeTruthy()
    expect(screen.queryByTestId('workshop-hub')).toBeNull()
  })
})
