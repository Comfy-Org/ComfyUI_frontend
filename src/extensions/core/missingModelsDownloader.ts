import { api } from '../../scripts/api'
import { app } from '../../scripts/app'

interface ModelInfo {
  folder: string
  filename: string
}

interface DownloadTask {
  task_id: string
  status: string
  progress?: number
  error?: string
  downloaded_size?: number
  total_size?: number
}

interface ModelEntry {
  element: HTMLElement
  text: string
  url?: string
  button?: HTMLButtonElement
  statusElement?: HTMLElement
}

interface DownloadState {
  button: HTMLButtonElement
  modelInfo: ModelInfo
  statusElement?: HTMLElement
}

app.registerExtension({
  name: 'Comfy.MissingModelsDownloader',
  async setup(): Promise<void> {
    const activeDownloads = new Map<string, DownloadState>()

    // Model repositories with known URLs
    const modelRepositories: Record<string, Record<string, string>> = {
      checkpoints: {
        'sd_xl_base_1.0.safetensors':
          'https://huggingface.co/stabilityai/stable-diffusion-xl-base-1.0/resolve/main/sd_xl_base_1.0.safetensors',
        'sd_xl_refiner_1.0.safetensors':
          'https://huggingface.co/stabilityai/stable-diffusion-xl-refiner-1.0/resolve/main/sd_xl_refiner_1.0.safetensors',
        'v1-5-pruned-emaonly.safetensors':
          'https://huggingface.co/runwayml/stable-diffusion-v1-5/resolve/main/v1-5-pruned-emaonly.safetensors',
        'v1-5-pruned.safetensors':
          'https://huggingface.co/runwayml/stable-diffusion-v1-5/resolve/main/v1-5-pruned.safetensors'
      },
      vae: {
        'sdxl_vae.safetensors':
          'https://huggingface.co/stabilityai/sdxl-vae/resolve/main/sdxl_vae.safetensors',
        'vae-ft-mse-840000-ema-pruned.safetensors':
          'https://huggingface.co/stabilityai/sd-vae-ft-mse-original/resolve/main/vae-ft-mse-840000-ema-pruned.safetensors'
      },
      loras: {
        'lcm-lora-sdv1-5.safetensors':
          'https://huggingface.co/latent-consistency/lcm-lora-sdv1-5/resolve/main/pytorch_lora_weights.safetensors',
        'lcm-lora-sdxl.safetensors':
          'https://huggingface.co/latent-consistency/lcm-lora-sdxl/resolve/main/pytorch_lora_weights.safetensors'
      },
      controlnet: {
        'control_v11p_sd15_canny.pth':
          'https://huggingface.co/lllyasviel/ControlNet-v1-1/resolve/main/control_v11p_sd15_canny.pth',
        'control_v11p_sd15_openpose.pth':
          'https://huggingface.co/lllyasviel/ControlNet-v1-1/resolve/main/control_v11p_sd15_openpose.pth',
        'control_v11f1p_sd15_depth.pth':
          'https://huggingface.co/lllyasviel/ControlNet-v1-1/resolve/main/control_v11f1p_sd15_depth.pth'
      },
      upscale_models: {
        'RealESRGAN_x4plus.pth':
          'https://github.com/xinntao/Real-ESRGAN/releases/download/v0.1.0/RealESRGAN_x4plus.pth',
        'RealESRGAN_x4plus_anime_6B.pth':
          'https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.2.4/RealESRGAN_x4plus_anime_6B.pth',
        '4x-UltraSharp.pth':
          'https://huggingface.co/uwg/upscaler/resolve/main/ESRGAN/4x-UltraSharp.pth'
      },
      clip: {
        'clip_l.safetensors':
          'https://huggingface.co/comfyanonymous/flux_text_encoders/resolve/main/clip_l.safetensors',
        't5xxl_fp16.safetensors':
          'https://huggingface.co/comfyanonymous/flux_text_encoders/resolve/main/t5xxl_fp16.safetensors',
        't5xxl_fp8_e4m3fn.safetensors':
          'https://huggingface.co/comfyanonymous/flux_text_encoders/resolve/main/t5xxl_fp8_e4m3fn.safetensors'
      },
      unet: {
        'flux1-dev.safetensors':
          'https://huggingface.co/black-forest-labs/FLUX.1-dev/resolve/main/flux1-dev.safetensors',
        'flux1-schnell.safetensors':
          'https://huggingface.co/black-forest-labs/FLUX.1-schnell/resolve/main/flux1-schnell.safetensors'
      }
    }

    console.log('[MissingModelsDownloader] Extension loaded')

    // Wait for app to be ready
    if (app.ui?.dialog) {
      setupDialogMonitoring()
    } else {
      // Wait for UI to be ready
      const checkInterval = setInterval(() => {
        if (app.ui?.dialog) {
          clearInterval(checkInterval)
          setupDialogMonitoring()
        }
      }, 100)
    }

    function setupDialogMonitoring() {
      // Monitor DOM mutations for dialog creation
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === 1) {
              // Element node
              checkForMissingModelsDialog(node as HTMLElement)
            }
          })
        })
      })

      // Start observing
      observer.observe(document.body, {
        childList: true,
        subtree: true
      })

      console.log('[MissingModelsDownloader] Dialog monitoring active')
    }

    function checkForMissingModelsDialog(element: HTMLElement) {
      // Look for the missing models dialog by its content
      const isDialog =
        element.classList &&
        (element.classList.contains('p-dialog') ||
          element.classList.contains('comfy-modal') ||
          element.tagName === 'DIALOG')

      if (!isDialog && 'querySelector' in element) {
        const dialogs = element.querySelectorAll(
          'dialog, .p-dialog, .comfy-modal'
        )
        dialogs.forEach((dialog) =>
          checkForMissingModelsDialog(dialog as HTMLElement)
        )
        return
      }

      const textContent = element.textContent || ''

      // Check for missing models dialog indicators
      if (
        textContent.includes('Missing Models') ||
        textContent.includes('When loading the graph') ||
        textContent.includes('models were not found')
      ) {
        console.log('[MissingModelsDownloader] Found missing models dialog')

        // Add a small delay to ensure dialog is fully rendered
        setTimeout(() => {
          enhanceMissingModelsDialog(element)
        }, 100)
      }
    }

    function enhanceMissingModelsDialog(dialogElement: HTMLElement) {
      // Don't enhance twice
      if (dialogElement.dataset.enhancedWithDownloads) {
        return
      }
      dialogElement.dataset.enhancedWithDownloads = 'true'

      // Find model entries in the dialog
      const modelEntries = findModelEntries(dialogElement)

      if (modelEntries.length === 0) {
        console.log(
          '[MissingModelsDownloader] No model entries found in dialog'
        )
        return
      }

      console.log(
        `[MissingModelsDownloader] Found ${modelEntries.length} missing models`
      )

      // Add download button to each model
      modelEntries.forEach((entry) => {
        addDownloadButton(entry)
      })

      // Add "Download All" button if multiple models
      if (modelEntries.length > 1) {
        addDownloadAllButton(dialogElement, modelEntries)
      }
    }

    function findModelEntries(dialogElement: HTMLElement): ModelEntry[] {
      const entries: ModelEntry[] = []

      // Look for list items containing model paths
      const listItems = dialogElement.querySelectorAll(
        'li, .model-item, [class*="missing"]'
      )

      listItems.forEach((item) => {
        const text = item.textContent || ''
        // Pattern: folder.filename or folder/filename
        if (text.match(/\w+[\.\/]\w+/)) {
          // Look for URL in the same element or nearby
          const link = item.querySelector('a') as HTMLAnchorElement
          let url: string | undefined = link?.href

          // If no direct link, look for URL in the text or parent element
          if (!url) {
            url = extractUrlFromElement(item as HTMLElement)
          }

          entries.push({
            element: item as HTMLElement,
            text: text.trim(),
            url: url
          })
        }
      })

      // Also check for any divs or spans that might contain model names
      if (entries.length === 0) {
        const textElements = dialogElement.querySelectorAll('div, span, p')
        textElements.forEach((elem) => {
          const text = elem.textContent || ''
          if (text.match(/\w+\.\w+/) && !elem.querySelector('button')) {
            // Check if this looks like a model filename
            const parts = text.split(/[\.\/]/)
            if (
              parts.length >= 2 &&
              looksLikeModelName(parts[parts.length - 1])
            ) {
              const link = elem.querySelector('a') as HTMLAnchorElement
              let url: string | undefined = link?.href

              if (!url) {
                url = extractUrlFromElement(elem as HTMLElement)
              }

              entries.push({
                element: elem as HTMLElement,
                text: text.trim(),
                url: url
              })
            }
          }
        })
      }

      return entries
    }

    function extractUrlFromElement(element: HTMLElement): string | undefined {
      // Try to find URL in the element or its siblings
      const parent = element.parentElement
      if (!parent) return undefined

      // Look for links in the same container
      const links = parent.querySelectorAll('a')
      for (const link of links) {
        const href = (link as HTMLAnchorElement).href
        if (
          href &&
          (href.includes('http') ||
            href.includes('huggingface') ||
            href.includes('civitai'))
        ) {
          return href
        }
      }

      // Try to extract URL from text
      const html = parent.innerHTML
      const urlPatterns = [
        /href="([^"]+)"/gi,
        /https?:\/\/[^\s<>"]+/gi,
        /huggingface\.co\/[^\s<>"]+/gi,
        /civitai\.com\/[^\s<>"]+/gi,
        /github\.com\/[^\s<>"]+/gi
      ]

      for (const pattern of urlPatterns) {
        const matches = html.match(pattern)
        if (matches && matches.length > 0) {
          // Clean up the URL
          let url = matches[0]
          if (url.startsWith('href="')) {
            url = url.substring(6, url.length - 1)
          }
          return url
        }
      }

      return undefined
    }

    function looksLikeModelName(filename: string): boolean {
      const modelExtensions = ['safetensors', 'ckpt', 'pt', 'pth', 'bin']
      const lower = filename.toLowerCase()
      return modelExtensions.some((ext) => lower.includes(ext))
    }

    function addDownloadButton(entry: ModelEntry) {
      const { element, text, url } = entry

      // Check if button already added
      if (element.querySelector('[data-download-button]')) {
        console.log(
          '[MissingModelsDownloader] Button already exists for:',
          text
        )
        return
      }

      // Parse model info from text
      const modelInfo = parseModelInfo(text)
      if (!modelInfo) return

      // Create a container for button and status
      const container = document.createElement('span')
      container.setAttribute('data-download-button', 'true')
      container.style.cssText =
        'margin-left: 10px; display: inline-flex; align-items: center; gap: 8px;'

      // Create download button
      const btn = document.createElement('button')
      btn.textContent = 'Download'
      btn.style.cssText = `
        padding: 4px 12px;
        background: #4CAF50;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
        font-weight: 500;
        transition: all 0.2s ease;
      `

      // Create status element
      const status = document.createElement('span')
      status.style.cssText = 'font-size: 12px; color: #666; min-width: 150px;'

      // Check if we have a URL (from dialog or known sources)
      const knownUrl = getKnownUrl(modelInfo.folder, modelInfo.filename)
      const downloadUrl = url || knownUrl

      if (downloadUrl) {
        btn.style.background = '#2196F3'
      } else {
        btn.style.background = '#FFC107'
        btn.title = 'Click to enter URL'
      }

      btn.onclick = () =>
        startDownload(modelInfo, btn, status, downloadUrl || undefined)

      container.appendChild(btn)
      container.appendChild(status)
      element.appendChild(container)

      entry.button = btn
      entry.statusElement = status
    }

    function parseModelInfo(text: string): ModelInfo | null {
      // Try different patterns
      const patterns = [
        /(\w+)\.(\w+(?:\.\w+)*)/, // folder.filename
        /(\w+)\/(\w+(?:\.\w+)*)/, // folder/filename
        /^(\w+(?:\.\w+)*)$/ // just filename
      ]

      for (const pattern of patterns) {
        const match = text.match(pattern)
        if (match) {
          if (match.length === 2) {
            // Just filename, try to guess folder
            return {
              folder: guessFolder(match[1]),
              filename: match[1]
            }
          } else {
            return {
              folder: match[1],
              filename: match[2]
            }
          }
        }
      }

      return null
    }

    function guessFolder(filename: string): string {
      const lower = filename.toLowerCase()
      if (lower.includes('vae')) return 'vae'
      if (lower.includes('lora')) return 'loras'
      if (lower.includes('control')) return 'controlnet'
      if (lower.includes('upscale') || lower.includes('esrgan'))
        return 'upscale_models'
      if (lower.includes('clip')) return 'clip'
      if (lower.includes('unet') || lower.includes('flux')) return 'unet'
      return 'checkpoints'
    }

    function getKnownUrl(folder: string, filename: string): string | null {
      const repo = modelRepositories[folder]
      if (repo && repo[filename]) {
        return repo[filename]
      }

      // Try alternate folders
      const alternateFolders: Record<string, string> = {
        text_encoders: 'clip',
        diffusion_models: 'unet'
      }

      const altFolder = alternateFolders[folder]
      if (altFolder) {
        const altRepo = modelRepositories[altFolder]
        if (altRepo && altRepo[filename]) {
          return altRepo[filename]
        }
      }

      return null
    }

    async function startDownload(
      modelInfo: ModelInfo,
      button: HTMLButtonElement,
      status: HTMLElement,
      providedUrl?: string
    ) {
      let url = providedUrl

      if (!url) {
        // Create inline URL input instead of prompt
        const input = document.createElement('input')
        input.type = 'text'
        input.placeholder = 'Enter download URL...'
        input.style.cssText =
          'padding: 4px 8px; border: 1px solid #ccc; border-radius: 4px; font-size: 12px; width: 250px;'

        const submitBtn = document.createElement('button')
        submitBtn.textContent = 'OK'
        submitBtn.style.cssText =
          'margin-left: 4px; padding: 4px 8px; background: #2196F3; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;'

        // Hide button and show input
        button.style.display = 'none'
        const container = button.parentElement
        if (container) {
          container.insertBefore(input, status)
          container.insertBefore(submitBtn, status)
          input.focus()
        }

        const handleSubmit = () => {
          url = input.value.trim()
          if (url) {
            input.remove()
            submitBtn.remove()
            button.style.display = 'inline-block'
            proceedWithDownload(url)
          } else {
            status.textContent = 'URL required'
            status.style.color = '#F44336'
          }
        }

        submitBtn.onclick = handleSubmit
        input.onkeypress = (e) => {
          if (e.key === 'Enter') handleSubmit()
        }

        // Cancel on Escape
        input.onkeydown = (e) => {
          if (e.key === 'Escape') {
            input.remove()
            submitBtn.remove()
            button.style.display = 'inline-block'
          }
        }

        return
      }

      proceedWithDownload(url)

      async function proceedWithDownload(downloadUrl: string) {
        // Update button state
        button.textContent = 'Starting...'
        button.disabled = true
        button.style.background = '#FF9800'
        status.textContent = 'Connecting...'
        status.style.color = '#FF9800'

        try {
          const response = await api.fetchApi('/models/download', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              url: downloadUrl,
              model_type: modelInfo.folder,
              filename: modelInfo.filename
            })
          })

          const data = await response.json()

          if (response.ok) {
            console.log(
              `[MissingModelsDownloader] Started download: ${data.task_id}`
            )
            activeDownloads.set(data.task_id, {
              button,
              modelInfo,
              statusElement: status
            })
            monitorDownload(data.task_id, button, status)
          } else {
            button.textContent = 'Retry'
            button.style.background = '#F44336'
            button.disabled = false
            status.textContent = data.error || 'Download not available'
            status.style.color = '#F44336'

            // If backend doesn't support downloads, show help text
            if (response.status === 501) {
              status.innerHTML =
                '<a href="' +
                downloadUrl +
                '" target="_blank" style="color: #2196F3;">Open URL</a> to download manually'
            }
          }
        } catch (error) {
          console.error('[MissingModelsDownloader] Download error:', error)
          button.textContent = 'Retry'
          button.style.background = '#F44336'
          button.disabled = false
          status.textContent = 'Connection error'
          status.style.color = '#F44336'
        }
      }
    }

    async function monitorDownload(
      taskId: string,
      button: HTMLButtonElement,
      statusElement: HTMLElement
    ) {
      const checkStatus = async () => {
        try {
          const response = await api.fetchApi(`/models/download/${taskId}`)
          const status: DownloadTask = await response.json()

          if (!response.ok) {
            button.textContent = 'Failed'
            button.style.background = '#F44336'
            button.disabled = false
            statusElement.textContent = status.error || 'Download failed'
            statusElement.style.color = '#F44336'
            activeDownloads.delete(taskId)
            return
          }

          switch (status.status) {
            case 'completed':
              button.textContent = '✓ Done'
              button.style.background = '#4CAF50'
              button.disabled = true
              statusElement.textContent = 'Download complete'
              statusElement.style.color = '#4CAF50'
              activeDownloads.delete(taskId)
              return

            case 'failed':
              button.textContent = 'Retry'
              button.style.background = '#F44336'
              button.disabled = false
              statusElement.textContent = status.error || 'Download failed'
              statusElement.style.color = '#F44336'
              activeDownloads.delete(taskId)
              return

            case 'downloading':
              const progress = status.progress || 0
              button.textContent = `${Math.round(progress)}%`
              if (status.downloaded_size && status.total_size) {
                const mb = (size: number) => (size / 1024 / 1024).toFixed(1)
                statusElement.textContent = `${mb(status.downloaded_size)} / ${mb(status.total_size)} MB`
                statusElement.style.color = '#2196F3'
              }
              setTimeout(checkStatus, 1000)
              break

            case 'paused':
              button.textContent = 'Resume'
              button.style.background = '#9E9E9E'
              statusElement.textContent = 'Paused'
              statusElement.style.color = '#9E9E9E'
              setTimeout(checkStatus, 2000)
              break

            default:
              button.textContent = status.status
              statusElement.textContent = ''
              setTimeout(checkStatus, 1000)
          }
        } catch (error) {
          console.error('[MissingModelsDownloader] Status check error:', error)
          setTimeout(checkStatus, 2000)
        }
      }

      checkStatus()
    }

    function addDownloadAllButton(
      dialogElement: HTMLElement,
      entries: ModelEntry[]
    ) {
      // Find dialog footer or create one
      let footer = dialogElement.querySelector(
        '.p-dialog-footer, .dialog-footer, footer'
      )
      if (!footer) {
        footer = document.createElement('div')
        footer.className = 'dialog-footer'
        ;(footer as HTMLElement).style.cssText =
          'padding: 10px; border-top: 1px solid #ccc; margin-top: 10px;'
        dialogElement.appendChild(footer)
      }

      const btn = document.createElement('button')
      btn.textContent = `Download All (${entries.length})`
      btn.style.cssText = `
        padding: 6px 16px;
        background: #4CAF50;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 14px;
        font-weight: 500;
      `

      btn.onclick = () => {
        entries.forEach((entry) => {
          if (entry.button && !entry.button.disabled) {
            entry.button.click()
          }
        })
        btn.disabled = true
        btn.textContent = 'Downloads Started'
        btn.style.background = '#9E9E9E'
      }

      footer.appendChild(btn)
    }

    // Cleanup on unload
    const cleanup = () => {
      activeDownloads.forEach((_state, taskId) => {
        // Cancel any active downloads
        api.fetchApi(`/models/download/${taskId}/cancel`, {
          method: 'POST'
        })
      })
      activeDownloads.clear()
    }

    // Register cleanup on window unload
    window.addEventListener('beforeunload', cleanup)
  }
})
