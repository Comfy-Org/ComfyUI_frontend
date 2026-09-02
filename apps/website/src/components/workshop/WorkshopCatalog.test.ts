// @vitest-environment happy-dom
import { render, screen } from '@testing-library/vue'
import { afterEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'

import { usePrototypeTweaks } from '../../composables/usePrototypeTweaks'
import WorkshopCatalog from './WorkshopCatalog.vue'

const { entry } = usePrototypeTweaks()

afterEach(() => {
  entry.value = 'workshop'
})

describe('WorkshopCatalog', () => {
  it('starts on the models catalog and swaps to the V2 Hub entry when the tweak asks', async () => {
    render(WorkshopCatalog, { props: { models: [] } })
    expect(screen.getByTestId('workshop-hero')).toBeTruthy()
    expect(screen.queryByTestId('workshop-hub')).toBeNull()

    entry.value = 'hub'
    await nextTick()
    expect(screen.getByTestId('workshop-hub')).toBeTruthy()
    expect(screen.queryByTestId('workshop-hero')).toBeNull()
  })
})
