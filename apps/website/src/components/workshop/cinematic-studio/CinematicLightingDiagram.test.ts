import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'
import CinematicLightingDiagram from './CinematicLightingDiagram.vue'

describe('lighting diagram', () => {
  it('describes empty rigs, updated positions, colors and strengths without simulating light', async () => {
    const { rerender } = render(CinematicLightingDiagram, {
      props: { lights: [] }
    })
    const diagram = screen.getByRole('img', { name: 'Lighting positions' })
    expect(diagram).toHaveAccessibleDescription(
      'Add a light to see its position here.'
    )
    await rerender({
      lights: [
        { position: 'left', color: '#ff0000', brightness: 80, diffusion: 40 },
        { position: 'top', color: '#00ff00', brightness: 0, diffusion: 100 },
        { position: 'left', color: '#0000ff', brightness: 50, diffusion: 20 }
      ]
    })
    expect(diagram).toHaveAccessibleDescription(
      'Light 1: Left, #ff0000, Brightness 80%, Diffusion 40%; Light 2: Above, #00ff00, Brightness 0%, Diffusion 100%; Light 3: Left, #0000ff, Brightness 50%, Diffusion 20%'
    )
    expect(screen.getByText('Light 3 · Left · 50%')).toBeVisible()
    expect(screen.getByText(/This is not a relighting preview/)).toBeVisible()
    await rerender({ lights: [] })
    expect(screen.queryByText('Light 3 · Left · 50%')).not.toBeInTheDocument()
  })

  it('localizes the subject, camera, height and marker descriptions', () => {
    render(CinematicLightingDiagram, {
      props: {
        locale: 'zh-CN',
        lights: [
          {
            position: 'bottom',
            color: '#ffffff',
            brightness: 60,
            diffusion: 60
          }
        ]
      }
    })
    expect(
      screen.getByRole('img', { name: '灯光位置' })
    ).toHaveAccessibleDescription(
      '灯光 1: 下方, #ffffff, 亮度 60%, 柔光程度 60%'
    )
    expect(screen.getByText('相机')).toBeInTheDocument()
    expect(screen.getByText('高度')).toBeInTheDocument()
  })
})
