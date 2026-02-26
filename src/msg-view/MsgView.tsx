import React, { useState } from 'react'
/* eslint-disable */
import { parse_msg_file } from 'msg-parser-wasm'
import {  Button, Spin } from 'antd'
import { DownloadOutlined, FileZipOutlined } from '@ant-design/icons'
import { downloadFile } from '../utils'
import { useRequest } from 'ahooks'
import dayjs from 'dayjs'
import { deEncapsulateSync } from 'rtf-stream-parser'
import iconv from 'iconv-lite'
import './index.scss'

export interface MsgViewProps {
  /**
   * .msg 文件的 URL 地址。
   */
  url: string
  /**
   * 文件名称，用于下载时的默认文件名。
   */
  fileName?: string
  /**
   * 渲染在工具栏左侧的自定义内容。
   */
  leftDom?: React.ReactNode
}

interface MsgData {
  subject?: string
  sender_name?: string
  sender_email?: string
  recipients?: string[]
  cc_recipients?: string[]
  sent_time?: string
  body_text?: string
  body_html?: string
  body_rtf?: string
  attachments?: {
    filename?: string
    content_type?: string
    data?: Uint8Array | string
    content_id?: string
  }[]
}

function formatSentTime(timeStr: string): string {
  if (!timeStr) return '—'
  const d = dayjs(timeStr)
  return d.isValid() ? d.format('YYYY-MM-DD HH:mm') : timeStr
}

const MsgView: React.FC<MsgViewProps> = (props) => {
  const { url, fileName, leftDom } = props
  const [isFullscreen, setIsFullscreen] = useState(false)

  const { data: msgData, loading } = useRequest(
    async () => {
      try {
        const response = await fetch(url)
        const arrayBuffer = await response.arrayBuffer()
        const uint8Array = new Uint8Array(arrayBuffer)
        const result = parse_msg_file(uint8Array)

        // 将附件 Uint8Array data 转换为 Blob URL
        result.attachments?.forEach?.((att: NonNullable<MsgData['attachments']>[number]) => {
          att.data = URL.createObjectURL(
            new Blob([att.data as unknown as ArrayBuffer], { type: att.content_type }),
          )
        })

        /*
         * 若 body_html 中存在 cid: 引用，查找对应附件并替换为 Blob URL
         */
        if (result.body_html) {
          if (!result.body_html.startsWith('<')) {
            result.body_html = ''
          }
          const doc = new DOMParser().parseFromString(result.body_html, 'text/html')
          const images = doc.querySelectorAll('img')
          images.forEach((img) => {
            const cid = img.getAttribute('src')
            const attachment = result.attachments?.find(
              (att: NonNullable<MsgData['attachments']>[number]) => `cid:${att.content_id}` === cid,
            )
            if (attachment) {
              img.setAttribute('src', attachment.data as string)
              img.setAttribute('style', 'max-width: 100%; max-height: 100%;')
            }
          })
          result.body_html = doc.body.innerHTML
        }

        // 若无 body_html，尝试从 RTF 中提取 HTML 正文
        if (result.body_rtf) {
          result.body_rtf = deEncapsulateSync(result.body_rtf, { decode: iconv.decode })
          if (!result.body_html && result.body_rtf.mode === 'html') {
            result.body_html = result.body_rtf.text

            const doc = new DOMParser().parseFromString(result.body_html, 'text/html')
            const images = doc.querySelectorAll('img')
            images.forEach((img) => {
              const cid = img.getAttribute('src')
              const attachment = result.attachments?.find(
                (att: NonNullable<MsgData['attachments']>[number]) => `cid:${att.content_id}` === cid,
              )
              if (attachment) {
                img.setAttribute('src', attachment.data as string)
              }
            })
            result.body_html = doc.body.innerHTML
          }
        }

        return result as MsgData
      } catch (error) {
        console.error(error)
        return null
      }
    },
    {
      refreshDeps: [url],
      cacheKey: url,
    },
  )

  const hasAttachments = msgData?.attachments?.length

  return (
    <div className="msg-view">
      {/* 工具栏 */}
      <div className="msg-view-tools">
        <div className="msg-view-tools-left">{leftDom}</div>
        <div className="msg-view-tools-right">
          <Button
            size="small"
            icon={<DownloadOutlined />}
            onClick={() => url && downloadFile(url, fileName)}
          />
        </div>
      </div>

      {/* 正文区域 */}
      <div className="msg-view-body">
        {!msgData && loading && (
          <div className="msg-view-loading">
            <Spin />
          </div>
        )}

        {msgData && (
          <div className="msg-view-card">
            <div className="msg-view-card-inner">
              {/* 主题 */}
              <div className="msg-view-subject">
                <h1>{`邮件标题：${msgData.subject || '（无主题）'}`}</h1>
              </div>

              {/* 发件人 / 收件人 / 时间 */}
              <div className="msg-view-meta">
                <div className="msg-view-meta-row">
                  <span className="msg-view-meta-label">发件人</span>
                  <span className="msg-view-meta-value">
                    {msgData.sender_name || msgData.sender_email || '—'}
                    {msgData.sender_email && (
                      <span className="msg-view-meta-email">&lt;{msgData.sender_email}&gt;</span>
                    )}
                  </span>
                </div>

                {msgData.recipients && msgData.recipients.length > 0 && (
                  <div className="msg-view-meta-row">
                    <span className="msg-view-meta-label">收件人</span>
                    <span className="msg-view-meta-value">{msgData.recipients.join(', ')}</span>
                  </div>
                )}

                {msgData.cc_recipients && msgData.cc_recipients.length > 0 && (
                  <div className="msg-view-meta-row">
                    <span className="msg-view-meta-label">抄送</span>
                    <span className="msg-view-meta-value">{msgData.cc_recipients.join(', ')}</span>
                  </div>
                )}

                <div className="msg-view-meta-row">
                  <span className="msg-view-meta-label">时间</span>
                  <span className="msg-view-meta-value">{formatSentTime(msgData.sent_time || '')}</span>
                </div>
              </div>

              {/* 正文 */}
              {(msgData.body_html?.trim() || msgData.body_text?.trim()) && (
                <>
                  <div className="msg-view-body-label">邮件正文</div>
                  <div className="msg-view-body-content">
                    {msgData.body_html?.trim() ? (
                      <div dangerouslySetInnerHTML={{ __html: msgData.body_html }} />
                    ) : (
                      <pre>{msgData.body_text}</pre>
                    )}
                  </div>
                </>
              )}

              {/* 附件列表 */}
              {hasAttachments ? (
                <div className="msg-view-attachments">
                  <div className="msg-view-attachments-title">
                    附件 ({msgData.attachments?.length || 0})
                  </div>
                  <div className="msg-view-attachments-list">
                    {msgData.attachments?.map((att, i) => (
                      <div key={i} className="msg-view-attachment-item" title={att.filename}>
                        <div className="msg-view-attachment-info">
                          <FileZipOutlined className="msg-view-attachment-icon" />
                          <span>{att.filename}</span>
                        </div>
                        <Button
                          icon={<DownloadOutlined />}
                          size="small"
                          type="link"
                          onClick={() => downloadFile(att.data as string, att.filename || '')}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default MsgView
