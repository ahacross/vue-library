<script setup lang="ts">
import { ref, computed } from 'vue';
import { VirtualGrid } from '@wasm-virtual/vue';

const rowCount = ref(10_000_000); // Default to 10 Million rows!
const colCount = ref(50);         // 50 columns = 500 Million cells!
const pinnedCols = ref(2);        // First 2 columns pinned sticky

const totalCells = computed(() => {
  return (rowCount.value * colCount.value).toLocaleString();
});
</script>

<template>
  <div class="grid-demo-root">
    <!-- Controls Bar -->
    <div class="demo-controls">
      <div class="control-group">
        <label>행 개수 (Rows):</label>
        <div class="btn-group">
          <button
            :class="{ active: rowCount === 10000 }"
            @click="rowCount = 10000"
          >
            1만
          </button>
          <button
            :class="{ active: rowCount === 100000 }"
            @click="rowCount = 100000"
          >
            10만
          </button>
          <button
            :class="{ active: rowCount === 1000000 }"
            @click="rowCount = 1000000"
          >
            100만
          </button>
          <button
            :class="{ active: rowCount === 10000000 }"
            @click="rowCount = 10000000"
          >
            🔥 1,000만 행
          </button>
        </div>
      </div>

      <div class="control-group">
        <label>열 개수 (Cols):</label>
        <div class="btn-group">
          <button :class="{ active: colCount === 20 }" @click="colCount = 20">20열</button>
          <button :class="{ active: colCount === 50 }" @click="colCount = 50">🔥 50열</button>
          <button :class="{ active: colCount === 100 }" @click="colCount = 100">100열</button>
        </div>
      </div>

      <div class="control-group">
        <label>틀고정 (Pinned):</label>
        <div class="btn-group">
          <button :class="{ active: pinnedCols === 1 }" @click="pinnedCols = 1">1열</button>
          <button :class="{ active: pinnedCols === 2 }" @click="pinnedCols = 2">2열</button>
          <button :class="{ active: pinnedCols === 3 }" @click="pinnedCols = 3">3열</button>
        </div>
      </div>

      <div class="stats-summary">
        <span class="stat-label">총 가상 셀 수:</span>
        <span class="stat-num">{{ totalCells }} 개</span>
      </div>
    </div>

    <!-- Main 2D Virtual Grid with Column Filter Header -->
    <div class="grid-content-area">
      <VirtualGrid
        :key="`${rowCount}-${colCount}-${pinnedCols}`"
        :row-count="rowCount"
        :col-count="colCount"
        :pinned-cols="pinnedCols"
        :row-height="38"
        :col-width="130"
        :height="620"
      />
    </div>
  </div>
</template>

<style scoped>
.grid-demo-root {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 16px 20px;
  gap: 14px;
  background-color: #0b0f19;
  box-sizing: border-box;
}

.demo-controls {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 20px;
  background-color: #111827;
  padding: 12px 18px;
  border-radius: 10px;
  border: 1px solid #1f2937;
  flex-shrink: 0;
}

.control-group {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
  color: #94a3b8;
}

.btn-group {
  display: flex;
  background-color: #1f2937;
  border-radius: 6px;
  padding: 2px;
  gap: 2px;
}

.btn-group button {
  background: transparent;
  border: none;
  color: #9ca3af;
  padding: 6px 12px;
  font-size: 12px;
  font-weight: 500;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-group button:hover {
  color: #f3f4f6;
  background-color: #374151;
}

.btn-group button.active {
  background-color: #6366f1;
  color: #ffffff;
  font-weight: 600;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
}

.stats-summary {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 8px;
  background-color: #1e293b;
  padding: 6px 14px;
  border-radius: 6px;
  border: 1px solid #334155;
  font-size: 13px;
}

.stat-label {
  color: #94a3b8;
}

.stat-num {
  color: #38bdf8;
  font-weight: 700;
  font-family: ui-monospace, SFMono-Regular, monospace;
}

.grid-content-area {
  flex: 1;
  min-height: 0;
  position: relative;
}
</style>
