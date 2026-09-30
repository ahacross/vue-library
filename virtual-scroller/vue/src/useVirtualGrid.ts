import { ref, shallowRef, computed, unref, watch, MaybeRef } from 'vue';
import { ensureWasmInitialized, WasmColumnarTable, parseGridResult, GridResult } from '../../core/index';

export type MaybeGetter<T> = MaybeRef<T> | (() => T);

function resolveVal<T>(val: MaybeGetter<T>): T {
  return typeof val === 'function' ? (val as () => T)() : unref(val);
}

const MAX_DOM_HEIGHT = 10_000_000;

export interface UseVirtualGridOptions {
  rowCount: MaybeGetter<number>;
  colCount: MaybeGetter<number>;
  rowHeight?: number;
  colWidth?: number;
  pinnedCols?: number;
  overscanX?: number;
  overscanY?: number;
}

export function useVirtualGrid(options: UseVirtualGridOptions) {
  const rowHeight = options.rowHeight ?? 38;
  const colWidth = options.colWidth ?? 130;
  const pinnedCols = options.pinnedCols ?? 2;
  const overscanX = options.overscanX ?? 3;
  const overscanY = options.overscanY ?? 5;

  const containerRef = shallowRef<HTMLElement | null>(null);
  const wasmGrid = shallowRef<WasmColumnarTable | null>(null);
  const isReady = ref(false);

  const totalWidth = ref(0);
  const rawTotalHeight = ref(0);
  const domTotalHeight = ref(0);
  const filteredCount = ref(0);
  const totalCount = ref(0);
  const filterTimeMs = ref(0);

  const rowStart = ref(0);
  const rowEnd = ref(0);
  const colStart = ref(0);
  const colEnd = ref(0);

  // Column filters state: Map<colIndex, query>
  const columnFilters = ref<Record<number, string>>({});
  const scrollLeft = ref(0);

  // Sorting state: colIndex or null, and ascending boolean
  const sortColumn = ref<number | null>(null);
  const sortAsc = ref<boolean>(true);

  let currentScrollLeft = 0;
  let currentScrollTop = 0;
  let currentViewportW = 1000;
  let currentViewportH = 600;

  const getScrollScaleY = () => {
    if (rawTotalHeight.value <= MAX_DOM_HEIGHT) return 1;
    const maxVirtual = Math.max(1, rawTotalHeight.value - currentViewportH);
    const maxDom = Math.max(1, MAX_DOM_HEIGHT - currentViewportH);
    return maxVirtual / maxDom;
  };

  const update = () => {
    if (!wasmGrid.value || !isReady.value) return;

    const scaleY = getScrollScaleY();
    const virtualScrollTop = currentScrollTop * scaleY;

    const ptr = wasmGrid.value.compute_2d(
      currentScrollLeft,
      virtualScrollTop,
      currentViewportW,
      currentViewportH,
      overscanX,
      overscanY
    );

    const res: GridResult = parseGridResult(ptr);
    rowStart.value = res.rowStart;
    rowEnd.value = res.rowEnd;
    colStart.value = res.colStart;
    colEnd.value = res.colEnd;

    rawTotalHeight.value = res.totalHeight;
    totalWidth.value = res.totalWidth;
    filteredCount.value = wasmGrid.value.filtered_count();
    totalCount.value = wasmGrid.value.total_count();

    if (rawTotalHeight.value > MAX_DOM_HEIGHT) {
      domTotalHeight.value = MAX_DOM_HEIGHT;
    } else {
      domTotalHeight.value = rawTotalHeight.value;
    }
  };

  const onScroll = (e?: Event) => {
    if (containerRef.value) {
      currentScrollLeft = containerRef.value.scrollLeft;
      scrollLeft.value = currentScrollLeft;
      currentScrollTop = containerRef.value.scrollTop;
      currentViewportW = containerRef.value.clientWidth || 1000;
      currentViewportH = containerRef.value.clientHeight || 600;
    }
    update();
  };

  const initGrid = async () => {
    isReady.value = false;
    await ensureWasmInitialized();
    const rows = resolveVal(options.rowCount) || 10_000_000;
    const cols = resolveVal(options.colCount) || 50;

    const grid = new WasmColumnarTable(rowHeight, colWidth);
    grid.set_pinned_cols(0, pinnedCols);

    const t0 = performance.now();
    grid.populate_2d_benchmark(rows, cols);
    const t1 = performance.now();
    console.log(`[VirtualGrid 2D] Generated ${rows.toLocaleString()} rows × ${cols} cols in ${(t1 - t0).toFixed(1)}ms`);

    wasmGrid.value = grid;
    totalWidth.value = grid.total_width();
    rawTotalHeight.value = grid.total_height();
    filteredCount.value = grid.filtered_count();
    totalCount.value = grid.total_count();

    if (rawTotalHeight.value > MAX_DOM_HEIGHT) {
      domTotalHeight.value = MAX_DOM_HEIGHT;
    } else {
      domTotalHeight.value = rawTotalHeight.value;
    }

    isReady.value = true;
    if (containerRef.value) {
      currentViewportW = containerRef.value.clientWidth || 1000;
      currentViewportH = containerRef.value.clientHeight || 600;
    }
    update();
  };

  watch(
    () => [resolveVal(options.rowCount), resolveVal(options.colCount)],
    ([newRows, newCols]) => {
      if (wasmGrid.value && newRows && newCols) {
        initGrid();
      }
    }
  );

  const reapplyAll = () => {
    if (!wasmGrid.value) return;
    wasmGrid.value.reset_filter();

    // Reapply all active column filters across all columns
    for (const [colStr, q] of Object.entries(columnFilters.value)) {
      const c = Number(colStr);
      const text = (q || '').trim();
      if (text) {
        wasmGrid.value.filter_column(c, text);
      }
    }

    // Reapply sort if active
    if (sortColumn.value !== null) {
      wasmGrid.value.sort_by_column(sortColumn.value, sortAsc.value);
    }
  };

  const applyColumnFilter = (colIdx: number, query: string) => {
    if (!wasmGrid.value) return;
    columnFilters.value[colIdx] = query;

    const t0 = performance.now();
    reapplyAll();
    const t1 = performance.now();
    filterTimeMs.value = +(t1 - t0).toFixed(2);

    if (containerRef.value) {
      containerRef.value.scrollTop = 0;
      currentScrollTop = 0;
    }
    update();
  };

  const toggleSort = (colIdx: number) => {
    if (!wasmGrid.value) return;

    if (sortColumn.value === colIdx) {
      if (sortAsc.value) {
        sortAsc.value = false; // Toggle to DESC
      } else {
        sortColumn.value = null; // Toggle to NONE (reset)
        sortAsc.value = true;
      }
    } else {
      sortColumn.value = colIdx;
      sortAsc.value = true; // New column defaults to ASC
    }

    const t0 = performance.now();
    reapplyAll();
    const t1 = performance.now();
    filterTimeMs.value = +(t1 - t0).toFixed(2);

    if (containerRef.value) {
      containerRef.value.scrollTop = 0;
      currentScrollTop = 0;
    }
    update();
  };

  const resetAllFilters = () => {
    columnFilters.value = {};
    sortColumn.value = null;
    sortAsc.value = true;
    if (wasmGrid.value) {
      const t0 = performance.now();
      wasmGrid.value.reset_filter();
      const t1 = performance.now();
      filterTimeMs.value = +(t1 - t0).toFixed(2);

      if (containerRef.value) {
        containerRef.value.scrollTop = 0;
        currentScrollTop = 0;
      }
      update();
    }
  };

  const getCellValue = (filteredRowIdx: number, colIdx: number): string => {
    if (!wasmGrid.value) return '';
    return wasmGrid.value.get_cell_value(filteredRowIdx, colIdx);
  };

  const getColumnName = (colIdx: number): string => {
    if (!wasmGrid.value) return `Col ${colIdx + 1}`;
    return wasmGrid.value.column_name(colIdx);
  };

  const bindContainer = (el: HTMLElement) => {
    containerRef.value = el;
    currentScrollLeft = el.scrollLeft;
    scrollLeft.value = currentScrollLeft;
    currentScrollTop = el.scrollTop;
    currentViewportW = el.clientWidth || 1000;
    currentViewportH = el.clientHeight || 600;
    update();
  };

  const unbindContainer = () => {
    containerRef.value = null;
  };

  const visibleRowIndices = computed(() => {
    const list: number[] = [];
    const count = filteredCount.value;
    const start = rowStart.value;
    const end = Math.max(rowEnd.value, Math.min(count, 30));
    for (let r = start; r < end && r < count; r++) {
      list.push(r);
    }
    return list;
  });

  const visibleColIndices = computed(() => {
    const list: number[] = [];
    const count = resolveVal(options.colCount) || 50;
    const start = colStart.value;
    const end = Math.max(colEnd.value, Math.min(count, 15));
    for (let c = start; c < end && c < count; c++) {
      list.push(c);
    }
    return list;
  });

  const getCellTop = (r: number): number => {
    const scaleY = getScrollScaleY();
    if (scaleY === 1) return r * rowHeight;
    const virtualScrollTop = currentScrollTop * scaleY;
    return currentScrollTop + (r * rowHeight - virtualScrollTop);
  };

  initGrid();

  return {
    containerRef,
    bindContainer,
    unbindContainer,
    onScroll,
    isReady,
    totalWidth,
    totalHeight: domTotalHeight,
    rawTotalHeight,
    filteredCount,
    totalCount,
    filterTimeMs,
    columnFilters,
    scrollLeft,
    sortColumn,
    sortAsc,
    toggleSort,
    rowStart,
    rowEnd,
    colStart,
    colEnd,
    rowHeight,
    colWidth,
    pinnedCols,
    visibleRowIndices,
    visibleColIndices,
    getCellTop,
    getCellValue,
    getColumnName,
    applyColumnFilter,
    resetAllFilters,
    update,
  };
}
