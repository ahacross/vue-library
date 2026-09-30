<script setup lang="ts">
import { computed, h, isVNode, toRaw } from 'vue'
import { ColumnDef, CellRendererParams, GridApi } from '../types'

const props = defineProps<{
  column: ColumnDef
  row: any
  value: any
  rowIndex: number
  api: GridApi
}>()

const emit = defineEmits<{
  (e: 'cellChange', field: string, value: any, rowIndex: number): void
}>()

// 셀 렌더러 파라미터 (ag-Grid 스타일)
const cellParams = computed<CellRendererParams>(() => {
  return {
    value: props.value,
    row: props.row,
    rowIndex: props.rowIndex,
    field: props.column.field,
    column: props.column,
    api: props.api,
    setValue: (newValue: any) => {
      props.row[props.column.field] = newValue
      emit('cellChange', props.column.field, newValue, props.rowIndex)
    },
    refreshCell: () => {
      props.api.refreshView()
    },
    ...(props.column.cellRendererParams || {})
  }
})

// 함수형 또는 컴포넌트 렌더러 평가
const renderedContent = computed(() => {
  const renderer = props.column.cellRenderer
  if (!renderer) return null

  if (typeof renderer === 'function') {
    try {
      const res = (renderer as Function)(cellParams.value)
      return res
    } catch {
      return null
    }
  }
  return null
})

// VNode 렌더러 헬퍼 컴포넌트
const VNodeRenderer = () => {
  const content = renderedContent.value
  if (isVNode(content)) {
    return content
  }
  if (typeof content === 'string' || typeof content === 'number' || typeof content === 'boolean') {
    return h('span', String(content))
  }
  return null
}

const displayValue = computed(() => {
  if (props.column.valueFormatter) {
    return props.column.valueFormatter(props.value, props.row)
  }
  return props.value !== undefined && props.value !== null ? String(props.value) : ''
})

const isVueComponent = computed(() => {
  const renderer = props.column.cellRenderer
  if (!renderer) return false
  return typeof renderer === 'object' || (typeof renderer === 'function' && renderedContent.value === null)
})

const rawComponent = computed(() => {
  return props.column.cellRenderer ? toRaw(props.column.cellRenderer) : null
})
</script>

<template>
  <div class="grid-cell-content">
    <!-- 1. Vue Component 렌더러인 경우 (toRaw로 반응형 오버헤드 및 워닝 방지) -->
    <component
      :is="rawComponent"
      v-if="isVueComponent"
      :params="cellParams"
    />

    <!-- 2. 함수형 렌더러 (VNode / 문자열 / JSX 반환)인 경우 -->
    <VNodeRenderer v-else-if="renderedContent !== null" />

    <!-- 3. 기본 텍스트 / valueFormatter 출력 -->
    <span v-else class="cell-text">
      {{ displayValue }}
    </span>
  </div>
</template>

<style scoped>
.grid-cell-content {
  display: flex;
  align-items: center;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.cell-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
