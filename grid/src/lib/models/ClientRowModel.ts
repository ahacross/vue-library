import type { FilterModel, RowRangeResponse, SortDirection } from '../types'
import type { IRowModel } from './IRowModel'

/**
 * ClientRowModel
 * 
 * 엑셀 파일 파싱 데이터나 일반 JS 객체 배열을 가상 스크롤 그리드에
 * 즉시 바인딩할 수 있는 인메모리 행 모델입니다.
 */
export class ClientRowModel<T = any> implements IRowModel<T> {
  private allRows: T[] = []
  private displayRows: T[] = []
  private sortField: string | null = null
  private sortDir: SortDirection = null
  private filters: FilterModel = {}

  constructor(rows: T[] = []) {
    this.setRows(rows)
  }

  setRows(rows: T[]) {
    this.allRows = rows
    this.applySortAndFilter()
  }

  async init(): Promise<void> {}

  destroy(): void {
    this.allRows = []
    this.displayRows = []
  }

  getTotalRows(): number {
    return this.allRows.length
  }

  getFilteredRows(): number {
    return this.displayRows.length
  }

  async fetchRows(start: number, end: number): Promise<RowRangeResponse<T>> {
    const rows = this.displayRows.slice(start, end)
    return {
      start,
      rows,
      totalRows: this.allRows.length,
      filteredRows: this.displayRows.length
    }
  }

  async setSort(field: string, direction: SortDirection): Promise<void> {
    this.sortField = direction ? field : null
    this.sortDir = direction
    this.applySortAndFilter()
  }

  async setFilter(filters: FilterModel): Promise<void> {
    this.filters = filters
    this.applySortAndFilter()
  }

  updateCell(rowIndex: number, field: string, value: any): void {
    if (this.displayRows[rowIndex]) {
      ;(this.displayRows[rowIndex] as any)[field] = value
    }
  }

  getMemoryBytes(): number {
    return this.allRows.length * 200
  }

  private applySortAndFilter() {
    let result = [...this.allRows]

    // 1. 필터링
    const filterEntries = Object.entries(this.filters)
    if (filterEntries.length > 0) {
      result = result.filter((row) => {
        return filterEntries.every(([field, item]) => {
          if (!item || item.value === undefined || item.value === null || item.value === '') return true
          const val = String((row as any)[field] ?? '').toLowerCase()
          const search = String(item.value).toLowerCase()
          return val.includes(search)
        })
      })
    }

    // 2. 정렬
    if (this.sortField && this.sortDir) {
      const field = this.sortField
      const dir = this.sortDir === 'asc' ? 1 : -1
      result.sort((a: any, b: any) => {
        const valA = a[field]
        const valB = b[field]
        if (typeof valA === 'number' && typeof valB === 'number') {
          return (valA - valB) * dir
        }
        return String(valA ?? '').localeCompare(String(valB ?? ''), undefined, { numeric: true }) * dir
      })
    }

    this.displayRows = result
  }
}
