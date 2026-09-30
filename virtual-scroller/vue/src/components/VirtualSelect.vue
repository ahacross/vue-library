<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { useVirtualSelect, VisibleOption } from '../useVirtualSelect';
import { vVirtualScroll } from '../vVirtualScroll';

const props = withDefaults(
  defineProps<{
    options: string[];
    modelValue?: string;
    placeholder?: string;
    itemHeight?: number;
    dropdownHeight?: number;
  }>(),
  {
    modelValue: '',
    placeholder: '옵션을 선택하세요...',
    itemHeight: 32,
    dropdownHeight: 280,
  }
);

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void;
  (e: 'change', value: string, index: number): void;
}>();

const isOpen = ref(false);
const containerEl = ref<HTMLElement | null>(null);
const searchInputRef = ref<HTMLInputElement | null>(null);

const {
  visibleOptions,
  filteredCount,
  query,
  setQuery,
  totalHeight,
  bindContainer,
  onScroll,
  update,
} = useVirtualSelect({
  items: () => props.options,
  itemHeight: props.itemHeight,
});

const scrollTarget = { bindContainer, onScroll };

const toggleDropdown = () => {
  isOpen.value = !isOpen.value;
  if (isOpen.value) {
    setTimeout(() => {
      searchInputRef.value?.focus();
      update();
    }, 50);
  }
};

const closeDropdown = () => {
  isOpen.value = false;
};

const handleClickOutside = (e: MouseEvent) => {
  if (isOpen.value && containerEl.value && !containerEl.value.contains(e.target as Node)) {
    closeDropdown();
  }
};

onMounted(() => {
  window.addEventListener('click', handleClickOutside);
});

onUnmounted(() => {
  window.removeEventListener('click', handleClickOutside);
});

const onSearchInput = (e: Event) => {
  const target = e.target as HTMLInputElement;
  setQuery(target.value);
};

const selectItem = (opt: VisibleOption) => {
  emit('update:modelValue', opt.label);
  emit('change', opt.label, opt.originalIndex);
  closeDropdown();
};
</script>

<template>
  <div ref="containerEl" class="wasm-select-container">
    <!-- Trigger Button -->
    <div class="wasm-select-trigger" @click.stop="toggleDropdown">
      <span class="wasm-select-value" :class="{ placeholder: !props.modelValue }">
        {{ props.modelValue || props.placeholder }}
      </span>
      <span class="wasm-select-arrow" :class="{ open: isOpen }">▼</span>
    </div>

    <!-- Dropdown Menu -->
    <div
      v-if="isOpen"
      class="wasm-select-dropdown"
      :style="{ maxHeight: `${props.dropdownHeight + 60}px` }"
    >
      <!-- Search Input -->
      <div class="wasm-select-search-box">
        <input
          ref="searchInputRef"
          type="text"
          class="wasm-select-search-input"
          placeholder="검색어 입력 (Wasm 실시간 필터)..."
          :value="query"
          @input="onSearchInput"
        />
        <span class="wasm-select-count">
          {{ filteredCount.toLocaleString() }}개
        </span>
      </div>

      <!-- Virtualized Options List -->
      <div
        v-virtual-scroll="scrollTarget"
        class="wasm-select-list"
        :style="{ height: `${props.dropdownHeight}px` }"
      >
        <div
          class="wasm-select-list-content"
          :style="{ height: `${Math.max(totalHeight, props.dropdownHeight)}px` }"
        >
          <div
            v-for="opt in visibleOptions"
            :key="`opt-${opt.originalIndex}`"
            class="wasm-select-option"
            :class="{ selected: opt.label === props.modelValue }"
            :style="{
              transform: `translateY(${opt.offset}px)`,
              height: `${props.itemHeight}px`,
            }"
            @click="selectItem(opt)"
          >
            <slot name="option" :option="opt" :select="() => selectItem(opt)">
              <span class="opt-label">{{ opt.label }}</span>
              <span class="opt-index">#{{ opt.originalIndex.toLocaleString() }}</span>
            </slot>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.wasm-select-container {
  position: relative;
  width: 100%;
  font-family: system-ui, -apple-system, sans-serif;
}

.wasm-select-trigger {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: #0f172a;
  border: 1px solid #334155;
  border-radius: 6px;
  cursor: pointer;
  user-select: none;
  transition: border-color 0.15s;
}

.wasm-select-trigger:hover {
  border-color: #38bdf8;
}

.wasm-select-value {
  color: #f1f5f9;
  font-size: 14px;
}

.wasm-select-value.placeholder {
  color: #64748b;
}

.wasm-select-arrow {
  color: #94a3b8;
  font-size: 10px;
  transition: transform 0.2s;
}

.wasm-select-arrow.open {
  transform: rotate(180deg);
}

.wasm-select-dropdown {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  z-index: 50;
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 6px;
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.wasm-select-search-box {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  background: #0f172a;
  border-bottom: 1px solid #334155;
}

.wasm-select-search-input {
  flex: 1;
  background: transparent;
  border: none;
  color: #f8fafc;
  font-size: 13px;
  outline: none;
}

.wasm-select-count {
  font-size: 11px;
  color: #38bdf8;
  background: #0369a1;
  padding: 2px 6px;
  border-radius: 4px;
}

.wasm-select-list {
  position: relative;
  overflow-y: auto;
}

.wasm-select-list-content {
  position: relative;
  width: 100%;
}

.wasm-select-option {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 12px;
  box-sizing: border-box;
  color: #cbd5e1;
  font-size: 13px;
  cursor: pointer;
  transition: background 0.1s;
}

.wasm-select-option:hover {
  background: #334155;
  color: #f8fafc;
}

.wasm-select-option.selected {
  background: #0284c7;
  color: #ffffff;
}

.opt-index {
  font-size: 11px;
  color: #64748b;
  font-family: monospace;
}

.wasm-select-option.selected .opt-index {
  color: #bae6fd;
}
</style>
