export interface TestRef {
  title: string
  context?: string
}

export interface Requirement {
  group: string
  text: string
  tests?: TestRef[]
  notTested?: string
}

const t = (title: string, context?: string): TestRef => ({ title, context })

const DECIDE =
  'Nodes 2.0 differs in a way that may be better; tested once the team records whether to accept it.'

const INPUTS: Requirement[] = [
  {
    group: 'Size and layout',
    text: 'Widget row height is 20 px',
    tests: [t('widget rows are 20 px tall')]
  },
  {
    group: 'Size and layout',
    text: 'Gap between widget rows is 4 px (row pitch 24 px)',
    tests: [t('widget rows are 24 px apart')]
  },
  {
    group: 'Size and layout',
    text: 'Single-line text, labelled toggle and upload combo rows are 20 px on a 24 px pitch',
    tests: [t('single-line text and labelled toggle rows are 20 px tall')]
  },
  {
    group: 'Size and layout',
    text: 'Slot (socket) rows are 20 px apart',
    tests: [t('consecutive link-only input sockets are 20 px apart')]
  },
  {
    group: 'Size and layout',
    text: 'First socket centre is 14 px below the body top',
    tests: [
      t(
        'the first input and output sockets are centred 14 px below the body top'
      )
    ]
  },
  {
    group: 'Size and layout',
    text: 'Input socket x is node x + 10',
    tests: [t('input sockets sit 10 px inside the left edge of the node')]
  },
  {
    group: 'Size and layout',
    text: 'Output socket x is node x + width − 9',
    tests: [t('output sockets sit 9 px inside the right edge of the node')]
  },
  {
    group: 'Size and layout',
    text: 'Unhighlighted socket dot is 8 px across',
    tests: [t('a socket dot is 8 px across')]
  },
  {
    group: 'Size and layout',
    text: 'Title bar is 30 px tall',
    tests: [t('the title bar is 30 px tall')]
  },
  {
    group: 'Size and layout',
    text: 'Title font is 14 px',
    tests: [t('node title text is 14 px')]
  },
  {
    group: 'Size and layout',
    text: 'Widget label and value font is 12 px',
    tests: [t('widget label and value text is 12 px')]
  },
  {
    group: 'Size and layout',
    text: 'Widgets are inset 15 px from each side of the node',
    tests: [t('widgets are inset 15 px from each side of the node')]
  },
  {
    group: 'Size and layout',
    text: 'Minimum node width with widgets is 210 px',
    tests: [t('a node with widgets cannot be resized narrower than 210 px')]
  },
  {
    group: 'Size and layout',
    text: 'A node is drawn exactly as tall as its saved size',
    tests: [t('a node is drawn exactly as tall as its saved size')]
  },
  {
    group: 'Size and layout',
    text: 'Load Image’s saved size includes its image preview',
    tests: [
      t('Load Image with an image saves a size that includes the preview')
    ]
  },
  {
    group: 'Size and layout',
    text: 'Multiline text node is at least 400 × 200',
    tests: [t('a multiline text node is at least 400 × 200')]
  },
  {
    group: 'Size and layout',
    text: 'widget.last_y is the top of the drawn row',
    tests: [t('widget.last_y is the top of the drawn widget row')]
  },
  {
    group: 'Size and layout',
    text: 'Switching renderers keeps the size of a Load Image node with a preview',
    tests: [
      t(
        'switching renderers keeps the size of a Load Image node showing an image'
      )
    ]
  },
  {
    group: 'Value behaviour',
    text: 'Number drag moves one step per screen pixel, at any value and zoom',
    tests: [t('dragging a number moves it one step per screen pixel')]
  },
  {
    group: 'Value behaviour',
    text: 'Number drag starts from the first pixel (no threshold)',
    notTested: DECIDE
  },
  {
    group: 'Value behaviour',
    text: 'Double-click window is 300 ms',
    notTested:
      'Depends on exact event timing; a browser test cannot measure it without false results.'
  },
  {
    group: 'Value behaviour',
    text: 'Number arrows have a 40 px hit zone at each end',
    notTested:
      'The Nodes 2.0 button edge is 1–3 px from the boundary, too close to test without false results.'
  },
  {
    group: 'Value behaviour',
    text: 'Clicking away from a number being typed discards the edit',
    tests: [t('clicking away from a number being typed keeps the old value')]
  },
  {
    group: 'Value behaviour',
    text: 'A typed number may be a maths expression',
    tests: [t('typing a maths expression into a number stores its result')]
  },
  {
    group: 'Value behaviour',
    text: 'Number fields have no arrow-key or Page Up/Down stepping',
    notTested: DECIDE
  },
  {
    group: 'Value behaviour',
    text: 'Numbers display with toFixed at their precision',
    tests: [t('a number shows its value formatted by toFixed at its precision')]
  },
  {
    group: 'Value behaviour',
    text: 'Numbers above the maximum are clamped to the maximum',
    tests: [t('typing a number above its maximum stores the maximum')]
  },
  {
    group: 'Value behaviour',
    text: 'A wrong decimal separator is rejected',
    tests: [t('typing a comma decimal in English leaves the number unchanged')]
  },
  {
    group: 'Value behaviour',
    text: 'Slider value follows the click position without snapping to step',
    tests: [t('clicking 37% along a slider sets 37% of its range')]
  },
  {
    group: 'Value behaviour',
    text: 'Read-only slider ignores drags',
    tests: [t('a read-only slider ignores drags')]
  },
  {
    group: 'Value behaviour',
    text: 'Knob is drawn',
    tests: [t('a knob widget is drawn')]
  },
  {
    group: 'Value behaviour',
    text: 'Next combo arrow stops at the last option',
    tests: [t('the next arrow on the last combo option keeps the last option')]
  },
  {
    group: 'Value behaviour',
    text: 'From an invalid value, previous combo arrow goes to the first option',
    tests: [
      t('stepping back from an invalid combo value selects the first option')
    ]
  },
  {
    group: 'Value behaviour',
    text: 'Combo list filter matches labels only',
    notTested: DECIDE
  },
  {
    group: 'Value behaviour',
    text: 'Combo list keys: ↑ wraps, → selects last',
    tests: [
      t(
        'arrow up from the first option of an open combo list wraps to the last'
      ),
      t('arrow right in an open combo list jumps to the last option')
    ]
  },
  {
    group: 'Value behaviour',
    text: 'A combo with object-valued options lists their labels',
    tests: [t('a combo whose values are an object lists their labels')]
  },
  {
    group: 'Value behaviour',
    text: 'Single-line text reports its value once, on commit',
    tests: [
      t(
        'a single-line text widget reports its value once, when typing is committed'
      )
    ]
  },
  {
    group: 'Value behaviour',
    text: 'Disabled toggle ignores clicks',
    tests: [t('a disabled toggle with on/off labels ignores clicks')]
  },
  {
    group: 'Value behaviour',
    text: 'Button keeps its value and passes position and event to its callback',
    tests: [
      t(
        'a button keeps its value and passes the click position and event to its callback'
      )
    ]
  },
  {
    group: 'Value behaviour',
    text: 'Upload combos step through files with previous/next arrows',
    tests: [t('Load Image steps to the next file with its next arrow')]
  },
  {
    group: 'Value behaviour',
    text: 'Control after generate shows the stored mode',
    tests: [
      t(
        'control after generate set to increment-wrap is not shown as randomize'
      )
    ]
  },
  {
    group: 'Events, states and menus',
    text: 'A value change calls onWidgetChanged, bumps the graph version and syncs the bound property',
    tests: [
      t(
        'a value change notifies the node, bumps the graph version and syncs the bound property'
      )
    ]
  },
  {
    group: 'Events, states and menus',
    text: 'A disabled widget hides its value',
    tests: [t('a disabled number hides its value')]
  },
  {
    group: 'Events, states and menus',
    text: 'A linked widget keeps its 24 px row',
    tests: [t('a linked widget keeps a 24 px row pitch')]
  },
  {
    group: 'Events, states and menus',
    text: 'Dragging a link over a node reveals compatible widget sockets',
    tests: [t('dragging a link over a node reveals a compatible widget socket')]
  },
  {
    group: 'Events, states and menus',
    text: 'Widget right-click lists Favorite and Rename first',
    tests: [
      t('right-clicking a widget lists Favorite Widget and Rename Widget first')
    ]
  },
  {
    group: 'Events, states and menus',
    text: 'Tooltip shows the widget description only',
    notTested: DECIDE
  },
  ...[
    {
      group: 'Size and layout',
      text: 'Highlighted socket dot is 10 px across'
    },
    {
      group: 'Size and layout',
      text: 'Save and reopen in the other renderer preserves links'
    },
    {
      group: 'Value behaviour',
      text: 'Numbers below the minimum are clamped to the minimum'
    },
    { group: 'Value behaviour', text: 'Read-only slider ignores clicks' },
    { group: 'Value behaviour', text: 'Knob can be dragged' },
    {
      group: 'Value behaviour',
      text: 'Previous combo arrow stops at the first option'
    },
    {
      group: 'Value behaviour',
      text: 'From an invalid value, next combo arrow selects the first option'
    },
    {
      group: 'Value behaviour',
      text: 'Combo list keys: ↓ wraps, ← selects first'
    },
    { group: 'Events, states and menus', text: 'Linked widget name is dimmed' }
  ].map((requirement) => ({
    ...requirement,
    notTested: 'No scenario exercises this complementary behavior yet.'
  }))
]

const NOT_INSTALLED =
  'Pack not in the suite yet; the expected loss is from a source read only.'

const PACKS: Requirement[] = [
  {
    group: 'rgthree-comfy',
    text: 'Image Comparer: Slide and Click modes',
    tests: [
      t(
        'Image Comparer (run output delivered by an `executed` message) shows image B left of the hovered point'
      ),
      t(
        'Image Comparer in Click mode (comparer_mode property) shows image B while the button is held'
      )
    ]
  },
  {
    group: 'rgthree-comfy',
    text: 'Reroute: Shift+Z move shortcut',
    tests: [t('Reroute moves with the pointer while Shift+Z is held')]
  },
  {
    group: 'rgthree-comfy',
    text: 'Reroute: label',
    tests: [t('Reroute draws its title as a label when showLabel is set')]
  },
  {
    group: 'rgthree-comfy',
    text: 'Mute / Bypass Relay: status text',
    tests: [
      t(
        'Mute / Bypass Relay draws its mode mapping when it differs from the default'
      )
    ]
  },
  {
    group: 'rgthree-comfy',
    text: 'Label: double-click opens properties',
    tests: [t('Label opens its properties panel on double-click')]
  },
  {
    group: 'rgthree-comfy',
    text: 'Power LoRA toggle and strength arrows',
    tests: [
      t('Power Lora Loader row toggles off and steps strength up when clicked')
    ]
  },
  {
    group: 'rgthree-comfy',
    text: 'Fast Groups Bypasser toggle',
    tests: [
      t(
        'Fast Groups Bypasser bypasses the nodes of a group when its toggle is clicked'
      )
    ]
  },
  {
    group: 'rgthree-comfy',
    text: 'Fast Muter toggle',
    notTested:
      'Covered by the shared toggle code in the Fast Groups Bypasser test; no test of its own yet.'
  },
  {
    group: 'comfyui-custom-scripts',
    text: 'Workflow Image export (PNG) contains the nodes',
    tests: [t('Workflow Image export (PNG) contains the nodes of the graph')]
  },
  {
    group: 'comfyui-custom-scripts',
    text: 'Math Expression result readout',
    tests: [
      t(
        'Math Expression shows its result (run output delivered by an `executed` message)'
      )
    ]
  },
  {
    group: 'comfyui-custom-scripts',
    text: 'Autocomplete in prompt boxes',
    tests: [t('Autocomplete offers words while typing in a prompt box')]
  },
  {
    group: 'comfyui-custom-scripts',
    text: 'Preset Text missing-preset warning',
    tests: [
      t('Preset Text marks itself red when its preset is missing at queue time')
    ]
  },
  {
    group: 'comfyui-impact-pack',
    text: 'Mask Rect Area preview',
    tests: [
      t('Mask Rect Area preview draws the area and follows the width widget')
    ]
  },
  {
    group: 'comfyui-impact-pack',
    text: 'Progress badge',
    tests: [
      t(
        'Iterative upscale shows a progress badge (status from an `impact/update_status` message)'
      )
    ]
  },
  {
    group: 'comfyui-impact-pack',
    text: 'Red X on SEGM output',
    notTested:
      'Only drawn for a node in Impact-Subpack, which needs ultralytics (too large to install for the suite).'
  },
  {
    group: 'comfyui-mixlab-nodes',
    text: 'Grid Input and SVG Image overlays',
    tests: [
      t('Grid Input overlay buttons sit inside the node and follow a pan'),
      t('SVG Image overlay upload field sits inside the node and follows a pan')
    ]
  },
  {
    group: 'comfyui-mixlab-nodes',
    text: 'Mixlab badge',
    tests: [t('Node badge with the node id is drawn above the node')]
  },
  {
    group: 'comfyui_custom_nodes_alekpet',
    text: 'IDE node UPDATE toggle',
    tests: [t('IDE node UPDATE toggle switches off when clicked')]
  },
  {
    group: 'comfyui_custom_nodes_alekpet',
    text: 'IDE type labels',
    tests: [t('IDE node labels its slots with their types')]
  },
  {
    group: 'comfyui_custom_nodes_alekpet',
    text: 'Speech / recognition overlay',
    tests: [
      t(
        'Speech and recognition buttons overlay the CLIP Text Encode prompt (enabled by its setting)'
      )
    ]
  },
  {
    group: 'crt-nodes',
    text: 'Magic LoRA Loader controls',
    tests: [
      t('Magic LoRA Loader Dry / Wet steps up when its + arrow is clicked')
    ]
  },
  {
    group: 'crt-nodes',
    text: 'YuE2 Music Generator: run output',
    tests: [
      t(
        'YuE Music Generator loads its run output (delivered by an `executed` message)'
      )
    ]
  },
  {
    group: 'comfyui-mxtoolkit',
    text: 'Slider and Slider 2D',
    tests: [
      t('Slider draws its knob and commits the dragged value on release'),
      t('Slider 2D draws its knob and commits the dragged point on release')
    ]
  },
  {
    group: 'comfyui-mxtoolkit',
    text: 'Seed and Stop title buttons',
    tests: [
      t('Seed title button is drawn and a click picks a new seed and queues'),
      t('Stop title button is drawn and a click queues the workflow')
    ]
  },
  {
    group: 'comfyui-mxtoolkit',
    text: 'Reroute dot shape',
    tests: [
      t(
        'Reroute is a titleless dot whose input sits at the top centre when inputDir is UP'
      )
    ]
  },
  {
    group: 'comfy-mtb',
    text: 'Note+ display and edit',
    tests: [
      t('Note+ displays its markdown rendered as HTML inside the node'),
      t(
        'Note+ edit icon opens the editor and the note shows the edited markdown'
      )
    ]
  },
  {
    group: 'comfy-mtb',
    text: 'Note+ edit icon is drawn',
    tests: [t('Note+ draws its edit icon in the title bar')]
  },
  {
    group: 'comfy-mtb',
    text: 'Help "?" popup',
    tests: [t('Help "?" in the title opens the node documentation popup')]
  },
  {
    group: 'comfyui_fill-nodes',
    text: 'Gradient Image Generator editor',
    tests: [
      t('Gradient Image Generator draws its gradient preview'),
      t(
        'Gradient Image Generator adds a stop on click and drops a picked stop on release'
      )
    ]
  },
  {
    group: 'comfyui_fill-nodes',
    text: 'Bullet Hell and Tetris games',
    tests: [
      t('Bullet Hell draws its game field with the ship and enemies'),
      t('Tetris draws its playfield with a falling piece')
    ]
  },
  {
    group: 'comfyui_fill-nodes',
    text: 'Save Images folder view',
    tests: [
      t('Save Images shows its folder tree and removes the folder picked in it')
    ]
  },
  {
    group: 'comfyui_fill-nodes',
    text: 'Image Adjuster preview',
    tests: [
      t(
        'Image Adjuster draws the adjusted image it receives (fl_image_adjuster event)'
      )
    ]
  },
  {
    group: 'bjornulf_custom_nodes',
    text: 'Images Compare slider',
    tests: [
      t(
        'Images Compare (run output delivered by an `executed` message) splits the two images where it is clicked'
      )
    ]
  },
  {
    group: 'deno-custom-nodes',
    text: 'Image Compare hover and modes',
    tests: [
      t(
        'Image Compare (run output delivered by an `executed` message) moves the split to the hovered point'
      ),
      t(
        'Image Compare (run output delivered by an `executed` message) redraws as a difference when Difference is clicked'
      )
    ]
  },
  {
    group: 'deno-custom-nodes',
    text: 'Resolution helper crop drag',
    tests: [t('Resize Box crop position moves when the crop box is dragged')]
  },
  {
    group: 'deno-custom-nodes',
    text: 'Multi-LoRA toggles',
    tests: [t('Multi-LoRA row toggle turns the LoRA off and repaints the row')]
  },
  {
    group: 'deno-custom-nodes',
    text: 'Multi-LoRA, Image Compare, Resize Box layout',
    tests: [
      t('Multi-LoRA keeps the backend widgets it hides out of the layout'),
      t('Image Compare keeps the backend widgets it hides out of the layout'),
      t(
        'Resize Box keeps the size widgets it hides in Preset Ratio mode out of the layout'
      )
    ]
  },
  {
    group: 'comfyui-easy-use',
    text: 'Image Chooser (Always Pause): pick an image and confirm',
    tests: [
      t(
        'Image Chooser paused in Always Pause (`easyuse-image-choose` event) lets the user pick an image and confirm it'
      )
    ]
  },
  {
    group: 'cg-use-everywhere',
    text: 'Rename an input slot on a UE node',
    tests: [t('an input slot on a Use Everywhere node can be renamed')]
  },
  {
    group: 'cg-use-everywhere',
    text: 'Control: rename an input slot on an ordinary node',
    tests: [
      t(
        'control: an input slot on an ordinary node can be renamed the same way'
      )
    ]
  },
  {
    group: 'comfyui-kjnodes',
    text: 'Set/Get nodes and virtual links; Spline and Points editors',
    tests: [
      t(
        'Get node takes the name, title and type of a Set node picked from its combo'
      ),
      t(
        'Set node with Show connections (drawConnection) draws a virtual link to its Get node'
      ),
      t('Spline Editor adds a control point on Shift+click'),
      t('Points Editor adds a positive point on Shift+click')
    ]
  },
  {
    group: 'comfyui-kjnodes',
    text: 'Help "?" button',
    tests: [t('clicking the centre of the help "?" opens the node description')]
  },
  {
    group: 'comfyui-videohelpersuite',
    text: 'Load Video upload and preview',
    tests: [
      t(
        'Load Video upload button uploads the chosen file and shows its preview'
      )
    ]
  },
  {
    group: 'comfyui-videohelpersuite',
    text: 'Drag the node by its video preview',
    tests: [t('dragging the video preview moves the node')]
  },
  {
    group: 'comfyui-videohelpersuite',
    text: '"?" help button',
    tests: [
      t('clicking the "?" at the right end of the title opens the node help')
    ]
  },
  {
    group: 'comfyui-rmbg',
    text: 'Image Compare View; colour swatch',
    tests: [
      t(
        'Image Compare View shows both run images (`executed` message) and moves the split to the pointer'
      ),
      t(
        'COLORCODE swatch shows its colour and opens the colour picker on click'
      )
    ]
  },
  {
    group: 'efficiency-nodes-comfyui',
    text: 'LoRA Stacker row hiding; seed button',
    tests: [
      t('LoRA Stacker shows as many LoRA rows as lora_count'),
      t('KSampler (Efficient) seed button sets the seed to -1')
    ]
  },
  {
    group: 'efficiency-nodes-comfyui',
    text: 'KSampler (Efficient) GIF preview',
    tests: [
      t(
        'KSampler (Efficient) preview from an `executed` gifs output sits inside the node and follows a pan'
      )
    ]
  },
  {
    group: 'comfyui-inspire-pack',
    text: 'Progress badge above node',
    notTested: NOT_INSTALLED
  },
  {
    group: 'comfyui-wd14-tagger',
    text: 'Status badge',
    notTested: NOT_INSTALLED
  },
  {
    group: 'comfyui-tooling-nodes',
    text: 'Decorative node icon',
    notTested: NOT_INSTALLED
  },
  {
    group: 'comfyui_layerstyle',
    text: 'No loss expected',
    notTested: NOT_INSTALLED
  },
  {
    group: 'comfyui_tinyterranodes',
    text: 'No loss expected',
    notTested: NOT_INSTALLED
  },
  {
    group: 'Comfyui-Resolution-Master',
    text: 'No loss expected',
    notTested: NOT_INSTALLED
  }
]

const ZOOMED_OUT_1000 =
  'Classic itself misses this absolute target at 1,000 nodes, so the paired control cannot pass; needs restating as a ratio to classic.'

const PERF: Requirement[] = [
  {
    group: 'Load and memory',
    text: 'Load at 1,000 nodes: time to interactive and heap within 1.5× classic',
    tests: [
      t(
        'loading reaches interactive within 1.5x classic time and heap',
        '1000 nodes'
      )
    ]
  },
  {
    group: 'Load and memory',
    text: 'Load at 200 nodes: time to interactive and heap within 1.5× classic',
    tests: [
      t(
        'loading reaches interactive within 1.5x classic time and heap',
        '200 nodes'
      )
    ]
  },
  {
    group: 'Load and memory',
    text: 'Visit the whole graph then return: heap within 1.5× classic at 1,000 nodes',
    tests: [
      t(
        'heap after visiting the whole graph and returning is within 1.5x classic',
        '1000 nodes'
      )
    ]
  },
  {
    group: 'Load and memory',
    text: 'Visit the whole graph then return: heap within 1.5× classic at 200 nodes',
    tests: [
      t(
        'heap after visiting the whole graph and returning is within 1.5x classic',
        '200 nodes'
      )
    ]
  },
  {
    group: 'Load and memory',
    text: 'Stress at 2,000 and 4,000 nodes: load, heap, idle, typing',
    notTested: 'Runs nightly with @slow; not part of this run.'
  },
  {
    group: 'Responsiveness',
    text: 'Typing key-to-paint within 1.2× classic at 1,000 nodes',
    tests: [
      t(
        'typing in a prompt paints each key within 1.2x classic latency',
        '1000 nodes'
      )
    ]
  },
  {
    group: 'Responsiveness',
    text: 'Typing key-to-paint within 1.2× classic at 200 nodes',
    tests: [
      t(
        'typing in a prompt paints each key within 1.2x classic latency',
        '200 nodes'
      )
    ]
  },
  {
    group: 'Responsiveness',
    text: 'Idle main-thread busy within 1.5× classic at 1,000 nodes',
    tests: [
      t('idle main-thread busy time is within 1.5x classic', '1000 nodes')
    ]
  },
  {
    group: 'Responsiveness',
    text: 'Idle main-thread busy within 1.5× classic at 200 nodes',
    notTested:
      'Both renderers idle at 1.5–2.3 % here, so the ratio of two tiny numbers sits on the 1.5× bar; needs an absolute floor.'
  },
  {
    group: 'Frame times',
    text: 'Pan at working zoom: p95 ≤ 33 ms at 1,000 nodes',
    tests: [
      t(
        'panning at working zoom keeps p95 frame time within 33 ms',
        '1000 nodes'
      )
    ]
  },
  {
    group: 'Frame times',
    text: 'Pan at working zoom: p95 ≤ 33 ms at 200 nodes',
    tests: [
      t(
        'panning at working zoom keeps p95 frame time within 33 ms',
        '200 nodes'
      )
    ]
  },
  {
    group: 'Frame times',
    text: 'Pan zoomed out to fit the whole graph: p95 ≤ 33 ms at 200 nodes',
    tests: [
      t(
        'panning with the whole graph in view keeps p95 frame time within 33 ms',
        '200 nodes'
      )
    ]
  },
  {
    group: 'Frame times',
    text: 'Pan zoomed out to fit the whole graph: p95 ≤ 33 ms at 1,000 nodes',
    notTested: ZOOMED_OUT_1000
  },
  {
    group: 'Frame times',
    text: 'Zoom sweep across the zoomed-out threshold: worst frame ≤ 50 ms at 200 nodes',
    tests: [
      t(
        'a zoom sweep across the low-quality threshold has no frame over 50 ms',
        '200 nodes'
      )
    ]
  },
  {
    group: 'Frame times',
    text: 'Zoom sweep at 1,000 nodes: worst frame ≤ 50 ms',
    notTested: ZOOMED_OUT_1000
  },
  {
    group: 'Frame times',
    text: 'Drag one node: p95 ≤ 33 ms at 200 nodes (working zoom and zoomed out)',
    tests: [
      t(
        'dragging one node at working zoom keeps p95 frame time within 33 ms',
        '200 nodes'
      ),
      t(
        'dragging one node with the whole graph in view keeps p95 frame time within 33 ms',
        '200 nodes'
      )
    ]
  },
  {
    group: 'Frame times',
    text: 'Drag 50 selected nodes: p95 ≤ 33 ms at 200 nodes (working zoom and zoomed out)',
    tests: [
      t(
        'dragging 50 selected nodes at working zoom keeps p95 frame time within 33 ms',
        '200 nodes'
      ),
      t(
        'dragging 50 selected nodes with the whole graph in view keeps p95 frame time within 33 ms',
        '200 nodes'
      )
    ]
  },
  {
    group: 'Frame times',
    text: 'Drag one node and drag 50 at 1,000 nodes: p95 ≤ 33 ms',
    notTested:
      'Nodes 2.0 p95 sits on the 33/50 ms refresh boundary, so the verdict flips between runs; needs a main-thread time ratio.'
  },
  {
    group: 'Frame times',
    text: 'Select all and drag, zoomed out: median ≥ 30 FPS',
    notTested: ZOOMED_OUT_1000
  },
  {
    group: 'Frame times',
    text: 'Execution progress updates: p95 ≤ 33 ms',
    notTested: 'No test written yet.'
  }
]

/** The acceptance document's requirements per Playwright project, in document order. */
export const REQUIREMENTS: Record<string, Requirement[]> = {
  'nodes2-acceptance': INPUTS,
  'nodes2-acceptance-packs': PACKS,
  'nodes2-acceptance-perf': PERF
}
