<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { ContextMenuItem, RangeSelectionStats } from '../types'

defineProps<{
  x: number
  y: number
  items: ContextMenuItem[]
  stats?: RangeSelectionStats | null
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const onGlobalClick = () => {
  emit('close')
}

onMounted(() => {
  window.addEventListener('click', onGlobalClick)
  window.addEventListener('contextmenu', onGlobalClick)
})

onUnmounted(() => {
  window.removeEventListener('click', onGlobalClick)
  window.removeEventListener('contextmenu', onGlobalClick)
})
</script>

<template>
  <div
    class="grid-context-menu"
    :style="{ left: `${x}px`, top: `${y}px` }"
    @click.stop
  >
    <!-- 선택 범위 실시간 통계 바 (통계가 있을 경우) -->
    <div v-if="stats && stats.count > 1" class="context-stats-panel">
      <div class="stat-badge">
        <span class="stat-label">선택 셀</span>
        <span class="stat-val">{{ stats.count }}개</span>
      </div>
      <div v-if="stats.numericCount > 0" class="stat-badge">
        <span class="stat-label">합계</span>
        <span class="stat-val">{{ Math.round(stats.sum).toLocaleString() }}</span>
      </div>
      <div v-if="stats.numericCount > 0" class="stat-badge">
        <span class="stat-label">평균</span>
        <span class="stat-val">{{ (Math.round(stats.avg * 10) / 10).toLocaleString() }}</span>
      </div>
    </div>

    <div v-if="stats && stats.count > 1" class="context-divider" />

    <!-- 메뉴 액션 목록 -->
    <template v-for="(item, idx) in items" :key="idx">
      <div v-if="item.divider" class="context-divider" />
      <button
        v-else
        class="context-item-btn"
        :disabled="item.disabled"
        @click="item.action(); emit('close')"
      >
        <span v-if="item.icon" class="context-icon">{{ item.icon }}</span>
        <span class="context-text">{{ item.label }}</span>
      </button>
    </template>
  </div>
</template>

<style scoped>
.grid-context-menu {
  position: fixed;
  z-index: 10000;
  width: 210px;
  background: #ffffff;
  border-radius: 8px;
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.25), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
  border: 1px solid #cbd5e1;
  padding: 6px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-family: inherit;
  animation: context-pop 0.1s ease-out;
}

@keyframes context-pop {
  from { opacity: 0; transform: scale(0.95); }
  to { opacity: 1; transform: scale(1); }
}

.context-stats-panel {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  padding: 4px 6px;
  background: #f8fafc;
  border-radius: 4px;
  border: 1px solid #e2e8f0;
}

.stat-badge {
  display: flex;
  flex-direction: column;
  font-size: 10px;
  color: #64748b;
  flex: 1;
  min-width: 50px;
}

.stat-label {
  font-size: 9px;
  font-weight: 600;
  text-transform: uppercase;
}

.stat-val {
  font-size: 11px;
  font-weight: 700;
  color: #1e293b;
}

.context-divider {
  height: 1px;
  background: #e2e8f0;
  margin: 3px 0;
}

.context-item-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 10px;
  border-radius: 4px;
  border: none;
  background: transparent;
  font-size: 12px;
  font-weight: 500;
  color: #334155;
  cursor: pointer;
  text-align: left;
  transition: background 0.1s ease;
}

.context-item-btn:hover:not(:disabled) {
  background: #eff6ff;
  color: #1d4ed8;
}

.context-item-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.context-icon {
  font-size: 13px;
}

.context-text {
  flex-grow: 1;
}
</style>
