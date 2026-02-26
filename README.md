# @luo-luo/file-view

基于 React 的文件预览组件库.
| 文件类型 | 内部依赖 | 预览组件 |
|--------|---------|---------|
| .pdf | react-pdf、pdf.js | PdfView |
| .msg | msg-parser-wasm | MsgView |

...（photo,excel,word...）持续更新中...


## 安装

```bash
pnpm add @luo-luo/file-view
```

## 使用

```tsx
import { PdfView } from '@luo-luo/file-view';

<div style={{ width: '600px', height: '800px' }}>
  <PdfView
    url="https://example.com/document.pdf"
    fileName="document.pdf"
    leftDom={<span>合同预览</span>}
  />
</div>
```

## API

| 属性 | 类型 | 说明 |
|------|------|------|
| `url` | `string` | 文件地址 |
| `fileName` | `string` | 文件名，用于下载默认名称及弹窗标题 |
| `leftDom` | `React.ReactNode` | 工具栏左侧自定义内容 |

## 开发

```bash
pnpm install       # 安装依赖
pnpm run build     # 构建库
pnpm run dev       # 监听模式
pnpm run doc       # 启动文档开发服务器
pnpm run lint      # 代码检查
pnpm run format    # 代码格式化
```

## License
MIT
