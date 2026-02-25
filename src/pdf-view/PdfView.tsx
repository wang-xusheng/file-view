import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import LazyPage from './LazyPage'

import { Button, Modal, Spin } from 'antd'
import {
  DownloadOutlined,
  FullscreenExitOutlined,
  FullscreenOutlined,
  RotateLeftOutlined,
  RotateRightOutlined,
  ZoomInOutlined,
  ZoomOutOutlined,
} from '@ant-design/icons'
import unknowFile from '../assets/img/unknow-file.svg'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'
import './index.scss'
import { downloadFile, redirectToUrl } from '../utils'
import { useDebounceEffect, useSize } from 'ahooks'

pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()
export interface AttachViewProps {
  /**
   * PDF 文件的 URL 地址。若 URL 后缀不是 `.pdf`，将显示「文件无法预览」提示。
   */
  url?: string
  /**
   * 渲染在工具栏左侧的自定义内容，可用于展示文件名、标题或操作按钮等。
   */
  leftDom?: React.ReactNode
  /**
   * 文件名称，用于下载时的默认文件名，以及全屏预览弹窗的标题和无法预览时的提示信息。
   */
  fileName?: string
}

const DEFAULT_SCALE = 0.9

const PdfView: React.FC<AttachViewProps> = (props) => {
  const { url, fileName, leftDom } = props

  const pdfOptions = useMemo(
    () => ({
      wasmUrl: `pdfjs-dist/wasm/`,
      cMapUrl: 'pdfjs-dist/cmaps/',
      cMapPacked: true,
    }),
    []
  )
  const [numPages, setNumPages] = useState<number | null>(null)
  const [pageDimensions, setPageDimensions] = useState<{
    width: number
    height: number
  } | null>(null)
  const pageRef = useRef<pdfjs.PDFPageProxy | null>(null)
  const documentRef = useRef<pdfjs.PDFDocumentProxy | null>(null)
  const [scale, setScale] = useState(DEFAULT_SCALE)
  const [rotation, setRotation] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const attachViewRef = useRef<HTMLDivElement>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const attachViewWidth = useSize(attachViewRef)?.width
  const ispdf = url?.split('.').pop()?.toLowerCase() === 'pdf'

  const onDocumentLoadSuccess = useCallback((pdf: pdfjs.PDFDocumentProxy) => {
    documentRef.current = pdf
    setNumPages(pdf.numPages)
    setError(null)
  }, [])

  const onDocumentLoadError = useCallback((err: Error) => {
    setError('无法加载PDF文件。请检查文件链接或网络连接。')
    console.error(err)
  }, [])

  useDebounceEffect(() => {
    if (attachViewWidth && pageRef.current) {
      const { width: defaultPageWidth } = pageRef.current.getViewport({
        scale: 1.0,
        rotation: pageRef.current.rotate || 0,
      })
      setScale(((attachViewWidth || 595) / defaultPageWidth) * DEFAULT_SCALE)
    }
  }, [attachViewWidth])

  const onPageLoadSuccess = (page: pdfjs.PDFPageProxy) => {
    pageRef.current = page
    if (!pageDimensions) {
      const { width: defaultPageWidth } = page.getViewport({
        scale: 1.0,
        rotation: page.rotate || 0,
      })

      const scaleFactor = (attachViewWidth || 595) / defaultPageWidth

      const { width: pageWidth, height: pageHeight } = page.getViewport({
        scale: scaleFactor * DEFAULT_SCALE,
        rotation: page.rotate || 0,
      })

      setPageDimensions({ width: pageWidth, height: pageHeight })

      setRotation(0)
      setScale(scaleFactor * DEFAULT_SCALE)
    }
  }

  const changeScale = (offset: number) => {
    const newScale = Math.max(0.01, scale + (scale > 0.3 ? offset : offset * 0.1))
    setScale(newScale)
  }

  const changeRotation = (offset: number) => {
    setRotation((prevRotation) => (prevRotation + offset + 360) % 360)
  }

  const cleanup = useCallback(() => {
    if (pageRef.current) {
      pageRef.current.cleanup()
      pageRef.current = null
    }
    documentRef.current = null

    setNumPages(null)
    setPageDimensions(null)
    setScale(DEFAULT_SCALE)
    setRotation(0)
    setError(null)
  }, [])

  useEffect(() => {
    if (pageRef.current) {
      const { width: pageWidth, height: pageHeight } = pageRef.current.getViewport({
        scale,
        rotation,
      })
      setPageDimensions({ width: pageWidth, height: pageHeight })
    }
  }, [scale, rotation])

  useEffect(() => {
    cleanup()
  }, [url])

  useEffect(() => {
    return () => {
      cleanup()
    }
  }, [])

  return (
    <div className="attach-view" ref={attachViewRef}>
      {/* --- 控制栏 --- */}
      <div className="attach-view-tools">
        <div className="attach-view-tools-left">{leftDom}</div>
        <div className="attach-view-tools-right">
          <div className="rotate-buttons btn-28">
            <Button
              className="custom-button-base-style"
              size="small"
              icon={<DownloadOutlined />}
              onClick={() => url && downloadFile(url, fileName)}
            />
          </div>
          <div className="zoom-buttons">
            <Button
              className="custom-button-base-style"
              disabled={!ispdf}
              size="small"
              icon={<ZoomOutOutlined />}
              onClick={() => changeScale(-0.1)}
            />
            <span className="zoom-percent">
              {`${Math.round(scale * 100)}%`}
            </span>
            <Button
              className="custom-button-base-style"
              disabled={!ispdf}
              size="small"
              icon={<ZoomInOutlined />}
              onClick={() => changeScale(0.1)}
            />
          </div>
          <div className="rotate-buttons btn-54">
            <Button
              className="custom-button-base-style"
              disabled={!ispdf}
              size="small"
              icon={<RotateLeftOutlined />}
              onClick={() => changeRotation(-90)}
            />
            <Button
              className="custom-button-base-style"
              disabled={!ispdf}
              size="small"
              icon={<RotateRightOutlined />}
              onClick={() => changeRotation(90)}
            />
          </div>
          <div className="rotate-buttons btn-28">
            <Button
              className="custom-button-base-style"
              disabled={!ispdf}
              size="small"
              icon={isFullscreen ? <FullscreenExitOutlined /> : <FullscreenOutlined />}
              onClick={() => setIsFullscreen(!isFullscreen)}
            />
          </div>
        </div>
      </div>

      {/* --- PDF 显示区 --- */}
      <div className="pdf-container">
        <div
          className="pdf-viewer-area"
          ref={containerRef}
          style={
            pageDimensions?.width
              ? ({ '--page-width': `${pageDimensions.width}px` } as React.CSSProperties)
              : undefined
          }
        >
          {error && <div className="error-message">{error}</div>}
          {ispdf ? (
            <Document
              options={pdfOptions}
              className="document-content"
              file={url}
              onLoadSuccess={onDocumentLoadSuccess}
              onLoadError={onDocumentLoadError}
              externalLinkTarget="_blank"
              loading={
                <div className="document-loading">
                  <Spin />
                </div>
              }
            >
              {!pageDimensions && numPages && (
                <Page
                  pageNumber={1}
                  onLoadSuccess={onPageLoadSuccess}
                  className="hidden-page"
                />
              )}

              {pageDimensions &&
                Array.from(new Array(numPages), (el, index) => {
                  return (
                    <LazyPage
                      key={`page_${index}`}
                      pageNumber={index + 1}
                      scale={scale}
                      rotation={rotation}
                      width={pageDimensions.width}
                      height={pageDimensions.height}
                    />
                  )
                })}
            </Document>
          ) : (
            <div className="unknown-file-container">
              <img src={unknowFile} alt="unknow-file" />
              <p className="unknown-file-title">文件无法预览</p>
              {fileName && (
                <p className="unknown-file-text">附件名称：{fileName}</p>
              )}
              <p className="unknown-file-text">点击上方「下载」可本地自行查看</p>
            </div>
          )}
        </div>
      </div>

      {isFullscreen && (
        <Modal
          open={isFullscreen}
          onCancel={() => setIsFullscreen(false)}
          title={fileName || 'PDF 预览'}
          width="80%"
          footer={[
            <Button key="newTab" onClick={() => url && redirectToUrl(url, true)}>
              新标签页打开
            </Button>,
            <Button key="close" type="primary" onClick={() => setIsFullscreen(false)}>
              关闭
            </Button>,
          ]}
        >
          <iframe src={url} style={{ width: '100%', height: 'calc(100vh - 300px)', border: 'none' }} />
        </Modal>
      )}
    </div>
  )
}

export default PdfView
