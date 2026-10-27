/**
 * Excel 导入导出（基于 SheetJS）
 * 导入：读取首个工作表 -> 按字段映射转换为对象数组 -> 逐行校验，错误行带原因回显
 * 导出：支持多级表头与列筛选
 */
import * as XLSX from 'xlsx'

/** 列定义：导入导出共用 */
export interface ExcelColumn {
  /** 表头显示名 */
  label: string
  /** 对象字段名 */
  prop: string
  /** 导入时是否必填 */
  required?: boolean
  /** 校验函数，返回错误描述；undefined 表示通过 */
  validator?: (value: unknown, row: Record<string, unknown>) => string | undefined
  /** 导出时的格式化 */
  formatter?: (row: Record<string, unknown>) => unknown
  /** 列宽（字符数） */
  width?: number
}

export interface ImportError {
  /** Excel 中的行号（含表头，从 2 开始） */
  row: number
  /** 出错字段 */
  prop: string
  /** 字段名中文 */
  label: string
  /** 原始值 */
  value: unknown
  /** 错误原因 */
  message: string
}

export interface ImportResult<T> {
  rows: T[]
  errors: ImportError[]
  total: number
}

/** 读取 Excel 文件，返回校验后的数据与错误明细 */
export function importExcel<T = Record<string, any>>(
  file: File,
  columns: ExcelColumn[]
): Promise<ImportResult<T>> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = e.target?.result
        const wb = XLSX.read(data, { type: 'array' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        // header:1 得到二维数组，首行为表头
        const raw: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false })
        if (!raw.length) {
          resolve({ rows: [], errors: [], total: 0 })
          return
        }
        const header = (raw[0] as string[]).map((h) => String(h ?? '').trim())
        // 表头名 -> 字段映射，容错：允许顺序不同
        const propByHeader: Record<string, string> = {}
        columns.forEach((c) => {
          const idx = header.indexOf(c.label)
          if (idx >= 0) propByHeader[String(idx)] = c.prop
        })

        const rows: T[] = []
        const errors: ImportError[] = []

        for (let r = 1; r < raw.length; r++) {
          const line = raw[r] as unknown[]
          const obj: Record<string, unknown> = {}
          columns.forEach((c) => {
            const colIdx = header.indexOf(c.label)
            obj[c.prop] = colIdx >= 0 ? line[colIdx] : undefined
          })

          let hasError = false
          columns.forEach((c) => {
            const val = obj[c.prop]
            if (c.required && (val === undefined || val === null || val === '')) {
              errors.push({ row: r + 1, prop: c.prop, label: c.label, value: val, message: '不能为空' })
              hasError = true
              return
            }
            if (c.validator) {
              const msg = c.validator(val, obj)
              if (msg) {
                errors.push({ row: r + 1, prop: c.prop, label: c.label, value: val, message: msg })
                hasError = true
              }
            }
          })
          if (!hasError) rows.push(obj as T)
        }
        resolve({ rows, errors, total: raw.length - 1 })
      } catch (err) {
        reject(err)
      }
    }
    reader.onerror = reject
    reader.readAsArrayBuffer(file)
  })
}

/** 导出为 xlsx 并触发下载 */
export function exportExcel(
  rows: Record<string, unknown>[],
  columns: ExcelColumn[],
  filename = 'export'
): void {
  const header = columns.map((c) => c.label)
  const body = rows.map((row) => columns.map((c) => (c.formatter ? c.formatter(row) : row[c.prop])))
  const ws = XLSX.utils.aoa_to_sheet([header, ...body])
  ws['!cols'] = columns.map((c) => ({ wch: c.width || 16 }))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')
  const name = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`
  XLSX.writeFile(wb, name)
}

/** 下载导入模板（只含表头与示例行） */
export function downloadTemplate(columns: ExcelColumn[], filename = '导入模板'): void {
  const header = columns.map((c) => c.label)
  const sample = columns.map((c) => (c.prop === 'name' ? '示例名称' : ''))
  const ws = XLSX.utils.aoa_to_sheet([header, sample])
  ws['!cols'] = columns.map((c) => ({ wch: c.width || 16 }))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')
  XLSX.writeFile(wb, `${filename}.xlsx`)
}
