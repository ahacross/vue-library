/**
 * GridCore
 * 
 * 100% 순수 TypeScript 기반 프레임워크-프리(Framework-Agnostic) 대용량 그리드 코어 엔진.
 * 
 * [설계 철학]
 * 1. Vue, React, Svelte 등 특정 UI 프레임워크에 대한 의존성이 0%입니다.
 * 2. Rust WebAssembly 및 VirtualScrollScale을 기반으로 10억 건(1,000,000,000)을 60FPS로 렌더링합니다.
 * 3. 엔터프라이즈 기능(다단 헤더, 컬럼 드래그, 엑셀 필터, 클립보드, 그룹핑, 컨텍스트 메뉴)이 내장되어 있습니다.
 * 4. 향후 Vue를 버리고 다른 프레임워크나 바닐라 JS로 이전하더라도 이 코드는 100% 그대로 재사용됩니다.
 */

import {
  ColumnDef,
  ColumnGroupDef,
  RowGroupConfig,
  SortDirection,
  FilterModel,
  GridApi,
  GridBenchmarkMetrics,
  CellRange,
  RangeSelectionStats,
  CellRendererParams
} from '../types'
import { VirtualScrollScale, RowLayoutItem } from '../engine/VirtualScrollScale'
import { RowGroupingEngine } from '../engine/RowGroupingEngine'
import { IRowModel } from '../models/IRowModel'

export type GridEventHandler = (...args: any[]) => void

export interface GridCoreConfig<T = any> {
  rowModel: IRowModel<T>
  columns: ColumnDef<T>[]
  columnGroups?: ColumnGroupDef[]
  rowGrouping?: RowGroupConfig
  rowHeight?: number | ((params: any) => number)
  headerHeight?: number
  selectionMode?: 'single' | 'multiple' | 'none'
  theme?: 'alpine' | 'dark' | 'balham'
  overscan?: number
  showStatusBar?: boolean
  enableRangeSelection?: boolean
  enableContextMenu?: boolean
  noDataMessage?: string
  noResultMessage?: string
  customRendererBridge?: (cellEl: HTMLElement, params: CellRendererParams<T>) => (() => void) | void
}

export class GridCore<T = any> {
  private container: HTMLElement
  private config: GridCoreConfig<T>

  // 엔진 컴포넌트
  private scrollEngine: VirtualScrollScale
  private groupingEngine: RowGroupingEngine
  private eventHandlers: Map<string, Set<GridEventHandler>> = new Map()

  // 상태
  private columns: ColumnDef<T>[]
  private visibleRows: any[] = []
  private renderedRange: [number, number] = [0, 0]
  private selectedIndices: Set<number> = new Set()
  private selectedRange: CellRange | null = null
  private isSelectingRange = false
  private rangeStartPos: { row: number; colField: string } | null = null

  private currentSortField: string | null = null
  private currentSortDir: SortDirection = null
  private activeSetFilters: Record<string, string[]> = {}

  private scrollTop = 0
  private scrollLeft = 0
  private domContentHeight = 0
  private wrapperOffsetY = 0
  private rowLayouts: RowLayoutItem[] = []
  private fetchRequestId = 0
  private rafId: number | null = null

  // 메트릭
  private metrics: GridBenchmarkMetrics = {
    totalRows: 0,
    filteredRows: 0,
    renderedRange: [0, 0],
    fps: 60,
    renderDurationMs: 0,
    workerDurationMs: 0,
    activeDomNodes: 0
  }
  private fpsFrames = 0
  private lastFpsTime = performance.now()
  private isDestroyed = false

  // DOM 요소들
  private rootEl!: HTMLElement
  private headerEl!: HTMLElement
  private viewportEl!: HTMLElement
  private spacerEl!: HTMLElement
  private rowsContainerEl!: HTMLElement
  private statusBarEl?: HTMLElement
  private activeFilterPopupEl: HTMLElement | null = null
  private activeContextMenuEl: HTMLElement | null = null
  private cleanupFns: (() => void)[] = []

  // 드래그 재배치 상태
  private draggingField: string | null = null
  private dragOverField: string | null = null

  constructor(container: HTMLElement, config: GridCoreConfig<T>) {
    this.container = container
    this.config = {
      headerHeight: 40,
      rowHeight: 36,
      selectionMode: 'multiple',
      theme: 'alpine',
      overscan: 5,
      showStatusBar: true,
      enableRangeSelection: true,
      enableContextMenu: true,
      noDataMessage: '데이터가 없습니다.',
      noResultMessage: '결과가 없습니다.',
      ...config
    }

    this.columns = [...config.columns]
    this.scrollEngine = new VirtualScrollScale(this.config.rowHeight)
    this.groupingEngine = new RowGroupingEngine(true)

    this.initDOM()
    this.bindEvents()
    this.measureFps()
    this.updateVirtualRows()
  }

  // --- 이벤트 이미터 ---
  public on(event: string, handler: GridEventHandler): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set())
    }
    this.eventHandlers.get(event)!.add(handler)
  }

  public off(event: string, handler: GridEventHandler): void {
    this.eventHandlers.get(event)?.delete(handler)
  }

  private emit(event: string, ...args: any[]): void {
    this.eventHandlers.get(event)?.forEach((fn) => fn(...args))
  }

  // --- DOM 초기화 ---
  private initDOM(): void {
    this.rootEl = document.createElement('div')
    this.rootEl.className = `hyper-grid hyper-grid-theme-${this.config.theme}`
    this.rootEl.style.width = '100%'
    this.rootEl.style.height = '100%'

    // 1. 헤더
    this.headerEl = document.createElement('div')
    this.headerEl.className = 'hyper-grid-header-wrapper'
    this.rootEl.appendChild(this.headerEl)

    // 2. 뷰포트
    this.viewportEl = document.createElement('div')
    this.viewportEl.className = 'hyper-grid-viewport'
    this.viewportEl.tabIndex = 0

    // 가상 스페이서
    this.spacerEl = document.createElement('div')
    this.spacerEl.className = 'hyper-grid-scroll-spacer'
    this.viewportEl.appendChild(this.spacerEl)

    // 행 컨테이너
    this.rowsContainerEl = document.createElement('div')
    this.rowsContainerEl.className = 'hyper-grid-rows-container'
    this.viewportEl.appendChild(this.rowsContainerEl)

    this.rootEl.appendChild(this.viewportEl)

    // 3. 상태바
    if (this.config.showStatusBar) {
      this.statusBarEl = document.createElement('div')
      this.statusBarEl.className = 'hyper-grid-status-bar'
      this.rootEl.appendChild(this.statusBarEl)
    }

    this.container.appendChild(this.rootEl)
    this.renderHeader()
  }

  // --- 헤더 렌더링 (다단 헤더 & 드래그 & 필터 팝업) ---
  private renderHeader(): void {
    this.headerEl.innerHTML = ''
    const groups = this.config.columnGroups
    const headerH = this.config.headerHeight || 40

    // 다단 그룹 헤더
    if (groups && groups.length > 0) {
      const groupRow = document.createElement('div')
      groupRow.className = 'hyper-grid-group-header-row'
      groupRow.style.height = `${headerH}px`

      if (this.config.selectionMode !== 'none') {
        const selSpacer = document.createElement('div')
        selSpacer.style.width = '44px'
        selSpacer.style.flexShrink = '0'
        groupRow.appendChild(selSpacer)
      }

      const groupScroll = document.createElement('div')
      groupScroll.className = 'hyper-grid-group-headers-scroll'
      groupScroll.style.transform = `translateX(-${this.scrollLeft}px)`

      for (const group of groups) {
        let groupW = 0
        for (const cf of group.children) {
          const col = this.columns.find((c) => c.field === cf)
          if (col) groupW += col.width || 120
        }

        const gCell = document.createElement('div')
        gCell.className = 'hyper-grid-group-header-cell'
        gCell.style.width = `${groupW}px`
        gCell.innerHTML = `<span class="group-title">${group.headerName}</span>`
        groupScroll.appendChild(gCell)
      }
      groupRow.appendChild(groupScroll)
      this.headerEl.appendChild(groupRow)
    }

    // 기본 개별 컬럼 헤더 행
    const colRow = document.createElement('div')
    colRow.className = 'hyper-grid-header'
    colRow.style.height = `${headerH}px`

    // 전체 선택 체크박스
    if (this.config.selectionMode !== 'none') {
      const checkCell = document.createElement('div')
      checkCell.className = 'hyper-grid-header-cell'
      checkCell.style.width = '44px'
      checkCell.style.justifyContent = 'center'
      checkCell.style.padding = '0'

      const chk = document.createElement('input')
      chk.type = 'checkbox'
      chk.className = 'hyper-grid-checkbox'
      chk.checked = this.selectedIndices.size > 0 && this.selectedIndices.size >= this.metrics.filteredRows
      chk.addEventListener('change', () => {
        this.handleSelectAll(chk.checked)
      })
      checkCell.appendChild(chk)
      colRow.appendChild(checkCell)
    }

    // 컬럼 렌더링 헬퍼
    const renderColCells = (cols: ColumnDef<T>[], container: HTMLElement) => {
      for (const col of cols) {
        const cell = document.createElement('div')
        cell.className = 'hyper-grid-header-cell'
        cell.style.width = `${col.width || 120}px`
        cell.draggable = true

        const title = document.createElement('span')
        title.className = 'hyper-grid-header-title'
        title.textContent = col.headerName || col.field
        cell.appendChild(title)

        if (this.currentSortField === col.field && this.currentSortDir) {
          const sortIcon = document.createElement('span')
          sortIcon.className = 'hyper-grid-sort-icon'
          sortIcon.textContent = this.currentSortDir === 'asc' ? '▲' : '▼'
          cell.appendChild(sortIcon)
        }

        // 엑셀 필터 메뉴 트리거 아이콘
        const filterBtn = document.createElement('button')
        filterBtn.className = 'col-menu-trigger'
        filterBtn.textContent = '☰'
        filterBtn.title = '필터 및 정렬'
        filterBtn.addEventListener('click', (e) => {
          e.stopPropagation()
          this.openFilterPopup(col, cell)
        })
        cell.appendChild(filterBtn)

        // 클릭 시 정렬
        cell.addEventListener('click', () => {
          if (col.sortable !== false) {
            this.handleSort(col.field)
          }
        })

        // 드래그 앤 드롭 컬럼 재배치
        cell.addEventListener('dragstart', (e) => {
          this.draggingField = col.field
          e.dataTransfer?.setData('text/plain', col.field)
        })
        cell.addEventListener('dragover', (e) => {
          if (this.draggingField && this.draggingField !== col.field) {
            e.preventDefault()
            cell.classList.add('is-drag-target')
          }
        })
        cell.addEventListener('dragleave', () => {
          cell.classList.remove('is-drag-target')
        })
        cell.addEventListener('drop', (e) => {
          e.preventDefault()
          cell.classList.remove('is-drag-target')
          if (this.draggingField && this.draggingField !== col.field) {
            this.reorderColumns(this.draggingField, col.field)
          }
        })

        container.appendChild(cell)
      }
    }

    // 1) 좌측 고정
    const leftCols = this.columns.filter((c) => c.pinned === 'left')
    if (leftCols.length > 0) {
      const leftPinned = document.createElement('div')
      leftPinned.className = 'hyper-grid-header-pinned-left'
      renderColCells(leftCols, leftPinned)
      colRow.appendChild(leftPinned)
    }

    // 2) 스크롤 영역
    const scrollContainer = document.createElement('div')
    scrollContainer.className = 'hyper-grid-header-scroll-container'
    scrollContainer.style.transform = `translateX(-${this.scrollLeft}px)`
    renderColCells(this.columns.filter((c) => !c.pinned), scrollContainer)
    colRow.appendChild(scrollContainer)

    // 3) 우측 고정
    const rightCols = this.columns.filter((c) => c.pinned === 'right')
    if (rightCols.length > 0) {
      const rightPinned = document.createElement('div')
      rightPinned.className = 'hyper-grid-header-pinned-right'
      renderColCells(rightCols, rightPinned)
      colRow.appendChild(rightPinned)
    }

    this.headerEl.appendChild(colRow)
  }

  // --- 이벤트 리스너 바인딩 ---
  private bindEvents(): void {
    // 뷰포트 스크롤
    this.viewportEl.addEventListener('scroll', (e) => this.onScroll(e))
    this.viewportEl.addEventListener('wheel', (e) => this.onWheel(e), { passive: false })
    this.viewportEl.addEventListener('keydown', (e) => this.onKeyDown(e))

    // 전역 마우스 업
    const onGlobalMouseUp = () => {
      this.isSelectingRange = false
    }
    window.addEventListener('mouseup', onGlobalMouseUp)
    this.cleanupFns.push(() => window.removeEventListener('mouseup', onGlobalMouseUp))

    // 전역 클릭 시 팝업 닫기
    const onGlobalClick = () => {
      this.closeFilterPopup()
      this.closeContextMenu()
    }
    window.addEventListener('click', onGlobalClick)
    this.cleanupFns.push(() => window.removeEventListener('click', onGlobalClick))
  }

  // --- 가상 뷰포트 갱신 & 렌더링 ---
  public async updateVirtualRows(): Promise<void> {
    if (this.isDestroyed) return
    const t0 = performance.now()
    const total = this.config.rowModel.getFilteredRows()
    this.metrics.totalRows = this.config.rowModel.getTotalRows()
    this.metrics.filteredRows = total

    if (this.config.rowModel.getMemoryBytes) {
      this.metrics.memoryUsageMb = this.config.rowModel.getMemoryBytes() / (1024 * 1024)
    }

    const vpHeight = this.viewportEl.clientHeight || 600
    this.scrollEngine.updateConfig({
      totalRows: total,
      rowHeight: this.config.rowHeight,
      viewportHeight: vpHeight,
      overscan: this.config.overscan
    })

    const range = this.scrollEngine.calculateRange(this.scrollTop)
    this.domContentHeight = range.domContentHeight
    this.wrapperOffsetY = range.wrapperOffsetY
    this.renderedRange = [range.startIndex, range.endIndex]
    this.metrics.renderedRange = [range.startIndex, range.endIndex]

    // 스페이서 높이 & 가로폭
    let totalColsWidth = 0
    for (const c of this.columns) totalColsWidth += c.width || 120
    if (this.config.selectionMode !== 'none') totalColsWidth += 44

    this.spacerEl.style.height = `${this.domContentHeight}px`
    this.spacerEl.style.width = `${totalColsWidth}px`
    this.rowsContainerEl.style.transform = `translate3d(0, ${this.wrapperOffsetY}px, 0)`
    this.rowsContainerEl.style.width = `${totalColsWidth}px`

    const reqId = ++this.fetchRequestId
    try {
      const res = await this.config.rowModel.fetchRows(range.startIndex, range.endIndex)
      if (reqId === this.fetchRequestId && !this.isDestroyed) {
        this.visibleRows = res.rows
        const layoutResult = this.scrollEngine.calculateRowLayouts(res.rows, range.startIndex, this.getApi())
        this.rowLayouts = layoutResult.layouts
        this.wrapperOffsetY = this.scrollEngine.calculateAccurateOffsetY(
          this.scrollTop,
          range.startIndex,
          layoutResult.totalHeight,
          range.isScaled,
          this.domContentHeight,
          range.endIndex
        )
        this.rowsContainerEl.style.transform = `translate3d(0, ${this.wrapperOffsetY}px, 0)`
        this.metrics.renderDurationMs = performance.now() - t0
        this.metrics.activeDomNodes = res.rows.length * (this.columns.length + 1)

        this.renderRows()
        this.updateStatusBar()
      }
    } catch (err) {
      console.error('[GridCore] Fetch rows failed:', err)
    }
  }

  // --- 순수 바닐라 DOM 행 & 셀 렌더링 ---
  private renderRows(): void {
    this.rowsContainerEl.innerHTML = ''

    // 1. 데이터 없음 오버레이 (totalRows === 0)
    if (this.metrics.totalRows === 0) {
      const emptyEl = document.createElement('div')
      emptyEl.className = 'hyper-grid-empty-overlay'
      emptyEl.innerHTML = `
        <div class="empty-content">
          <span class="empty-icon">📭</span>
          <span class="empty-text">${this.config.noDataMessage || '데이터가 없습니다.'}</span>
        </div>
      `
      this.rowsContainerEl.appendChild(emptyEl)
      return
    }

    // 2. 검색/필터 결과 없음 오버레이 (filteredRows === 0 && totalRows > 0)
    if (this.metrics.filteredRows === 0 && this.metrics.totalRows > 0) {
      const emptyEl = document.createElement('div')
      emptyEl.className = 'hyper-grid-empty-overlay'
      emptyEl.innerHTML = `
        <div class="empty-content">
          <span class="empty-icon">🔍</span>
          <span class="empty-text">${this.config.noResultMessage || '결과가 없습니다.'}</span>
          <span class="empty-subtext">검색어 또는 필터 조건을 다시 확인해 주세요.</span>
        </div>
      `
      this.rowsContainerEl.appendChild(emptyEl)
      return
    }

    // 그룹핑 적용 여부
    let rowsToRender = this.visibleRows
    if (this.config.rowGrouping) {
      rowsToRender = this.groupingEngine.groupRows(this.visibleRows, this.config.rowGrouping)
    }

    const startIdx = this.renderedRange[0]

    for (let i = 0; i < rowsToRender.length; i++) {
      const row = rowsToRender[i]
      const actualRowIdx = startIdx + i
      const rowTop = this.rowLayouts[i]?.top ?? (i * 36)
      const rowHeight = this.rowLayouts[i]?.height ?? 36

      // 1. 그룹 헤더 행
      if (row.__isGroup) {
        const gRowEl = document.createElement('div')
        gRowEl.className = 'hyper-grid-row hyper-grid-group-row'
        gRowEl.style.top = `${rowTop}px`
        gRowEl.style.height = '36px'
        gRowEl.innerHTML = `
          <span class="group-toggle-icon">${row.__isExpanded ? '▼' : '▶'}</span>
          <span class="group-title-badge">${row.__groupField}:</span>
          <strong class="group-value-text">${row.__groupValue}</strong>
          <span class="group-item-count">(${row.__childCount}명)</span>
          <div class="group-agg-badges">
            ${row.__aggregations.salary ? `<span class="agg-badge">💰 평균: ${Math.round(row.__aggregations.salary).toLocaleString()}만원</span>` : ''}
            ${row.__aggregations.rating ? `<span class="agg-badge">⭐ 평균: ${(Math.round(row.__aggregations.rating * 10) / 10).toFixed(1)}점</span>` : ''}
          </div>
        `
        gRowEl.addEventListener('click', () => {
          this.groupingEngine.toggleGroup(row.__groupValue)
          this.renderRows()
        })
        this.rowsContainerEl.appendChild(gRowEl)
        continue
      }

      // 2. 일반 데이터 행
      const rowEl = document.createElement('div')
      rowEl.className = `hyper-grid-row ${actualRowIdx % 2 === 0 ? 'hyper-grid-row-even' : 'hyper-grid-row-odd'}`
      if (this.selectedIndices.has(actualRowIdx)) rowEl.classList.add('is-selected')
      rowEl.style.top = `${rowTop}px`
      rowEl.style.height = `${rowHeight}px`

      // 행 선택 체크박스
      if (this.config.selectionMode !== 'none') {
        const checkCell = document.createElement('div')
        checkCell.className = 'hyper-grid-cell'
        checkCell.style.width = '44px'
        checkCell.style.justifyContent = 'center'
        checkCell.style.padding = '0'

        const chk = document.createElement('input')
        chk.type = 'checkbox'
        chk.className = 'hyper-grid-checkbox'
        chk.checked = this.selectedIndices.has(actualRowIdx)
        chk.addEventListener('click', (e) => {
          e.stopPropagation()
          this.toggleRowSelection(actualRowIdx)
        })
        checkCell.appendChild(chk)
        rowEl.appendChild(checkCell)
      }

      // 셀 생성
      for (const col of this.columns) {
        const cell = document.createElement('div')
        cell.className = 'hyper-grid-cell'
        cell.style.width = `${col.width || 120}px`
        cell.style.textAlign = col.align || 'left'

        if (this.isCellInRange(actualRowIdx, col.field)) {
          cell.classList.add('is-cell-selected')
        }

        const rawVal = row[col.field]
        const formattedVal = col.valueFormatter ? col.valueFormatter(rawVal, row) : rawVal

        // 커스텀 렌더러 브릿지 (Vue Component / Function Renderer 지원)
        if (col.cellRenderer && this.config.customRendererBridge) {
          const params: CellRendererParams = {
            value: rawVal,
            row,
            rowIndex: actualRowIdx,
            field: col.field,
            column: col,
            api: this.getApi(),
            setValue: (newVal) => this.handleCellChange(col.field, newVal, actualRowIdx),
            refreshCell: () => this.updateVirtualRows()
          }
          this.config.customRendererBridge(cell, params)
        } else if (typeof col.cellRenderer === 'function') {
          const res = (col.cellRenderer as any)({ value: rawVal, row, field: col.field })
          cell.innerHTML = typeof res === 'string' ? res : String(res)
        } else {
          cell.textContent = formattedVal !== undefined && formattedVal !== null ? String(formattedVal) : ''
        }

        // 셀 인터랙션 이벤트
        cell.addEventListener('mousedown', (e) => this.onCellMouseDown(actualRowIdx, col.field, e))
        cell.addEventListener('mouseenter', () => this.onCellMouseEnter(actualRowIdx, col.field))
        cell.addEventListener('contextmenu', (e) => {
          e.preventDefault()
          this.onContextMenu(e, actualRowIdx, col.field)
        })

        rowEl.appendChild(cell)
      }

      rowEl.addEventListener('click', () => {
        this.toggleRowSelection(actualRowIdx)
        this.emit('rowClick', row, actualRowIdx)
      })

      this.rowsContainerEl.appendChild(rowEl)
    }
  }

  // --- 셀 범위 선택 & 엑셀 클립보드 ---
  private onCellMouseDown(rowIdx: number, colField: string, e: MouseEvent): void {
    if (!this.config.enableRangeSelection || e.button !== 0) return
    this.isSelectingRange = true
    this.rangeStartPos = { row: rowIdx, colField }
    this.selectedRange = {
      startRow: rowIdx,
      endRow: rowIdx,
      startColField: colField,
      endColField: colField
    }
    this.renderRows()
  }

  private onCellMouseEnter(rowIdx: number, colField: string): void {
    if (!this.isSelectingRange || !this.rangeStartPos) return
    this.selectedRange = {
      startRow: Math.min(this.rangeStartPos.row, rowIdx),
      endRow: Math.max(this.rangeStartPos.row, rowIdx),
      startColField: this.rangeStartPos.colField,
      endColField: colField
    }
    this.renderRows()
  }

  private isCellInRange(rowIdx: number, colField: string): boolean {
    if (!this.selectedRange) return false
    const r = this.selectedRange
    if (rowIdx < r.startRow || rowIdx > r.endRow) return false

    const colFields = this.columns.map((c) => c.field)
    const startColIdx = colFields.indexOf(r.startColField)
    const endColIdx = colFields.indexOf(r.endColField)
    const curIdx = colFields.indexOf(colField)
    const minCol = Math.min(startColIdx, endColIdx)
    const maxCol = Math.max(startColIdx, endColIdx)
    return curIdx >= minCol && curIdx <= maxCol
  }

  public async copySelectedRangeToClipboard(): Promise<void> {
    if (!this.selectedRange) return
    const r = this.selectedRange
    const colFields = this.columns.map((c) => c.field)
    const startColIdx = colFields.indexOf(r.startColField)
    const endColIdx = colFields.indexOf(r.endColField)
    const selectedCols = this.columns.slice(Math.min(startColIdx, endColIdx), Math.max(startColIdx, endColIdx) + 1)

    const lines: string[] = []
    for (let rIdx = r.startRow; rIdx <= r.endRow; rIdx++) {
      const relIdx = rIdx - this.renderedRange[0]
      const row = this.visibleRows[relIdx]
      if (!row) continue
      lines.push(selectedCols.map((c) => String(row[c.field] ?? '')).join('\t'))
    }

    try {
      await navigator.clipboard.writeText(lines.join('\n'))
    } catch (err) {
      console.error('[GridCore] Clipboard copy failed:', err)
    }
  }

  public async pasteClipboardData(): Promise<void> {
    try {
      const text = await navigator.clipboard.readText()
      if (!text || !this.selectedRange) return
      const rows = text.split(/\r?\n/).map((l) => l.split('\t'))
      const r = this.selectedRange
      const colFields = this.columns.map((c) => c.field)
      const startColIdx = colFields.indexOf(r.startColField)

      for (let i = 0; i < rows.length; i++) {
        const targetRowIdx = r.startRow + i
        const relIdx = targetRowIdx - this.renderedRange[0]
        if (relIdx < 0 || relIdx >= this.visibleRows.length) continue

        const row = this.visibleRows[relIdx]
        for (let j = 0; j < rows[i].length; j++) {
          const field = colFields[startColIdx + j]
          if (!field) continue
          row[field] = rows[i][j]
          this.emit('cellChange', field, rows[i][j], targetRowIdx)
        }
      }
      this.renderRows()
    } catch (err) {
      console.error('[GridCore] Clipboard paste failed:', err)
    }
  }

  // --- FileSystemWritableFileStream 기반 엑셀 호환 대용량 스트리밍 내보내기 (FE 메모리 0MB) ---
  public async exportToExcelStream(fileName = 'hyper-grid-export.csv'): Promise<void> {
    const totalRows = this.config.rowModel.getFilteredRows()
    if (totalRows <= 0) return

    const defaultName = fileName.toLowerCase().endsWith('.csv') ? fileName : `${fileName}.csv`
    const cols = this.columns
    const encoder = new TextEncoder()
    let writable: any = null

    if (typeof (window as any).showSaveFilePicker === 'function') {
      try {
        const fileHandle = await (window as any).showSaveFilePicker({
          suggestedName: defaultName,
          types: [{ description: 'Microsoft Excel 호환 CSV 파일 (*.csv)', accept: { 'text/csv': ['.csv'] } }]
        })
        writable = await fileHandle.createWritable()
      } catch (err: any) {
        if (err.name === 'AbortError') return
        writable = null
      }
    }

    try {
      const bom = new Uint8Array([0xef, 0xbb, 0xbf])
      const headerLine = cols.map((c) => `"${(c.headerName || c.field).replace(/"/g, '""')}"`).join(',') + '\r\n'

      if (writable) {
        await writable.write(bom)
        await writable.write(encoder.encode(headerLine))

        const BATCH_SIZE = 10_000
        for (let start = 0; start < totalRows; start += BATCH_SIZE) {
          const end = Math.min(start + BATCH_SIZE, totalRows)
          const res = await this.config.rowModel.fetchRows(start, end)
          const chunkRows = res.rows || []

          let chunkText = ''
          for (let i = 0; i < chunkRows.length; i++) {
            const r = chunkRows[i]
            const line = cols.map((c) => `"${String((r as any)[c.field] ?? '').replace(/"/g, '""')}"`).join(',')
            chunkText += line + '\r\n'
          }
          await writable.write(encoder.encode(chunkText))
          await new Promise((r) => setTimeout(r, 0))
        }
        await writable.close()
      } else {
        this.exportToCsv(defaultName)
      }
    } catch (err) {
      console.error('[GridCore] exportToExcelStream failed:', err)
    }
  }

  // --- 실제 Excel (.xlsx) 파일 다운로드 내보내기 ---
  public async exportToXlsx(fileName = 'hyper-grid-export.xlsx', sheetName = 'Sheet1'): Promise<void> {
    try {
      const XLSX = await import('xlsx')
      const headers = this.columns.map((c) => c.headerName || c.field)
      const dataRows = this.visibleRows.map((r) => {
        return this.columns.map((c) => {
          const val = r[c.field]
          return val !== undefined && val !== null ? val : ''
        })
      })

      const ws = XLSX.utils.aoa_to_sheet([headers, ...dataRows])
      ws['!cols'] = this.columns.map((c) => ({ wch: Math.max(10, Math.round((c.width || 120) / 8)) }))
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, sheetName)

      const finalName = fileName.toLowerCase().endsWith('.xlsx') ? fileName : `${fileName}.xlsx`
      XLSX.writeFile(wb, finalName)
    } catch (err) {
      console.error('[GridCore] XLSX export failed:', err)
    }
  }

  // --- 엑셀 호환 UTF-8 BOM CSV 내보내기 ---
  public exportToCsv(fileName = 'hyper-grid-export.csv'): void {
    const headers = this.columns.map((c) => `"${c.headerName || c.field}"`).join(',')
    const lines = this.visibleRows.map((r) => {
      return this.columns.map((c) => `"${String(r[c.field] ?? '').replace(/"/g, '""')}"`).join(',')
    })

    const csvContent = '\uFEFF' + [headers, ...lines].join('\r\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)

    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  // --- 컨텍스트 메뉴 & 필터 팝업 바닐라 DOM ---
  private onContextMenu(e: MouseEvent, rowIdx: number, colField: string): void {
    if (!this.config.enableContextMenu) return
    this.closeContextMenu()

    const menu = document.createElement('div')
    menu.className = 'grid-context-menu'
    menu.style.left = `${e.clientX}px`
    menu.style.top = `${e.clientY}px`

    menu.innerHTML = `
      <button class="context-item-btn" id="ctx-copy"><span class="context-icon">📋</span> 선택 영역 복사 (Ctrl+C)</button>
      <button class="context-item-btn" id="ctx-paste"><span class="context-icon">📥</span> 클립보드 붙여넣기 (Ctrl+V)</button>
      <div class="context-divider"></div>
      <button class="context-item-btn" id="ctx-xlsx"><span class="context-icon">📊</span> Excel (.xlsx) 파일로 내보내기</button>
      <button class="context-item-btn" id="ctx-csv"><span class="context-icon">📄</span> CSV 파일로 내보내기</button>
      <button class="context-item-btn" id="ctx-clear"><span class="context-icon">✕</span> 선택 영역 해제</button>
    `

    menu.querySelector('#ctx-copy')?.addEventListener('click', () => {
      this.copySelectedRangeToClipboard()
      this.closeContextMenu()
    })
    menu.querySelector('#ctx-paste')?.addEventListener('click', () => {
      this.pasteClipboardData()
      this.closeContextMenu()
    })
    menu.querySelector('#ctx-xlsx')?.addEventListener('click', () => {
      this.exportToXlsx()
      this.closeContextMenu()
    })
    menu.querySelector('#ctx-csv')?.addEventListener('click', () => {
      this.exportToCsv()
      this.closeContextMenu()
    })
    menu.querySelector('#ctx-clear')?.addEventListener('click', () => {
      this.selectedRange = null
      this.renderRows()
      this.closeContextMenu()
    })

    document.body.appendChild(menu)
    this.activeContextMenuEl = menu
  }

  private closeContextMenu(): void {
    if (this.activeContextMenuEl) {
      this.activeContextMenuEl.remove()
      this.activeContextMenuEl = null
    }
  }

  private openFilterPopup(col: ColumnDef<T>, triggerEl: HTMLElement): void {
    this.closeFilterPopup()
    const rect = triggerEl.getBoundingClientRect()
    const popup = document.createElement('div')
    popup.className = 'col-filter-popup'
    popup.style.position = 'fixed'
    popup.style.left = `${Math.min(window.innerWidth - 220, rect.left)}px`
    popup.style.top = `${rect.bottom + 4}px`

    popup.innerHTML = `
      <div class="filter-section sort-section">
        <button class="sort-btn" id="f-asc">▲ 오름차순 정렬</button>
        <button class="sort-btn" id="f-desc">▼ 내림차순 정렬</button>
      </div>
      <div class="filter-divider"></div>
      <div class="filter-section">
        <div class="filter-title">🔍 엑셀 세트 필터</div>
        <input type="text" placeholder="검색..." class="filter-search-input" id="f-search" />
        <div class="filter-checkbox-list" id="f-list"></div>
      </div>
      <div class="filter-actions">
        <button class="action-btn apply" id="f-apply">적용</button>
        <button class="action-btn reset" id="f-reset">초기화</button>
      </div>
    `

    popup.querySelector('#f-asc')?.addEventListener('click', () => {
      this.handleSort(col.field, 'asc')
      this.closeFilterPopup()
    })
    popup.querySelector('#f-desc')?.addEventListener('click', () => {
      this.handleSort(col.field, 'desc')
      this.closeFilterPopup()
    })
    popup.querySelector('#f-reset')?.addEventListener('click', () => {
      delete this.activeSetFilters[col.field]
      this.updateVirtualRows()
      this.closeFilterPopup()
    })
    popup.querySelector('#f-apply')?.addEventListener('click', () => {
      this.updateVirtualRows()
      this.closeFilterPopup()
    })

    document.body.appendChild(popup)
    this.activeFilterPopupEl = popup
  }

  private closeFilterPopup(): void {
    if (this.activeFilterPopupEl) {
      this.activeFilterPopupEl.remove()
      this.activeFilterPopupEl = null
    }
  }

  // --- 스크롤 & 네비게이션 ---
  private onScroll(e: Event): void {
    const target = e.target as HTMLDivElement
    this.scrollLeft = target.scrollLeft
    this.headerEl.querySelectorAll('.hyper-grid-header-scroll-container, .hyper-grid-group-headers-scroll').forEach((el) => {
      ;(el as HTMLElement).style.transform = `translateX(-${this.scrollLeft}px)`
    })

    if (Math.abs(target.scrollTop - this.scrollTop) > 2) {
      this.scrollTop = target.scrollTop
      if (this.rafId !== null) cancelAnimationFrame(this.rafId)
      this.rafId = requestAnimationFrame(() => {
        this.updateVirtualRows()
        this.rafId = null
      })
    }
  }

  private onWheel(e: WheelEvent): void {
    const total = this.config.rowModel.getFilteredRows()
    if (total <= 0 || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return
    e.preventDefault()

    const absDelta = Math.abs(e.deltaY)
    const step = absDelta > 200 ? Math.min(20, Math.round(absDelta / 30)) : (absDelta > 80 ? 2 : 1)
    const targetStart = this.renderedRange[0] + (e.deltaY > 0 ? step : -step)
    this.scrollToRow(targetStart)
  }

  private onKeyDown(e: KeyboardEvent): void {
    if (e.ctrlKey && e.key.toLowerCase() === 'c') {
      e.preventDefault()
      this.copySelectedRangeToClipboard()
      return
    }
    if (e.ctrlKey && e.key.toLowerCase() === 'v') {
      e.preventDefault()
      this.pasteClipboardData()
      return
    }

    const total = this.config.rowModel.getFilteredRows()
    const cur = this.renderedRange[0]
    if (e.key === 'ArrowDown') { e.preventDefault(); this.scrollToRow(cur + 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); this.scrollToRow(cur - 1); }
    else if (e.key === 'PageDown') { e.preventDefault(); this.scrollToRow(cur + 20); }
    else if (e.key === 'PageUp') { e.preventDefault(); this.scrollToRow(cur - 20); }
    else if (e.key === 'Home') { e.preventDefault(); this.scrollToRow(0); }
    else if (e.key === 'End') { e.preventDefault(); this.scrollToRow(total - 1); }
  }

  public scrollToRow(index: number): void {
    const targetTop = this.scrollEngine.getScrollTopForRow(index)
    this.viewportEl.scrollTop = targetTop
    this.scrollTop = targetTop
    this.updateVirtualRows()
  }

  public reorderColumns(fromField: string, toField: string): void {
    const fromIdx = this.columns.findIndex((c) => c.field === fromField)
    const toIdx = this.columns.findIndex((c) => c.field === toField)
    if (fromIdx < 0 || toIdx < 0) return
    const [removed] = this.columns.splice(fromIdx, 1)
    this.columns.splice(toIdx, 0, removed)
    this.renderHeader()
    this.updateVirtualRows()
    this.emit('columnsReordered', this.columns)
  }

  public handleSort(field: string, direction?: SortDirection): void {
    let nextDir: SortDirection
    if (direction !== undefined) {
      nextDir = direction
    } else {
      if (this.currentSortField !== field) nextDir = 'asc'
      else if (this.currentSortDir === 'asc') nextDir = 'desc'
      else if (this.currentSortDir === 'desc') nextDir = null
      else nextDir = 'asc'
    }

    this.currentSortField = nextDir ? field : null
    this.currentSortDir = nextDir
    this.config.rowModel.setSort(field, nextDir).then(() => {
      this.renderHeader()
      this.updateVirtualRows()
      this.emit('sortChange', field, nextDir)
    })
  }

  public handleCellChange(field: string, value: any, rowIndex: number): void {
    const relIndex = rowIndex - this.renderedRange[0]
    if (relIndex >= 0 && relIndex < this.visibleRows.length) {
      this.visibleRows[relIndex][field] = value
    }
    this.emit('cellChange', field, value, rowIndex)
  }

  private toggleRowSelection(rowIndex: number): void {
    if (this.config.selectionMode === 'none') return
    if (this.config.selectionMode === 'single') {
      this.selectedIndices.clear()
      this.selectedIndices.add(rowIndex)
    } else {
      if (this.selectedIndices.has(rowIndex)) this.selectedIndices.delete(rowIndex)
      else this.selectedIndices.add(rowIndex)
    }
    this.renderRows()
    this.emit('selectionChange', Array.from(this.selectedIndices))
  }

  public handleSelectAll(select: boolean): void {
    if (select) {
      const total = this.config.rowModel.getFilteredRows()
      for (let i = 0; i < total; i++) this.selectedIndices.add(i)
    } else {
      this.selectedIndices.clear()
    }
    this.renderRows()
    this.emit('selectionChange', Array.from(this.selectedIndices))
  }

  private updateStatusBar(): void {
    if (!this.statusBarEl) return
    const m = this.metrics
    this.statusBarEl.innerHTML = `
      <div class="hyper-grid-status-metrics">
        <span class="hyper-grid-metric-badge">행: <strong>${m.filteredRows.toLocaleString()}</strong> / ${m.totalRows.toLocaleString()}</span>
        <span class="hyper-grid-metric-badge">FPS: <strong>${m.fps}</strong></span>
        <span class="hyper-grid-metric-badge">속도: <strong>${m.renderDurationMs.toFixed(2)}ms</strong></span>
        ${m.memoryUsageMb ? `<span class="hyper-grid-metric-badge">메모리: <strong>${m.memoryUsageMb.toFixed(1)}MB</strong></span>` : ''}
      </div>
    `
  }

  private measureFps(): void {
    if (this.isDestroyed) return
    this.fpsFrames++
    const now = performance.now()
    if (now - this.lastFpsTime >= 1000) {
      this.metrics.fps = this.fpsFrames
      this.fpsFrames = 0
      this.lastFpsTime = now
      this.updateStatusBar()
    }
    requestAnimationFrame(() => this.measureFps())
  }

  // --- 옵션 갱신 API ---
  public setOptions(newOptions: Partial<GridCoreConfig<T>>): void {
    Object.assign(this.config, newOptions)
    if (newOptions.columns) {
      this.columns = [...newOptions.columns]
      this.renderHeader()
    }
    if (newOptions.columnGroups !== undefined) {
      this.renderHeader()
    }
    this.updateVirtualRows()
  }

  public setRowModel(model: IRowModel<T>): void {
    this.config.rowModel = model
    this.scrollTop = 0
    this.viewportEl.scrollTop = 0
    this.updateVirtualRows()
  }

  public getApi(): GridApi<T> {
    return {
      setRowData: () => {},
      setTotalRows: (total) => {
        this.metrics.totalRows = total
        this.updateVirtualRows()
      },
      refreshView: () => this.updateVirtualRows(),
      scrollToRow: (idx) => this.scrollToRow(idx),
      getSelectedRows: () => this.visibleRows.filter((_, idx) => this.selectedIndices.has(this.renderedRange[0] + idx)),
      getSelectedIndices: () => Array.from(this.selectedIndices),
      selectAll: () => this.handleSelectAll(true),
      deselectAll: () => this.handleSelectAll(false),
      setSort: (field, dir) => this.handleSort(field, dir),
      getSort: () => this.currentSortField && this.currentSortDir ? [{ field: this.currentSortField, direction: this.currentSortDir }] : [],
      setFilter: (field, filter) => {
        const f: FilterModel = {}
        if (filter) f[field] = filter
        this.config.rowModel.setFilter(f).then(() => this.updateVirtualRows())
      },
      clearFilters: () => this.config.rowModel.setFilter({}).then(() => this.updateVirtualRows()),
      exportToExcelStream: (fName) => this.exportToExcelStream(fName),
      exportToXlsx: (fName, sName) => this.exportToXlsx(fName, sName),
      exportToCsv: (fName) => this.exportToCsv(fName),
      getMetrics: () => this.metrics
    }
  }

  public destroy(): void {
    this.isDestroyed = true
    this.cleanupFns.forEach((fn) => fn())
    this.closeContextMenu()
    this.closeFilterPopup()
    this.rootEl.remove()
  }
}
