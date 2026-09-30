<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import GridDemo from './views/GridDemo.vue';
import TreeDemo from './views/TreeDemo.vue';
import SelectDemo from './views/SelectDemo.vue';

const activeTab = ref<'grid' | 'tree' | 'select'>('grid');

// Real-time FPS Counter
const currentFps = ref(60);
let frameCount = 0;
let lastTime = performance.now();
let animFrameId: number;

const calculateFps = (now: number) => {
  frameCount++;
  const delta = now - lastTime;
  if (delta >= 1000) {
    currentFps.value = Math.round((frameCount * 1000) / delta);
    frameCount = 0;
    lastTime = now;
  }
  animFrameId = requestAnimationFrame(calculateFps);
};

onMounted(() => {
  animFrameId = requestAnimationFrame(calculateFps);
});

onUnmounted(() => {
  cancelAnimationFrame(animFrameId);
});
</script>

<template>
  <div class="app-layout">
    <!-- Navigation Header -->
    <header class="app-header">
      <div class="header-brand">
        <div class="brand-logo">⚡</div>
        <div>
          <h1 class="brand-title">Wasm Virtual Scroller</h1>
          <p class="brand-sub">Rust + WebAssembly 극초경량(41KB Gzip) 고성능 2D 가상화 & 사전 인코딩 엔진</p>
        </div>
      </div>

      <!-- Tab Switcher -->
      <nav class="nav-tabs">
        <button
          class="tab-btn"
          :class="{ active: activeTab === 'grid' }"
          @click="activeTab = 'grid'"
        >
          📊 2D Grid (1,000만 행 × 50열 & 컬럼별 필터)
        </button>
        <button
          class="tab-btn"
          :class="{ active: activeTab === 'tree' }"
          @click="activeTab = 'tree'"
        >
          🌳 Tree (5만 계층 노드)
        </button>
        <button
          class="tab-btn"
          :class="{ active: activeTab === 'select' }"
          @click="activeTab = 'select'"
        >
          🔽 Select (100만 옵션 검색)
        </button>
      </nav>

      <!-- System Performance Badges -->
      <div class="header-metrics">
        <div class="metric-badge fps-badge" :class="{ smooth: currentFps >= 50 }">
          <span class="dot"></span>
          <span class="metric-val">{{ currentFps }} FPS</span>
        </div>
        <div class="metric-badge wasm-badge">
          <span class="wasm-tag">Wasm Core</span>
          <span class="wasm-size">41.1 KB (Gzip 압축)</span>
        </div>
      </div>
    </header>

    <!-- Main Viewport -->
    <main class="app-main">
      <KeepAlive>
        <component
          :is="
            activeTab === 'grid'
              ? GridDemo
              : activeTab === 'tree'
              ? TreeDemo
              : SelectDemo
          "
        />
      </KeepAlive>
    </main>
  </div>
</template>

<style scoped>
.app-layout {
  display: flex;
  flex-direction: column;
  width: 100vw;
  height: 100vh;
  background-color: #0b0f19;
  color: #f1f5f9;
  overflow: hidden;
}

.app-header {
  height: 60px;
  background-color: #111827;
  border-bottom: 1px solid #1f2937;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  flex-shrink: 0;
  gap: 16px;
}

.header-brand {
  display: flex;
  align-items: center;
  gap: 12px;
}

.brand-logo {
  font-size: 24px;
  background: linear-gradient(135deg, #38bdf8, #818cf8);
  width: 38px;
  height: 38px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.brand-title {
  font-size: 16px;
  font-weight: 700;
  color: #f8fafc;
  line-height: 1.2;
}

.brand-sub {
  font-size: 11px;
  color: #94a3b8;
}

.nav-tabs {
  display: flex;
  gap: 6px;
  background: #0f172a;
  padding: 4px;
  border-radius: 8px;
  border: 1px solid #1e293b;
}

.tab-btn {
  background: transparent;
  border: none;
  color: #94a3b8;
  padding: 6px 14px;
  font-size: 13px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s ease;
  font-weight: 500;
}

.tab-btn:hover {
  color: #f1f5f9;
}

.tab-btn.active {
  background: #0284c7;
  color: #ffffff;
  font-weight: 600;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
}

.header-metrics {
  display: flex;
  align-items: center;
  gap: 10px;
}

.metric-badge {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 12px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

.fps-badge {
  background: rgba(239, 68, 68, 0.15);
  border: 1px solid rgba(239, 68, 68, 0.3);
  color: #f87171;
}

.fps-badge.smooth {
  background: rgba(34, 197, 94, 0.15);
  border: 1px solid rgba(34, 197, 94, 0.3);
  color: #4ade80;
}

.fps-badge .dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
}

.wasm-badge {
  background: #1e293b;
  border: 1px solid #334155;
  color: #cbd5e1;
}

.wasm-tag {
  background: #38bdf8;
  color: #0b0f19;
  font-weight: 700;
  font-size: 10px;
  padding: 1px 4px;
  border-radius: 3px;
}

.app-main {
  flex: 1;
  padding: 14px 20px;
  overflow: hidden;
  position: relative;
}
</style>
