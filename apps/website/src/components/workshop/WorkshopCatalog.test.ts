// @vitest-environment happy-dom
import { render, screen } from '@testing-library/vue'
import { afterEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'

import { usePrototypeTweaks } from '../../composables/usePrototypeTweaks'
import WorkshopCatalog from './WorkshopCatalog.vue'

const { version } = usePrototypeTweaks()

afterEach(() => {
  version.value = 'v1'
})

describe('WorkshopCatalog', () => {
  it('starts on the models catalog and swaps to the V2 screen when the tweak asks', async () => {
    render(WorkshopCatalog, { props: { models: [] } })
    expect(screen.getByTestId('workshop-hero')).toBeTruthy()
    expect(screen.queryByTestId('workshop-hub')).toBeNull()

    version.value = 'v2'
    await nextTick()
    expect(screen.getByTestId('workshop-hub')).toBeTruthy()
    expect(screen.queryByTestId('workshop-hero')).toBeNull()
  })
})
