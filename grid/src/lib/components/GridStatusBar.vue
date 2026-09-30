<script setup lang="ts">
import { computed } from 'vue'
import { GridBenchmarkMetrics } from '../types'

const props = defineProps<{
  metrics: GridBenchmarkMetrics
  selectedCount?: number
}>()

const formattedTotal = computed(() => props.metrics.totalRows.toLocaleString())
const formattedFiltered = computed(() => props.metrics.filteredRows.toLocaleString())
const isFiltered = computed(() => props.metrics.filteredRows !== props.metrics.totalRows)

const memoryText = computed(() => {
  if (!props.metrics.memoryUsageMb) return null
  return `${props.metrics.memoryUsageMb.toFixed(1)} MB`
})
</script>

<template>
  <div class="hyper-grid-status-bar">
    <div class="hyper-grid-status-left">
      <span>
        전체 행: <strong>{{ formattedTotal }}</strong>
      </span>
      <span v-if="isFiltered" style="color: #ea580c;">
        필터 결과: <strong>{{ formattedFiltered }}</strong>
      </span>
      <span v-if="selectedCount && selectedCount > 0">
        선택: <strong>{{ selectedCount.toLocaleString() }}</strong>개
      </span>
      <span style="opacity: 0.7;">
        표시 범위: [{{ metrics.renderedRange[0].toLocaleString() }} ~ {{ metrics.renderedRange[1].toLocaleString() }}]
      </span>
    </div>

    <div class="hyper-grid-status-right">
      <span v-if="memoryText" class="hyper-grid-metric-badge" title="TypedArray SoA 압축 메모리">
        💾 RAM: {{ memoryText }}
      </span>
      <span class="hyper-grid-metric-badge" title="최근 프레임 렌더링 소요 시간">
        ⚡ 렌더: {{ metrics.renderDurationMs.toFixed(1) }}ms
      </span>
      <span v-if="metrics.workerDurationMs > 0" class="hyper-grid-metric-badge" title="Worker 정렬/필터 연산 시간">
        ⚙️ Worker: {{ metrics.workerDurationMs.toFixed(1) }}ms
      </span>
      <span class="hyper-grid-metric-badge" title="초당 프레임 수">
        🎯 {{ metrics.fps }} FPS
      </span>
      <span style="font-size: 11px; opacity: 0.7;">
        활성 DOM: {{ metrics.activeDomNodes }}개
      </span>
    </div>
  </div>
</template>
