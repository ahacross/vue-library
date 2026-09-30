<script setup lang="ts">
import { ref, shallowRef, computed, onMounted, onUnmounted, watch } from 'vue'
import {
  ColumnDef,
  ColumnGroupDef,
  RowGroupConfig,
  SortDirection,
  FilterModel,
  GridApi,
  GridBenchmarkMetrics,
  RowSelectionMode,
  RowHeightOption,
  CellRange,
  RangeSelectionStats,
  ContextMenuItem
} from '../types'
import { VirtualScrollScale, RowLayoutItem, SAFE_MAX_DOM_HEIGHT } from '../engine/VirtualScrollScale'
import { RowGroupingEngine } from '../engine/RowGroupingEngine'
import { IRowModel } from '../models/IRowModel'
import GridHeader from './GridHeader.vue'
import GridStatusBar from './GridStatusBar.vue'
import GridCell from './GridCell.vue'
import GridContextMenu from './GridContextMenu.vue'

const props = withDefaults(
  defineProps<{
    rowModel: IRowModel
    columns: ColumnDef[]
    columnGroups?: ColumnGroupDef[]
    rowGrouping?: RowGroupConfig
    rowHeight?: RowHeightOption
    headerHeight?: number
    selectionMode?: RowSelectionMode
    theme?: 'alpine' | 'dark' | 'balham'
    overscan?: number
    showStatusBar?: boolean
    loading?: boolean
    enableRangeSelection?: boolean
    enableContextMenu?: boolean
    excelFileName?: string
    exportUrl?: string
    dataUrl?: string
    noDataMessage?: string
    noResultMessage?: string
  }>(),
  {
    rowHeight: 36,
    headerHeight: 40,
    selectionMode: 'multiple',
    theme: 'alpine',
    overscan: 5,
    showStatusBar: true,
    loading: false,
    enableRangeSelection: true,
    enableContextMenu: true,
    excelFileName: 'grid-export.xlsx',
    exportUrl: '/api/grid/export/xlsx',
    noDataMessage: '데이터가 없습니다.',
    noResultMessage: '결과가 없습니다.'
  }
)

const emit = defineEmits<{
  (e: 'rowClick', row: any, index: number): void
  (e: 'selectionChange', selectedRows: any[]): void
  (e: 'sortChange', field: string, direction: SortDirection): void
  (e: 'cellChange', field: string, value: any, rowIndex: number): void
}>()

// 내부 상태
const viewportRef = ref<HTMLDivElement | null>(null)
const scrollLeft = ref(0)
const scrollTop = ref(0)
const viewportHeight = ref(600)
const viewportWidth = ref(1000)

// 렌더링 데이터
const visibleRows = shallowRef<any[]>([])
const renderedRange = ref<[number, number]>([0, 0])
const wrapperOffsetY = ref(0)
const domContentHeight = ref(0)

// 활성 컬럼
const activeColumns = shallowRef<ColumnDef[]>([...props.columns])

// 행 선택 상태
const selectedIndices = ref<Set<number>>(new Set())

// 정렬 상태
const currentSortField = ref<string | null>(null)
const currentSortDir = ref<SortDirection>(null)

// 벤치마크 메트릭
const metrics = ref<GridBenchmarkMetrics>({
  totalRows: 0,
  filteredRows: 0,
  renderedRange: [0, 0],
  fps: 60,
  renderDurationMs: 0,
  workerDurationMs: 0,
  activeDomNodes: 0
})

// 가상화 스케일 엔진 (순수 TS 엔진)
const scrollEngine = new VirtualScrollScale(props.rowHeight)
const rowLayouts = ref<RowLayoutItem[]>([])
let fetchRequestId = 0
let rafId: number | null = null

// FPS 측정
let fpsFrames = 0
let lastFpsTime = performance.now()

// 컬럼 총 너비
const totalColumnsWidth = computed(() => {
  let width = activeColumns.value.reduce((sum, col) => sum + (col.width || 120), 0)
  if (props.selectionMode !== 'none') width += 44
  return width
})

// 좌측 고정 컬럼들의 누적 오프셋 계산 (멀티 핀 컬럼 지원)
const leftPinnedOffsets = computed(() => {
  const offsets: Record<string, number> = {}
  let currentLeft = props.selectionMode !== 'none' ? 44 : 0
  for (const col of activeColumns.value) {
    if (col.pinned === 'left') {
      offsets[col.field] = currentLeft
      currentLeft += (col.width || 120)
    }
  }
  return offsets
})

// 고정/일반 컬럼 사전 분리 (매 행마다 filter() 호출 제거로 렌더링 성능 대폭 향상)
const leftColumns = computed(() => activeColumns.value.filter((c) => c.pinned === 'left'))
const centerColumns = computed(() => activeColumns.value.filter((c) => !c.pinned))
const rightColumns = computed(() => activeColumns.value.filter((c) => c.pinned === 'right'))

// 우측 고정 컬럼들의 누적 오프셋 계산 (우측부터 역순 누적)
const rightPinnedOffsets = computed(() => {
  const offsets: Record<string, number> = {}
  let currentRight = 0
  const rightCols = [...activeColumns.value].filter((c) => c.pinned === 'right').reverse()
  for (const col of rightCols) {
    offsets[col.field] = currentRight
    currentRight += (col.width || 120)
  }
  return offsets
})

// --- 컬럼 가상 스크롤 (Horizontal Column Virtualization) 엔진 ---
const COLUMN_OVERSCAN = 2 // 좌우 오버스캔 여유 컬럼 수

const virtualColumnState = computed(() => {
  const cols = centerColumns.value
  if (cols.length === 0) {
    return {
      visibleColumns: [] as ColumnDef[],
      leftSpacerWidth: 0,
      rightSpacerWidth: 0,
      startIndex: 0,
      endIndex: 0
    }
  }

  // 컬럼 수가 10개 이하면 전체 렌더링
  if (cols.length <= 10) {
    return {
      visibleColumns: cols,
      leftSpacerWidth: 0,
      rightSpacerWidth: 0,
      startIndex: 0,
      endIndex: cols.length - 1
    }
  }

  // 각 일반 컬럼의 누적 좌표 계산
  let currentOffset = 0
  const offsets: { left: number; width: number; right: number }[] = []
  for (let i = 0; i < cols.length; i++) {
    const w = cols[i].width || 120
    offsets.push({
      left: currentOffset,
      width: w,
      right: currentOffset + w
    })
    currentOffset += w
  }
  const totalCenterWidth = currentOffset

  // 고정 컬럼 폭 계산
  const leftPinnedTotal = leftColumns.value.reduce((acc, c) => acc + (c.width || 120), props.selectionMode !== 'none' ? 44 : 0)
  const rightPinnedTotal = rightColumns.value.reduce((acc, c) => acc + (c.width || 120), 0)

  // 가로 가상 뷰포트 범위 (좌우 200px 여유 버퍼)
  const effectiveViewportWidth = Math.max(100, viewportWidth.value - leftPinnedTotal - rightPinnedTotal)
  const visibleMinX = Math.max(0, scrollLeft.value - 200)
  const visibleMaxX = scrollLeft.value + effectiveViewportWidth + 200

  // 시작 컬럼 탐색
  let rawStart = 0
  while (rawStart < offsets.length && offsets[rawStart].right < visibleMinX) {
    rawStart++
  }

  // 끝 컬럼 탐색
  let rawEnd = rawStart
  while (rawEnd < offsets.length && offsets[rawEnd].left < visibleMaxX) {
    rawEnd++
  }
  rawEnd = Math.min(offsets.length - 1, rawEnd)

  const startIndex = Math.max(0, rawStart - COLUMN_OVERSCAN)
  const endIndex = Math.min(cols.length - 1, rawEnd + COLUMN_OVERSCAN)

  const visibleColumns = cols.slice(startIndex, endIndex + 1)
  const leftSpacerWidth = offsets[startIndex].left
  const rightSpacerWidth = Math.max(0, totalCenterWidth - offsets[endIndex].right)

  return {
    visibleColumns,
    leftSpacerWidth,
    rightSpacerWidth,
    startIndex,
    endIndex
  }
})

// --- 순수 TypeScript 코어 엔진 연동 ---
// 1. 행 그룹핑 엔진 (RowGroupingEngine)
const groupingEngine = ref(new RowGroupingEngine(true))

// 2. 셀 범위 선택 (Range Selection)
const selectedRange = ref<CellRange | null>(null)
const isSelectingRange = ref(false)
const rangeStartPos = ref<{ row: number; colField: string } | null>(null)

// 3. 우클릭 컨텍스트 메뉴
const contextMenuPos = ref<{ x: number; y: number } | null>(null)

// 4. 컬럼 재배치 핸들러
const handleColumnReorder = (fromField: string, toField: string) => {
  const cols = [...activeColumns.value]
  const fromIdx = cols.findIndex((c) => c.field === fromField)
  const toIdx = cols.findIndex((c) => c.field === toField)
  if (fromIdx < 0 || toIdx < 0) return
  const [removed] = cols.splice(fromIdx, 1)
  cols.splice(toIdx, 0, removed)
  activeColumns.value = cols
}

// 5. 엑셀 세트 필터 핸들러
const activeSetFilters = ref<Record<string, string[]>>({})
const handleColumnFilter = (field: string, values: string[] | null) => {
  if (!values) {
    delete activeSetFilters.value[field]
  } else {
    activeSetFilters.value[field] = values
  }
  updateVirtualRows()
}

// 6. 셀 범위 선택 인터랙션
const onCellMouseDown = (rowIndex: number, colField: string, event: MouseEvent) => {
  if (!props.enableRangeSelection || event.button !== 0) return
  isSelectingRange.value = true
  rangeStartPos.value = { row: rowIndex, colField }
  selectedRange.value = {
    startRow: rowIndex,
    endRow: rowIndex,
    startColField: colField,
    endColField: colField
  }
}

const onCellMouseEnter = (rowIndex: number, colField: string) => {
  if (!isSelectingRange.value || !rangeStartPos.value) return
  selectedRange.value = {
    startRow: Math.min(rangeStartPos.value.row, rowIndex),
    endRow: Math.max(rangeStartPos.value.row, rowIndex),
    startColField: rangeStartPos.value.colField,
    endColField: colField
  }
}

const onGlobalMouseUp = () => {
  isSelectingRange.value = false
}

// 셀이 선택 범위 안에 있는지 확인
const isCellInRange = (rowIndex: number, colField: string): boolean => {
  if (!selectedRange.value) return false
  const r = selectedRange.value
  if (rowIndex < r.startRow || rowIndex > r.endRow) return false

  const colFields = activeColumns.value.map((c) => c.field)
  const startColIdx = colFields.indexOf(r.startColField)
  const endColIdx = colFields.indexOf(r.endColField)
  const currentColIdx = colFields.indexOf(colField)

  const minCol = Math.min(startColIdx, endColIdx)
  const maxCol = Math.max(startColIdx, endColIdx)
  return currentColIdx >= minCol && currentColIdx <= maxCol
}

// 선택 영역 실시간 통계 계산
const rangeStats = computed<RangeSelectionStats | null>(() => {
  if (!selectedRange.value) return null
  const r = selectedRange.value
  const colFields = activeColumns.value.map((c) => c.field)
  const startColIdx = colFields.indexOf(r.startColField)
  const endColIdx = colFields.indexOf(r.endColField)
  const minCol = Math.min(startColIdx, endColIdx)
  const maxCol = Math.max(startColIdx, endColIdx)
  const selectedCols = colFields.slice(minCol, maxCol + 1)

  let count = 0
  let numericCount = 0
  let sum = 0

  for (let rIdx = r.startRow; rIdx <= r.endRow; rIdx++) {
    const relIdx = rIdx - renderedRange.value[0]
    const row = visibleRows.value[relIdx]
    if (!row) continue

    for (const cf of selectedCols) {
      count++
      const val = Number(row[cf])
      if (!isNaN(val) && typeof row[cf] === 'number') {
        numericCount++
        sum += val
      }
    }
  }

  return {
    count,
    numericCount,
    sum,
    avg: numericCount > 0 ? sum / numericCount : 0
  }
})

// 7. 엑셀 호환 클립보드 복사 (Ctrl+C)
const copySelectedRangeToClipboard = async () => {
  if (!selectedRange.value) return
  const r = selectedRange.value
  const colFields = activeColumns.value.map((c) => c.field)
  const startColIdx = colFields.indexOf(r.startColField)
  const endColIdx = colFields.indexOf(r.endColField)
  const minCol = Math.min(startColIdx, endColIdx)
  const maxCol = Math.max(startColIdx, endColIdx)
  const selectedCols = activeColumns.value.slice(minCol, maxCol + 1)

  const lines: string[] = []
  for (let rIdx = r.startRow; rIdx <= r.endRow; rIdx++) {
    const relIdx = rIdx - renderedRange.value[0]
    const row = visibleRows.value[relIdx]
    if (!row) continue

    const line = selectedCols.map((c) => String(row[c.field] ?? '')).join('\t')
    lines.push(line)
  }

  const tsv = lines.join('\n')
  try {
    await navigator.clipboard.writeText(tsv)
    console.log('[Grid] Copied to clipboard:', lines.length, 'rows')
  } catch (err) {
    console.error('[Grid] Clipboard copy failed:', err)
  }
}

// 8. 엑셀 호환 클립보드 붙여넣기 (Ctrl+V)
const pasteClipboardData = async () => {
  try {
    const text = await navigator.clipboard.readText()
    if (!text || !selectedRange.value) return
    const rows = text.split(/\r?\n/).map((line) => line.split('\t'))

    const r = selectedRange.value
    const colFields = activeColumns.value.map((c) => c.field)
    const startColIdx = colFields.indexOf(r.startColField)

    for (let i = 0; i < rows.length; i++) {
      const targetRowIdx = r.startRow + i
      const relIdx = targetRowIdx - renderedRange.value[0]
      if (relIdx < 0 || relIdx >= visibleRows.value.length) continue

      const targetRow = { ...visibleRows.value[relIdx] }
      const lineVals = rows[i]
      for (let j = 0; j < lineVals.length; j++) {
        const colField = colFields[startColIdx + j]
        if (!colField) continue
        targetRow[colField] = lineVals[j]
        if (props.rowModel.updateCell) {
          props.rowModel.updateCell(targetRowIdx, colField, lineVals[j])
        }
        emit('cellChange', colField, lineVals[j], targetRowIdx)
      }
      visibleRows.value[relIdx] = targetRow
    }
    visibleRows.value = [...visibleRows.value]
  } catch (err) {
    console.error('[Grid] Clipboard paste failed:', err)
  }
}

// 엑셀 내보내기 진행 상태
const exportProgress = ref<{ current: number; total: number; isExporting: boolean; message: string; hint?: string }>({
  current: 0,
  total: 0,
  isExporting: false,
  message: '',
  hint: ''
})

let isExportCancelled = false
const cancelExport = () => {
  isExportCancelled = true
  exportProgress.value.isExporting = false
}

// 9. 🚀 FileSystemWritableFileStream 기반 엑셀 호환 대용량 스트리밍 내보내기 (FE 메모리 0MB / 엑셀 최대 한도 엄격 캡핑)
const exportToExcelStream = async (fileName = 'grid-export.csv') => {
  if (exportProgress.value.isExporting) return

  const totalFiltered = props.rowModel.getFilteredRows()
  if (totalFiltered <= 0) return

  // ⭐️ 엑셀 파일(.xlsx/.csv)이 수용할 수 있는 전세계 프로그램 표준 상한선: 1,048,575행 (약 100만 행)
  // 10억 건 모드일지라도 엑셀이 열 수 있는 최대 한도(1,048,575행)로 자동 캡핑하여 10억 건 전체를 돌지 않도록 방어!
  const MAX_EXCEL_LIMIT = 1_048_575
  const totalRows = Math.min(totalFiltered, MAX_EXCEL_LIMIT)

  const defaultName = fileName.toLowerCase().endsWith('.csv') ? fileName : `${fileName}.csv`
  const cols = activeColumns.value
  const encoder = new TextEncoder()
  isExportCancelled = false

  // 1. File System Access API 지원 여부 확인
  let writable: any = null
  const hasFileSystemAccess = typeof (window as any).showSaveFilePicker === 'function'

  if (hasFileSystemAccess) {
    try {
      const fileHandle = await (window as any).showSaveFilePicker({
        suggestedName: defaultName,
        types: [
          {
            description: 'Microsoft Excel 호환 쉼표로 구분된 파일 (*.csv)',
            accept: { 'text/csv': ['.csv'] }
          }
        ]
      })
      writable = await fileHandle.createWritable()
    } catch (err: any) {
      if (err.name === 'AbortError') return
      console.warn('[Grid] showSaveFilePicker failed, falling back to Blob stream:', err)
      writable = null
    }
  }

  try {
    exportProgress.value.isExporting = true
    exportProgress.value.total = totalRows
    exportProgress.value.current = 0
    exportProgress.value.message = writable
      ? '하드디스크로 직접 스트리밍 기록 중... (메모리 0MB)'
      : '브라우저 메모리 절약 스트리밍 중...'
    exportProgress.value.hint = totalFiltered > MAX_EXCEL_LIMIT
      ? `엑셀 프로그램 최대 한도(1,048,575행)에 맞춰 상위 ${totalRows.toLocaleString()}건을 안전하게 추출합니다.`
      : '브라우저 메모리를 쓰지 않고 파일 시스템으로 직접 전송하므로 안전하게 저장됩니다.'

    // 2. 엑셀 한글 깨짐 방지: UTF-8 BOM (0xEF, 0xBB, 0xBF)
    const bom = new Uint8Array([0xef, 0xbb, 0xbf])
    const headerLine = cols.map((c) => `"${(c.headerName || c.field).replace(/"/g, '""')}"`).join(',') + '\r\n'

    // 지원 브라우저 (Chrome, Edge 등): 하드디스크 파일로 즉시 기록 (메모리 점유 0MB)
    if (writable) {
      await writable.write(bom)
      await writable.write(encoder.encode(headerLine))

      let lastRow: any = null
      const BATCH_SIZE = 5_000
      for (let start = 0; start < totalRows; start += BATCH_SIZE) {
        if (isExportCancelled) {
          await writable.close()
          return
        }
        const end = Math.min(start + BATCH_SIZE, totalRows)
        const res = await props.rowModel.fetchRows(start, end, lastRow)
        const chunkRows = res.rows || []

        if (chunkRows.length > 0) {
          lastRow = chunkRows[chunkRows.length - 1]
        }

        let chunkText = ''
        for (let i = 0; i < chunkRows.length; i++) {
          const r = chunkRows[i]
          const line = cols.map((c) => {
            const val = r[c.field]
            if (val === undefined || val === null) return '""'
            return `"${String(val).replace(/"/g, '""')}"`
          }).join(',')
          chunkText += line + '\r\n'
        }

        await writable.write(encoder.encode(chunkText))
        exportProgress.value.current = Math.min(totalRows, start + chunkRows.length)
        await new Promise((resolve) => setTimeout(resolve, 0))
      }

      await writable.close()
    } else {
      // 미지원 브라우저 폴백: 청크 Blob 조각 다운로드
      const csvParts: string[] = ['\uFEFF' + headerLine]
      let lastRow: any = null
      const BATCH_SIZE = 5_000
      for (let start = 0; start < totalRows; start += BATCH_SIZE) {
        if (isExportCancelled) return
        const end = Math.min(start + BATCH_SIZE, totalRows)
        const res = await props.rowModel.fetchRows(start, end, lastRow)
        const chunkRows = res.rows || []

        if (chunkRows.length > 0) {
          lastRow = chunkRows[chunkRows.length - 1]
        }

        let chunkText = ''
        for (let i = 0; i < chunkRows.length; i++) {
          const r = chunkRows[i]
          const line = cols.map((c) => {
            const val = r[c.field]
            if (val === undefined || val === null) return '""'
            return `"${String(val).replace(/"/g, '""')}"`
          }).join(',')
          chunkText += line + '\r\n'
        }
        csvParts.push(chunkText)
        exportProgress.value.current = Math.min(totalRows, start + chunkRows.length)
        await new Promise((resolve) => setTimeout(resolve, 0))
      }

      const blob = new Blob(csvParts, { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = defaultName
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    }
  } catch (err) {
    console.error('[Grid] exportToExcelStream failed:', err)
  } finally {
    exportProgress.value.isExporting = false
  }
}

// 10. 🌟 범용 고속 엑셀(.xlsx) 내보내기 (백엔드 Rust 스트리밍 엔진 or 로컬 폴백)
const isExportingExcel = ref(false)

const exportToXlsx = async (fileName?: string) => {
  if (isExportingExcel.value) return
  const targetFileName = fileName || props.excelFileName || 'grid-export.xlsx'

  // 백엔드 공통 엑셀 API(exportUrl)가 설정되어 있으면 백엔드 스트리밍 엔진으로 직통 처리!
  if (props.exportUrl) {
    isExportingExcel.value = true
    try {
      const payload = {
        fileName: targetFileName,
        dataUrl: props.dataUrl,
        columns: activeColumns.value.map((c) => ({
          field: c.field,
          headerName: c.headerName || c.field,
          width: c.width || 120
        })),
        sortField: currentSortField.value,
        sortDir: currentSortDir.value
      }

      const res = await fetch(props.exportUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (!res.ok) {
        throw new Error(`엑셀 다운로드 요청 실패: ${res.statusText}`)
      }

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = targetFileName.toLowerCase().endsWith('.xlsx') ? targetFileName : `${targetFileName}.xlsx`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('[Grid] 엑셀 내보내기 오류:', err)
      alert('엑셀 파일 생성 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.')
    } finally {
      isExportingExcel.value = false
    }
  } else {
    // exportUrl이 없는 순수 클라이언트/오프라인 환경일 경우 기존 스트리밍으로 안전하게 폴백
    await exportToExcelStream(targetFileName)
  }
}

// 하위 호환용 CSV 내보내기 (exportToExcelStream 연결)
const exportToCsv = exportToExcelStream

// 11. 우클릭 컨텍스트 메뉴 열기
const onContextMenu = (e: MouseEvent, rowIndex: number, colField: string) => {
  if (!props.enableContextMenu) return
  if (!selectedRange.value || !isCellInRange(rowIndex, colField)) {
    selectedRange.value = {
      startRow: rowIndex,
      endRow: rowIndex,
      startColField: colField,
      endColField: colField
    }
  }
  contextMenuPos.value = { x: e.clientX, y: e.clientY }
}

// 컨텍스트 메뉴 항목 리스트
const contextMenuItems = computed<ContextMenuItem[]>(() => {
  return [
    {
      label: '선택 영역 복사 (Ctrl+C)',
      icon: '📋',
      action: copySelectedRangeToClipboard
    },
    {
      label: '클립보드 데이터 붙여넣기 (Ctrl+V)',
      icon: '📥',
      action: pasteClipboardData
    },
    {
      label: '',
      divider: true,
      action: () => {}
    },
    {
      label: '⚡ 엑셀 스트리밍 내보내기 (100만건 무제한 / 메모리 0MB)',
      icon: '📊',
      action: () => exportToExcelStream()
    },
    {
      label: '📄 일반 XLSX 파일로 내보내기 (최대 10만건)',
      icon: '📗',
      action: () => exportToXlsx()
    },
    {
      label: '선택 영역 해제',
      icon: '✕',
      action: () => { selectedRange.value = null }
    }
  ]
})

// 외부 노출 API (GridApi 확장)
const gridApi: GridApi = {
  setRowData: () => {},
  setTotalRows: (total: number) => {
    metrics.value.totalRows = total
    updateVirtualRows()
  },
  refreshView: () => {
    updateVirtualRows()
  },
  scrollToRow: (index: number) => scrollToRow(index),
  getSelectedRows: () => {
    return visibleRows.value.filter((_, idx) => {
      const actualIdx = renderedRange.value[0] + idx
      return selectedIndices.value.has(actualIdx)
    })
  },
  getSelectedIndices: () => Array.from(selectedIndices.value),
  selectAll: () => handleSelectAll(true),
  deselectAll: () => handleSelectAll(false),
  setSort: (field: string, dir: SortDirection) => {
    currentSortField.value = dir ? field : null
    currentSortDir.value = dir
    props.rowModel.setSort(field, dir).then(updateVirtualRows)
  },
  getSort: () => {
    return currentSortField.value && currentSortDir.value
      ? [{ field: currentSortField.value, direction: currentSortDir.value }]
      : []
  },
  setFilter: (field: string, filter) => {
    const filters: FilterModel = {}
    if (filter) filters[field] = filter
    props.rowModel.setFilter(filters).then(updateVirtualRows)
  },
  clearFilters: () => {
    props.rowModel.setFilter({}).then(updateVirtualRows)
  },
  exportToExcelStream,
  exportToXlsx,
  exportToCsv,
  getMetrics: () => metrics.value
}

// 가상 스크롤 범위 재계산 및 데이터 페칭
const updateVirtualRows = async () => {
  const t0 = performance.now()
  const total = props.rowModel.getFilteredRows()
  metrics.value.totalRows = props.rowModel.getTotalRows()
  metrics.value.filteredRows = total

  if (props.rowModel.getMemoryBytes) {
    metrics.value.memoryUsageMb = props.rowModel.getMemoryBytes() / (1024 * 1024)
  }

  scrollEngine.updateConfig({
    totalRows: total,
    rowHeight: props.rowHeight,
    viewportHeight: viewportHeight.value,
    overscan: props.overscan
  })

  const range = scrollEngine.calculateRange(scrollTop.value)
  domContentHeight.value = range.domContentHeight
  wrapperOffsetY.value = range.wrapperOffsetY
  renderedRange.value = [range.startIndex, range.endIndex]
  metrics.value.renderedRange = [range.startIndex, range.endIndex]
  logicalRawStartIndex = range.startIndex + props.overscan

  const reqId = ++fetchRequestId
  try {
    const res = await props.rowModel.fetchRows(range.startIndex, range.endIndex)
    if (reqId === fetchRequestId) {
      visibleRows.value = res.rows
      const layoutResult = scrollEngine.calculateRowLayouts(res.rows, range.startIndex, gridApi)
      rowLayouts.value = layoutResult.layouts
      wrapperOffsetY.value = scrollEngine.calculateAccurateOffsetY(
        scrollTop.value,
        range.startIndex,
        layoutResult.totalHeight,
        range.isScaled,
        range.domContentHeight,
        range.endIndex
      )
      metrics.value.renderDurationMs = performance.now() - t0
      metrics.value.activeDomNodes = res.rows.length * (leftColumns.value.length + virtualColumnState.value.visibleColumns.length + rightColumns.value.length + (props.selectionMode !== 'none' ? 1 : 0))
    }
  } catch (err) {
    console.error('[Grid] Fetch rows failed:', err)
  }
}

// 특정 행으로 스크롤 이동
const scrollToRow = (index: number) => {
  if (!viewportRef.value) return
  const total = props.rowModel.getFilteredRows()
  const visibleCount = Math.ceil(viewportHeight.value / scrollEngine.getEstimatedRowHeight())
  if (index >= total - 1) {
    jumpToExplicitRow(total - visibleCount)
    return
  }
  const targetScrollTop = scrollEngine.getScrollTopForRow(index)
  viewportRef.value.scrollTop = targetScrollTop
  scrollTop.value = targetScrollTop
  updateVirtualRows()
}

// 독립적인 논리 시작 행 인덱스 (오버스캔 피드백 루프 트랩 방지)
let logicalRawStartIndex = 0

// 명시적 행 점프
const jumpToExplicitRow = async (targetRowIndex: number) => {
  const total = props.rowModel.getFilteredRows()
  if (total <= 0) return
  const visibleCount = Math.ceil(viewportHeight.value / scrollEngine.getEstimatedRowHeight())
  const maxStart = Math.max(0, total - visibleCount)
  const rawStart = Math.max(0, Math.min(targetRowIndex, maxStart))
  logicalRawStartIndex = rawStart

  // ⭐️ 바닥 도달 판정: 끝에 도달했을 때는 무조건 10억 번째 행까지 완벽하게 포함
  const isBottom = rawStart >= maxStart
  let clampedStart = isBottom
    ? Math.max(0, total - visibleCount - (props.overscan * 2))
    : Math.max(0, rawStart - props.overscan)
  let clampedEnd = isBottom
    ? total
    : Math.min(total, rawStart + visibleCount + props.overscan)

  const targetScrollTop = isBottom
    ? scrollEngine.getScrollTopForRow(total - 1)
    : scrollEngine.getScrollTopForRow(rawStart)

  if (viewportRef.value) {
    viewportRef.value.scrollTop = targetScrollTop
  }
  scrollTop.value = targetScrollTop

  // ⭐️ renderedRange 즉시 갱신
  renderedRange.value = [clampedStart, clampedEnd]
  metrics.value.renderedRange = [clampedStart, clampedEnd]

  const reqId = ++fetchRequestId
  const t0 = performance.now()
  try {
    const res = await props.rowModel.fetchRows(clampedStart, clampedEnd)
    if (reqId === fetchRequestId) {
      visibleRows.value = res.rows
      renderedRange.value = [clampedStart, clampedEnd]
      metrics.value.renderedRange = [clampedStart, clampedEnd]

      const layoutResult = scrollEngine.calculateRowLayouts(res.rows, clampedStart, gridApi)
      rowLayouts.value = layoutResult.layouts
      const isScaled = (total * scrollEngine.getEstimatedRowHeight()) > SAFE_MAX_DOM_HEIGHT
      wrapperOffsetY.value = scrollEngine.calculateAccurateOffsetY(
        targetScrollTop,
        clampedStart,
        layoutResult.totalHeight,
        isScaled,
        domContentHeight.value,
        clampedEnd
      )
      metrics.value.renderDurationMs = performance.now() - t0
      metrics.value.activeDomNodes = res.rows.length * (activeColumns.value.length + 1)
    }
  } catch (err) {
    console.error('[Grid] Fetch rows failed:', err)
  }
}

// 마우스 휠 정밀 제어
const onWheel = (e: WheelEvent) => {
  const total = props.rowModel.getFilteredRows()
  if (total <= 0) return
  if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return
  e.preventDefault()

  const absDelta = Math.abs(e.deltaY)
  // 휠 스크롤 단계 계산: 일반 휠 1틱당 3~5행, 빠르게 굴리면 최대 25행
  let step = 3
  if (absDelta > 200) {
    step = Math.min(25, Math.round(absDelta / 20))
  } else if (absDelta > 80) {
    step = 5
  } else {
    step = 3
  }

  const direction = e.deltaY > 0 ? 1 : -1
  const visibleCount = Math.ceil(viewportHeight.value / scrollEngine.getEstimatedRowHeight())
  const maxStart = Math.max(0, total - visibleCount)

  // ⭐️ 핵심: 오버스캔이 빼진 renderedRange 대신 순수 논리 시작 인덱스를 기준으로 연속 전진!
  logicalRawStartIndex = Math.max(0, Math.min(maxStart, logicalRawStartIndex + (direction * step)))
  jumpToExplicitRow(logicalRawStartIndex)
}

// 키보드 정밀 내비게이션
const onKeyDown = (e: KeyboardEvent) => {
  if (e.ctrlKey && e.key.toLowerCase() === 'c') {
    e.preventDefault()
    copySelectedRangeToClipboard()
    return
  }
  if (e.ctrlKey && e.key.toLowerCase() === 'v') {
    e.preventDefault()
    pasteClipboardData()
    return
  }

  const total = props.rowModel.getFilteredRows()
  if (total <= 0) return
  const visibleCount = Math.ceil(viewportHeight.value / scrollEngine.getEstimatedRowHeight())
  const maxStart = Math.max(0, total - visibleCount)

  if (e.key === 'ArrowDown') {
    e.preventDefault()
    jumpToExplicitRow(logicalRawStartIndex + 1)
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    jumpToExplicitRow(logicalRawStartIndex - 1)
  } else if (e.key === 'PageDown') {
    e.preventDefault()
    jumpToExplicitRow(logicalRawStartIndex + visibleCount)
  } else if (e.key === 'PageUp') {
    e.preventDefault()
    jumpToExplicitRow(logicalRawStartIndex - visibleCount)
  } else if (e.key === 'Home') {
    e.preventDefault()
    jumpToExplicitRow(0)
  } else if (e.key === 'End') {
    e.preventDefault()
    jumpToExplicitRow(maxStart)
  }
}

// 스크롤 이벤트 핸들러
const onScroll = (e: Event) => {
  const target = e.target as HTMLDivElement
  scrollLeft.value = target.scrollLeft

  if (Math.abs(target.scrollTop - scrollTop.value) > 2) {
    scrollTop.value = target.scrollTop
    if (rafId !== null) cancelAnimationFrame(rafId)
    rafId = requestAnimationFrame(() => {
      updateVirtualRows()
      rafId = null
    })
  }
}

// 컬럼 너비 리사이징 핸들러
const handleColumnResize = (field: string, newWidth: number) => {
  const col = activeColumns.value.find((c) => c.field === field)
  if (col) {
    col.width = newWidth
  }
}

// 정렬 핸들러
const handleSort = async (field: string, direction?: SortDirection) => {
  let nextDir: SortDirection
  if (direction !== undefined) {
    nextDir = direction
  } else {
    if (currentSortField.value !== field) nextDir = 'asc'
    else if (currentSortDir.value === 'asc') nextDir = 'desc'
    else if (currentSortDir.value === 'desc') nextDir = null
    else nextDir = 'asc'
  }

  currentSortField.value = nextDir ? field : null
  currentSortDir.value = nextDir

  const t0 = performance.now()
  await props.rowModel.setSort(field, nextDir)
  metrics.value.workerDurationMs = performance.now() - t0

  emit('sortChange', field, nextDir)
  updateVirtualRows()
}

// 행 선택 토글
const toggleRowSelection = (rowIndex: number) => {
  if (props.selectionMode === 'none') return
  if (props.selectionMode === 'single') {
    selectedIndices.value.clear()
    selectedIndices.value.add(rowIndex)
  } else {
    if (selectedIndices.value.has(rowIndex)) {
      selectedIndices.value.delete(rowIndex)
    } else {
      selectedIndices.value.add(rowIndex)
    }
  }
  emit('selectionChange', Array.from(selectedIndices.value))
}

const handleSelectAll = (select: boolean) => {
  if (select) {
    const total = props.rowModel.getFilteredRows()
    for (let i = 0; i < total; i++) {
      selectedIndices.value.add(i)
    }
  } else {
    selectedIndices.value.clear()
  }
  emit('selectionChange', Array.from(selectedIndices.value))
}

const onRowClick = (row: any, rowIndex: number) => {
  toggleRowSelection(rowIndex)
  emit('rowClick', row, rowIndex)
}

// 셀 값 실시간 변경 처리
const handleCellChange = (field: string, value: any, rowIndex: number) => {
  const relIndex = rowIndex - renderedRange.value[0]
  if (relIndex >= 0 && relIndex < visibleRows.value.length) {
    const updatedRow = {
      ...visibleRows.value[relIndex],
      [field]: value
    }
    const nextRows = [...visibleRows.value]
    nextRows[relIndex] = updatedRow
    visibleRows.value = nextRows
  }

  // ⭐️ 핵심: 모델의 원천 압축 데이터 레이어(Rust WASM)에도 영구 수정 반영!
  if (props.rowModel.updateCell) {
    props.rowModel.updateCell(rowIndex, field, value)
  }

  emit('cellChange', field, value, rowIndex)
}

// FPS 모니터링 루프
const measureFps = () => {
  fpsFrames++
  const now = performance.now()
  if (now - lastFpsTime >= 1000) {
    metrics.value.fps = fpsFrames
    fpsFrames = 0
    lastFpsTime = now
  }
  requestAnimationFrame(measureFps)
}

// 필터 추천 고유값 맵
const filterValuesMap = computed(() => {
  return {
    department: ['Engineering', 'Design', 'Product', 'Sales', 'HR', 'Finance'],
    role: ['Junior', 'Senior', 'Lead', 'Principal', 'Director', 'VP'],
    status: ['ACTIVE', 'REMOTE', 'ON_LEAVE', 'OFFLINE']
  }
})

// 행 그룹핑이 적용된 최종 렌더링 목록
const displayRows = computed(() => {
  if (!props.rowGrouping) return visibleRows.value
  return groupingEngine.value.groupRows(visibleRows.value, props.rowGrouping)
})

let resizeObserver: ResizeObserver | null = null

onMounted(() => {
  if (viewportRef.value) {
    viewportHeight.value = viewportRef.value.clientHeight || 600
    viewportWidth.value = viewportRef.value.clientWidth || 1000

    resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.target === viewportRef.value) {
          viewportHeight.value = entry.contentRect.height
          viewportWidth.value = entry.contentRect.width
          updateVirtualRows()
        }
      }
    })
    resizeObserver.observe(viewportRef.value)
  }

  window.addEventListener('mouseup', onGlobalMouseUp)
  measureFps()
  updateVirtualRows()
})

onUnmounted(() => {
  if (resizeObserver) resizeObserver.disconnect()
  if (rafId !== null) cancelAnimationFrame(rafId)
  window.removeEventListener('mouseup', onGlobalMouseUp)
})

watch(() => props.columns, (newCols) => {
  activeColumns.value = [...newCols]
}, { deep: true })

watch(() => props.rowHeight, (newRowH) => {
  scrollEngine.setRowHeight(newRowH)
  updateVirtualRows()
})

watch(() => props.rowModel, () => {
  scrollTop.value = 0
  scrollLeft.value = 0
  if (viewportRef.value) {
    viewportRef.value.scrollTop = 0
    viewportRef.value.scrollLeft = 0
  }
  updateVirtualRows()
})

defineExpose({
  api: gridApi,
  scrollToRow,
  refresh: updateVirtualRows,
  isExportingExcel,
  exportToExcelStream,
  exportToXlsx,
  exportToCsv,
  reorderColumns: handleColumnReorder
})
</script>

<template>
  <div class="hyper-grid" :class="[`hyper-grid-theme-${theme}`]">
    <!-- 컬럼 헤더 (다단 그룹 헤더, 컬럼 드래그 재배치, 엑셀 세트 필터 지원) -->
    <GridHeader
      :columns="activeColumns"
      :column-groups="columnGroups"
      :header-height="headerHeight"
      :scroll-left="scrollLeft"
      :sort-field="currentSortField"
      :sort-direction="currentSortDir"
      :has-selection="selectionMode !== 'none'"
      :all-selected="selectedIndices.size > 0 && selectedIndices.size >= metrics.filteredRows"
      :filter-values-map="filterValuesMap"
      :visible-center-columns="virtualColumnState.visibleColumns"
      :left-spacer-width="virtualColumnState.leftSpacerWidth"
      :right-spacer-width="virtualColumnState.rightSpacerWidth"
      @sort="handleSort"
      @resize="handleColumnResize"
      @select-all="handleSelectAll"
      @reorder="handleColumnReorder"
      @filter="handleColumnFilter"
    />

    <!-- 가상 뷰포트 본문 -->
    <div
      ref="viewportRef"
      class="hyper-grid-viewport"
      tabindex="0"
      @scroll="onScroll"
      @wheel="onWheel"
      @keydown="onKeyDown"
    >
      <!-- 브라우저 스크롤 높이를 위한 가상 스페이서 -->
      <div
        class="hyper-grid-scroll-spacer"
        :style="{
          height: `${domContentHeight}px`,
          width: `${totalColumnsWidth}px`
        }"
      />

      <!-- 실제 화면에 보이는 행들을 감싸는 고성능 컨테이너 -->
      <div
        class="hyper-grid-rows-container"
        :style="{
          transform: `translate3d(0, ${wrapperOffsetY}px, 0)`,
          width: `${totalColumnsWidth}px`
        }"
      >
        <template v-for="(row, relIndex) in displayRows" :key="row.__isGroup ? row.id : (row._rawIndex ?? (renderedRange[0] + relIndex))">
          <!-- 1. 그룹 헤더 행 (Row Grouping & Aggregations) -->
          <div
            v-if="row.__isGroup"
            class="hyper-grid-row hyper-grid-group-row"
            :style="{
              top: `${rowLayouts[relIndex]?.top ?? (relIndex * 36)}px`,
              height: '36px',
              width: `${totalColumnsWidth}px`
            }"
            @click="groupingEngine.toggleGroup(row.__groupValue)"
          >
            <span class="group-toggle-icon">{{ row.__isExpanded ? '▼' : '▶' }}</span>
            <span class="group-title-badge">{{ row.__groupField }}:</span>
            <strong class="group-value-text">{{ row.__groupValue }}</strong>
            <span class="group-item-count">({{ row.__childCount }}명)</span>

            <!-- 실시간 롤업 집계 요약 배지 -->
            <div class="group-agg-badges">
              <span v-if="row.__aggregations.salary" class="agg-badge">
                💰 평균: {{ Math.round(row.__aggregations.salary).toLocaleString() }}만원
              </span>
              <span v-if="row.__aggregations.rating" class="agg-badge">
                ⭐ 평균: {{ (Math.round(row.__aggregations.rating * 10) / 10).toFixed(1) }}점
              </span>
            </div>
          </div>

          <!-- 2. 일반 데이터 행 -->
          <div
            v-else
            class="hyper-grid-row"
            :class="{
              'hyper-grid-row-even': (renderedRange[0] + relIndex) % 2 === 0,
              'hyper-grid-row-odd': (renderedRange[0] + relIndex) % 2 !== 0,
              'is-selected': selectedIndices.has(renderedRange[0] + relIndex)
            }"
            :style="{
              top: `${rowLayouts[relIndex]?.top ?? (relIndex * 36)}px`,
              height: `${rowLayouts[relIndex]?.height ?? 36}px`
            }"
            @click="onRowClick(row, renderedRange[0] + relIndex)"
          >
            <!-- 행 선택 체크박스 (좌측 sticky 0px 고정) -->
            <div
              v-if="selectionMode !== 'none'"
              class="hyper-grid-cell hyper-grid-cell-pinned-left"
              style="width: 44px; left: 0px; justify-content: center; padding: 0; z-index: 6;"
              @click.stop="toggleRowSelection(renderedRange[0] + relIndex)"
            >
              <input
                type="checkbox"
                class="hyper-grid-checkbox"
                :checked="selectedIndices.has(renderedRange[0] + relIndex)"
              />
            </div>

            <!-- 좌측 고정 컬럼 셀들 (누적 left 오프셋 적용) -->
            <template v-for="col in leftColumns" :key="col.field">
              <div
                class="hyper-grid-cell hyper-grid-cell-pinned-left"
                :class="{ 'is-cell-selected': isCellInRange(renderedRange[0] + relIndex, col.field) }"
                :style="{
                  width: `${col.width || 120}px`,
                  left: `${leftPinnedOffsets[col.field] ?? 0}px`,
                  textAlign: col.align || 'left',
                  zIndex: 5
                }"
                @mousedown="onCellMouseDown(renderedRange[0] + relIndex, col.field, $event)"
                @mouseenter="onCellMouseEnter(renderedRange[0] + relIndex, col.field)"
                @contextmenu.prevent="onContextMenu($event, renderedRange[0] + relIndex, col.field)"
              >
                <slot
                  :name="`cell-${col.field}`"
                  :row="row"
                  :value="row[col.field]"
                  :index="renderedRange[0] + relIndex"
                  :column="col"
                  :api="gridApi"
                >
                  <slot
                    name="cell"
                    :column="col"
                    :row="row"
                    :value="row[col.field]"
                    :index="renderedRange[0] + relIndex"
                    :api="gridApi"
                  >
                    <!-- 컴포넌트 렌더러가 있을 때만 GridCell 인스턴스 마운트, 일반 텍스트는 직접 렌더링으로 극적인 속도 향상 -->
                    <GridCell
                      v-if="col.cellRenderer"
                      :column="col"
                      :row="row"
                      :value="row[col.field]"
                      :row-index="renderedRange[0] + relIndex"
                      :api="gridApi"
                      @cell-change="handleCellChange"
                    />
                    <span v-else class="cell-text">
                      {{ col.valueFormatter ? col.valueFormatter(row[col.field], row) : (row[col.field] ?? '') }}
                    </span>
                  </slot>
                </slot>
              </div>
            </template>

            <!-- 일반 스크롤 컬럼 셀들 (컬럼 가상화: 좌/우 가상 스페이서 + 가시 컬럼 슬라이스) -->
            <div
              v-if="virtualColumnState.leftSpacerWidth > 0"
              class="hyper-grid-col-spacer"
              :style="{ width: `${virtualColumnState.leftSpacerWidth}px`, flexShrink: 0 }"
              aria-hidden="true"
            />

            <template v-for="col in virtualColumnState.visibleColumns" :key="col.field">
              <div
                class="hyper-grid-cell"
                :class="{ 'is-cell-selected': isCellInRange(renderedRange[0] + relIndex, col.field) }"
                :style="{
                  width: `${col.width || 120}px`,
                  textAlign: col.align || 'left'
                }"
                @mousedown="onCellMouseDown(renderedRange[0] + relIndex, col.field, $event)"
                @mouseenter="onCellMouseEnter(renderedRange[0] + relIndex, col.field)"
                @contextmenu.prevent="onContextMenu($event, renderedRange[0] + relIndex, col.field)"
              >
                <slot
                  :name="`cell-${col.field}`"
                  :row="row"
                  :value="row[col.field]"
                  :index="renderedRange[0] + relIndex"
                  :column="col"
                  :api="gridApi"
                >
                  <slot
                    name="cell"
                    :column="col"
                    :row="row"
                    :value="row[col.field]"
                    :index="renderedRange[0] + relIndex"
                    :api="gridApi"
                  >
                    <GridCell
                      v-if="col.cellRenderer"
                      :column="col"
                      :row="row"
                      :value="row[col.field]"
                      :row-index="renderedRange[0] + relIndex"
                      :api="gridApi"
                      @cell-change="handleCellChange"
                    />
                    <span v-else class="cell-text">
                      {{ col.valueFormatter ? col.valueFormatter(row[col.field], row) : (row[col.field] ?? '') }}
                    </span>
                  </slot>
                </slot>
              </div>
            </template>

            <div
              v-if="virtualColumnState.rightSpacerWidth > 0"
              class="hyper-grid-col-spacer"
              :style="{ width: `${virtualColumnState.rightSpacerWidth}px`, flexShrink: 0 }"
              aria-hidden="true"
            />

            <!-- 우측 고정 컬럼 셀들 (누적 right 오프셋 적용) -->
            <template v-for="col in rightColumns" :key="col.field">
              <div
                class="hyper-grid-cell hyper-grid-cell-pinned-right"
                :class="{ 'is-cell-selected': isCellInRange(renderedRange[0] + relIndex, col.field) }"
                :style="{
                  width: `${col.width || 120}px`,
                  right: `${rightPinnedOffsets[col.field] ?? 0}px`,
                  textAlign: col.align || 'left',
                  zIndex: 5
                }"
                @mousedown="onCellMouseDown(renderedRange[0] + relIndex, col.field, $event)"
                @mouseenter="onCellMouseEnter(renderedRange[0] + relIndex, col.field)"
                @contextmenu.prevent="onContextMenu($event, renderedRange[0] + relIndex, col.field)"
              >
                <slot
                  :name="`cell-${col.field}`"
                  :row="row"
                  :value="row[col.field]"
                  :index="renderedRange[0] + relIndex"
                  :column="col"
                  :api="gridApi"
                >
                  <slot
                    name="cell"
                    :column="col"
                    :row="row"
                    :value="row[col.field]"
                    :index="renderedRange[0] + relIndex"
                    :api="gridApi"
                  >
                    <GridCell
                      v-if="col.cellRenderer"
                      :column="col"
                      :row="row"
                      :value="row[col.field]"
                      :row-index="renderedRange[0] + relIndex"
                      :api="gridApi"
                      @cell-change="handleCellChange"
                    />
                    <span v-else class="cell-text">
                      {{ col.valueFormatter ? col.valueFormatter(row[col.field], row) : (row[col.field] ?? '') }}
                    </span>
                  </slot>
                </slot>
              </div>
            </template>
          </div>
        </template>
      </div>
    </div>

    <!-- 로딩 인디케이터 오버레이 -->
    <div v-if="loading" class="hyper-grid-loading-overlay">
      <div class="hyper-grid-spinner" />
      <span style="margin-top: 10px; font-weight: 600;">데이터 처리 중...</span>
    </div>

    <!-- 1. 데이터 없음 오버레이 (totalRows === 0) -->
    <div
      v-if="!loading && metrics.totalRows === 0"
      class="hyper-grid-empty-overlay"
    >
      <slot name="no-data">
        <div class="empty-content">
          <span class="empty-icon">📭</span>
          <span class="empty-text">{{ noDataMessage }}</span>
        </div>
      </slot>
    </div>

    <!-- 2. 검색/필터 결과 없음 오버레이 (filteredRows === 0 && totalRows > 0) -->
    <div
      v-else-if="!loading && metrics.filteredRows === 0 && metrics.totalRows > 0"
      class="hyper-grid-empty-overlay"
    >
      <slot name="no-result">
        <div class="empty-content">
          <span class="empty-icon">🔍</span>
          <span class="empty-text">{{ noResultMessage }}</span>
          <span class="empty-subtext">검색어 또는 필터 조건을 다시 확인해 주세요.</span>
        </div>
      </slot>
    </div>

    <!-- 3. 전체 데이터 엑셀/CSV 내보내기 진행률 오버레이 -->
    <div v-if="exportProgress.isExporting" class="hyper-grid-export-overlay">
      <div class="hyper-grid-export-modal">
        <div class="export-spinner" />
        <div class="export-title">{{ exportProgress.message }}</div>
        <div class="export-count">
          <strong>{{ exportProgress.current.toLocaleString() }}</strong> / {{ exportProgress.total.toLocaleString() }} 행
          ({{ exportProgress.total > 0 ? Math.round((exportProgress.current / exportProgress.total) * 100) : 0 }}%)
        </div>
        <div class="export-progress-bar">
          <div
            class="export-progress-fill"
            :style="{ width: `${exportProgress.total > 0 ? Math.min(100, (exportProgress.current / exportProgress.total) * 100) : 0}%` }"
          />
        </div>
        <div class="export-hint">
          {{ exportProgress.hint || '전체 데이터를 고속 청크로 수집하여 완성된 스프레드시트를 구성하고 있습니다.' }}
        </div>
        <button
          style="margin-top: 14px; padding: 6px 16px; font-size: 12px; border-radius: 6px; border: 1px solid #cbd5e1; background: #f8fafc; cursor: pointer; color: #475569; font-weight: 600;"
          @click="cancelExport"
        >
          ✕ 내보내기 취소
        </button>
      </div>
    </div>

    <!-- 상태바 & 벤치마크 메트릭 HUD -->
    <GridStatusBar
      v-if="showStatusBar"
      :metrics="metrics"
      :selected-count="selectedIndices.size"
    />

    <!-- 마우스 우클릭 컨텍스트 메뉴 -->
    <GridContextMenu
      v-if="contextMenuPos"
      :x="contextMenuPos.x"
      :y="contextMenuPos.y"
      :items="contextMenuItems"
      :stats="rangeStats"
      @close="contextMenuPos = null"
    />
  </div>
</template>
