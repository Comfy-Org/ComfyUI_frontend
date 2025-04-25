export interface ModelsDownloadSettings {
    settingId: string
      /**
     * Sources from we comfy can download models + optional customized download url during install
     */
    allowedSources: Array<string>
    /**
     * models extensions allowed to download
     */
    allowedSuffixes: Array<string>
    /**
     * Models that fail above conditions but are still allowed
     */
    whiteListedUrls: Set<string>
  }

  export const MODELS_DOWNLOAD_SETTINGS: ModelsDownloadSettings = {
    settingId: 'Comfy-Desktop.ModelsDownload.ExtraAllowedSource',
    allowedSources: ['https://civitai.com/', 'https://huggingface.co/'],
    allowedSuffixes:['.safetensors', '.sft'],
    whiteListedUrls: new Set([
        'https://huggingface.co/stabilityai/stable-zero123/resolve/main/stable_zero123.ckpt',
        'https://huggingface.co/TencentARC/T2I-Adapter/resolve/main/models/t2iadapter_depth_sd14v1.pth?download=true',
        'https://github.com/xinntao/Real-ESRGAN/releases/download/v0.1.0/RealESRGAN_x4plus.pth'
    ])
  }
