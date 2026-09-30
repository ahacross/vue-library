<template>
  <div ref="containerRef" class="nova-canvas-grid-root" :style="{ width, height }"></div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, watch } from 'vue';

const props = defineProps({
  columns: {
    type: Array,
    required: true,
    default: () => []
  },
  data: {
    type: Array,
    default: () => []
  },
  opfsEngine: {
    type: Object,
    default: null
  },
  wasmBridge: {
    type: Object,
    default: null
  },
  rowHeight: {
    type: Number,
    default: 32
  },
  headerHeight: {
    type: Number,
    default: 36
  },
  frozenColCount: {
    type: Number,
    default: 1
  },
  theme: {
    type: Object,
    default: () => ({})
  },
  width: {
    type: String,
    default: '100%'
  },
  height: {
    type: String,
    default: '100%'
  }
});

const emit = defineEmits(['select', 'cell-click', 'sort', 'visible-rows-change']);

const containerRef = ref(null);
// 💡 핵심: 오직 화면에 렌더링된 20~35개 행만 Vue의 반응형(Proxy) 객체로 감쌈 (메모리 0.01MB)
const visibleRows = shallowRef([]);
let gridInstance = null;
let resizeObserver = null;

onMounted(() => {
  if (!containerRef.value) return;

  const CanvasGridClass = window.CanvasGrid || (typeof CanvasGrid !== 'undefined' ? CanvasGrid : null);
  if (!CanvasGridClass) {
    console.error('[NovaCanvasGrid] CanvasGrid 코어 모듈을 찾을 수 없습니다.');
    return;
  }

  gridInstance = new CanvasGridClass(containerRef.value, {
    columns: props.columns,
    data: props.data,
    opfsEngine: props.opfsEngine,
    wasmBridge: props.wasmBridge,
    rowHeight: props.rowHeight,
    headerHeight: props.headerHeight,
    frozenColCount: props.frozenColCount,
    theme: props.theme,
    onSelect: (cell, rowData) => {
      emit('select', { cell, rowData });
    },
    onSort: (key, order) => {
      emit('sort', { key, order });
    },
    // 화면 뷰포트에 렌더링된 행만 Vue 반응성으로 전달
    onVisibleRowsChange: (rows, range) => {
      visibleRows.value = rows;
      emit('visible-rows-change', { rows, range });
    }
  });

  if (window.ResizeObserver) {
    resizeObserver = new ResizeObserver(() => {
      gridInstance?.resize();
    });
    resizeObserver.observe(containerRef.value);
  }
});

watch(() => props.data, (newVal) => {
  gridInstance?.setData(newVal);
});

watch(() => props.columns, (newVal) => {
  gridInstance?.setColumns(newVal);
}, { deep: true });

onBeforeUnmount(() => {
  if (resizeObserver) {
    resizeObserver.disconnect();
    resizeObserver = null;
  }
  gridInstance = null;
});

defineExpose({
  getInstance: () => gridInstance,
  visibleRows, // 오직 렌더링된 행만 포함하는 초경량 반응형 윈도우!
  resize: () => gridInstance?.resize(),
  render: () => gridInstance?.render(),
  sort: (key) => gridInstance?.handleSort(key),
  applyFilter: (condition) => gridInstance?.applyFilter(condition),
  clearFilter: () => gridInstance?.clearFilter(),
  scrollToRow: (row) => gridInstance?.scrollToRow(row),
  updateRow: (sourceIndex, partialData) => gridInstance?.updateRow(sourceIndex, partialData)
});
</script>

<style scoped>
.nova-canvas-grid-root {
  position: relative;
  overflow: hidden;
  box-sizing: border-box;
  user-select: none;
}
</style>
