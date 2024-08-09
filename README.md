# ComfyUI_frontend

Front-end of [ComfyUI](https://github.com/comfyanonymous/ComfyUI) modernized. This repo is fully compatible with the existing extension system.

## How To Use

Add command line argument `--front-end-version Comfy-Org/ComfyUI_frontend@latest` to your
ComfyUI launch script.

For Windows stand-alone build users, please edit the `run_cpu.bat` / `run_nvidia_gpu.bat` file as following

```bat
.\python_embeded\python.exe -s ComfyUI\main.py --windows-standalone-build --front-end-version Comfy-Org/ComfyUI_frontend@latest
pause
```

## Trouble Shooting
<details>
  <summary>Empty white screen (Fixed by https://github.com/comfyanonymous/ComfyUI/pull/4211)</summary>

  ### Behavior
  After you enable the new frontend in commandline, and open ComfyUI in the browser, you see a blank screen. If you toggle dev tools with F12, you can observe `litegraph.core.js:1` 404 in console messages.

  ### Cause
  The browser is caching the `index.html` file previously served from `localhost:8188`.

  ### How to fix
  Step 1: Disable cache in devtools
  
  ![image](https://github.com/user-attachments/assets/c0cec519-93b7-49f8-aea1-7adb0aa5b073)

  Step 2: Refresh your browser

</details>

## Release Summary

### Major features

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

### Node developers API
<details>
  <summary>v1.2.4: Extension API to register custom side bar tab</summary>

  Extensions now can call following API to register a sidebar tab.

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

The list of supported icons can be find here: https://primevue.org/icons/#list

We will support custom icon later.

![image](https://github.com/user-attachments/assets/7bff028a-bf91-4cab-bf97-55c243b3f5e0)
</details>


## Road Map

### What has been done

- Migrate all code to TypeScript with minimal change modification to the original logic.
- Bundle all code with vite's rollup build.
- Added a shim layer to be backward compatible with the existing extension system. <https://github.com/huchenlei/ComfyUI_frontend/pull/15>
- Front-end dev server.
- Zod schema for input validation on ComfyUI workflow.
- Make litegraph a npm dependency. <https://github.com/Comfy-Org/ComfyUI_frontend/pull/89>
- Introduce Vue to start managing part of the UI.
- Easy install and version management (<https://github.com/comfyanonymous/ComfyUI/pull/3897>).
- Better node management. Sherlock <https://github.com/Nuked88/ComfyUI-N-Sidebar>.


### What to be done

- Replace the existing ComfyUI front-end impl
- Remove `@ts-ignore`s.
- Turn on `strict` on `tsconfig.json`.
- Add more widget types for node developers.
- LLM streaming node.
- Linear mode (Similar to InvokeAI's linear mode).
- Keybinding settings management. Register keybindings API for custom nodes.
- New extensions API for adding UI-related features.

## Development

### Git pre-commit hooks

Run `npm run prepare` to install Git pre-commit hooks. Currently, the pre-commit
hook is used to auto-format code on commit.

### Dev Server

Note: The dev server will NOT load any extension from the ComfyUI server. Only
core extensions will be loaded.

- Run `npm install` to install the necessary packages
- Start local ComfyUI backend at `localhost:8188`
- Run `npm run dev` to start the dev server

### Test

- `git clone https://github.com/comfyanonymous/ComfyUI_examples.git` to `tests-ui/ComfyUI_examples` or the EXAMPLE_REPO_PATH location specified in .env
- `npm i` to install all dependencies
- `npm run test:generate` to fetch `tests-ui/data/object_info.json`
- `npm run test:generate:examples` to extract the example workflows
- `npm run test` to execute all unit tests.

### LiteGraph

This repo is using litegraph package hosted on https://github.com/Comfy-Org/litegraph.js. Any changes to litegraph should be submitted in that repo instead.

## Deploy

- Option 1: Set `DEPLOY_COMFYUI_DIR` in `.env` and run `npm run deploy`.
- Option 2: Copy everything under `dist/` to `ComfyUI/web/` in your ComfyUI checkout manually.

## Breaking changes

- api.api_url now adds a prefix `api/` to every url going through the method. If the custom node registers a new api endpoint but does not offer the `api/` prefixed alt endpoint, it will have issue. Luckily there aren't many extensions that do that. We can perform an audit before launching to resolve this issue.
