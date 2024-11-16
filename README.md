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

### Nightly Release

Nightly releases are published daily at [https://github.com/Comfy-Org/ComfyUI_frontend/releases](https://github.com/Comfy-Org/ComfyUI_frontend/releases).

To use the latest nightly release, add the following command line argument to your ComfyUI launch script:

```bat
--front-end-version Comfy-Org/ComfyUI_frontend@latest
```

#### For Windows Stand-alone Build Users

Edit your `run_cpu.bat` or `run_nvidia_gpu.bat` file as follows:

```bat
.\python_embeded\python.exe -s ComfyUI\main.py --windows-standalone-build --front-end-version Comfy-Org/ComfyUI_frontend@latest
pause
```

### Stable Release

Stable releases are published weekly in the ComfyUI main repository, aligned with ComfyUI backend's stable release schedule.

#### Feature Freeze

There will be a 2-day feature freeze before each stable release. During this period, no new major features will be merged.

## Release Summary

### Major features

<details>
  <summary>v1.3.22: Integrated server terminal</summary>

Press Ctrl + ` to toggle integrated terminal.

https://github.com/user-attachments/assets/eddedc6a-07a3-4a83-9475-63b3977f6d94
</details>

<details>
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

<details>
  <summary>v1.2.4: Node library sidebar tab</summary>

  #### Drag & Drop
https://github.com/user-attachments/assets/853e20b7-bc0e-49c9-bbce-a2ba7566f92f

  #### Filter
https://github.com/user-attachments/assets/4bbca3ee-318f-4cf0-be32-a5a5541066cf
</details>

<details>
  <summary>v1.2.0: Queue/History sidebar tab</summary>

  https://github.com/user-attachments/assets/86e264fe-4d26-4f07-aa9a-83bdd2d02b8f
</details>

<details>
  <summary>v1.1.0: Node search box</summary>

  #### Fuzzy search & Node preview
  ![image](https://github.com/user-attachments/assets/94733e32-ea4e-4a9c-b321-c1a05db48709)

  #### Release link with shift
  https://github.com/user-attachments/assets/a1b2b5c3-10d1-4256-b620-345de6858f25
</details>

### QoL changes

<details>
  <summary>v1.3.32: **Litegraph** Nested group</summary>

https://github.com/user-attachments/assets/f51adeb1-028e-40af-81e4-0ac13075198a
</details>

<details>
  <summary>v1.3.24: **Litegraph** Group selection</summary>

https://github.com/user-attachments/assets/e6230a94-411e-4fba-90cb-6c694200adaa
</details>

<details>
  <summary>v1.3.6: **Litegraph** Toggle link visibility</summary>

[rec.webm](https://github.com/user-attachments/assets/34e460ac-fbbc-44ef-bfbb-99a84c2ae2be)

</details>

<details>
  <summary>v1.3.4: **Litegraph** Auto widget to input conversion</summary>

Dropping a link of correct type on node widget will automatically convert the widget to input.

[rec.webm](https://github.com/user-attachments/assets/15cea0b0-b225-4bec-af50-2cdb16dc46bf)

</details>

<details>
  <summary>v1.3.4: **Litegraph** Canvas pan mode</summary>

The canvas becomes readonly in pan mode. Pan mode is activated by clicking the pan mode button on the canvas menu
or by holding the space key.

[rec.webm](https://github.com/user-attachments/assets/c7872532-a2ac-44c1-9e7d-9e03b5d1a80b)

</details>

<details>
  <summary>v1.3.1: **Litegraph** Shift drag link to create a new link</summary>

[rec.webm](https://github.com/user-attachments/assets/7e73aaf9-79e2-4c3c-a26a-911cba3b85e4)

</details>

<details>
  <summary>v1.2.62: **Litegraph** Show optional input slots as donuts</summary>

![GYEIRidb0AYGO-v](https://github.com/user-attachments/assets/e6cde0b6-654b-4afd-a117-133657a410b1)

</details>

<details>
  <summary>v1.2.44: **Litegraph** Double click group title to edit</summary>

https://github.com/user-attachments/assets/5bf0e2b6-8b3a-40a7-b44f-f0879e9ad26f

</details>

<details>
  <summary>v1.2.39: **Litegraph** Group selected nodes with Ctrl + G</summary>

https://github.com/user-attachments/assets/7805dc54-0854-4a28-8bcd-4b007fa01151

</details>

<details>
  <summary>v1.2.38: **Litegraph** Double click node title to edit</summary>

https://github.com/user-attachments/assets/d61d5d0e-f200-4153-b293-3e3f6a212b30

</details>

<details>
  <summary>v1.2.7: **Litegraph** drags multiple links with shift pressed</summary>

https://github.com/user-attachments/assets/68826715-bb55-4b2a-be6e-675cfc424afe

https://github.com/user-attachments/assets/c142c43f-2fe9-4030-8196-b3bfd4c6977d

</details>

<details>
  <summary>v1.2.2: **Litegraph** auto connects to correct slot</summary>

  #### Before
  https://github.com/user-attachments/assets/c253f778-82d5-4e6f-aec0-ea2ccf421651

  #### After
  https://github.com/user-attachments/assets/b6360ac0-f0d2-447c-9daa-8a2e20c0dc1d
</details>

<details>
  <summary>v1.1.8: **Litegraph** hides text overflow on widget value</summary>

  https://github.com/user-attachments/assets/5696a89d-4a47-4fcc-9e8c-71e1264943f2
</details>

### Developer APIs

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

<details>
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

<details>
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

<details>
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

<details>
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

<details>
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

<details>
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

## Development

### Tech Stack

- [Vue 3](https://vuejs.org/) with [TypeScript](https://www.typescriptlang.org/)
- [Pinia](https://pinia.vuejs.org/) for state management
- [PrimeVue](https://primevue.org/) with [TailwindCSS](https://tailwindcss.com/) for UI
- [Litegraph](https://github.com/Comfy-Org/litegraph.js) for node editor
- [zod](https://zod.dev/) for schema validation

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

### Unit Test

- `git clone https://github.com/comfyanonymous/ComfyUI_examples.git` to `tests-ui/ComfyUI_examples` or the EXAMPLE_REPO_PATH location specified in .env
- `npm i` to install all dependencies
- `npm run test:generate` to fetch `tests-ui/data/object_info.json`
- `npm run test:generate:examples` to extract the example workflows
- `npm run test` to execute all unit tests.

### Component Test

Component test verifies Vue components in `src/components/`.

- `npm run test:component` to execute all component tests.

### Playwright Test

Playwright test verifies the whole app. See <https://github.com/Comfy-Org/ComfyUI_frontend/blob/main/browser_tests/README.md> for details.

### LiteGraph

This repo is using litegraph package hosted on <https://github.com/Comfy-Org/litegraph.js>. Any changes to litegraph should be submitted in that repo instead.

### Test litegraph changes

- Run `npm link` in the local litegraph repo.
- Run `npm link @comfyorg/litegraph` in this repo.

This will replace the litegraph package in this repo with the local litegraph repo.

## Deploy

- Option 1: Set `DEPLOY_COMFYUI_DIR` in `.env` and run `npm run deploy`.
- Option 2: Copy everything under `dist/` to `ComfyUI/web/` in your ComfyUI checkout manually.

## Publish release to ComfyUI main repo

Run following command to publish a release to ComfyUI main repo. The script will create a new branch and do a commit to `web/` folder by checkout `dist.zip`
from GitHub release.

- `python scripts/main_repo_release.py <path_to_comfyui_main_repo> <version>`
