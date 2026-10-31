import userEvent from '@testing-library/user-event'
import { screen } from '@testing-library/vue'

export function clipTiles() {
  return screen.getAllByTestId('video-concat-clip')
}

export function placeClipTiles() {
  for (const [index, tile] of clipTiles().entries()) {
    tile.getBoundingClientRect = () =>
      DOMRect.fromRect({ x: index * 100, y: 0, width: 96, height: 54 })
  }
}

export function pressClipTile(tile: HTMLElement, clientX: number) {
  return userEvent.pointer({
    keys: '[MouseLeft>]',
    target: tile,
    coords: { clientX }
  })
}
