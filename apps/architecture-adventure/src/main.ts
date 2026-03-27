import './style/theme.css'
import './style/layout.css'
import './style/hud.css'
import './style/room.css'
import './style/challenge.css'
import './style/sidebar.css'
import './style/map.css'
import './style/animations.css'

function main(): void {
  const app = document.getElementById('app')
  if (!app) throw new Error('Missing #app element')
  app.textContent = 'Codebase Caverns v2 — Loading...'
}

main()
