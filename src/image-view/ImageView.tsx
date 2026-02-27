import React, { useEffect, useRef, useState } from 'react'
import { fabric } from 'fabric'
import { useDebounce, useEventListener, useSize } from 'ahooks'
import {  Button, Image } from 'antd'
import {
  FullscreenOutlined,
  RotateLeftOutlined,
  RotateRightOutlined,
  ZoomInOutlined,
  ZoomOutOutlined,
} from '@ant-design/icons'

import './index.scss'
import { loadHEICAsImage } from './loadImage'

export interface IPhotoViewProps {
  url: string
  leftDom?: React.ReactNode
  fileName?: string
}

interface IImageState {
  instance: fabric.Image | null
  initialScale: number
  rotation: number
  zoomLevel: number
}

const PhotoView: React.FC<IPhotoViewProps> = ({ url, leftDom }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasInstanceRef = useRef<fabric.Canvas | null>(null)

  const [zoomScale, setZoomScale] = useState('100%')

  const [imageState, setImageState] = useState<IImageState>({
    instance: null,
    initialScale: 1,
    rotation: 0,
    zoomLevel: 1,
  })

  const containerSize = useDebounce(useSize(containerRef), { wait: 100 })

  const [previewVisible, setPreviewVisible] = useState(false)
  const imageUrlEncoded = useRef(url)

  // 实际应用缩放到图像
  const applyZoom = (newZoomPercent: number) => {
    if (!canvasInstanceRef.current || !imageState.instance) return

    // 确保缩放比例在合理范围内 (10% - 500%)
    const zoomPercent = Math.min(Math.max(newZoomPercent, 10), 500)

    // 更新UI显示的缩放百分比
    setZoomScale(`${zoomPercent}%`)

    const newZoomLevel = zoomPercent / 100

    // 计算新缩放比例
    const newScale = imageState.initialScale * newZoomLevel

    // 获取canvas实例
    const canvas = canvasInstanceRef.current

    // 应用新的缩放比例
    imageState.instance.scale(newScale)

    // 更新坐标
    imageState.instance.setCoords()

    // 更新状态
    setImageState({
      ...imageState,
      zoomLevel: newZoomLevel,
    })

    canvas.renderAll()
  }

  // 增加缩放比例
  const zoomIn = () => {
    const currentZoom = parseInt(zoomScale.replace('%', ''))
    applyZoom(currentZoom + 10)
  }

  // 减少缩放比例
  const zoomOut = () => {
    const currentZoom = parseInt(zoomScale.replace('%', ''))
    applyZoom(currentZoom - 10)
  }

  // 旋转图像
  const rotateImage = (direction: 'left' | 'right') => {
    if (!canvasInstanceRef.current || !imageState.instance) return

    // 计算新的旋转角度 (每次旋转90度)
    const rotationChange = direction === 'left' ? -90 : 90
    const newRotation = (imageState.rotation + rotationChange) % 360

    // 获取canvas实例
    const canvas = canvasInstanceRef.current

    // 应用旋转
    imageState.instance.rotate(newRotation)

    // 获取画布中心点
    const canvasCenterX = canvas.width! / 2
    const canvasCenterY = canvas.height! / 2

    // 将图像放置在画布中心
    imageState.instance.set({
      left: canvasCenterX,
      top: canvasCenterY,
    })

    // 更新坐标
    imageState.instance.setCoords()

    // 更新状态
    setImageState({
      ...imageState,
      rotation: newRotation,
    })

    canvas.renderAll()
  }

  // 检查是否是 HEIC 格式
  const isHEICImage = (url: string) => {
    return /\.(heic|heif)$/i.test(url)
  }
  // 初始化canvas和图片
  useEffect(() => {
    if (canvasRef.current && containerSize && containerSize.width > 0 && containerSize.height > 0) {
      // 清理旧的canvas实例
      try {
        if (canvasInstanceRef.current) {
          // 检查 canvas 实例是否有效以及相关的 DOM 元素是否存在
          const canvasInstance = canvasInstanceRef.current
          if (canvasInstance && canvasInstance.getElement && canvasInstance.getElement()) {
            canvasInstance.dispose()
          }
        }
        canvasInstanceRef.current = null
      } catch (error) {
        console.error('Canvas dispose error:', error)
        canvasInstanceRef.current = null
      }

      // 设置canvas尺寸
      canvasRef.current.width = containerSize.width
      canvasRef.current.height = containerSize.height

      // 初始化 Fabric canvas
      const canvas = new fabric.Canvas(canvasRef.current)
      canvasInstanceRef.current = canvas
      canvas.setDimensions({ width: containerSize.width, height: containerSize.height })

      // 加载图片并调整大小
      const loadImage = async () => {
        let imageUrlToLoad = url

        // 如果是 HEIC 格式，先转换
        if (isHEICImage(url)) {
          try {
            imageUrlToLoad = await loadHEICAsImage(url)
          } catch (error) {
            console.error('HEIC 图像转换失败:', error)
            // 转换失败时仍尝试使用原始 URL
            imageUrlToLoad = url
          }
        }
        imageUrlEncoded.current = imageUrlToLoad
        fabric.Image.fromURL(imageUrlToLoad, (img: fabric.Image) => {
          const imgWidth = img.width || 0
          const imgHeight = img.height || 0

          if (imgWidth && imgHeight) {
            // 计算缩放比例，确保图片完全显示
            const scaleX = containerSize.width / imgWidth
            const scaleY = containerSize.height / imgHeight
            const initialScale = Math.min(scaleX, scaleY)
            const scale = initialScale // 取最小缩放比以确保完全显示
            setZoomScale(`100%`)

            img.scale(scale)

            // 居中显示
            img.set({
              originX: 'center',
              originY: 'center',
              left: containerSize.width / 2,
              top: containerSize.height / 2,
              hoverCursor: 'default', // 鼠标悬停时显示默认光标
            })

            canvas.add(img)
            canvas.renderAll()

            // 保存图像实例和初始缩放比例
            setImageState({
              instance: img,
              initialScale,
              rotation: 0,
              zoomLevel: 1,
            })
          }
        })
      }

      loadImage()
    }

    return () => {
      // 组件卸载时的清理函数，更安全的 canvas 销毁
      if (canvasInstanceRef.current) {
        try {
          const canvasInstance = canvasInstanceRef.current
          // 检查 canvas 实例是否有效且 DOM 元素仍然存在
          if (
            canvasInstance &&
            canvasInstance.getElement &&
            canvasInstance.getElement() &&
            canvasInstance.getElement().parentNode
          ) {
            canvasInstance.dispose()
          }
        } catch (error) {
          console.error('Canvas cleanup error:', error)
        } finally {
          canvasInstanceRef.current = null
        }
      }
    }
  }, [url, containerSize])

  useEventListener(
    'wheel',
    (e: WheelEvent) => {
      e.preventDefault()
      if (e.deltaY < 0) {
        zoomIn()
      } else {
        zoomOut()
      }
    },
    { target: containerRef }
  )

  useEventListener(
    'wheel',
    (e: WheelEvent) => {
      if (document.querySelector('.PhotoView__PhotoWrap')) {
        e.preventDefault()
      }
    },
    { target: document.querySelector('.PhotoView__PhotoWrap'), passive: false }
  )

  return (
    <div className="photo-view">
      <div className="photo-view-tools">
        <div className="photo-view-tools-left">{leftDom}</div>
        <div className="photo-view-tools-right">
          <div className="zoom-buttons">
            <Button
              className="custom-button-base-style"
              type="text"
              size="small"
              icon={<ZoomOutOutlined />}
              onClick={zoomOut}
            />
            <span className="zoom-scale-label">{zoomScale}</span>
            <Button
              className="custom-button-base-style"
              type="text"
              size="small"
              icon={<ZoomInOutlined />}
              onClick={zoomIn}
            />
          </div>
          <div className="rotate-buttons">
            <Button
              className="custom-button-base-style"
              type="text"
              size="small"
              icon={<RotateLeftOutlined />}
              onClick={() => rotateImage('left')}
            />
            <Button
              className="custom-button-base-style"
              type="text"
              size="small"
              icon={<RotateRightOutlined />}
              onClick={() => rotateImage('right')}
            />
          </div>
          <div className="rotate-buttons rotate-buttons--single">
            <Button
              className="custom-button-base-style"
              type="text"
              size="small"
              icon={<FullscreenOutlined />}
              onClick={() => {
                setPreviewVisible(true)
              }}
            />
          </div>
        </div>
      </div>
      <div ref={containerRef} className="photo-canvas-wrapper">
        <canvas ref={canvasRef} />
      </div>
      <Image
        width={200}
        style={{ display: 'none' }}
        alt="basic image"
        src="https://zos.alipayobjects.com/rmsportal/jkjgkEfvpUPVyRjUImniVslZfWPnJuuZ.png?x-oss-process=image/blur,r_50,s_50/quality,q_1/resize,m_mfit,h_200,w_200"
        preview={{
          open: previewVisible,
          src: imageUrlEncoded.current,
          onOpenChange: (value) => {
            setPreviewVisible(value);
          },
        }}
      />
    </div>
  )
}

export default PhotoView
