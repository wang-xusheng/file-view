import { expose } from 'comlink'
import { MainModule } from '@/assets/libheif-wasm/libheif.js'

const libheifPath = new URL('../assets/libheif-wasm/libheif.wasm', import.meta.url).toString()
// 动态导入 libheif.
let libheifModule: MainModule | null = null
let initPromise: Promise<void> | null = null

// Worker 中的 Blob 缓存（缓存已解码的 Blob）
const blobCache = new Map<string, Blob>()

/**
 * 初始化 libheif-wasm 模块
 */
const initLibheif = async () => {
  if (libheifModule) {
    return initPromise
  }

  if (initPromise) {
    return initPromise
  }

  initPromise = (async () => {
    try {
      // 动态导入 libheif
      const libheif = (await import('@/assets/libheif-wasm/libheif.js')).default

      // 异步加载 WASM 文件
      const wasmResponse = await fetch(libheifPath)
      if (!wasmResponse.ok) {
        throw new Error(`Failed to load WASM file: ${wasmResponse.status}`)
      }
      const wasmBinary = await wasmResponse.arrayBuffer()

      // 初始化 libheif 模块
      libheifModule = await libheif({
        wasmBinary,
      })

      console.log('[HEIC Worker] libheif-wasm 初始化成功')
    } catch (error) {
      console.error('[HEIC Worker] Failed to initialize libheif:', error)
      throw error
    }
  })()

  return initPromise
}

/**
 * 将 ImageData 转换为 AVIF Blob
 * @param imageData - ImageData 对象
 * @returns AVIF Blob
 */
const imageDataToBlob = async (imageData: ImageData): Promise<Blob> => {
  // 在 Worker 中创建 OffscreenCanvas
  const canvas = new OffscreenCanvas(imageData.width, imageData.height)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('无法获取 OffscreenCanvas context')

  ctx.putImageData(imageData, 0, 0)

  // 转换为 Blob（convertToBlob 方法在 src/types/offscreen-canvas.d.ts 中扩展）
  const blob = await canvas.convertToBlob({ type: 'image/avif', quality: 0.9 })
  return blob
}

/**
 * 将 HEIC 文件转换为 Blob
 * @param heicUrl HEIC 文件的 URL
 * @returns 转换后的 Blob
 */
const convertHEICToBlob = async (heicUrl: string): Promise<Blob> => {
  // 检查缓存
  if (blobCache.has(heicUrl)) {
    console.log('[HEIC Worker] 从缓存返回 Blob:', heicUrl)
    return blobCache.get(heicUrl)!
  }

  try {
    // 确保 libheif 已初始化
    await initLibheif()

    if (!libheifModule) {
      throw new Error('libheif module not initialized')
    }

    console.log('[HEIC Worker] 开始转换:', heicUrl)

    // 1. 获取 HEIC 文件的 ArrayBuffer
    const response = await fetch(heicUrl)
    const arrayBuffer = await response.arrayBuffer()

    // 2. 使用 libheif 解码 HEIC
    const uint8Array = new Uint8Array(arrayBuffer)
    // 创建解码器实例
    const decoder = new libheifModule.HeifDecoder()

    // 解码图像，返回 HeifImage 数组
    const images = decoder.decode(uint8Array)
    if (!images || images.length === 0) {
      throw new Error('HEIC 文件中没有图像')
    }

    // 获取第一张图像
    const heifImage = images[0]

    // 获取图像的宽高
    const width = heifImage.get_width()
    const height = heifImage.get_height()

    // 创建 ImageData 对象
    const imageData = new ImageData(width, height)

    // 使用 display 方法解码图像为 RGBA 格式并填充到 imageData
    await new Promise<void>((resolve, reject) => {
      heifImage.display(imageData, (result: ImageData | null) => {
        if (result) {
          resolve()
        } else {
          reject(new Error('解码图像失败'))
        }
      })
    })
    // 3. 转为 Blob
    const imageBlob = await imageDataToBlob(imageData)
    // 清理资源
    heifImage.free()

    // 缓存 Blob
    blobCache.set(heicUrl, imageBlob)

    console.log('[HEIC Worker] 转换成功:', heicUrl)

    return imageBlob
  } catch (error) {
    console.error('[HEIC Worker] HEIC 转换失败:', error)
    throw error
  }
}

/**
 * 清除特定 URL 的缓存
 */
const clearCache = (heicUrl?: string) => {
  if (heicUrl) {
    blobCache.delete(heicUrl)
    console.log('[HEIC Worker] 清除缓存:', heicUrl)
  } else {
    blobCache.clear()
    console.log('[HEIC Worker] 清除所有缓存')
  }
}

/**
 * 获取缓存大小
 */
const getCacheSize = () => {
  return blobCache.size
}

// 暴露 Worker API
const workerApi = {
  convertHEICToBlob,
  clearCache,
  getCacheSize,
}

expose(workerApi)

export type HeicWorkerApi = typeof workerApi
