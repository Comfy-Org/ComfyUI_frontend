/**
 * Manages in-memory cached file assets for the template publishing preview
 * step. Files are held as reactive refs with `blob:` URLs for local display.
 *
 * State is module-level so it persists across step navigation within the
 * publishing dialog but is lost on page reload.
 */
import type { Ref } from 'vue'
import { ref } from 'vue'

import type { CachedAsset } from '@/types/templateMarketplace'

/** Maximum number of images allowed in the example output gallery. */
export const MAX_GALLERY_IMAGES = 6

const thumbnail = ref<CachedAsset | null>(null)
const beforeImage = ref<CachedAsset | null>(null)
const afterImage = ref<CachedAsset | null>(null)
const videoPreview = ref<CachedAsset | null>(null)
const workflowPreview = ref<CachedAsset | null>(null)
const galleryImages = ref<CachedAsset[]>([])

/**
 * Creates a {@link CachedAsset} from a File, generating a blob URL for
 * local display.
 */
function cacheFile(file: File): CachedAsset {
  return {
    file,
    objectUrl: URL.createObjectURL(file),
    originalName: file.name
  }
}

/**
 * Replaces the value of a single-asset ref, revoking the previous blob URL
 * if one existed.
 *
 * @returns The blob URL of the newly cached asset.
 */
function setAsset(slot: Ref<CachedAsset | null>, file: File): string {
  if (slot.value) URL.revokeObjectURL(slot.value.objectUrl)
  slot.value = cacheFile(file)
  return slot.value.objectUrl
}

/**
 * Clears a single-asset ref and revokes its blob URL.
 */
function clearAsset(slot: Ref<CachedAsset | null>): void {
  if (slot.value) {
    URL.revokeObjectURL(slot.value.objectUrl)
    slot.value = null
  }
}

/**
 * Provides reactive access to all preview asset slots and methods to
 * populate, clear, and query them.
 */
export function useTemplatePreviewAssets() {
  /**
   * Adds an image to the example output gallery.
   *
   * @returns The blob URL of the added image, or `null` if the gallery
   *          is already at {@link MAX_GALLERY_IMAGES}.
   */
  function addGalleryImage(file: File): string | null {
    if (galleryImages.value.length >= MAX_GALLERY_IMAGES) return null
    const asset = cacheFile(file)
    galleryImages.value = [...galleryImages.value, asset]
    return asset.objectUrl
  }

  /**
   * Removes a gallery image by its index and revokes its blob URL.
   */
  function removeGalleryImage(index: number): void {
    const asset = galleryImages.value[index]
    if (!asset) return
    URL.revokeObjectURL(asset.objectUrl)
    galleryImages.value = galleryImages.value.filter((_, i) => i !== index)
  }

  /**
   * Revokes all blob URLs and resets every asset slot to its empty state.
   */
  function clearAll(): void {
    clearAsset(thumbnail)
    clearAsset(beforeImage)
    clearAsset(afterImage)
    clearAsset(videoPreview)
    clearAsset(workflowPreview)
    for (const asset of galleryImages.value) {
      URL.revokeObjectURL(asset.objectUrl)
    }
    galleryImages.value = []
  }

  return {
    thumbnail,
    beforeImage,
    afterImage,
    videoPreview,
    workflowPreview,
    galleryImages,
    setThumbnail: (file: File) => setAsset(thumbnail, file),
    clearThumbnail: () => clearAsset(thumbnail),
    setBeforeImage: (file: File) => setAsset(beforeImage, file),
    clearBeforeImage: () => clearAsset(beforeImage),
    setAfterImage: (file: File) => setAsset(afterImage, file),
    clearAfterImage: () => clearAsset(afterImage),
    setVideoPreview: (file: File) => setAsset(videoPreview, file),
    clearVideoPreview: () => clearAsset(videoPreview),
    setWorkflowPreview: (file: File) => setAsset(workflowPreview, file),
    clearWorkflowPreview: () => clearAsset(workflowPreview),
    addGalleryImage,
    removeGalleryImage,
    clearAll
  }
}
