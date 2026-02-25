// AIGC START
/**
 * 下载文件
 */
export function downloadFile(url: string, fileName?: string): void {
  const link = document.createElement('a')
  link.href = url
  link.download = fileName || 'download'
  link.target = '_blank'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

/**
 * 重定向到 URL
 */
export function redirectToUrl(url: string, openInNewTab = false): void {
  if (openInNewTab) {
    window.open(url, '_blank')
  } else {
    window.location.href = url
  }
}
// AIGC END
