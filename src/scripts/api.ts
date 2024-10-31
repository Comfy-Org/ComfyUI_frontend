import type { ComfyWorkflowJSON } from '@/types/comfyWorkflow'
import {
  type HistoryTaskItem,
  type PendingTaskItem,
  type RunningTaskItem,
  type ComfyNodeDef,
  type EmbeddingsResponse,
  type ExtensionsResponse,
  type PromptResponse,
  type SystemStats,
  type User,
  type Settings,
  type UserDataFullInfo,
  validateComfyNodeDef
} from '@/types/apiTypes'
import axios from 'axios'

interface QueuePromptRequestBody {
  client_id: string
  // Mapping from node id to node info + input values
  // TODO: Type this.
  prompt: Record<number, any>
  extra_data: {
    extra_pnginfo: {
      workflow: ComfyWorkflowJSON
    }
  }
  front?: boolean
  number?: number
}

class ComfyApi extends EventTarget {
  #registered = new Set()
  api_host: string
  api_base: string
  /**
   * The client id from the initial session storage.
   */
  initialClientId: string | null
  /**
   * The current client id from websocket status updates.
   */
  clientId?: string
  user: string
  socket: WebSocket | null = null

  reportedUnknownMessageTypes = new Set<string>()

  constructor() {
    super()
    // api.user is set by ComfyApp.setup()
    this.user = ''
    this.api_host = location.host
    this.api_base = location.pathname.split('/').slice(0, -1).join('/')
    console.log('Running on', this.api_host)
    this.initialClientId = sessionStorage.getItem('clientId')
  }

  internalURL(route: string): string {
    return this.api_base + '/internal' + route
  }

  apiURL(route: string): string {
    return this.api_base + '/api' + route
  }

  fileURL(route: string): string {
    return this.api_base + route
  }

  fetchApi(route: string, options?: RequestInit) {
    if (!options) {
      options = {}
    }
    if (!options.headers) {
      options.headers = {}
    }
    if (!options.cache) {
      options.cache = 'no-cache'
    }

    if (Array.isArray(options.headers)) {
      options.headers.push(['Comfy-User', this.user])
    } else if (options.headers instanceof Headers) {
      options.headers.set('Comfy-User', this.user)
    } else {
      options.headers['Comfy-User'] = this.user
    }
    return fetch(this.apiURL(route), options)
  }

  addEventListener(
    type: string,
    callback: any,
    options?: AddEventListenerOptions
  ) {
    super.addEventListener(type, callback, options)
    this.#registered.add(type)
  }

  /**
   * Poll status  for colab and other things that don't support websockets.
   */
  #pollQueue() {
    setInterval(async () => {
      try {
        const resp = await this.fetchApi('/prompt')
        const status = await resp.json()
        this.dispatchEvent(new CustomEvent('status', { detail: status }))
      } catch (error) {
        this.dispatchEvent(new CustomEvent('status', { detail: null }))
      }
    }, 1000)
  }

  /**
   * Creates and connects a WebSocket for realtime updates
   * @param {boolean} isReconnect If the socket is connection is a reconnect attempt
   */
  #createSocket(isReconnect?: boolean) {
    if (this.socket) {
      return
    }

    let opened = false
    let existingSession = window.name
    if (existingSession) {
      existingSession = '?clientId=' + existingSession
    }
    this.socket = new WebSocket(
      `ws${window.location.protocol === 'https:' ? 's' : ''}://${this.api_host}${this.api_base}/ws${existingSession}`
    )
    this.socket.binaryType = 'arraybuffer'

    this.socket.addEventListener('open', () => {
      opened = true
      if (isReconnect) {
        this.dispatchEvent(new CustomEvent('reconnected'))
      }
    })

    this.socket.addEventListener('error', () => {
      if (this.socket) this.socket.close()
      if (!isReconnect && !opened) {
        this.#pollQueue()
      }
    })

    this.socket.addEventListener('close', () => {
      setTimeout(() => {
        this.socket = null
        this.#createSocket(true)
      }, 300)
      if (opened) {
        this.dispatchEvent(new CustomEvent('status', { detail: null }))
        this.dispatchEvent(new CustomEvent('reconnecting'))
      }
    })

    this.socket.addEventListener('message', (event) => {
      try {
        if (event.data instanceof ArrayBuffer) {
          const view = new DataView(event.data)
          const eventType = view.getUint32(0)
          const buffer = event.data.slice(4)
          switch (eventType) {
            case 1:
              const view2 = new DataView(event.data)
              const imageType = view2.getUint32(0)
              let imageMime
              switch (imageType) {
                case 1:
                default:
                  imageMime = 'image/jpeg'
                  break
                case 2:
                  imageMime = 'image/png'
              }
              const imageBlob = new Blob([buffer.slice(4)], {
                type: imageMime
              })
              this.dispatchEvent(
                new CustomEvent('b_preview', { detail: imageBlob })
              )
              break
            default:
              throw new Error(
                `Unknown binary websocket message of type ${eventType}`
              )
          }
        } else {
          const msg = JSON.parse(event.data)
          switch (msg.type) {
            case 'status':
              if (msg.data.sid) {
                const clientId = msg.data.sid
                this.clientId = clientId
                window.name = clientId // use window name so it isnt reused when duplicating tabs
                sessionStorage.setItem('clientId', clientId) // store in session storage so duplicate tab can load correct workflow
              }
              this.dispatchEvent(
                new CustomEvent('status', { detail: msg.data.status })
              )
              break
            case 'progress':
              this.dispatchEvent(
                new CustomEvent('progress', { detail: msg.data })
              )
              break
            case 'executing':
              this.dispatchEvent(
                new CustomEvent('executing', {
                  detail: msg.data.display_node || msg.data.node
                })
              )
              break
            case 'executed':
              this.dispatchEvent(
                new CustomEvent('executed', { detail: msg.data })
              )
              break
            case 'execution_start':
              this.dispatchEvent(
                new CustomEvent('execution_start', { detail: msg.data })
              )
              break
            case 'execution_success':
              this.dispatchEvent(
                new CustomEvent('execution_success', { detail: msg.data })
              )
              break
            case 'execution_error':
              this.dispatchEvent(
                new CustomEvent('execution_error', { detail: msg.data })
              )
              break
            case 'execution_cached':
              this.dispatchEvent(
                new CustomEvent('execution_cached', { detail: msg.data })
              )
              break
            default:
              if (this.#registered.has(msg.type)) {
                this.dispatchEvent(
                  new CustomEvent(msg.type, { detail: msg.data })
                )
              } else if (!this.reportedUnknownMessageTypes.has(msg.type)) {
                this.reportedUnknownMessageTypes.add(msg.type)
                throw new Error(`Unknown message type ${msg.type}`)
              }
          }
        }
      } catch (error) {
        console.warn('Unhandled message:', event.data, error)
      }
    })
  }

  /**
   * Initialises sockets and realtime updates
   */
  init() {
    this.#createSocket()
  }

  /**
   * Gets a list of extension urls
   */
  async getExtensions(): Promise<ExtensionsResponse> {
    const resp = await this.fetchApi('/extensions', { cache: 'no-store' })
    return await resp.json()
  }

  /**
   * Gets a list of embedding names
   */
  async getEmbeddings(): Promise<EmbeddingsResponse> {
    const resp = await this.fetchApi('/embeddings', { cache: 'no-store' })
    return await resp.json()
  }

  /**
   * Loads node object definitions for the graph
   * @returns The node definitions
   */
  async getNodeDefs({ validate = false }: { validate?: boolean } = {}): Promise<
    Record<string, ComfyNodeDef>
  > {
    const resp = await this.fetchApi('/object_info', { cache: 'no-store' })
    const objectInfoUnsafe = await resp.json()
    if (!validate) {
      return objectInfoUnsafe
    }
    // Validate node definitions against zod schema. (slow)
    const objectInfo: Record<string, ComfyNodeDef> = {}
    for (const key in objectInfoUnsafe) {
      const validatedDef = validateComfyNodeDef(
        objectInfoUnsafe[key],
        /* onError=*/ (errorMessage: string) => {
          console.warn(
            `Skipping invalid node definition: ${key}. See debug log for more information.`
          )
          console.debug(errorMessage)
        }
      )
      if (validatedDef !== null) {
        objectInfo[key] = validatedDef
      }
    }
    return objectInfo
  }

  /**
   *
   * @param {number} number The index at which to queue the prompt, passing -1 will insert the prompt at the front of the queue
   * @param {object} prompt The prompt data to queue
   */
  async queuePrompt(
    number: number,
    {
      output,
      workflow
    }: { output: Record<number, any>; workflow: ComfyWorkflowJSON }
  ): Promise<PromptResponse> {
    const body: QueuePromptRequestBody = {
      client_id: this.clientId ?? '', // TODO: Unify clientId access
      prompt: output,
      extra_data: { extra_pnginfo: { workflow } }
    }

    if (number === -1) {
      body.front = true
    } else if (number != 0) {
      body.number = number
    }

    const res = await this.fetchApi('/prompt', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    })

    if (res.status !== 200) {
      throw {
        response: await res.json()
      }
    }

    return await res.json()
  }

  /**
   * Gets a list of model folder keys (eg ['checkpoints', 'loras', ...])
   * @returns The list of model folder keys
   */
  async getModelFolders(): Promise<string[]> {
    const res = await this.fetchApi(`/models`)
    if (res.status === 404) {
      return []
    }
    const folderBlacklist = ['configs', 'custom_nodes']
    return (await res.json()).filter(
      (folder: string) => !folderBlacklist.includes(folder)
    )
  }

  /**
   * Gets a list of models in the specified folder
   * @param {string} folder The folder to list models from, such as 'checkpoints'
   * @returns The list of model filenames within the specified folder
   */
  async getModels(folder: string): Promise<string[]> {
    const res = await this.fetchApi(`/models/${folder}`)
    if (res.status === 404) {
      return []
    }
    return await res.json()
  }

  /**
   * Gets the metadata for a model
   * @param {string} folder The folder containing the model
   * @param {string} model The model to get metadata for
   * @returns The metadata for the model
   */
  async viewMetadata(folder: string, model: string) {
    const res = await this.fetchApi(
      `/view_metadata/${folder}?filename=${encodeURIComponent(model)}`
    )
    const rawResponse = await res.text()
    if (!rawResponse) {
      return null
    }
    try {
      return JSON.parse(rawResponse)
    } catch (error) {
      console.error(
        'Error viewing metadata',
        res.status,
        res.statusText,
        rawResponse,
        error
      )
      return null
    }
  }

  /**
   * Loads a list of items (queue or history)
   * @param {string} type The type of items to load, queue or history
   * @returns The items of the specified type grouped by their status
   */
  async getItems(type: 'queue' | 'history') {
    if (type === 'queue') {
      return this.getQueue()
    }
    return this.getHistory()
  }

  /**
   * Gets the current state of the queue
   * @returns The currently running and queued items
   */
  async getQueue(): Promise<{
    Running: RunningTaskItem[]
    Pending: PendingTaskItem[]
  }> {
    try {
      const res = await this.fetchApi('/queue')
      const data = await res.json()
      return {
        // Running action uses a different endpoint for cancelling
        Running: data.queue_running.map((prompt: Record<number, any>) => ({
          taskType: 'Running',
          prompt,
          remove: { name: 'Cancel', cb: () => api.interrupt() }
        })),
        Pending: data.queue_pending.map((prompt: Record<number, any>) => ({
          taskType: 'Pending',
          prompt
        }))
      }
    } catch (error) {
      console.error(error)
      return { Running: [], Pending: [] }
    }
  }

  /**
   * Gets the prompt execution history
   * @returns Prompt history including node outputs
   */
  async getHistory(
    max_items: number = 200
  ): Promise<{ History: HistoryTaskItem[] }> {
    try {
      const res = await this.fetchApi(`/history?max_items=${max_items}`)
      const json: Promise<HistoryTaskItem[]> = await res.json()
      return {
        History: Object.values(json).map((item) => ({
          ...item,
          taskType: 'History'
        }))
      }
    } catch (error) {
      console.error(error)
      return { History: [] }
    }
  }

  /**
   * Gets system & device stats
   * @returns System stats such as python version, OS, per device info
   */
  async getSystemStats(): Promise<SystemStats> {
    const res = await this.fetchApi('/system_stats')
    return await res.json()
  }

  /**
   * Sends a POST request to the API
   * @param {*} type The endpoint to post to
   * @param {*} body Optional POST data
   */
  async #postItem(type: string, body: any) {
    try {
      await this.fetchApi('/' + type, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: body ? JSON.stringify(body) : undefined
      })
    } catch (error) {
      console.error(error)
    }
  }

  /**
   * Deletes an item from the specified list
   * @param {string} type The type of item to delete, queue or history
   * @param {number} id The id of the item to delete
   */
  async deleteItem(type: string, id: string) {
    await this.#postItem(type, { delete: [id] })
  }

  /**
   * Clears the specified list
   * @param {string} type The type of list to clear, queue or history
   */
  async clearItems(type: string) {
    await this.#postItem(type, { clear: true })
  }

  /**
   * Interrupts the execution of the running prompt
   */
  async interrupt() {
    await this.#postItem('interrupt', null)
  }

  /**
   * Gets user configuration data and where data should be stored
   */
  async getUserConfig(): Promise<User> {
    return (await this.fetchApi('/users')).json()
  }

  /**
   * Creates a new user
   * @param { string } username
   * @returns The fetch response
   */
  createUser(username: string) {
    return this.fetchApi('/users', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ username })
    })
  }

  /**
   * Gets all setting values for the current user
   * @returns { Promise<string, unknown> } A dictionary of id -> value
   */
  async getSettings(): Promise<Settings> {
    return (await this.fetchApi('/settings')).json()
  }

  /**
   * Gets a setting for the current user
   * @param { string } id The id of the setting to fetch
   * @returns { Promise<unknown> } The setting value
   */
  async getSetting(id: keyof Settings): Promise<Settings[keyof Settings]> {
    return (await this.fetchApi(`/settings/${encodeURIComponent(id)}`)).json()
  }

  /**
   * Stores a dictionary of settings for the current user
   */
  async storeSettings(settings: Settings) {
    return this.fetchApi(`/settings`, {
      method: 'POST',
      body: JSON.stringify(settings)
    })
  }

  /**
   * Stores a setting for the current user
   */
  async storeSetting(id: keyof Settings, value: Settings[keyof Settings]) {
    return this.fetchApi(`/settings/${encodeURIComponent(id)}`, {
      method: 'POST',
      body: JSON.stringify(value)
    })
  }

  /**
   * Gets a user data file for the current user
   */
  async getUserData(file: string, options?: RequestInit) {
    return this.fetchApi(`/userdata/${encodeURIComponent(file)}`, options)
  }

  /**
   * Stores a user data file for the current user
   * @param { string } file The name of the userdata file to save
   * @param { unknown } data The data to save to the file
   * @param { RequestInit & { stringify?: boolean, throwOnError?: boolean } } [options]
   * @returns { Promise<Response> }
   */
  async storeUserData(
    file: string,
    data: any,
    options: RequestInit & {
      overwrite?: boolean
      stringify?: boolean
      throwOnError?: boolean
      full_info?: boolean
    } = {
      overwrite: true,
      stringify: true,
      throwOnError: true,
      full_info: false
    }
  ): Promise<Response> {
    const resp = await this.fetchApi(
      `/userdata/${encodeURIComponent(file)}?overwrite=${options.overwrite}&full_info=${options.full_info}`,
      {
        method: 'POST',
        body: options?.stringify ? JSON.stringify(data) : data,
        ...options
      }
    )
    if (resp.status !== 200 && options.throwOnError !== false) {
      throw new Error(
        `Error storing user data file '${file}': ${resp.status} ${(await resp).statusText}`
      )
    }

    return resp
  }

  /**
   * Deletes a user data file for the current user
   * @param { string } file The name of the userdata file to delete
   */
  async deleteUserData(file: string) {
    const resp = await this.fetchApi(`/userdata/${encodeURIComponent(file)}`, {
      method: 'DELETE'
    })
    return resp
  }

  /**
   * Move a user data file for the current user
   * @param { string } source The userdata file to move
   * @param { string } dest The destination for the file
   */
  async moveUserData(
    source: string,
    dest: string,
    options = { overwrite: false }
  ) {
    const resp = await this.fetchApi(
      `/userdata/${encodeURIComponent(source)}/move/${encodeURIComponent(dest)}?overwrite=${options?.overwrite}`,
      {
        method: 'POST'
      }
    )
    return resp
  }

  /**
   * @overload
   * Lists user data files for the current user
   * @param { string } dir The directory in which to list files
   * @param { boolean } [recurse] If the listing should be recursive
   * @param { true } [split] If the paths should be split based on the os path separator
   * @returns { Promise<string[][]> } The list of split file paths in the format [fullPath, ...splitPath]
   */
  /**
   * @overload
   * Lists user data files for the current user
   * @param { string } dir The directory in which to list files
   * @param { boolean } [recurse] If the listing should be recursive
   * @param { false | undefined } [split] If the paths should be split based on the os path separator
   * @returns { Promise<string[]> } The list of files
   */
  async listUserData(
    dir: string,
    recurse: boolean,
    split?: true
  ): Promise<string[][]>
  async listUserData(
    dir: string,
    recurse: boolean,
    split?: false
  ): Promise<string[]>
  /**
   * @deprecated Use `listUserDataFullInfo` instead.
   */
  async listUserData(dir: string, recurse: boolean, split?: boolean) {
    const resp = await this.fetchApi(
      `/userdata?${new URLSearchParams({
        recurse: recurse ? 'true' : 'false',
        dir,
        split: split ? 'true' : 'false'
      })}`
    )
    if (resp.status === 404) return []
    if (resp.status !== 200) {
      throw new Error(
        `Error getting user data list '${dir}': ${resp.status} ${resp.statusText}`
      )
    }
    return resp.json()
  }

  async listUserDataFullInfo(dir: string): Promise<UserDataFullInfo[]> {
    const resp = await this.fetchApi(
      `/userdata?dir=${encodeURIComponent(dir)}&recurse=true&split=false&full_info=true`
    )
    if (resp.status === 404) return []
    if (resp.status !== 200) {
      throw new Error(
        `Error getting user data list '${dir}': ${resp.status} ${resp.statusText}`
      )
    }
    return resp.json()
  }

  async getLogs(): Promise<string> {
    return (await axios.get(this.internalURL('/logs'))).data
  }

  async getFolderPaths(): Promise<Record<string, string[]>> {
    return (await axios.get(this.internalURL('/folder_paths'))).data
  }
}

export const api = new ComfyApi()
