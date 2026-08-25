import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import WorkspaceProfilePic from './WorkspaceProfilePic.vue'

function renderPic(workspaceName: string) {
  return render(WorkspaceProfilePic, { props: { workspaceName } })
}

describe('WorkspaceProfilePic', () => {
  it('shows the first letter, uppercased', () => {
    renderPic('team comfy')
    expect(screen.getByText('T')).toBeInTheDocument()
  })

  it('keeps an astral first character intact instead of half a surrogate pair', () => {
    renderPic('🎨 studio')
    expect(screen.getByText('🎨')).toBeInTheDocument()
  })

  it('falls back when the name is empty', () => {
    renderPic('')
    expect(screen.getByText('?')).toBeInTheDocument()
  })
})
