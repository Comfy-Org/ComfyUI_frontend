const styles = `
  #maskEditorContainer {
    display: fixed;
  }
  #maskEditor_brush {
    position: absolute;
    backgroundColor: transparent;
    z-index: 8889;
    pointer-events: none;
    border-radius: 50%;
    overflow: visible;
    outline: 1px dashed black;
    box-shadow: 0 0 0 1px white;
  }
  #maskEditor_brushPreviewGradient {
    position: absolute;
    width: 100%;
    height: 100%;
    border-radius: 50%;
    display: none;
  }
  #maskEditor {
    display: block;
    width: 100%;
    height: 100vh;
    left: 0;
    z-index: 8888;
    position: fixed;
    background: rgba(50,50,50,0.75);
    backdrop-filter: blur(10px);
    overflow: hidden;
    user-select: none;
    --mask-editor-top-bar-height: 44px;
  }
  #maskEditor_sidePanelContainer {
    height: 100%;
    width: 220px;
    z-index: 8888;
    display: flex;
    flex-direction: column;
  }
  #maskEditor_sidePanel {
    background: var(--comfy-menu-bg);
    height: 100%;
    display: flex;
    align-items: center;
    overflow-y: auto;
    width: 220px;
    padding: 0 10px;
  }
  #maskEditor_sidePanelContent {
    width: 100%;
  }
  #maskEditor_sidePanelShortcuts {
    display: flex;
    flex-direction: row;
    width: 100%;
    margin-top: 10px;
    gap: 10px;
    justify-content: center;
  }
  .maskEditor_sidePanelIconButton {
    width: 40px;
    height: 40px;
    pointer-events: auto;
    display: flex;
    justify-content: center;
    align-items: center;
    transition: background-color 0.1s;
  }
  .maskEditor_sidePanelIconButton:hover {
    background-color: rgba(0, 0, 0, 0.2);
  }
  #maskEditor_sidePanelBrushSettings {
    display: flex;
    flex-direction: column;
    gap: 10px;
    width: 100%;
    padding: 10px;
  }
  .maskEditor_sidePanelTitle {
    text-align: center;
    font-size: 15px;
    font-family: sans-serif;
    color: var(--descrip-text);
    margin-top: 10px;
  }
  #maskEditor_sidePanelBrushShapeContainer {
    display: flex;
    width: 180px;
    height: 50px;
    border: 1px solid var(--border-color);
    pointer-events: auto;
    background: rgba(0, 0, 0, 0.2);
  }
  #maskEditor_sidePanelBrushShapeCircle {
    width: 35px;
    height: 35px;
    border-radius: 50%;
    border: 1px solid var(--border-color);
    pointer-events: auto;
    transition: background 0.1s;
    margin-left: 7.5px;
  }
  .maskEditor_sidePanelBrushRange {
    width: 180px;
    -webkit-appearance: none;
    appearance: none;
    background: transparent;
    cursor: pointer;
  }
  .maskEditor_sidePanelBrushRange::-webkit-slider-thumb {
    height: 20px;
    width: 20px;
    border-radius: 50%;
    cursor: grab;
    margin-top: -8px;
    background: var(--p-surface-700);
    border: 1px solid var(--border-color);
  }
  .maskEditor_sidePanelBrushRange::-moz-range-thumb {
    height: 20px;
    width: 20px;
    border-radius: 50%;
    cursor: grab;
    background: var(--p-surface-800);
    border: 1px solid var(--border-color);
  }
  .maskEditor_sidePanelBrushRange::-webkit-slider-runnable-track {
    background: var(--p-surface-700);
    height: 3px;
  }
  .maskEditor_sidePanelBrushRange::-moz-range-track {
    background: var(--p-surface-700);
    height: 3px;
  }

  #maskEditor_sidePanelBrushShapeSquare {
    width: 35px;
    height: 35px;
    margin: 5px;
    border: 1px solid var(--border-color);
    pointer-events: auto;
    transition: background 0.1s;
  }

  .maskEditor_brushShape_dark {
    background: transparent;
  }

  .maskEditor_brushShape_dark:hover {
    background: var(--p-surface-900);
  }

  .maskEditor_brushShape_light {
    background: transparent;
  }

  .maskEditor_brushShape_light:hover {
    background: var(--comfy-menu-bg);
  }

  #maskEditor_sidePanelImageLayerSettings {
    display: flex;
    flex-direction: column;
    gap: 10px;
    width: 100%;
    align-items: center;
  }
  .maskEditor_sidePanelLayer {
    display: flex;
    width: 100%;
    height: 50px;
  }
  .maskEditor_sidePanelLayerVisibilityContainer {
    width: 50px;
    height: 50px;
    border-radius: 8px;
    display: flex;
    justify-content: center;
    align-items: center;
  }
  .maskEditor_sidePanelVisibilityToggle {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    pointer-events: auto;
  }
  .maskEditor_sidePanelLayerIconContainer {
    width: 60px;
    height: 50px;
    border-radius: 8px;
    display: flex;
    justify-content: center;
    align-items: center;
    fill: var(--input-text);
  }
  .maskEditor_sidePanelLayerIconContainer svg {
    width: 30px;
    height: 30px;
  }
  #maskEditor_sidePanelMaskLayerBlendingContainer {
    width: 80px;
    height: 50px;
    border-radius: 8px;
    display: flex;
    justify-content: center;
    align-items: center;
  }
  #maskEditor_sidePanelMaskLayerBlendingSelect {
    width: 80px;
    height: 30px;
    border: 1px solid var(--border-color);
    background-color: rgba(0, 0, 0, 0.2);
    color: var(--input-text);
    font-family: sans-serif;
    font-size: 15px;
    pointer-events: auto;
    transition: background-color border 0.1s;
  }
  #maskEditor_sidePanelClearCanvasButton:hover {
    background-color: var(--p-overlaybadge-outline-color);
    border: none;
  }
  #maskEditor_sidePanelClearCanvasButton {
    width: 180px;
    height: 30px;
    border: none;
    background: rgba(0, 0, 0, 0.2);
    border: 1px solid var(--border-color);
    color: var(--input-text);
    font-family: sans-serif;
    font-size: 15px;
    pointer-events: auto;
    transition: background-color 0.1s;
  }
  #maskEditor_sidePanelClearCanvasButton:hover {
    background-color: var(--p-overlaybadge-outline-color);
  }
  #maskEditor_sidePanelHorizontalButtonContainer {
    display: flex;
    gap: 10px;
    height: 40px;
  }
  .maskEditor_sidePanelBigButton {
    width: 85px;
    height: 30px;
    border: none;
    background: rgba(0, 0, 0, 0.2);
    border: 1px solid var(--border-color);
    color: var(--input-text);
    font-family: sans-serif;
    font-size: 15px;
    pointer-events: auto;
    transition: background-color border 0.1s;
  }
  .maskEditor_sidePanelBigButton:hover {
    background-color: var(--p-overlaybadge-outline-color);
    border: none;
  }
  #maskEditor_toolPanel {
    height: 100%;
    width: 4rem;
    z-index: 8888;
    background: var(--comfy-menu-bg);
    display: flex;
    flex-direction: column;
  }
  .maskEditor_toolPanelContainer {
    width: 4rem;
    height: 4rem;
    display: flex;
    justify-content: center;
    align-items: center;
    position: relative;
    transition: background-color 0.2s;
  }
  .maskEditor_toolPanelContainerSelected svg {
    fill: var(--p-button-text-primary-color) !important;
  }
  .maskEditor_toolPanelContainerSelected .maskEditor_toolPanelIndicator {
    display: block;
  }
  .maskEditor_toolPanelContainer svg {
    width: 75%;
    aspect-ratio: 1/1;
    fill: var(--p-button-text-secondary-color);
  }

  .maskEditor_toolPanelContainerDark:hover {
    background-color: var(--p-surface-800);
  }

  .maskEditor_toolPanelContainerLight:hover {
    background-color: var(--p-surface-300);
  }

  .maskEditor_toolPanelIndicator {
    display: none;
    height: 100%;
    width: 4px;
    position: absolute;
    left: 0;
    background: var(--p-button-text-primary-color);
  }
  #maskEditor_sidePanelPaintBucketSettings {
    display: flex;
    flex-direction: column;
    gap: 10px;
    width: 100%;
    padding: 10px;
  }
  #canvasBackground {
    background: white;
    width: 100%;
    height: 100%;
  }
  #maskEditor_sidePanelButtonsContainer {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-top: 10px;
  }
  .maskEditor_sidePanelSeparator {
    width: 100%;
    height: 2px;
    background: var(--border-color);
    margin-top: 1.5em;
    margin-bottom: 5px;
  }
  #maskEditor_pointerZone {
    width: calc(100% - 4rem - 220px);
    height: 100%;
  }
  #maskEditor_uiContainer {
    width: 100%;
    height: 100%;
    position: absolute;
    z-index: 8888;
    display: flex;
    flex-direction: column;
  }
  #maskEditorCanvasContainer {
    position: absolute;
    width: 1000px;
    height: 667px;
    left: 359px;
    top: 280px;
  }
  #imageCanvas {
    width: 100%;
    height: 100%;
  }
  #maskCanvas {
    width: 100%;
    height: 100%;
  }
  #maskEditor_uiHorizontalContainer {
    width: 100%;
    height: calc(100% - var(--mask-editor-top-bar-height));
    display: flex;
  }
  #maskEditor_topBar {
    display: flex;
    height: var(--mask-editor-top-bar-height);
    align-items: center;
    background: var(--comfy-menu-bg);
    shrink: 0;
  }
  #maskEditor_topBarTitle {
    margin: 0;
    margin-left: 0.5rem;
    margin-right: 0.5rem;
    font-size: 1.2em;
  }
  #maskEditor_topBarButtonContainer {
    display: flex;
    gap: 10px;
    margin-right: 0.5rem;
    position: absolute;
    right: 0;
    width: 100%;
  }
  #maskEditor_topBarShortcutsContainer {
    display: flex;
    gap: 10px;
    margin-left: 5px;
  }

  .maskEditor_topPanelIconButton_dark {
    width: 50px;
    height: 30px;
    pointer-events: auto;
    display: flex;
    justify-content: center;
    align-items: center;
    transition: background-color 0.1s;
    background: var(--p-surface-800);
    border: 1px solid var(--p-form-field-border-color);
    border-radius: 10px;
  }

  .maskEditor_topPanelIconButton_dark:hover {
      background-color: var(--p-surface-900);
  }

  .maskEditor_topPanelIconButton_dark svg {
    width: 25px;
    height: 25px;
    pointer-events: none;
    fill: var(--input-text);
  }

  .maskEditor_topPanelIconButton_light {
    width: 50px;
    height: 30px;
    pointer-events: auto;
    display: flex;
    justify-content: center;
    align-items: center;
    transition: background-color 0.1s;
    background: var(--comfy-menu-bg);
    border: 1px solid var(--p-form-field-border-color);
    border-radius: 10px;
  }

  .maskEditor_topPanelIconButton_light:hover {
      background-color: var(--p-surface-300);
  }

  .maskEditor_topPanelIconButton_light svg {
    width: 25px;
    height: 25px;
    pointer-events: none;
    fill: var(--input-text);
  }

  .maskEditor_topPanelButton_dark {
    height: 30px;
    background: var(--p-surface-800);
    border: 1px solid var(--p-form-field-border-color);
    border-radius: 10px;
    color: var(--input-text);
    font-family: sans-serif;
    pointer-events: auto;
    transition: 0.1s;
    width: 60px;
  }

  .maskEditor_topPanelButton_dark:hover {
    background-color: var(--p-surface-900);
  }

  .maskEditor_topPanelButton_light {
    height: 30px;
    background: var(--comfy-menu-bg);
    border: 1px solid var(--p-form-field-border-color);
    border-radius: 10px;
    color: var(--input-text);
    font-family: sans-serif;
    pointer-events: auto;
    transition: 0.1s;
    width: 60px;
  }

  .maskEditor_topPanelButton_light:hover {
    background-color: var(--p-surface-300);
  }


  #maskEditor_sidePanelColorSelectSettings {
    flex-direction: column;
  }

  .maskEditor_sidePanel_paintBucket_Container {
    width: 180px;
    display: flex;
    flex-direction: column;
    position: relative;
  }

  .maskEditor_sidePanel_colorSelect_Container {
    display: flex;
    width: 180px;
    align-items: center;
    gap: 5px;
    height: 30px;
  }

  #maskEditor_sidePanelVisibilityToggle {
    position: absolute;
    right: 0;
  }

  #maskEditor_sidePanelColorSelectMethodSelect {
    position: absolute;
    right: 0;
    height: 30px;
    border-radius: 0;
    border: 1px solid var(--border-color);
    background: rgba(0,0,0,0.2);
  }

  #maskEditor_sidePanelVisibilityToggle {
    position: absolute;
    right: 0;
  }

  .maskEditor_sidePanel_colorSelect_tolerance_container {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-bottom: 10px;
  }

  .maskEditor_sidePanelContainerColumn {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding-bottom: 12px;
  }

  .maskEditor_sidePanelContainerRow {
    display: flex;
    flex-direction: row;
    gap: 10px;
    align-items: center;
    min-height: 24px;
    position: relative;
  }

  .maskEditor_accent_bg_dark {
    background: var(--p-surface-800);
  }

  .maskEditor_accent_bg_very_dark {
    background: var(--p-surface-900);
  }

  .maskEditor_accent_bg_light {
    background: var(--p-surface-300);
  }

  .maskEditor_accent_bg_very_light {
    background: var(--comfy-menu-bg);
  }

  #maskEditor_paintBucketSettings {
    display: none;
  }

  #maskEditor_colorSelectSettings {
    display: none;
  }

  .maskEditor_sidePanelToggleContainer {
    cursor: pointer;
    display: inline-block;
    position: absolute;
    right: 0;
  }

  .maskEditor_toggle_bg_dark {
    background: var(--p-surface-700);
  }

  .maskEditor_toggle_bg_light {
    background: var(--p-surface-300);
  }

  .maskEditor_sidePanelToggleSwitch {
    display: inline-block;
    border-radius: 16px;
    width: 40px;
    height: 24px;
    position: relative;
    vertical-align: middle;
    transition: background 0.25s;
  }
  .maskEditor_sidePanelToggleSwitch:before, .maskEditor_sidePanelToggleSwitch:after {
    content: "";
  }
  .maskEditor_sidePanelToggleSwitch:before {
    display: block;
    background: linear-gradient(to bottom, #fff 0%, #eee 100%);
    border-radius: 50%;
    width: 16px;
    height: 16px;
    position: absolute;
    top: 4px;
    left: 4px;
    transition: ease 0.2s;
  }
  .maskEditor_sidePanelToggleContainer:hover .maskEditor_sidePanelToggleSwitch:before {
    background: linear-gradient(to bottom, #fff 0%, #fff 100%);
  }
  .maskEditor_sidePanelToggleCheckbox:checked + .maskEditor_sidePanelToggleSwitch {
    background: var(--p-button-text-primary-color);
  }
  .maskEditor_sidePanelToggleCheckbox:checked + .maskEditor_toggle_bg_dark:before {
    background: var(--p-surface-900);
  }
  .maskEditor_sidePanelToggleCheckbox:checked + .maskEditor_toggle_bg_light:before {
    background: var(--comfy-menu-bg);
  }
  .maskEditor_sidePanelToggleCheckbox:checked + .maskEditor_sidePanelToggleSwitch:before {
    left: 20px;
  }

  .maskEditor_sidePanelToggleCheckbox {
    position: absolute;
    visibility: hidden;
  }

  .maskEditor_sidePanelDropdown_dark {
    border: 1px solid var(--p-form-field-border-color);
    background: var(--p-surface-900);
    height: 24px;
    padding-left: 5px;
    padding-right: 5px;
    border-radius: 6px;
    transition: background 0.1s;
  }

  .maskEditor_sidePanelDropdown_dark option {
    background: var(--p-surface-900);
  }

  .maskEditor_sidePanelDropdown_dark:focus {
    outline: 1px solid var(--p-button-text-primary-color);
  }

  .maskEditor_sidePanelDropdown_dark option:hover {
    background: white;
  }
  .maskEditor_sidePanelDropdown_dark option:active {
    background: var(--p-highlight-background);
  }

  .maskEditor_sidePanelDropdown_light {
    border: 1px solid var(--p-form-field-border-color);
    background: var(--comfy-menu-bg);
    height: 24px;
    padding-left: 5px;
    padding-right: 5px;
    border-radius: 6px;
    transition: background 0.1s;
  }

  .maskEditor_sidePanelDropdown_light option {
    background: var(--comfy-menu-bg);
  }

  .maskEditor_sidePanelDropdown_light:focus {
    outline: 1px solid var(--p-surface-300);
  }

  .maskEditor_sidePanelDropdown_light option:hover {
    background: white;
  }
  .maskEditor_sidePanelDropdown_light option:active {
    background: var(--p-surface-300);
  }

  .maskEditor_layerRow {
    height: 50px;
    width: 100%;
    border-radius: 10px;
  }

  .maskEditor_sidePanelLayerPreviewContainer {
    width: 40px;
    height: 30px;
  }

  .maskEditor_sidePanelLayerPreviewContainer > svg{
    width: 100%;
    height: 100%;
    object-fit: contain;
    fill: var(--p-surface-100);
  }

  #maskEditor_sidePanelImageLayerImage {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }

  .maskEditor_sidePanelSubTitle {
    text-align: left;
    font-size: 12px;
    font-family: sans-serif;
    color: var(--descrip-text);
  }

  .maskEditor_containerDropdown {
    position: absolute;
    right: 0;
  }

  .maskEditor_sidePanelLayerCheckbox {
    margin-left: 15px;
  }

  .maskEditor_toolPanelZoomIndicator {
    width: 4rem;
    height: 4rem;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    gap: 5px;
    color: var(--p-button-text-secondary-color);
    position: absolute;
    bottom: 0;
    transition: background-color 0.2s;
  }

  #maskEditor_toolPanelDimensionsText {
    font-size: 12px;
  }

  #maskEditor_topBarSaveButton {
    background: var(--p-primary-color) !important;
    color: var(--p-button-primary-color) !important;
  }

  #maskEditor_topBarSaveButton:hover {
    background: var(--p-primary-hover-color) !important;
  }

`

// Inject styles into document
const styleSheet = document.createElement('style')
styleSheet.type = 'text/css'
styleSheet.innerText = styles
document.head.appendChild(styleSheet)
