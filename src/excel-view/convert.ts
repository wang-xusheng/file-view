/**
 * ExcelJS → Univer 数据转换
 *
 * 将 ExcelJS 解析出的 Workbook 转换为 Univer IWorkbookData 格式，
 * 涵盖单元格值、样式、合并区域、行高列宽等属性的映射。
 */

import {
  type ICellData,
  type IStyleData,
  type IWorkbookData,
  type IWorksheetData,
  BooleanNumber,
  BorderStyleTypes,
  CellValueType,
  HorizontalAlign,
  ImageSourceType,
  LocaleType,
  VerticalAlign,
  WrapStrategy,
} from '@univerjs/presets'
import { SheetDrawingAnchorType } from '@univerjs/presets/preset-sheets-drawing'
import type { Cell } from 'exceljs'
import { Workbook } from 'exceljs'

// ============ 基础工具函数 ============

/** ExcelJS 的 ARGB 颜色值（如 "FF4472C4"）转为 CSS hex（如 "#4472C4"） */
function argbToHex(argb: string): string {
  if (argb.length === 8) return '#' + argb.slice(2)
  if (argb.length === 6) return '#' + argb
  return '#000000'
}

/** JS Date 转 Excel 序列号（以 1899-12-30 为基准，兼容 Excel 1900 日期体系） */
function dateToSerial(date: Date): number {
  const epoch = new Date(1899, 11, 30).getTime()
  return (date.getTime() - epoch) / 86400000
}

/** Excel 列字母（如 "AB"）转为 0-based 列索引 */
function columnToIndex(col: string): number {
  let idx = 0
  for (let i = 0; i < col.length; i++) {
    idx = idx * 26 + (col.charCodeAt(i) - 64)
  }
  return idx - 1
}

/** 解析合并单元格引用（如 "A1:C3"）为 0-based 行列范围 */
function parseMerge(ref: string): { startRow: number; startColumn: number; endRow: number; endColumn: number } | null {
  const m = ref.match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/)
  if (!m) return null
  return {
    startRow: Number(m[2]) - 1,
    startColumn: columnToIndex(m[1]),
    endRow: Number(m[4]) - 1,
    endColumn: columnToIndex(m[3]),
  }
}

// ============ ExcelJS → Univer 枚举映射表 ============

const H_ALIGN_MAP: Record<string, HorizontalAlign> = {
  left: HorizontalAlign.LEFT,
  center: HorizontalAlign.CENTER,
  right: HorizontalAlign.RIGHT,
  justify: HorizontalAlign.JUSTIFIED,
  fill: HorizontalAlign.LEFT,
  centerContinuous: HorizontalAlign.CENTER,
  distributed: HorizontalAlign.DISTRIBUTED,
}

const V_ALIGN_MAP: Record<string, VerticalAlign> = {
  top: VerticalAlign.TOP,
  middle: VerticalAlign.MIDDLE,
  bottom: VerticalAlign.BOTTOM,
}

const BORDER_MAP: Record<string, BorderStyleTypes> = {
  thin: BorderStyleTypes.THIN,
  medium: BorderStyleTypes.MEDIUM,
  thick: BorderStyleTypes.THICK,
  dotted: BorderStyleTypes.DOTTED,
  dashed: BorderStyleTypes.DASHED,
  dashDot: BorderStyleTypes.DASH_DOT,
  dashDotDot: BorderStyleTypes.DASH_DOT_DOT,
  double: BorderStyleTypes.DOUBLE,
  mediumDashed: BorderStyleTypes.MEDIUM_DASHED,
  mediumDashDot: BorderStyleTypes.MEDIUM_DASH_DOT,
  mediumDashDotDot: BorderStyleTypes.MEDIUM_DASH_DOT_DOT,
  slantDashDot: BorderStyleTypes.SLANT_DASH_DOT,
  hair: BorderStyleTypes.HAIR,
}

// ============ 单元格值 & 样式转换 ============

/** 将 ExcelJS Cell 的值转换为 Univer ICellData 的值部分（v/t/f） */
function convertCellValue(cell: Cell): Pick<ICellData, 'v' | 't' | 'f'> | null {
  const val = cell.value
  if (val === null || val === undefined) return null
  if (typeof val === 'string') return { v: val, t: CellValueType.STRING }
  if (typeof val === 'number') return { v: val, t: CellValueType.NUMBER }
  if (typeof val === 'boolean') return { v: val ? 1 : 0, t: CellValueType.BOOLEAN }
  if (val instanceof Date) return { v: dateToSerial(val), t: CellValueType.NUMBER }

  if (typeof val === 'object') {
    if ('formula' in val) {
      const fv = val as { formula: string; result?: unknown }
      const r = fv.result
      return {
        f: `=${fv.formula}`,
        v: r instanceof Date ? dateToSerial(r) : (typeof r === 'object' ? String(r) : (r as string | number | undefined)) ?? undefined,
        t: typeof r === 'number' ? CellValueType.NUMBER : CellValueType.STRING,
      }
    }
    if ('richText' in val) {
      // Univer 免费版不支持富文本，拼接为纯文本
      const rt = val as { richText: { text: string }[] }
      return { v: rt.richText.map((r) => r.text).join(''), t: CellValueType.STRING }
    }
    if ('text' in val) return { v: String((val as { text: string }).text), t: CellValueType.STRING }
    if ('error' in val) return { v: String((val as { error: string }).error), t: CellValueType.STRING }
  }

  return { v: String(val), t: CellValueType.STRING }
}

/** 将 ExcelJS Cell 的样式转换为 Univer IStyleData */
function convertCellStyle(cell: Cell): IStyleData | null {
  const s: IStyleData = {}
  let has = false
  const { font, fill, alignment, border, numFmt } = cell

  if (font) {
    if (font.bold) { s.bl = BooleanNumber.TRUE; has = true }
    if (font.italic) { s.it = BooleanNumber.TRUE; has = true }
    if (font.size) { s.fs = font.size; has = true }
    if (font.name) { s.ff = font.name; has = true }
    if (font.underline) { s.ul = { s: BooleanNumber.TRUE }; has = true }
    if (font.strike) { s.st = { s: BooleanNumber.TRUE }; has = true }
    if (font.color?.argb) { s.cl = { rgb: argbToHex(font.color.argb) }; has = true }
  }

  if (fill && 'fgColor' in fill && fill.fgColor?.argb) {
    const hex = argbToHex(fill.fgColor.argb)
    // ExcelJS 对无背景色的单元格可能返回 argb="FF000000"，需过滤
    if (hex !== '#000000') { s.bg = { rgb: hex }; has = true }
  }

  if (alignment) {
    if (alignment.horizontal && H_ALIGN_MAP[alignment.horizontal]) {
      s.ht = H_ALIGN_MAP[alignment.horizontal]; has = true
    }
    if (alignment.vertical && V_ALIGN_MAP[alignment.vertical]) {
      s.vt = V_ALIGN_MAP[alignment.vertical]; has = true
    }
    if (alignment.wrapText) { s.tb = WrapStrategy.WRAP; has = true }
  }
  if (border) {
    const sides = [['top', 't'], ['bottom', 'b'], ['left', 'l'], ['right', 'r']] as const
    const bd: Record<string, { s: BorderStyleTypes; cl: { rgb: string } }> = {}
    let hasBd = false
    for (const [excelSide, uniSide] of sides) {
      const b = border[excelSide]
      if (b?.style) {
        bd[uniSide] = {
          s: BORDER_MAP[b.style] ?? BorderStyleTypes.THIN,
          cl: { rgb: b.color?.argb ? argbToHex(b.color.argb) : '#000000' },
        }
        hasBd = true
      }
    }
    if (hasBd) { s.bd = bd; has = true }
  }

  if (numFmt) { s.n = { pattern: numFmt }; has = true }

  return has ? s : null
}

// ============ 图片转换 ============

/** ExcelJS media buffer 转为 base64 data URL */
function bufferToDataUrl(buffer: ArrayBuffer | Uint8Array, extension: string): string {
  const mime = extension === 'jpg' ? 'jpeg' : extension
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return `data:image/${mime};base64,${btoa(binary)}`
}

/** EMU（English Metric Units）转像素，1 px ≈ 9525 EMU */
const EMU_PER_PX = 9525

interface SheetImageData {
  data: Record<string, unknown>
  order: string[]
  /** 图片锚点覆盖的最大行号（用于扩展 sheet 行数，避免图片被截断） */
  maxRow: number
  /** 图片锚点覆盖的最大列号 */
  maxCol: number
}

/**
 * 从 ExcelJS worksheet 提取图片，转换为 Univer SHEET_DRAWING_PLUGIN 资源格式。
 *
 * ExcelJS 的 getImages() 返回图片锚点（tl/br），nativeColOff/nativeRowOff 单位为 EMU；
 * Univer 的 sheetTransform 使用 column/row + 像素偏移。
 */
function extractSheetImages(
  ws: InstanceType<typeof Workbook>['worksheets'][number],
  media: Array<{ type: string; name: string; extension: string; buffer: ArrayBuffer | Uint8Array }>,
  unitId: string,
  subUnitId: string,
): SheetImageData | null {
  const images = ws.getImages()
  if (!images.length) return null

  const data: Record<string, unknown> = {}
  const order: string[] = []
  let maxRow = 0
  let maxCol = 0

  for (const img of images) {
    const mediaItem = media[Number(img.imageId)]
    if (!mediaItem) continue

    const drawingId = `img_${subUnitId}_${order.length}`
    const source = bufferToDataUrl(mediaItem.buffer, mediaItem.extension)

    const { tl, br } = img.range
    maxRow = Math.max(maxRow, br.nativeRow)
    maxCol = Math.max(maxCol, br.nativeCol)

    const sheetTransform = {
      from: {
        column: tl.nativeCol,
        columnOffset: tl.nativeColOff / EMU_PER_PX,
        row: tl.nativeRow,
        rowOffset: tl.nativeRowOff / EMU_PER_PX,
      },
      to: {
        column: br.nativeCol,
        columnOffset: br.nativeColOff / EMU_PER_PX,
        row: br.nativeRow,
        rowOffset: br.nativeRowOff / EMU_PER_PX,
      },
    }

    data[drawingId] = {
      unitId,
      subUnitId,
      drawingId,
      drawingType: 0, // DrawingTypeEnum.DRAWING_IMAGE
      imageSourceType: ImageSourceType.BASE64,
      source,
      sheetTransform,
      axisAlignSheetTransform: sheetTransform,
      anchorType: SheetDrawingAnchorType.Both,
    }
    order.push(drawingId)
  }

  return order.length ? { data, order, maxRow, maxCol } : null
}

// ============ CSV 解析 ============

/** 解析 CSV 文本为二维字符串数组，支持 RFC 4180 双引号转义 */
function parseCsvText(text: string): string[][] {
  const rows: string[][] = []
  let current = ''
  let inQuotes = false
  let row: string[] = []

  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    if (inQuotes) {
      if (char === '"') {
        if (i + 1 < text.length && text[i + 1] === '"') {
          current += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        current += char
      }
    } else {
      if (char === '"') {
        inQuotes = true
      } else if (char === ',') {
        row.push(current)
        current = ''
      } else if (char === '\n') {
        row.push(current)
        current = ''
        rows.push(row)
        row = []
      } else if (char === '\r') {
        // skip
      } else {
        current += char
      }
    }
  }

  if (current || row.length) {
    row.push(current)
    rows.push(row)
  }

  return rows
}

/** 将 CSV 解析结果转换为 Univer IWorkbookData，自动推断数值类型 */
function csvToWorkbookData(rows: string[][]): Partial<IWorkbookData> {
  const sheetId = 'sheet_1'
  const cellData: Record<number, Record<number, ICellData>> = {}
  let maxCols = 0

  for (let ri = 0; ri < rows.length; ri++) {
    const row = rows[ri]
    maxCols = Math.max(maxCols, row.length)
    for (let ci = 0; ci < row.length; ci++) {
      const val = row[ci]
      if (val === '') continue
      if (!cellData[ri]) cellData[ri] = {}
      const num = Number(val)
      if (!isNaN(num) && val.trim() !== '') {
        cellData[ri][ci] = { v: num, t: CellValueType.NUMBER }
      } else {
        cellData[ri][ci] = { v: val, t: CellValueType.STRING }
      }
    }
  }

  return {
    id: 'excel_preview',
    name: 'CSV Preview',
    appVersion: '1.0.0',
    locale: LocaleType.ZH_CN,
    styles: {},
    sheetOrder: [sheetId],
    sheets: {
      [sheetId]: {
        id: sheetId,
        name: 'Sheet1',
        rowCount: Math.max(rows.length + 20, 100),
        columnCount: Math.max(maxCols + 5, 26),
        defaultColumnWidth: 73,
        defaultRowHeight: 23,
        cellData,
        rowData: {},
        columnData: {},
        mergeData: [],
        tabColor: '',
        hidden: BooleanNumber.FALSE,
        showGridlines: BooleanNumber.TRUE,
      },
    },
    resources: [],
  }
}

// ============ 主转换入口 ============

/** 根据文件名或 URL 后缀判断是否为 CSV 文件 */
function isCsvFile(url: string, fileName?: string): boolean {
  const name = (fileName || url).toLowerCase()
  return name.endsWith('.csv')
}

/**
 * 从 URL 加载 .xlsx 或 .csv 文件，转换为 Univer IWorkbookData。
 * 通过 fileName 或 URL 后缀自动识别文件类型。
 */
export async function loadAndConvert(url: string, fileName?: string): Promise<Partial<IWorkbookData>> {
  const resp = await fetch(url)

  if (isCsvFile(url, fileName)) {
    const text = await resp.text()
    return csvToWorkbookData(parseCsvText(text))
  }

  const buffer = await resp.arrayBuffer()
  const wb = new Workbook()
  await wb.xlsx.load(buffer)

  const sheets: Record<string, Partial<IWorksheetData>> = {}
  const sheetOrder: string[] = []
  const drawingMap: Record<string, SheetImageData> = {}
  const media = ((wb as unknown as { media: Array<{ type: string; name: string; extension: string; buffer: ArrayBuffer | Uint8Array }> }).media) ?? []

  for (const ws of wb.worksheets) {
    const sheetId = `sheet_${ws.id}`
    sheetOrder.push(sheetId)

    const cellData: Record<number, Record<number, ICellData>> = {}
    const rowData: Record<number, { h?: number }> = {}
    const columnData: Record<number, { w?: number }> = {}

    ws.columns?.forEach((col, i) => {
      if (col.width) columnData[i] = { w: col.width * 7.5 }
    })

    ws.eachRow({ includeEmpty: true }, (row, rowNum) => {
      const ri = rowNum - 1
      if (row.height) rowData[ri] = { h: row.height * 1.333 }

      row.eachCell({ includeEmpty: true }, (cell, colNum) => {
        const ci = colNum - 1
        const val = convertCellValue(cell)
        const sty = convertCellStyle(cell)
        if (val || sty) {
          if (!cellData[ri]) cellData[ri] = {}
          cellData[ri][ci] = { ...val, ...(sty ? { s: sty } : {}) }
        }
      })
    })

    const mergeData: { startRow: number; startColumn: number; endRow: number; endColumn: number }[] = []
    const merges: string[] = (ws.model as unknown as Record<string, unknown>).merges as string[] ?? []
    for (const ref of merges) {
      const r = parseMerge(ref)
      if (r) mergeData.push(r)
    }

    const imageData = extractSheetImages(ws, media, 'excel_preview', sheetId)
    if (imageData) drawingMap[sheetId] = imageData

    const imgMaxRow = imageData ? imageData.maxRow + 5 : 0
    const imgMaxCol = imageData ? imageData.maxCol + 3 : 0

    sheets[sheetId] = {
      id: sheetId,
      name: ws.name,
      rowCount: Math.max(ws.rowCount + 20, 100, imgMaxRow),
      columnCount: Math.max(ws.columnCount + 5, 26, imgMaxCol),
      defaultColumnWidth: 73,
      defaultRowHeight: 23,
      cellData,
      rowData,
      columnData,
      mergeData,
      tabColor: '',
      hidden: BooleanNumber.FALSE,
      showGridlines: BooleanNumber.TRUE,
    }
  }

  const resources: Array<{ name: string; data: string }> = []
  if (Object.keys(drawingMap).length > 0) {
    resources.push({
      name: 'SHEET_DRAWING_PLUGIN',
      data: JSON.stringify(drawingMap),
    })
  }

  return {
    id: 'excel_preview',
    name: 'Excel Preview',
    appVersion: '1.0.0',
    locale: LocaleType.ZH_CN,
    styles: {},
    sheetOrder,
    sheets,
    resources,
  }
}
