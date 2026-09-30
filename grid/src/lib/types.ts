/**
 * Vue Hyper Grid - Type Definitions
 */

import type { Component } from 'vue'

export type SortDirection = 'asc' | 'desc' | null

export interface SortItem {
  field: string
  direction: 'asc' | 'desc'
}

export type SortModel = SortItem[]

export type FilterOperator = 'contains' | 'equals' | 'greaterThan' | 'lessThan' | 'range'

export interface FilterItem {
  operator: FilterOperator
  value: any
  valueTo?: any
}

export type FilterModel = Record<string, FilterItem>

export interface RowHeightParams<T = any> {
  row?: T
  rowIndex: number
  api?: GridApi<T>
}

export type RowHeightOption<T = any> = number | ((params: RowHeightParams<T>) => number)

export interface CellRendererParams<T = any> {
  value: any
  row: T
  rowIndex: number
  field: string
  column: ColumnDef<T>
  api: GridApi<T>
  setValue: (newValue: any) => void
  refreshCell: () => void
}

export type CellRendererType<T = any> =
  | Component
  | ((params: CellRendererParams<T>) => any)
  | string

export interface ColumnDef<T = any> {
  field: string
  headerName?: string
  width?: number
  minWidth?: number
  maxWidth?: number
  sortable?: boolean
  resizable?: boolean
  pinned?: 'left' | 'right'
  type?: 'number' | 'string' | 'date' | 'boolean'
  valueFormatter?: (value: any, row: T) => string
  cellRenderer?: CellRendererType<T>
  cellRendererParams?: Record<string, any>
  headerClass?: string
  cellClass?: string | ((params: CellRendererParams<T>) => string)
  align?: 'left' | 'center' | 'right'
}

export type RowSelectionMode = 'single' | 'multiple' | 'none'

export interface GridOptions<T = any> {
  columnDefs: ColumnDef<T>[]
  columnGroups?: ColumnGroupDef[]
  rowGrouping?: RowGroupConfig
  rowHeight?: RowHeightOption<T>
  headerHeight?: number
  selectionMode?: RowSelectionMode
  theme?: 'alpine' | 'dark' | 'balham'
  overscan?: number
  enableRangeSelection?: boolean
  enableSorting?: boolean
  enableFiltering?: boolean
  enableContextMenu?: boolean
  showStatusBar?: boolean
  excelFileName?: string
  exportUrl?: string
  dataUrl?: string
  noDataMessage?: string
  noResultMessage?: string
}

export type GridCoreOptions<T = any> = GridOptions<T>

export interface GridBenchmarkMetrics {
  totalRows: number
  filteredRows: number
  renderedRange: [number, number]
  fps: number
  renderDurationMs: number
  workerDurationMs: number
  memoryUsageMb?: number
  activeDomNodes: number
}

export interface GridApi<T = any> {
  setRowData: (rows: T[]) => void
  setTotalRows: (total: number) => void
  refreshView: () => void
  scrollToRow: (index: number) => void
  getSelectedRows: () => T[]
  getSelectedIndices: () => number[]
  selectAll: () => void
  deselectAll: () => void
  setSort: (field: string, direction: SortDirection) => void
  getSort: () => SortModel
  setFilter: (field: string, filter: FilterItem | null) => void
  clearFilters: () => void
  exportToExcelStream: (fileName?: string) => Promise<void>
  exportToXlsx: (fileName?: string, sheetName?: string) => Promise<void>
  exportToCsv: (fileName?: string) => void
  getMetrics: () => GridBenchmarkMetrics
}

export interface RowRangeRequest {
  start: number
  end: number
}

export interface RowRangeResponse<T = any> {
  start: number
  rows: T[]
  totalRows: number
  filteredRows: number
}

// --- 엔터프라이즈 확장 타입 ---

// 다단 그룹 헤더 정의
export interface ColumnGroupDef {
  groupId: string
  headerName: string
  children: string[] // 자식 컬럼들의 field 배열
}

// 행 그룹핑 및 실시간 집계 정의
export interface RowGroupConfig {
  field: string // 그룹핑 기준 컬럼
  expanded?: boolean // 기본 펼침 여부
  aggregations?: {
    field: string
    type: 'count' | 'sum' | 'avg' | 'min' | 'max'
  }[]
}

// 셀 범위 선택 (Excel 스타일 Range Selection)
export interface CellRange {
  startRow: number
  endRow: number
  startColField: string
  endColField: string
}

// 범위 선택 통계 요약
export interface RangeSelectionStats {
  count: number
  numericCount: number
  sum: number
  avg: number
  min?: number
  max?: number
}

// 컨텍스트 메뉴 액션
export interface ContextMenuItem {
  label: string
  icon?: string
  action: () => void
  disabled?: boolean
  divider?: boolean
}
