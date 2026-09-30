<script setup lang="ts">
import { ref, computed } from 'vue'
import { ColumnDef, SortDirection } from '../types'

const props = defineProps<{
  column: ColumnDef
  currentSortDir?: SortDirection
  availableValues?: string[]
}>()

const emit = defineEmits<{
  (e: 'sort', dir: SortDirection): void
  (e: 'filter', values: string[] | null): void
  (e: 'close'): void
}>()

const searchKeyword = ref('')
const selectedValues = ref<Set<string>>(new Set(props.availableValues || []))

const filteredOptions = computed(() => {
  if (!props.availableValues) return []
  if (!searchKeyword.value) return props.availableValues
  const kw = searchKeyword.value.toLowerCase()
  return props.availableValues.filter((v) => v.toLowerCase().includes(kw))
})

const isAllSelected = computed(() => {
  if (!props.availableValues || props.availableValues.length === 0) return false
  return selectedValues.value.size >= props.availableValues.length
})

const toggleSelectAll = () => {
  if (isAllSelected.value) {
    selectedValues.value.clear()
  } else {
    selectedValues.value = new Set(props.availableValues || [])
  }
}

const toggleValue = (val: string) => {
  if (selectedValues.value.has(val)) {
    selectedValues.value.delete(val)
  } else {
    selectedValues.value.add(val)
  }
}

const handleSort = (dir: SortDirection) => {
  emit('sort', dir)
  emit('close')
}

const applyFilter = () => {
  if (isAllSelected.value || selectedValues.value.size === 0) {
    emit('filter', null)
  } else {
    emit('filter', Array.from(selectedValues.value))
  }
  emit('close')
}

const resetFilter = () => {
  selectedValues.value = new Set(props.availableValues || [])
  emit('filter', null)
  emit('close')
}
</script>

<template>
  <div class="col-filter-popup" @click.stop>
    <!-- 정렬 컨트롤 -->
    <div class="filter-section sort-section">
      <button
        class="sort-btn"
        :class="{ active: currentSortDir === 'asc' }"
        @click="handleSort('asc')"
      >
        <span>▲ 오름차순 정렬</span>
      </button>
      <button
        class="sort-btn"
        :class="{ active: currentSortDir === 'desc' }"
        @click="handleSort('desc')"
      >
        <span>▼ 내림차순 정렬</span>
      </button>
    </div>

    <div class="filter-divider" />

    <!-- 세트 필터 (체크박스 목록) -->
    <div class="filter-section">
      <div class="filter-title">🔍 엑셀 세트 필터</div>
      <input
        v-model="searchKeyword"
        type="text"
        placeholder="검색..."
        class="filter-search-input"
      />

      <div class="filter-checkbox-list">
        <label class="checkbox-item select-all">
          <input
            type="checkbox"
            :checked="isAllSelected"
            @change="toggleSelectAll"
          />
          <span class="checkbox-label">(전체 선택)</span>
        </label>

        <label
          v-for="val in filteredOptions"
          :key="val"
          class="checkbox-item"
        >
          <input
            type="checkbox"
            :checked="selectedValues.has(val)"
            @change="toggleValue(val)"
          />
          <span class="checkbox-label">{{ val }}</span>
        </label>
      </div>
    </div>

    <!-- 하단 액션 버튼 -->
    <div class="filter-actions">
      <button class="action-btn apply" @click="applyFilter">적용</button>
      <button class="action-btn reset" @click="resetFilter">초기화</button>
    </div>
  </div>
</template>

<style scoped>
.col-filter-popup {
  position: absolute;
  top: 100%;
  right: 0;
  width: 200px;
  background: #ffffff;
  border-radius: 8px;
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.2), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
  border: 1px solid #cbd5e1;
  padding: 8px;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-family: inherit;
}

.filter-section {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.sort-section {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.sort-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  border-radius: 4px;
  border: none;
  background: transparent;
  font-size: 11px;
  font-weight: 500;
  color: #334155;
  cursor: pointer;
  text-align: left;
}

.sort-btn:hover {
  background: #f1f5f9;
}

.sort-btn.active {
  background: #eff6ff;
  color: #2563eb;
  font-weight: 700;
}

.filter-divider {
  height: 1px;
  background: #e2e8f0;
  margin: 2px 0;
}

.filter-title {
  font-size: 11px;
  font-weight: 700;
  color: #475569;
  margin-bottom: 2px;
}

.filter-search-input {
  width: 100%;
  padding: 4px 8px;
  font-size: 11px;
  border: 1px solid #cbd5e1;
  border-radius: 4px;
  outline: none;
  box-sizing: border-box;
}

.filter-search-input:focus {
  border-color: #3b82f6;
  box-shadow: 0 0 0 1px #3b82f6;
}

.filter-checkbox-list {
  max-height: 120px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 3px;
  margin-top: 4px;
  padding: 2px 0;
}

.checkbox-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: #334155;
  cursor: pointer;
  user-select: none;
}

.checkbox-item.select-all {
  font-weight: 600;
  border-bottom: 1px solid #f1f5f9;
  padding-bottom: 3px;
}

.checkbox-label {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.filter-actions {
  display: flex;
  justify-content: flex-end;
  gap: 6px;
  margin-top: 4px;
  padding-top: 6px;
  border-top: 1px solid #f1f5f9;
}

.action-btn {
  padding: 4px 10px;
  font-size: 11px;
  font-weight: 600;
  border-radius: 4px;
  border: none;
  cursor: pointer;
}

.action-btn.apply {
  background: #2563eb;
  color: #ffffff;
}

.action-btn.apply:hover {
  background: #1d4ed8;
}

.action-btn.reset {
  background: #f1f5f9;
  color: #64748b;
}

.action-btn.reset:hover {
  background: #e2e8f0;
}
</style>
