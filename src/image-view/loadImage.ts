import { wrap, Remote } from 'comlink'
import type { HeicWorkerApi } from '@/workers/heic-worker'

// Worker 实例和 API
let worker: Worker | null = null
let workerApi: Remote<HeicWorkerApi> | null = null

// URL 缓存（主线程）
const urlCache = new Map<string, string>()

/**
 * 初始化 Worker
 */
const initWorker = () => {
  if (workerApi) {
    return workerApi
  }

  // 创建 Worker 实例
  worker = new Worker(new URL('@/workers/heic-worker.ts', import.meta.url), {
    type: 'module',
  })

  // 使用 Comlink 包装 Worker
  workerApi = wrap<HeicWorkerApi>(worker)

  return workerApi
}

/**
 * 将 HEIC 文件转换为 Image URL
 * 使用 Web Worker 处理转换，避免阻塞主线程
 * @param heicUrl HEIC 文件的 URL
 * @returns 转换后的 Blob URL
 */
export const loadHEICAsImage = async (heicUrl: string): Promise<string> => {
  // 检查主线程 URL 缓存
  if (urlCache.has(heicUrl)) {
    return urlCache.get(heicUrl)!
  }

  try {
    // 初始化 Worker
    const api = initWorker()

    // 调用 Worker 进行转换，获取 Blob
    const blob = await api.convertHEICToBlob(heicUrl)

    // 在主线程创建 Object URL
    const imageUrl = URL.createObjectURL(blob)

    return imageUrl
  } catch (error) {
    console.error('[HEIC] 转换失败:', error)
    throw error
  }
}
