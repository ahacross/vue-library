<script setup lang="ts">
import { ref, computed } from 'vue';
import { VirtualSelect } from '@wasm-virtual/vue';

const targetCount = ref(1000000); // 1 Million options!
const selectedValue = ref('');

const generateOptions = (count: number): string[] => {
  const categories = ['스마트폰', '노트북', '모니터', '키보드', '마우스', '그래픽카드', 'CPU', '메모리', '태블릿', '이어폰'];
  const brands = ['삼성', '애플', 'LG', '소니', '델', '레노버', '에이수스', '로지텍', '커세어', '레이저'];
  const items: string[] = [];

  for (let i = 1; i <= count; i++) {
    const brand = brands[i % brands.length];
    const cat = categories[(i * 3) % categories.length];
    const modelNum = (1000 + (i % 9000)).toString();
    items.push(`[${brand}] ${cat} 프로 에디션 X-${modelNum} (코드: #${i})`);
  }
  return items;
};

const options = computed(() => generateOptions(targetCount.value));
</script>

<template>
  <div class="select-demo-root">
    <!-- Controls bar -->
    <div class="demo-controls">
      <div class="control-group">
        <label>옵션 개수 (Options):</label>
        <div class="btn-group">
          <button
            :class="{ active: targetCount === 10000 }"
            @click="targetCount = 10000"
          >
            1만 개
          </button>
          <button
            :class="{ active: targetCount === 100000 }"
            @click="targetCount = 100000"
          >
            10만 개
          </button>
          <button
            :class="{ active: targetCount === 500000 }"
            @click="targetCount = 500000"
          >
            50만 개
          </button>
          <button
            :class="{ active: targetCount === 1000000 }"
            @click="targetCount = 1000000"
          >
            🔥 100만 개 옵션
          </button>
        </div>
      </div>

      <div class="stats-badge">
        <span>총 옵션 개수:</span>
        <strong>{{ options.length.toLocaleString() }} 개</strong>
        <span class="highlight-tag">Wasm Zero-Lag Substring Filter</span>
      </div>
    </div>

    <!-- Select Showcase Card -->
    <div class="select-card">
      <div class="select-header">
        <h2>대용량 드롭다운 셀렉트 테스트</h2>
        <p class="select-desc">
          아래 드롭다운을 열고 검색어를 아무렇게나 쳐보세요. <strong>{{ targetCount.toLocaleString() }}개</strong> 항목에 대해 Rust Wasm 바이트 스캔으로 타이핑 렉 없이 실시간 필터링됩니다.
        </p>
      </div>

      <div class="select-box-wrapper">
        <label class="field-label">상품 선택 (100만 개 중 검색):</label>
        <VirtualSelect
          :key="targetCount"
          :options="options"
          v-model="selectedValue"
          placeholder="클릭하여 상품 검색 및 선택..."
          :dropdown-height="320"
        />
      </div>

      <div class="selection-result">
        <span class="res-label">현재 선택된 값:</span>
        <div class="res-val" :class="{ empty: !selectedValue }">
          {{ selectedValue || '선택된 항목 없음' }}
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.select-demo-root {
  display: flex;
  flex-direction: column;
  height: 100%;
  gap: 12px;
}

.demo-controls {
  display: flex;
  align-items: center;
  gap: 20px;
  background: #131d31;
  padding: 10px 16px;
  border-radius: 8px;
  border: 1px solid #1e293b;
  flex-wrap: wrap;
}

.control-group {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #94a3b8;
}

.btn-group {
  display: flex;
  gap: 4px;
}

.btn-group button {
  background: #1e293b;
  border: 1px solid #334155;
  color: #cbd5e1;
  padding: 4px 10px;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-group button:hover {
  background: #334155;
  color: #fff;
}

.btn-group button.active {
  background: #0284c7;
  border-color: #38bdf8;
  color: #ffffff;
  font-weight: 600;
}

.stats-badge {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #94a3b8;
}

.stats-badge strong {
  color: #38bdf8;
  font-family: monospace;
  font-size: 15px;
}

.highlight-tag {
  background: rgba(56, 189, 248, 0.15);
  border: 1px solid rgba(56, 189, 248, 0.4);
  color: #38bdf8;
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 4px;
}

.select-card {
  max-width: 650px;
  margin: 40px auto 0;
  background: #131d31;
  border: 1px solid #1e293b;
  border-radius: 10px;
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.select-header h2 {
  font-size: 18px;
  color: #f8fafc;
  margin-bottom: 6px;
}

.select-desc {
  font-size: 13px;
  color: #94a3b8;
  line-height: 1.5;
}

.select-desc strong {
  color: #38bdf8;
}

.select-box-wrapper {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.field-label {
  font-size: 13px;
  color: #cbd5e1;
  font-weight: 500;
}

.selection-result {
  background: #0f172a;
  border: 1px solid #1e293b;
  border-radius: 6px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.res-label {
  font-size: 11px;
  color: #64748b;
}

.res-val {
  font-size: 14px;
  color: #38bdf8;
  font-weight: 500;
}

.res-val.empty {
  color: #64748b;
  font-style: italic;
}
</style>
