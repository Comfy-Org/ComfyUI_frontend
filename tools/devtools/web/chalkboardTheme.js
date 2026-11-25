import { app } from '../../scripts/app.js'

app.registerExtension({
  name: 'DevTools.ChalkboardTheme',
  themes: [
    {
      preset: {
        id: 'devtools-chalkboard',
        name: 'Chalkboard (DevTools)',
        stylesheet: 'devtools-chalkboard',
        colors: {
          node_slot: { MODEL: '#b7d3f2', CLIP: '#f7e3a1', LATENT: '#f2b8d0' },
          litegraph_base: {
            CLEAR_BACKGROUND_COLOR: '#22332b',
            NODE_DEFAULT_BGCOLOR: '#2c4036',
            NODE_DEFAULT_COLOR: '#355043',
            NODE_TITLE_COLOR: '#f4f1e8',
            LINK_COLOR: '#e8e4d8'
          },
          comfy_base: {
            'fg-color': '#f4f1e8',
            'bg-color': '#22332b',
            'comfy-menu-bg': '#1b2922',
            'comfy-input-bg': '#2c4036',
            'border-color': '#4d6b5c'
          }
        }
      },
      stylesheetUrl: new URL('./chalkboard.css', import.meta.url).href
    }
  ]
})
