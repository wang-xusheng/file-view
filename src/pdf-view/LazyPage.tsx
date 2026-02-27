import React, { useRef, useState, useEffect } from 'react'
import { Page, pdfjs } from 'react-pdf'
import { useInViewport } from 'ahooks'
import { Spin } from 'antd'

interface LazyPageProps {
  pageNumber: number
  scale: number
  rotation: number
  width: number
  height: number
}

const LazyPage = (props: LazyPageProps) => {
  const { pageNumber, scale, rotation, width, height } = props
  const ref = useRef(null)
  const [inViewport] = useInViewport(ref)
  const pageRef = useRef<pdfjs.PDFPageProxy | null>(null)
  const [shouldLoadPage, setShouldLoadPage] = useState(false)
  const [pageRotation, setPageRotation] = useState(0)

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null

    if (inViewport) {
      timer = setTimeout(() => {
        setShouldLoadPage(true)
      }, 50)
    } else {
      setShouldLoadPage(false)
    }

    return () => {
      if (timer) {
        clearTimeout(timer)
      }
    }
  }, [inViewport])

  const onPageLoadSuccess = (page: pdfjs.PDFPageProxy) => {
    pageRef.current = page
    setPageRotation(page.rotate || 0)
  }

  return (
    <div ref={ref} className="page-placeholder">
      {shouldLoadPage ? (
        <Page
          pageNumber={pageNumber}
          scale={scale}
          rotate={rotation + pageRotation}
          renderTextLayer={true}
          renderAnnotationLayer={true}
          onLoadSuccess={onPageLoadSuccess}
          loading={
            <div className="page-loading" style={{ width, height }}>
              <Spin />
            </div>
          }
        />
      ) : (
        <div className="placeholder-content" style={{ width, height }}>
          <Spin description={`加载第 ${pageNumber} 页中...`} />
        </div>
      )}
    </div>
  )
}

export default LazyPage
