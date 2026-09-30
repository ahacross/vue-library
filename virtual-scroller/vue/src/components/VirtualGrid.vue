<script setup lang="ts">
import { computed } from 'vue';
import { useVirtualGrid } from '../useVirtualGrid';
import { vVirtualScroll } from '../vVirtualScroll';

const props = withDefaults(
  defineProps<{
    rowCount?: number;
    colCount?: number;
    rowHeight?: number;
    colWidth?: number;
    pinnedCols?: number;
    height?: number;
  }>(),
  {
    rowCount: 10_000_000,
    colCount: 50,
    rowHeight: 38,
    colWidth: 130,
    pinnedCols: 2,
    height: 600,
  }
);

const {
  totalWidth,
  totalHeight,
  visibleRowIndices,
  filteredCount,
  totalCount,
  filterTimeMs,
  columnFilters,
  sortColumn,
  sortAsc,
  toggleSort,
  getCellTop,
  getCellValue,
  getColumnName,
  applyColumnFilter,
  resetAllFilters,
  bindContainer,
  onScroll,
} = useVirtualGrid({
  rowCount: () => props.rowCount,
  colCount: () => props.colCount,
  rowHeight: props.rowHeight,
  colWidth: props.colWidth,
  pinnedCols: props.pinnedCols,
});

const scrollTarget = { bindContainer, onScroll };

const hasActiveFiltersOrSort = computed(() => {
  return (
    sortColumn.value !== null ||
    Object.values(columnFilters.value).some((v) => v && v.trim() !== '')
  );
});

const getHeaderInputPlaceholder = (col: number) => {
  switch (col) {
    case 0: return 'ID검색...';
    case 1: return 'Apple, Sony...';
    case 2: return '스마트폰...';
    case 3: return '재고있음...';
    case 4: return 'VIP, 일반...';
    case 5: return '최소금액...';
    case 6: return '최소평점...';
    case 7: return 'SKU...';
    case 8: return '강남, 판교...';
    case 9: return '덕평, 김포...';
    case 10: return '카드, 계좌...';
    default: return `필터...`;
  }
};
</script>

<template>
  <div class="virtual-grid-root">
    <!-- Top HUD & Performance Info Bar -->
    <div class="grid-hud-bar">
      <div class="hud-badges">
        <span class="badge badge-wasm">Wasm 2D Grid (SoA)</span>
        <span class="badge badge-dict">사전 인코딩 (Dictionary)</span>
        <span class="hud-item">
          전체: <strong>{{ totalCount.toLocaleString() }}</strong> 행 × <strong>{{ props.colCount }}</strong> 열
          <span class="cell-count">({{ (totalCount * props.colCount).toLocaleString() }}개 셀)</span>
        </span>
        <span class="hud-item">
          필터 결과: <strong class="text-cyan">{{ filteredCount.toLocaleString() }}</strong> 행
        </span>
        <span class="hud-item timer-badge" v-if="filterTimeMs > 0">
          ⚡ 연산 소요: <strong class="text-emerald">{{ filterTimeMs }} ms</strong>
        </span>
      </div>

      <div class="hud-actions">
        <button
          class="btn-reset-filter"
          @click="resetAllFilters"
          :disabled="!hasActiveFiltersOrSort"
        >
          필터/정렬 초기화
        </button>
      </div>
    </div>

    <!-- 2D Virtual Scrolling Viewport -->
    <div
      v-virtual-scroll="scrollTarget"
      class="grid-viewport"
      :style="{ height: `${props.height}px` }"
    >
      <!-- Total Virtual Canvas (Total Width × Total Virtual Height) -->
      <div
        class="grid-canvas"
        :style="{
          width: `${totalWidth}px`,
          height: `${totalHeight + 76}px`,
        }"
      >
        <!-- Sticky Header (GPU Compositor Sticky: 100% Zero Jitter) -->
        <div
          class="grid-header-sticky"
          :style="{ width: `${totalWidth}px` }"
        >
          <!-- Row 1: Column Titles with Sorting Toggle -->
          <div class="header-tier-row title-row">
            <div
              v-for="c in props.colCount"
              :key="`header-title-${c - 1}`"
              class="header-cell title-cell"
              :class="{
                'pinned-sticky': c - 1 < props.pinnedCols,
                'pinned-last': c - 1 === props.pinnedCols - 1,
                'active-sort': sortColumn === c - 1
              }"
              :style="{
                width: `${props.colWidth}px`,
                left: c - 1 < props.pinnedCols ? `${(c - 1) * props.colWidth}px` : undefined,
              }"
              @click="toggleSort(c - 1)"
              title="클릭하여 오름차순/내림차순 정렬"
            >
              <div class="title-content">
                <span class="col-name">{{ getColumnName(c - 1) }}</span>
                <span class="sort-icon">
                  <template v-if="sortColumn === c - 1">
                    {{ sortAsc ? '▲' : '▼' }}
                  </template>
                  <template v-else>
                    <span class="sort-hint">⇅</span>
                  </template>
                </span>
              </div>
              <span class="col-num">#{{ c }}</span>
            </div>
          </div>

          <!-- Row 2: Column Filter Inputs -->
          <div class="header-tier-row filter-row">
            <div
              v-for="c in props.colCount"
              :key="`header-filter-${c - 1}`"
              class="header-cell filter-cell"
              :class="{
                'pinned-sticky': c - 1 < props.pinnedCols,
                'pinned-last': c - 1 === props.pinnedCols - 1
              }"
              :style="{
                width: `${props.colWidth}px`,
                left: c - 1 < props.pinnedCols ? `${(c - 1) * props.colWidth}px` : undefined,
              }"
            >
              <input
                type="text"
                :value="columnFilters[c - 1] || ''"
                @input="applyColumnFilter(c - 1, ($event.target as HTMLInputElement).value)"
                :placeholder="getHeaderInputPlaceholder(c - 1)"
                class="header-filter-input"
              />
            </div>
          </div>
        </div>

        <!-- 2D Virtual Data Rows (Flexbox Row Container with GPU Sticky Pinned Columns) -->
        <div class="grid-body-layer">
          <div
            v-for="r in visibleRowIndices"
            :key="`row-${r}`"
            class="grid-data-row"
            :style="{
              top: `${getCellTop(r) + 76}px`,
              width: `${totalWidth}px`,
              height: `${props.rowHeight}px`,
            }"
          >
            <!-- Cells across all columns in this row -->
            <div
              v-for="c in props.colCount"
              :key="`cell-${r}-${c - 1}`"
              class="grid-data-cell"
              :class="{
                'pinned-sticky': c - 1 < props.pinnedCols,
                'pinned-last': c - 1 === props.pinnedCols - 1
              }"
              :style="{
                width: `${props.colWidth}px`,
                height: `${props.rowHeight}px`,
                left: c - 1 < props.pinnedCols ? `${(c - 1) * props.colWidth}px` : undefined,
              }"
            >
              <slot name="cell" :row="r" :col="c - 1" :value="getCellValue(r, c - 1)">
                <span class="cell-text font-medium">{{ getCellValue(r, c - 1) }}</span>
              </slot>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.virtual-grid-root {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  background: #0b0f19;
  border-radius: 10px;
  border: 1px solid #1e293b;
  overflow: hidden;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.45);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  color: #f1f5f9;
}

.grid-hud-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 16px;
  background: #0d121f;
  border-bottom: 1px solid #1e293b;
  flex-wrap: wrap;
  gap: 12px;
  flex-shrink: 0;
}

.hud-badges {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 13px;
  flex-wrap: wrap;
}

.badge {
  padding: 3px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.badge-wasm {
  background: rgba(99, 102, 241, 0.2);
  color: #818cf8;
  border: 1px solid rgba(99, 102, 241, 0.4);
}

.badge-dict {
  background: rgba(14, 165, 233, 0.2);
  color: #38bdf8;
  border: 1px solid rgba(14, 165, 233, 0.4);
}

.hud-item {
  color: #94a3b8;
}

.cell-count {
  font-size: 11px;
  color: #64748b;
  margin-left: 2px;
}

.text-cyan {
  color: #38bdf8;
}

.timer-badge {
  background: rgba(16, 185, 129, 0.15);
  padding: 3px 8px;
  border-radius: 6px;
  border: 1px solid rgba(16, 185, 129, 0.3);
}

.text-emerald {
  color: #34d399;
}

.btn-reset-filter {
  padding: 6px 14px;
  background: #1e293b;
  color: #cbd5e1;
  border: 1px solid #334155;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-reset-filter:hover:not(:disabled) {
  background: #334155;
  color: #fff;
}

.btn-reset-filter:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* Viewport & Canvas */
.grid-viewport {
  position: relative;
  overflow: auto;
  background: #0b0f19;
}

.grid-canvas {
  position: relative;
}

/* Sticky Header: GPU Accelerated Pure CSS Sticky */
.grid-header-sticky {
  position: sticky;
  top: 0;
  left: 0;
  height: 76px;
  z-index: 100;
  background: #111827;
  border-bottom: 2px solid #334155;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
}

.header-tier-row {
  display: flex;
  height: 38px;
  width: 100%;
}

.title-row {
  background: #111827;
  border-bottom: 1px solid #1f2937;
}

.filter-row {
  background: #0d121f;
}

.header-cell {
  flex-shrink: 0;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  padding: 0 10px;
  border-right: 1px solid #1f2937;
  background: inherit;
}

/* Title Styling with Sort button */
.title-cell {
  justify-content: space-between;
  cursor: pointer;
  user-select: none;
  transition: background-color 0.15s;
}

.title-cell:hover {
  background-color: #1a2234;
}

.title-cell.active-sort {
  background-color: #1e2538;
  color: #38bdf8;
}

.title-content {
  display: flex;
  align-items: center;
  gap: 6px;
  overflow: hidden;
}

.col-name {
  font-size: 12px;
  font-weight: 700;
  color: inherit;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sort-icon {
  font-size: 11px;
  color: #38bdf8;
}

.sort-hint {
  color: #475569;
  font-size: 11px;
}

.col-num {
  font-size: 10px;
  color: #64748b;
  font-family: ui-monospace, SFMono-Regular, monospace;
}

/* Filter Input Styling */
.filter-cell {
  padding: 4px 8px;
}

.header-filter-input {
  width: 100%;
  height: 28px;
  background: #182030;
  border: 1px solid #293548;
  border-radius: 4px;
  color: #f1f5f9;
  font-size: 11px;
  padding: 0 8px;
  outline: none;
  box-sizing: border-box;
  transition: all 0.15s ease;
}

.header-filter-input:focus {
  border-color: #6366f1;
  background: #1e293b;
  box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.25);
}

.header-filter-input::placeholder {
  color: #475569;
  font-size: 11px;
}

/* 
 * ROCK-SOLID PINNED COLUMNS (0% JITTER)
 * Uses browser-native compositor-thread CSS position: sticky
 */
.pinned-sticky {
  position: sticky !important;
  z-index: 20 !important;
  background: #111827 !important;
}

.title-row .pinned-sticky {
  z-index: 120 !important;
  background: #141b2d !important;
}

.filter-row .pinned-sticky {
  z-index: 120 !important;
  background: #0f1524 !important;
}

.grid-data-row .pinned-sticky {
  z-index: 30 !important;
  background: #0f172a !important;
}

.pinned-last {
  border-right: 2px solid #6366f1 !important;
  box-shadow: 4px 0 8px rgba(0, 0, 0, 0.35);
}

/* Body Data Rows & Cells */
.grid-body-layer {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}

.grid-data-row {
  position: absolute;
  left: 0;
  display: flex;
  align-items: center;
  border-bottom: 1px solid #1e293b;
  background: #0b0f19;
}

.grid-data-row:hover {
  background: #141c2c;
}

.grid-data-row:hover .grid-data-cell {
  background: #141c2c !important;
}

.grid-data-cell {
  flex-shrink: 0;
  box-sizing: border-box;
  padding: 0 10px;
  display: flex;
  align-items: center;
  border-right: 1px solid #1e293b;
  font-size: 12px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  background: inherit;
}

.cell-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.font-medium {
  font-weight: 500;
  color: #e2e8f0;
}
</style>
