<div align="center">

# ComfyUI_frontend

**Official front-end implementation of [ComfyUI](https://github.com/comfyanonymous/ComfyUI).**

[![Website][website-shield]][website-url]
[![Discord][discord-shield]][discord-url]
[![Matrix][matrix-shield]][matrix-url]
<br>
[![][github-release-shield]][github-release-link]
[![][github-release-date-shield]][github-release-link]
[![][github-downloads-shield]][github-downloads-link]
[![][github-downloads-latest-shield]][github-downloads-link]


[github-release-shield]: https://img.shields.io/github/v/release/Comfy-Org/ComfyUI_frontend?style=flat&sort=semver
[github-release-link]: https://github.com/Comfy-Org/ComfyUI_frontend/releases
[github-release-date-shield]: https://img.shields.io/github/release-date/Comfy-Org/ComfyUI_frontend?style=flat
[github-downloads-shield]: https://img.shields.io/github/downloads/Comfy-Org/ComfyUI_frontend/total?style=flat
[github-downloads-latest-shield]: https://img.shields.io/github/downloads/Comfy-Org/ComfyUI_frontend/latest/total?style=flat&label=downloads%40latest
[github-downloads-link]: https://github.com/Comfy-Org/ComfyUI_frontend/releases
[matrix-shield]: https://img.shields.io/badge/Matrix-000000?style=flat&logo=matrix&logoColor=white
[matrix-url]: https://app.element.io/#/room/%23comfyui_space%3Amatrix.org
[website-shield]: https://img.shields.io/badge/ComfyOrg-4285F4?style=flat
[website-url]: https://www.comfy.org/
[discord-shield]: https://img.shields.io/discord/1218270712402415686?style=flat&logo=discord&logoColor=white&label=Discord
[discord-url]: https://www.comfy.org/discord

</div>

## Release Schedule

The project follows a structured release process for each minor version, consisting of three distinct phases:

1. **Development Phase** - 1 week
   - Active development of new features
   - Code changes merged to the development branch

2. **Feature Freeze** - 1 week
   - No new features accepted
   - Only bug fixes are cherry-picked to the release branch
   - Testing and stabilization of the codebase

3. **Publication**
   - Release is published at the end of the freeze period
   - Version is finalized and made available to all users

### Nightly Releases
Nightly releases are published daily at [https://github.com/Comfy-Org/ComfyUI_frontend/releases](https://github.com/Comfy-Org/ComfyUI_frontend/releases).

To use the latest nightly release, add the following command line argument to your ComfyUI launch script:

```bat
--front-end-version Comfy-Org/ComfyUI_frontend@latest
```

## Overlapping Release Cycles
The development of successive minor versions overlaps. For example, while version 1.1 is in feature freeze, development for version 1.2 begins simultaneously.

### Example Release Cycle

| Week | Date Range | Version 1.1 | Version 1.2 | Version 1.3 | Patch Releases |
|------|------------|-------------|-------------|-------------|----------------|
| 1 | Mar 1-7 | Development | - | - | - |
| 2 | Mar 8-14 | Feature Freeze | Development | - | 1.1.0 through 1.1.6 (daily) |
| 3 | Mar 15-21 | Released | Feature Freeze | Development | 1.1.7 through 1.1.13 (daily)<br>1.2.0 through 1.2.6 (daily) |
| 4 | Mar 22-28 | - | Released | Feature Freeze | 1.2.7 through 1.2.13 (daily)<br>1.3.0 through 1.3.6 (daily) |

## Release Summary

### Major features

<details id='feature-native-translation'>
  <summary>v1.5: Native translation (i18n)</summary>

  ComfyUI now includes built-in translation support, replacing the need for third-party translation extensions. Select your language
  in `Comfy > Locale > Language` to translate the interface into English, Chinese (Simplified), Russian, Japanese, or Korean. This native
  implementation offers better performance, reliability, and maintainability compared to previous solutions.<br>

  More details available here: https://blog.comfy.org/p/native-localization-support-i18n
</details>

<details id='feature-mask-editor'>
  <summary>v1.4: New mask editor</summary>

  https://github.com/Comfy-Org/ComfyUI_frontend/pull/1284 implements a new mask editor.

  ![image](https://github.com/user-attachments/assets/f0ea6ee5-00ee-4e5d-a09c-6938e86a1f17)
</details>

<details id='feature-integrated-server-terminal'>
  <summary>v1.3.22: Integrated server terminal</summary>

Press Ctrl + ` to toggle integrated terminal.

https://github.com/user-attachments/assets/eddedc6a-07a3-4a83-9475-63b3977f6d94
</details>

<details id='feature-keybinding-customization'>
  <summary>v1.3.7: Keybinding customization</summary>

## Basic UI
![image](https://github.com/user-attachments/assets/c84a1609-3880-48e0-a746-011f36beda68)

## Reset button
![image](https://github.com/user-attachments/assets/4d2922da-bb4f-4f90-8017-a8e4a0db07c7)

## Edit Keybinding
![image](https://github.com/user-attachments/assets/77626b7a-cb46-48f8-9465-e03120aac66a)
![image](https://github.com/user-attachments/assets/79131a4e-75c6-4715-bd11-c6aaed887779)

[rec.webm](https://github.com/user-attachments/assets/a3984ed9-eb28-4d47-86c0-7fc3efc2b5d0)

</details>

<details id='feature-node-library-sidebar'>
  <summary>v1.2.4: Node library sidebar tab</summary>

  #### Drag & Drop
https://github.com/user-attachments/assets/853e20b7-bc0e-49c9-bbce-a2ba7566f92f

  #### Filter
https://github.com/user-attachments/assets/4bbca3ee-318f-4cf0-be32-a5a5541066cf
</details>

<details id='feature-queue-sidebar'>
  <summary>v1.2.0: Queue/History sidebar tab</summary>

  https://github.com/user-attachments/assets/86e264fe-4d26-4f07-aa9a-83bdd2d02b8f
</details>

<details id='feature-node-search'>
  <summary>v1.1.0: Node search box</summary>

  #### Fuzzy search & Node preview
  ![image](https://github.com/user-attachments/assets/94733e32-ea4e-4a9c-b321-c1a05db48709)

  #### Release link with shift
  https://github.com/user-attachments/assets/a1b2b5c3-10d1-4256-b620-345de6858f25
</details>

### QoL changes

<details id='feature-nested-group'>
  <summary>v1.3.32: **Litegraph** Nested group</summary>

https://github.com/user-attachments/assets/f51adeb1-028e-40af-81e4-0ac13075198a
</details>

<details id='feature-group-selection'>
  <summary>v1.3.24: **Litegraph** Group selection</summary>

https://github.com/user-attachments/assets/e6230a94-411e-4fba-90cb-6c694200adaa
</details>

<details id='feature-toggle-link-visibility'>
  <summary>v1.3.6: **Litegraph** Toggle link visibility</summary>

[rec.webm](https://github.com/user-attachments/assets/34e460ac-fbbc-44ef-bfbb-99a84c2ae2be)

</details>

<details id='feature-auto-widget-conversion'>
  <summary>v1.3.4: **Litegraph** Auto widget to input conversion</summary>

Dropping a link of correct type on node widget will automatically convert the widget to input.

[rec.webm](https://github.com/user-attachments/assets/15cea0b0-b225-4bec-af50-2cdb16dc46bf)

</details>

<details id='feature-pan-mode'>
  <summary>v1.3.4: **Litegraph** Canvas pan mode</summary>

The canvas becomes readonly in pan mode. Pan mode is activated by clicking the pan mode button on the canvas menu
or by holding the space key.

[rec.webm](https://github.com/user-attachments/assets/c7872532-a2ac-44c1-9e7d-9e03b5d1a80b)

</details>

<details id='feature-shift-drag-link-creation'>
  <summary>v1.3.1: **Litegraph** Shift drag link to create a new link</summary>

[rec.webm](https://github.com/user-attachments/assets/7e73aaf9-79e2-4c3c-a26a-911cba3b85e4)

</details>

<details id='feature-optional-input-donuts'>
  <summary>v1.2.62: **Litegraph** Show optional input slots as donuts</summary>

![GYEIRidb0AYGO-v](https://github.com/user-attachments/assets/e6cde0b6-654b-4afd-a117-133657a410b1)

</details>

<details id='feature-group-title-edit'>
  <summary>v1.2.44: **Litegraph** Double click group title to edit</summary>

https://github.com/user-attachments/assets/5bf0e2b6-8b3a-40a7-b44f-f0879e9ad26f

</details>

<details id='feature-group-selection-shortcut'>
  <summary>v1.2.39: **Litegraph** Group selected nodes with Ctrl + G</summary>

https://github.com/user-attachments/assets/7805dc54-0854-4a28-8bcd-4b007fa01151

</details>

<details id='feature-node-title-edit'>
  <summary>v1.2.38: **Litegraph** Double click node title to edit</summary>

https://github.com/user-attachments/assets/d61d5d0e-f200-4153-b293-3e3f6a212b30

</details>

<details id='feature-drag-multi-link'>
  <summary>v1.2.7: **Litegraph** drags multiple links with shift pressed</summary>

https://github.com/user-attachments/assets/68826715-bb55-4b2a-be6e-675cfc424afe

https://github.com/user-attachments/assets/c142c43f-2fe9-4030-8196-b3bfd4c6977d

</details>

<details id='feature-auto-connect-link'>
  <summary>v1.2.2: **Litegraph** auto connects to correct slot</summary>

  #### Before
  https://github.com/user-attachments/assets/c253f778-82d5-4e6f-aec0-ea2ccf421651

  #### After
  https://github.com/user-attachments/assets/b6360ac0-f0d2-447c-9daa-8a2e20c0dc1d
</details>

<details id='feature-hide-text-overflow'>
  <summary>v1.1.8: **Litegraph** hides text overflow on widget value</summary>

  https://github.com/user-attachments/assets/5696a89d-4a47-4fcc-9e8c-71e1264943f2
</details>

### Developer APIs

<details>
  <summary>v1.6.13: prompt/confirm/alert replacements for ComfyUI desktop</summary>

Several browser-only APIs are not available in ComfyUI desktop's electron environment.

- `window.prompt`
- `window.confirm`
- `window.alert`

Please use the following APIs as replacements.

```js
// window.prompt
window['app'].extensionManager.dialog
  .prompt({
    title: 'Test Prompt',
    message: 'Test Prompt Message'
  })
  .then((value: string) => {
    // Do something with the value user entered
  })
```

![image](https://github.com/user-attachments/assets/c73f74d0-9bb4-4555-8d56-83f1be4a1d7e)

```js
// window.confirm
window['app'].extensionManager.dialog
  .confirm({
    title: 'Test Confirm',
    message: 'Test Confirm Message'
  })
  .then((value: boolean) => {
    // Do something with the value user entered
  })
```

![image](https://github.com/user-attachments/assets/8dec7a42-7443-4245-85be-ceefb1116e96)

```js
// window.alert
window['app'].extensionManager.toast
  .addAlert("Test Alert")
```

![image](https://github.com/user-attachments/assets/9b18bdca-76ef-4432-95de-5cd2369684f2)

</details>

<details>
  <summary>v1.3.34: Register about panel badges</summary>

```js
app.registerExtension({
  name: 'TestExtension1',
  aboutPageBadges: [
    {
      label: 'Test Badge',
      url: 'https://example.com',
      icon: 'pi pi-box'
    }
  ]
})
```

![image](https://github.com/user-attachments/assets/099e77ee-16ad-4141-b2fc-5e9d5075188b)

</details>

<details id='extension-api-bottom-panel-tabs'>
  <summary>v1.3.22: Register bottom panel tabs</summary>

```js
app.registerExtension({
  name: 'TestExtension',
  bottomPanelTabs: [
    {
      id: 'TestTab',
      title: 'Test Tab',
      type: 'custom',
      render: (el) => {
        el.innerHTML = '<div>Custom tab</div>'
      }
    }
  ]
})
```

![image](https://github.com/user-attachments/assets/2114f8b8-2f55-414b-b027-78e61c870b64)

</details>

<details id='extension-api-settings'>
  <summary>v1.3.22: New settings API</summary>

Legacy settings API.

```js
// Register a new setting
app.ui.settings.addSetting({
  id: 'TestSetting',
  name: 'Test Setting',
  type: 'text',
  defaultValue: 'Hello, world!'
})

// Get the value of a setting
const value = app.ui.settings.getSettingValue('TestSetting')

// Set the value of a setting
app.ui.settings.setSettingValue('TestSetting', 'Hello, universe!')
```

New settings API.

```js
// Register a new setting
app.registerExtension({
  name: 'TestExtension1',
  settings: [
    {
      id: 'TestSetting',
      name: 'Test Setting',
      type: 'text',
      defaultValue: 'Hello, world!'
    }
  ]
})

// Get the value of a setting
const value = app.extensionManager.setting.get('TestSetting')

// Set the value of a setting
app.extensionManager.setting.set('TestSetting', 'Hello, universe!')
```

</details>

<details id='extension-api-commands-keybindings'>
  <summary>v1.3.7: Register commands and keybindings</summary>

  Extensions can call the following API to register commands and keybindings. Do
  note that keybindings defined in core cannot be overwritten, and some keybindings
  are reserved by the browser.

```js
  app.registerExtension({
    name: 'TestExtension1',
    commands: [
      {
        id: 'TestCommand',
        function: () => {
          alert('TestCommand')
        }
      }
    ],
    keybindings: [
      {
        combo: { key: 'k' },
        commandId: 'TestCommand'
      }
    ]
  })
```

</details>

<details id='extension-api-topbar-menu'>
  <summary>v1.3.1: Extension API to register custom topbar menu items</summary>

  Extensions can call the following API to register custom topbar menu items.

```js
  app.registerExtension({
    name: 'TestExtension1',
    commands: [
      {
        id: 'foo-id',
        label: 'foo',
        function: () => {
          alert(1)
        }
      }
    ],
    menuCommands: [
      {
        path: ['ext', 'ext2'],
        commands: ['foo-id']
      }
    ]
  })
```

![image](https://github.com/user-attachments/assets/ae7b082f-7ce9-4549-a446-4563567102fe)
</details>

<details id='extension-api-toast'>
  <summary>v1.2.27: Extension API to add toast message</summary>i

  Extensions can call the following API to add toast messages.

```js
  app.extensionManager.toast.add({
    severity: 'info',
    summary: 'Loaded!',
    detail: 'Extension loaded!',
    life: 3000
  })
```
Documentation of all supported options can be found here: <https://primevue.org/toast/#api.toast.interfaces.ToastMessageOptions>

![image](https://github.com/user-attachments/assets/de02cd7e-cd81-43d1-a0b0-bccef92ff487)
</details>

<details id='extension-api-sidebar-tab'>
  <summary>v1.2.4: Extension API to register custom sidebar tab</summary>

  Extensions now can call the following API to register a sidebar tab.

```js
  app.extensionManager.registerSidebarTab({
    id: "search",
    icon: "pi pi-search",
    title: "search",
    tooltip: "search",
    type: "custom",
    render: (el) => {
      el.innerHTML = "<div>Custom search tab</div>";
    },
  });
```

The list of supported icons can be found here: <https://primevue.org/icons/#list>

We will support custom icons later.

![image](https://github.com/user-attachments/assets/7bff028a-bf91-4cab-bf97-55c243b3f5e0)
</details>

<details id='extension-api-selection-toolbox'>
  <summary>v1.10.9: Selection Toolbox API</summary>

Extensions can register commands that appear in the selection toolbox when specific items are selected on the canvas.

```js
app.registerExtension({
  name: 'TestExtension1',
  commands: [
    {
      id: 'test.selection.command',
      label: 'Test Command',
      icon: 'pi pi-star',
      function: () => {
        // Command logic here
      }
    }
  ],
  // Return an array of command IDs to show in the selection toolbox
  // when an item is selected
  getSelectionToolboxCommands: (selectedItem) => ['test.selection.command']
})
```

The selection toolbox will display the command button when items are selected:
![Image](https://github.com/user-attachments/assets/28d91267-c0a9-4bd5-a7c4-36e8ec44c9bd)

</details>

## Contributing

We're building this frontend together and would love your help — no matter how you'd like to pitch in! You don't need to write code to make a difference.

Here are some ways to get involved:

- **Pull Requests:** Add features, fix bugs, or improve code health. Browse [issues](https://github.com/Comfy-Org/ComfyUI_frontend/issues) for inspiration.
- **Vote on Features:** Give a 👍 to the feature requests you care about to help us prioritize.
- **Verify Bugs:** Try reproducing reported issues and share your results (even if the bug doesn't occur!).
- **Community Support:** Hop into our [Discord](https://www.comfy.org/discord) to answer questions or get help.
- **Share & Advocate:** Tell your friends, tweet about us, or share tips to support the project.

Have another idea? Drop into Discord or open an issue, and let's chat!

## Development

### Prerequisites & Technology Stack

- **Required Software**:
  - Node.js (v16 or later) and npm
  - Git for version control
  - A running ComfyUI backend instance
  
- **Tech Stack**:
  - [Vue 3](https://vuejs.org/) with [TypeScript](https://www.typescriptlang.org/)
  - [Pinia](https://pinia.vuejs.org/) for state management
  - [PrimeVue](https://primevue.org/) with [TailwindCSS](https://tailwindcss.com/) for UI
  - [litegraph.js](https://github.com/Comfy-Org/litegraph.js) for node editor
  - [zod](https://zod.dev/) for schema validation
  - [vue-i18n](https://github.com/intlify/vue-i18n) for internationalization

### Initial Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/Comfy-Org/ComfyUI_frontend.git
   cd ComfyUI_frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure environment (optional):
   Create a `.env` file in the project root based on the provided [.env.example](.env.example) file.

   **Note about ports**: By default, the dev server expects the ComfyUI backend at `localhost:8188`. If your ComfyUI instance runs on a different port, update this in your `.env` file.

### Dev Server Configuration

To launch ComfyUI and have it connect to your development server:

```bash
python main.py --port 8188
```

### Git pre-commit hooks

Run `npm run prepare` to install Git pre-commit hooks. Currently, the pre-commit
hook is used to auto-format code on commit.

### Dev Server

Note: The dev server will NOT load any extension from the ComfyUI server. Only
core extensions will be loaded.

- Start local ComfyUI backend at `localhost:8188`
- Run `npm run dev` to start the dev server
- Run `npm run dev:electron` to start the dev server with electron API mocked

#### Access dev server on touch devices

Enable remote access to the dev server by setting `VITE_REMOTE_DEV` in `.env` to `true`.

After you start the dev server, you should see following logs:

```
> comfyui-frontend@1.3.42 dev
> vite


  VITE v5.4.6  ready in 488 ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: http://172.21.80.1:5173/
  ➜  Network: http://192.168.2.20:5173/
  ➜  press h + enter to show help
```

Make sure your desktop machine and touch device are on the same network. On your touch device,
navigate to `http://<server_ip>:5173` (e.g. `http://192.168.2.20:5173` here), to access the ComfyUI frontend.

### Recommended Code Editor Configuration

This project includes `.vscode/launch.json.default` and `.vscode/settings.json.default` files with recommended launch and workspace settings for editors that use the `.vscode` directory (e.g., VS Code, Cursor, etc.).

We've also included a list of recommended extensions in `.vscode/extensions.json`. Your editor should detect this file and show a human friendly list in the Extensions panel, linking each entry to its marketplace page.

### Recommended MCP Integrations

#### Playwright Browser Automation

The Playwright MCP server enables LLM coding assistants (like Copilot, Claude Code, etc.) to control and inspect web browsers programmatically. This allows assistants to navigate websites, take screenshots, and interact with web pages on your behalf.

For ComfyUI_frontend development, you can ask coding assistants to use Playwright screenshots to continuously verify that your code changes produce the expected visual results.

##### Setup for Claude Code

After installing dependencies with `npm i`, the Playwright MCP server will be automatically available when you start Claude Code locally.

Here's how Claude Code can use the Playwright MCP server to inspect the interface of the local development server (assuming you're running the dev server at `localhost:5173`):


```
> navigate to localhost:5173 and take a screenshot.
   tell me the items in the menubar

● I'll navigate to localhost:5173 and take a
  screenshot to see the menubar items.

● playwright:playwright_navigate (MCP)(url:       …
                                      "http://local
                                      host:5173")
  ⎿  Navigated to http://localhost:5173

● playwright:playwright_screenshot (MCP)(name: "lo…
                                        alhost_5173
                                        _menubar")

  ⎿ Screenshot saved to: ../../../Downloads/localho
    st_5173_menubar-2025-05-30T17-23-00-942Z.png
  ⎿  Screenshot also stored in memory with name:
     'localhost_5173_menubar'

● Read(../../../Downloads/localhost_5173_menubar-2…
      25-05-30T17-23-00-942Z.png)
  ⎿  Read image (94.3KB)

● Based on the screenshot, I can see the menubar at
   the top of the ComfyUI interface contains the
  following items:

  Main Menubar Items:
  - Workflow - Menu for workflow-related actions
  - Edit - Menu for editing operations
  - Help - Menu for help and documentation

  Additional UI Elements:
  - ComfyUI Logo - On the far left
  - Workflow Tab - Shows "Unsaved Workflow" with a
  dropdown and close button
  - Layout Controls - On the far right (grid view
  and hamburger menu icons)

  The interface shows a typical ComfyUI workflow
  graph with nodes like "Load Checkpoint", "CLIP
  Text Encode (Prompt)", "KSampler", and "Empty
  Latent Image" connected with colored cables.
```

### Unit Test

- `npm i` to install all dependencies
- `npm run test:unit` to execute all unit tests.

### Component Test

Component test verifies Vue components in `src/components/`.

- `npm run test:component` to execute all component tests.

### Playwright Test

Playwright test verifies the whole app. See <https://github.com/Comfy-Org/ComfyUI_frontend/blob/main/browser_tests/README.md> for details.

### litegraph.js

This repo is using litegraph package hosted on <https://github.com/Comfy-Org/litegraph.js>. Any changes to litegraph should be submitted in that repo instead.

#### Test litegraph.js changes

- Run `npm link` in the local litegraph repo.
- Run `npm link @comfyorg/litegraph` in this repo.

This will replace the litegraph package in this repo with the local litegraph repo.

### i18n

See [locales/README.md](src/locales/README.md) for details.

## Troubleshooting

> **Note**: For comprehensive troubleshooting and how-to guides, please refer to our [official documentation](https://docs.comfy.org/). This section covers only the most common issues related to frontend development.

> **Desktop Users**: For issues specific to the desktop application, please refer to the [ComfyUI desktop repository](https://github.com/Comfy-Org/desktop).

### Debugging Custom Node (Extension) Issues

If you're experiencing crashes, errors, or unexpected behavior with ComfyUI, it's often caused by custom nodes (extensions). Follow these steps to identify and resolve the issues:

#### Step 1: Verify if custom nodes are causing the problem

Run ComfyUI with the `--disable-all-custom-nodes` flag:

```bash
python main.py --disable-all-custom-nodes
```

If the issue disappears, a custom node is the culprit. Proceed to the next step.

#### Step 2: Identify the problematic custom node using binary search

Rather than disabling nodes one by one, use this more efficient approach:

1. Temporarily move half of your custom nodes out of the `custom_nodes` directory
   ```bash
   # Create a temporary directory
   # Linux/Mac
   mkdir ~/custom_nodes_disabled
   
   # Windows
   mkdir %USERPROFILE%\custom_nodes_disabled
   
   # Move half of your custom nodes (assuming you have node1 through node8)
   # Linux/Mac
   mv custom_nodes/node1 custom_nodes/node2 custom_nodes/node3 custom_nodes/node4 ~/custom_nodes_disabled/
   
   # Windows
   move custom_nodes\node1 custom_nodes\node2 custom_nodes\node3 custom_nodes\node4 %USERPROFILE%\custom_nodes_disabled\
   ```

2. Run ComfyUI again
   - If the issue persists: The problem is in nodes 5-8 (the remaining half)
   - If the issue disappears: The problem is in nodes 1-4 (the moved half)

3. Let's assume the issue disappeared, so the problem is in nodes 1-4. Move half of these for the next test:
   ```bash
   # Move nodes 3-4 back to custom_nodes
   # Linux/Mac
   mv ~/custom_nodes_disabled/node3 ~/custom_nodes_disabled/node4 custom_nodes/
   
   # Windows
   move %USERPROFILE%\custom_nodes_disabled\node3 %USERPROFILE%\custom_nodes_disabled\node4 custom_nodes\
   ```

4. Run ComfyUI again
   - If the issue reappears: The problem is in nodes 3-4
   - If issue still gone: The problem is in nodes 1-2

5. Let's assume the issue reappeared, so the problem is in nodes 3-4. Test each one:
   ```bash
   # Move node 3 back to disabled
   # Linux/Mac
   mv custom_nodes/node3 ~/custom_nodes_disabled/
   
   # Windows
   move custom_nodes\node3 %USERPROFILE%\custom_nodes_disabled\
   ```

6. Run ComfyUI again
   - If the issue disappears: node3 is the problem
   - If issue persists: node4 is the problem

7. Repeat until you identify the specific problematic node

#### Step 3: Update or replace the problematic node

Once identified:
1. Check for updates to the problematic custom node
2. Consider alternatives with similar functionality
3. Report the issue to the custom node developer with specific details

### Common Issues and Solutions

- **"Module not found" errors**: Usually indicates missing Python dependencies. Check the custom node's `requirements.txt` file for required packages and install them:
  ```bash
  pip install -r custom_nodes/problematic_node/requirements.txt
  ```

- **Frontend or Templates Package Not Updated**: After updating ComfyUI via Git, ensure you update the frontend dependencies:
  ```bash
  pip install -r requirements.txt
  ```

- **Can't Find Custom Node**: Make sure to disable node validation in ComfyUI settings.

- **Error Toast About Workflow Failing Validation**: Report the issue to the ComfyUI team. As a temporary workaround, disable workflow validation in settings.

- **Login Issues When Not on Localhost**: Normal login is only available when accessing from localhost. If you're running ComfyUI via LAN, another domain, or headless, you can use our API key feature to authenticate. The API key lets you log in normally through the UI. Generate an API key at [platform.comfy.org/login](https://platform.comfy.org/login) and use it in the API Key field in the login dialog or with the `--api-key` command line argument. Refer to our [API Key Integration Guide](https://docs.comfy.org/essentials/comfyui-server/api-key-integration#integration-of-api-key-to-use-comfyui-api-nodes) for complete setup instructions.