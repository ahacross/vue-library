<script setup lang="ts">
import { ref, computed } from 'vue'
import { ColumnDef, ColumnGroupDef, SortDirection } from '../types'
import ColumnFilterMenu from './ColumnFilterMenu.vue'

const props = defineProps<{
  columns: ColumnDef[]
  columnGroups?: ColumnGroupDef[]
  headerHeight: number
  scrollLeft: number
  sortField: string | null
  sortDirection: SortDirection
  allSelected?: boolean
  hasSelection?: boolean
  filterValuesMap?: Record<string, string[]>
  visibleCenterColumns?: ColumnDef[]
  leftSpacerWidth?: number
  rightSpacerWidth?: number
}>()

const emit = defineEmits<{
  (e: 'sort', field: string, dir?: SortDirection): void
  (e: 'resize', field: string, width: number): void
  (e: 'selectAll', select: boolean): void
  (e: 'reorder', fromField: string, toField: string): void
  (e: 'filter', field: string, values: string[] | null): void
}>()

// 리사이징 상태
const isResizing = ref(false)
const resizingField = ref<string | null>(null)
let startX = 0
let startWidth = 0

// 드래그 앤 드롭 컬럼 재배치 상태
const draggingField = ref<string | null>(null)
const dragOverField = ref<string | null>(null)

// 활성 컬럼 필터 팝업 필드
const activeFilterMenuField = ref<string | null>(null)

const toggleFilterMenu = (field: string, event: MouseEvent) => {
  event.stopPropagation()
  if (activeFilterMenuField.value === field) {
    activeFilterMenuField.value = null
  } else {
    activeFilterMenuField.value = field
  }
}

const onResizeStart = (col: ColumnDef, event: MouseEvent) => {
  event.preventDefault()
  event.stopPropagation()
  isResizing.value = true
  resizingField.value = col.field
  startX = event.clientX
  startWidth = col.width || 120

  const onMouseMove = (moveEvent: MouseEvent) => {
    const deltaX = moveEvent.clientX - startX
    const minW = col.minWidth || 50
    const maxW = col.maxWidth || 800
    const newWidth = Math.min(maxW, Math.max(minW, startWidth + deltaX))
    emit('resize', col.field, newWidth)
  }

  const onMouseUp = () => {
    isResizing.value = false
    resizingField.value = null
    window.removeEventListener('mousemove', onMouseMove)
    window.removeEventListener('mouseup', onMouseUp)
  }

  window.addEventListener('mousemove', onMouseMove)
  window.addEventListener('mouseup', onMouseUp)
}

const onHeaderClick = (col: ColumnDef) => {
  if (isResizing.value || draggingField.value) return
  if (col.sortable !== false) {
    emit('sort', col.field)
  }
}

// 드래그 앤 드롭 핸들러
const onDragStart = (e: DragEvent, field: string) => {
  if (isResizing.value) {
    e.preventDefault()
    return
  }
  draggingField.value = field
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', field)
  }
}

const onDragOver = (e: DragEvent, field: string) => {
  if (!draggingField.value || draggingField.value === field) return
  e.preventDefault()
  dragOverField.value = field
}

const onDrop = (e: DragEvent, targetField: string) => {
  e.preventDefault()
  if (draggingField.value && draggingField.value !== targetField) {
    emit('reorder', draggingField.value, targetField)
  }
  draggingField.value = null
  dragOverField.value = null
}

const onDragEnd = () => {
  draggingField.value = null
  dragOverField.value = null
}

// 다단 그룹 헤더 너비 계산
const groupHeaderWidths = computed(() => {
  if (!props.columnGroups) return {}
  const widths: Record<string, number> = {}
  for (const group of props.columnGroups) {
    let w = 0
    for (const childField of group.children) {
      const col = props.columns.find((c) => c.field === childField)
      if (col) w += col.width || 120
    }
    widths[group.groupId] = w
  }
  return widths
})

// 좌측 고정 컬럼 총 너비 (체크박스 44px 포함)
const leftPinnedWidth = computed(() => {
  const checkboxW = props.hasSelection ? 44 : 0
  const colsW = props.columns
    .filter((c) => c.pinned === 'left')
    .reduce((sum, c) => sum + (c.width || 120), 0)
  return checkboxW + colsW
})

// 우측 고정 컬럼 총 너비
const rightPinnedWidth = computed(() => {
  return props.columns
    .filter((c) => c.pinned === 'right')
    .reduce((sum, c) => sum + (c.width || 120), 0)
})

// 좌측 고정 영역과 일반 스크롤 영역의 그룹 분리
const leftPinnedFieldNames = computed(() => {
  return new Set(props.columns.filter((c) => c.pinned === 'left').map((c) => c.field))
})

const leftPinnedGroups = computed(() => {
  if (!props.columnGroups) return []
  const pinnedSet = leftPinnedFieldNames.value
  return props.columnGroups.filter((g) => g.children.some((f) => pinnedSet.has(f)))
})

const unpinnedGroups = computed(() => {
  if (!props.columnGroups) return []
  const pinnedSet = leftPinnedFieldNames.value
  return props.columnGroups.filter((g) => !g.children.some((f) => pinnedSet.has(f)))
})

// 외부 클릭 시 필터 팝업 닫기
const closeFilterMenu = () => {
  activeFilterMenuField.value = null
}
</script>

<template>
  <div
    class="hyper-grid-header-wrapper"
    :class="{ 'has-groups': !!columnGroups && columnGroups.length > 0 }"
    @click="closeFilterMenu"
  >
    <!-- 1단: 다단 그룹 헤더 (Group Headers) -->
    <div
      v-if="columnGroups && columnGroups.length > 0"
      class="hyper-grid-group-header-row"
      :style="{ height: `${headerHeight}px` }"
    >
      <!-- 좌측 고정 그룹 영역 (체크박스 및 좌측 고정 컬럼과 정렬) -->
      <div
        v-if="leftPinnedWidth > 0"
        class="hyper-grid-group-header-pinned-left"
        :style="{ width: `${leftPinnedWidth}px`, flexShrink: 0 }"
      >
        <div
          v-if="hasSelection && leftPinnedGroups.length === 0"
          style="width: 44px; flex-shrink: 0;"
          class="hyper-grid-group-header-cell"
        />
        <div
          v-for="group in leftPinnedGroups"
          :key="group.groupId"
          class="hyper-grid-group-header-cell"
          :style="{ width: `${groupHeaderWidths[group.groupId] || 200}px` }"
        >
          <span class="group-title">{{ group.headerName }}</span>
        </div>
      </div>

      <!-- 일반 스크롤 그룹 헤더 (클리핑 뷰포트 + 내부 트랜스폼) -->
      <div class="hyper-grid-header-scroll-viewport">
        <div
          class="hyper-grid-group-headers-scroll"
          :style="{ transform: `translateX(-${scrollLeft}px)` }"
        >
          <div
            v-for="group in unpinnedGroups"
            :key="group.groupId"
            class="hyper-grid-group-header-cell"
            :style="{ width: `${groupHeaderWidths[group.groupId] || 200}px` }"
          >
            <span class="group-title">{{ group.headerName }}</span>
          </div>
        </div>
      </div>

      <!-- 우측 고정 그룹 스페이서 -->
      <div
        v-if="rightPinnedWidth > 0"
        class="hyper-grid-group-header-pinned-right"
        :style="{ width: `${rightPinnedWidth}px`, flexShrink: 0 }"
      />
    </div>

    <!-- 2단: 기본 개별 컬럼 헤더 행 -->
    <div class="hyper-grid-header" :style="{ height: `${headerHeight}px` }">
      <!-- 좌측 고정 영역 (전체 선택 체크박스 + 좌측 고정 컬럼들) -->
      <div class="hyper-grid-header-pinned-left">
        <!-- 전체 선택 체크박스 -->
        <div
          v-if="hasSelection"
          class="hyper-grid-header-cell hyper-grid-header-cell-pinned-left"
          style="width: 44px; justify-content: center; padding: 0; flex-shrink: 0;"
        >
          <input
            type="checkbox"
            class="hyper-grid-checkbox"
            :checked="allSelected"
            @change="emit('selectAll', ($event.target as HTMLInputElement).checked)"
          />
        </div>

        <template v-for="col in columns.filter(c => c.pinned === 'left')" :key="col.field">
          <div
            class="hyper-grid-header-cell hyper-grid-cell-pinned-left"
            :class="{
              'is-drag-target': dragOverField === col.field,
              'is-dragging': draggingField === col.field
            }"
            :style="{ width: `${col.width || 120}px` }"
            draggable="true"
            @dragstart="onDragStart($event, col.field)"
            @dragover="onDragOver($event, col.field)"
            @drop="onDrop($event, col.field)"
            @dragend="onDragEnd"
            @click="onHeaderClick(col)"
          >
            <span class="hyper-grid-header-title">{{ col.headerName || col.field }}</span>
            <span v-if="sortField === col.field" class="hyper-grid-sort-icon">
              {{ sortDirection === 'asc' ? '▲' : sortDirection === 'desc' ? '▼' : '' }}
            </span>

            <!-- 엑셀 세트 필터 트리거 아이콘 -->
            <button
              class="col-menu-trigger"
              title="필터 및 정렬 메뉴"
              @click="toggleFilterMenu(col.field, $event)"
            >
              ☰
            </button>

            <!-- 세트 필터 팝업 -->
            <ColumnFilterMenu
              v-if="activeFilterMenuField === col.field"
              :column="col"
              :current-sort-dir="sortField === col.field ? sortDirection : null"
              :available-values="filterValuesMap?.[col.field]"
              @sort="(dir) => emit('sort', col.field, dir)"
              @filter="(vals) => emit('filter', col.field, vals)"
              @close="closeFilterMenu"
            />

            <div
              v-if="col.resizable !== false"
              class="hyper-grid-col-resizer"
              :class="{ 'is-resizing': resizingField === col.field }"
              @mousedown="onResizeStart(col, $event)"
            />
          </div>
        </template>
      </div>

      <!-- 일반 스크롤 컬럼 영역 (오버플로우 클리핑 뷰포트) -->
      <div class="hyper-grid-header-scroll-viewport">
        <div
          class="hyper-grid-header-scroll-content"
          :style="{ transform: `translateX(-${scrollLeft}px)` }"
        >
          <!-- 가상 컬럼 좌측 스페이서 -->
          <div
            v-if="(leftSpacerWidth ?? 0) > 0"
            class="hyper-grid-col-spacer"
            :style="{ width: `${leftSpacerWidth}px`, flexShrink: 0 }"
            aria-hidden="true"
          />

          <template v-for="col in (visibleCenterColumns ?? columns.filter(c => !c.pinned))" :key="col.field">
            <div
              class="hyper-grid-header-cell"
              :class="{
                'is-drag-target': dragOverField === col.field,
                'is-dragging': draggingField === col.field
              }"
              :style="{ width: `${col.width || 120}px` }"
              draggable="true"
              @dragstart="onDragStart($event, col.field)"
              @dragover="onDragOver($event, col.field)"
              @drop="onDrop($event, col.field)"
              @dragend="onDragEnd"
              @click="onHeaderClick(col)"
            >
              <span class="hyper-grid-header-title">{{ col.headerName || col.field }}</span>
              <span v-if="sortField === col.field" class="hyper-grid-sort-icon">
                {{ sortDirection === 'asc' ? '▲' : sortDirection === 'desc' ? '▼' : '' }}
              </span>

              <!-- 엑셀 세트 필터 트리거 아이콘 -->
              <button
                class="col-menu-trigger"
                title="필터 및 정렬 메뉴"
                @click="toggleFilterMenu(col.field, $event)"
              >
                ☰
              </button>

              <!-- 세트 필터 팝업 -->
              <ColumnFilterMenu
                v-if="activeFilterMenuField === col.field"
                :column="col"
                :current-sort-dir="sortField === col.field ? sortDirection : null"
                :available-values="filterValuesMap?.[col.field]"
                @sort="(dir) => emit('sort', col.field, dir)"
                @filter="(vals) => emit('filter', col.field, vals)"
                @close="closeFilterMenu"
              />

              <div
                v-if="col.resizable !== false"
                class="hyper-grid-col-resizer"
                :class="{ 'is-resizing': resizingField === col.field }"
                @mousedown="onResizeStart(col, $event)"
              />
            </div>
          </template>

          <!-- 가상 컬럼 우측 스페이서 -->
          <div
            v-if="(rightSpacerWidth ?? 0) > 0"
            class="hyper-grid-col-spacer"
            :style="{ width: `${rightSpacerWidth}px`, flexShrink: 0 }"
            aria-hidden="true"
          />
        </div>
      </div>

      <!-- 우측 고정 컬럼들 -->
      <div v-if="columns.some(c => c.pinned === 'right')" class="hyper-grid-header-pinned-right">
        <template v-for="col in columns.filter(c => c.pinned === 'right')" :key="col.field">
          <div
            class="hyper-grid-header-cell hyper-grid-cell-pinned-right"
            :class="{
              'is-drag-target': dragOverField === col.field,
              'is-dragging': draggingField === col.field
            }"
            :style="{ width: `${col.width || 120}px` }"
            draggable="true"
            @dragstart="onDragStart($event, col.field)"
            @dragover="onDragOver($event, col.field)"
            @drop="onDrop($event, col.field)"
            @dragend="onDragEnd"
            @click="onHeaderClick(col)"
          >
            <span class="hyper-grid-header-title">{{ col.headerName || col.field }}</span>
            <span v-if="sortField === col.field" class="hyper-grid-sort-icon">
              {{ sortDirection === 'asc' ? '▲' : sortDirection === 'desc' ? '▼' : '' }}
            </span>

            <!-- 엑셀 세트 필터 트리거 아이콘 -->
            <button
              class="col-menu-trigger"
              title="필터 및 정렬 메뉴"
              @click="toggleFilterMenu(col.field, $event)"
            >
              ☰
            </button>

            <!-- 세트 필터 팝업 -->
            <ColumnFilterMenu
              v-if="activeFilterMenuField === col.field"
              :column="col"
              :current-sort-dir="sortField === col.field ? sortDirection : null"
              :available-values="filterValuesMap?.[col.field]"
              @sort="(dir) => emit('sort', col.field, dir)"
              @filter="(vals) => emit('filter', col.field, vals)"
              @close="closeFilterMenu"
            />

            <div
              v-if="col.resizable !== false"
              class="hyper-grid-col-resizer"
              :class="{ 'is-resizing': resizingField === col.field }"
              @mousedown="onResizeStart(col, $event)"
            />
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.hyper-grid-header-wrapper {
  display: flex;
  flex-direction: column;
  position: relative;
  user-select: none;
}

.hyper-grid-header-scroll-viewport {
  flex-grow: 1;
  overflow: hidden;
  position: relative;
  min-width: 0;
  display: flex;
}

.hyper-grid-header-scroll-content,
.hyper-grid-group-headers-scroll {
  display: flex;
  will-change: transform;
  flex-shrink: 0;
}

.hyper-grid-group-header-row {
  display: flex;
  background-color: var(--hg-header-bg, #f8fafc);
  border-bottom: 1px solid var(--hg-border-color, #e2e8f0);
  overflow: hidden;
}

.hyper-grid-group-header-pinned-left,
.hyper-grid-group-header-pinned-right {
  display: flex;
  z-index: 12;
  background-color: var(--hg-header-bg, #f1f5f9);
}

.hyper-grid-group-header-pinned-left {
  box-shadow: var(--hg-pinned-shadow);
}

.hyper-grid-group-header-pinned-right {
  box-shadow: var(--hg-pinned-right-shadow);
}

.hyper-grid-group-header-cell {
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 12px;
  color: #1e293b;
  border-right: 1px solid var(--hg-border-color, #e2e8f0);
  background: #f1f5f9;
  box-sizing: border-box;
}

.hyper-grid-header-cell-pinned-left,
.hyper-grid-header-cell-pinned-right {
  background-color: var(--hg-header-bg, #f1f5f9) !important;
}

.col-menu-trigger {
  background: transparent;
  border: none;
  font-size: 10px;
  color: #64748b;
  cursor: pointer;
  padding: 2px 4px;
  border-radius: 3px;
  opacity: 0;
  transition: opacity 0.15s ease, background 0.15s ease;
  margin-left: auto;
}

.hyper-grid-header-cell:hover .col-menu-trigger {
  opacity: 1;
}

.col-menu-trigger:hover {
  background: rgba(0, 0, 0, 0.08);
  color: #1e293b;
}

.hyper-grid-header-cell.is-drag-target {
  border-left: 3px solid #2563eb !important;
}

.hyper-grid-header-cell.is-dragging {
  opacity: 0.5;
  background-color: #eff6ff !important;
}
</style>
