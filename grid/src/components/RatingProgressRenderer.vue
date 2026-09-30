<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { CellRendererParams } from '../lib/types'

const props = defineProps<{
  params: CellRendererParams
}>()

const isEditing = ref(false)
const inputRef = ref<HTMLInputElement | null>(null)

// 자체 로컬 반응형 상태를 두어 즉시 UI 반응 보장
const currentRating = ref<number>(Number(props.params.value) || 0)
const tempValue = ref(3.0)

// 상위에서 props.params.value가 변경되면 동기화
watch(
  () => props.params.value,
  (newVal) => {
    currentRating.value = Number(newVal) || 0
  },
  { immediate: true }
)

const percentage = computed(() => Math.min(100, Math.max(0, (currentRating.value / 5.0) * 100)))

const ratingColor = computed(() => {
  if (currentRating.value >= 4.0) return '#16a34a' // 초록
  if (currentRating.value >= 3.0) return '#2563eb' // 파랑
  if (currentRating.value >= 2.0) return '#eab308' // 노랑
  return '#dc2626' // 빨강
})

// 1. 별 클릭 시 즉시 점수 반영 (1~5점)
const setStarRating = (star: number, event: MouseEvent) => {
  event.stopPropagation()
  currentRating.value = star
  props.params.setValue(star)
}

// 2. 텍스트 더블클릭 또는 편집 버튼 클릭 시 세밀한 숫자 인라인 입력 모드
const startEditing = (event: MouseEvent) => {
  event.stopPropagation()
  tempValue.value = Number(currentRating.value.toFixed(1))
  isEditing.value = true
  nextTick(() => {
    inputRef.value?.focus()
    inputRef.value?.select()
  })
}

const saveEditing = () => {
  if (!isEditing.value) return
  let val = Number(tempValue.value)
  if (isNaN(val)) val = currentRating.value
  val = Math.max(1.0, Math.min(5.0, Math.round(val * 10) / 10))
  currentRating.value = val
  props.params.setValue(val)
  isEditing.value = false
}

const cancelEditing = () => {
  isEditing.value = false
}

const onKeyDown = (e: KeyboardEvent) => {
  if (e.key === 'Enter') {
    saveEditing()
  } else if (e.key === 'Escape') {
    cancelEditing()
  }
}
</script>

<template>
  <div class="interactive-rating-cell" @click.stop>
    <!-- 인라인 숫자 편집 모드 -->
    <div v-if="isEditing" class="rating-editor">
      <input
        ref="inputRef"
        v-model.number="tempValue"
        type="number"
        step="0.1"
        min="1.0"
        max="5.0"
        class="rating-input"
        @blur="saveEditing"
        @keydown="onKeyDown"
      />
      <button class="edit-btn save" @click.stop="saveEditing">✓</button>
      <button class="edit-btn cancel" @click.stop="cancelEditing">✕</button>
    </div>

    <!-- 일반 표시 및 별점 인터랙션 모드 -->
    <div v-else class="rating-display">
      <div class="stars-row">
        <span
          v-for="star in [1, 2, 3, 4, 5]"
          :key="star"
          class="interactive-star"
          :class="{ filled: star <= Math.round(currentRating) }"
          :title="`${star}점으로 수정하기`"
          @click="setStarRating(star, $event)"
        >
          ★
        </span>
        <span class="rating-number" title="더블클릭하여 직접 입력" @dblclick="startEditing">
          {{ currentRating.toFixed(1) }}
        </span>
        <button class="edit-trigger-btn" title="점수 직접 수정하기" @click="startEditing">
          ✏️
        </button>
      </div>

      <div class="progress-bar-bg">
        <div
          class="progress-bar-fill"
          :style="{ width: `${percentage}%`, backgroundColor: ratingColor }"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.interactive-rating-cell {
  display: flex;
  flex-direction: column;
  justify-content: center;
  width: 100%;
  height: 100%;
}

.rating-display {
  display: flex;
  flex-direction: column;
  width: 100%;
  gap: 3px;
}

.stars-row {
  display: flex;
  align-items: center;
  gap: 2px;
}

.interactive-star {
  font-size: 14px;
  color: #cbd5e1;
  cursor: pointer;
  line-height: 1;
  transition: transform 0.1s ease, color 0.1s ease;
  user-select: none;
}

.interactive-star:hover {
  transform: scale(1.3);
  color: #f59e0b !important;
}

.interactive-star.filled {
  color: #eab308;
}

.rating-number {
  font-size: 11px;
  font-weight: 700;
  margin-left: 4px;
  color: #475569;
  cursor: pointer;
}

.rating-number:hover {
  text-decoration: underline;
}

.edit-trigger-btn {
  background: transparent;
  border: none;
  font-size: 10px;
  cursor: pointer;
  padding: 1px 3px;
  opacity: 0.6;
  border-radius: 3px;
  transition: opacity 0.15s ease, background 0.15s ease;
}

.edit-trigger-btn:hover {
  opacity: 1;
  background: rgba(0, 0, 0, 0.06);
}

.progress-bar-bg {
  width: 100%;
  height: 4px;
  background-color: rgba(0, 0, 0, 0.08);
  border-radius: 2px;
  overflow: hidden;
}

.progress-bar-fill {
  height: 100%;
  border-radius: 2px;
  transition: width 0.25s ease, background-color 0.25s ease;
}

/* 인라인 에디터 스타일 */
.rating-editor {
  display: flex;
  align-items: center;
  gap: 4px;
  width: 100%;
}

.rating-input {
  width: 60px;
  height: 24px;
  padding: 0 6px;
  font-size: 12px;
  font-weight: 600;
  border: 1px solid #3b82f6;
  border-radius: 4px;
  outline: none;
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
}

.edit-btn {
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 700;
  border-radius: 4px;
  border: none;
  cursor: pointer;
}

.edit-btn.save {
  background: #16a34a;
  color: #ffffff;
}

.edit-btn.cancel {
  background: #94a3b8;
  color: #ffffff;
}
</style>
