import { DownloadOutlined } from '@ant-design/icons'
import { LocaleType } from '@univerjs/presets'
import { UniverSheetsCorePreset } from '@univerjs/preset-sheets-core'
import UniverPresetSheetsCoreZhCN from '@univerjs/preset-sheets-core/locales/zh-CN'
import { UniverSheetsDrawingPreset } from '@univerjs/presets/preset-sheets-drawing'
import { createUniver, mergeLocales } from '@univerjs/presets'
import { useEventListener, useRequest } from 'ahooks'
import { Button, Spin } from 'antd'
import { useEffect, useRef } from 'react'
import { downloadFile } from '../utils'
import { loadAndConvert } from './convert'
import './index.scss'
import '@univerjs/preset-sheets-core/lib/index.css'
import '@univerjs/presets/lib/styles/preset-sheets-drawing.css'

export interface ExcelViewProps {
  /** .xlsx 文件的 URL 地址。 */
  url?: string
  /** 文件名称，用于下载时的默认文件名。 */
  fileName?: string
  /** 渲染在工具栏左侧的自定义内容。 */
  leftDom?: React.ReactNode
}

const ExcelView: React.FC<ExcelViewProps> = ({ url, fileName, leftDom }) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const univerRef = useRef<{ dispose: () => void } | null>(null)

  const { data, loading, error } = useRequest(
    () => (url ? loadAndConvert(url) : Promise.resolve(null)),
    { refreshDeps: [url] },
  )

  useEffect(() => {
    if (!containerRef.current || !data) return

    const { univerAPI } = createUniver({
      locale: LocaleType.ZH_CN,
      locales: {
        [LocaleType.ZH_CN]: mergeLocales(UniverPresetSheetsCoreZhCN),
      },
      presets: [
        UniverSheetsCorePreset({ container: containerRef.current,toolbar: false,formulaBar: false, }),
        UniverSheetsDrawingPreset(),
      ],
    })

    univerRef.current = { dispose: () => univerAPI.dispose() }
    univerAPI.createWorkbook(data)
    // workbook + 所有 worksheet 都需要设置只读，仅 setEditable(false) 不够
    const eventId = univerAPI.addEvent(univerAPI.Event.LifeCycleChanged, ({ stage }) => {
      if (stage === univerAPI.Enum.LifecycleStages.Rendered) {
        const fWorkbook = univerAPI.getActiveWorkbook()!
    
        // disable selection
        // fWorkbook.disableSelection()
    
        // set read only
        const permission = fWorkbook.getWorkbookPermission()
        permission.setReadOnly()
        permission.setPermissionDialogVisible(false)
      }
    })

    return () => {
      eventId.dispose()
      univerRef.current?.dispose()
      univerRef.current = null
    }
  }, [data])

  // 监听containerRef,鼠标滚动事件
  useEventListener('wheel', (e: WheelEvent) => {
    e.preventDefault()
  }, { target: containerRef })

  return (
    <div className="excel-view">
      <div className="excel-view-tools">
        <div className="excel-view-tools-left">{leftDom}</div>
        <div className="excel-view-tools-right">
          {url && (
            <Button
              size="small"
              type="text"
              icon={<DownloadOutlined />}
              onClick={() => downloadFile(url, fileName)}
            />
          )}
        </div>
      </div>
      <div className="excel-view-container">
        {loading && (
          <div className="excel-view-loading">
            <Spin />
          </div>
        )}
        {error && (
          <div className="excel-view-error">{error.message || '文件加载失败'}</div>
        )}
        <div
          ref={containerRef}
          style={{
            width: '100%',
            height: '100%',
            display: loading || error ? 'none' : 'block',
          }}
        />
      </div>
    </div>
  )
}

export default ExcelView
