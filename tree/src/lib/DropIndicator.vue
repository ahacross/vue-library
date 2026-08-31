<script setup lang="ts">
import type { DropTarget } from './types'

defineProps<{
  target: DropTarget
  itemHeight: number
}>()
</script>

<template>
  <div class="vue-arborist-drop-indicator">
    <!-- Line indicator for before/after -->
    <div
      v-if="target.position === 'before' || target.position === 'after'"
      class="vue-arborist-drop-line"
      :style="{
        top: `${target.top}px`,
        left: `${target.left}px`,
        width: `${target.width}px`
      }"
    >
      <div class="vue-arborist-drop-circle"></div>
    </div>

    <!-- Highlight box for inside -->
    <div
      v-else-if="target.position === 'inside'"
      class="vue-arborist-drop-inside"
      :style="{
        top: `${target.top}px`,
        height: `${itemHeight}px`,
        left: `${target.left}px`,
        width: `${target.width}px`
      }"
    ></div>
  </div>
</template>

<style scoped>
.vue-arborist-drop-indicator {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 10;
}

.vue-arborist-drop-line {
  position: absolute;
  height: 2px;
  background-color: #3b82f6;
  transform: translateY(-1px);
  display: flex;
  align-items: center;
}

.vue-arborist-drop-circle {
  position: absolute;
  left: -4px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: #3b82f6;
}

.vue-arborist-drop-inside {
  position: absolute;
  border: 2px solid #3b82f6;
  background-color: rgba(59, 130, 246, 0.1);
  border-radius: 4px;
  box-sizing: border-box;
}
</style>
