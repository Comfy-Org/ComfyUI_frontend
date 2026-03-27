import './style/theme.css'
import './style/layout.css'
import './style/hud.css'
import './style/room.css'
import './style/challenge.css'
import './style/sidebar.css'
import './style/map.css'
import './style/animations.css'

import { isV1Save, loadSave } from '@/state/gameState'
import { enterRoom, initGameState, subscribe } from '@/engine/stateMachine'
import { mountApp, render } from '@/ui/renderer'

function main(): void {
  if (isV1Save()) {
    console.warn('Codebase Caverns v1 save detected. Starting fresh for v2.')
  }

  const save = loadSave()
  mountApp()
  initGameState(save)
  subscribe(render)
  enterRoom(save.currentRun.currentRoom)
}

main()
