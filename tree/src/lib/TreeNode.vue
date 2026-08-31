<script setup lang="ts" generic="T">
import { ref, nextTick, watch } from 'vue'
import type { NodeApi, TreeApi } from './types'

const props = withDefaults(
  defineProps<{
    node: NodeApi<T>
    tree: TreeApi<T>
    indent: number
    showCheckbox?: boolean
  }>(),
  {
    showCheckbox: false
  }
)

const inputRef = ref<HTMLInputElement | null>(null)
const editingText = ref('')

const getNodeName = () => {
  const data = props.node.data as any
  return data?.name !== undefined ? String(data.name) : String(props.node.id)
}

watch(
  () => props.node.isEditing,
  (isEditing) => {
    if (isEditing) {
      editingText.value = getNodeName()
      nextTick(() => {
        if (inputRef.value) {
          inputRef.value.focus()
          inputRef.value.select()
        }
      })
    }
  },
  { immediate: true }
)

const handleKeyDown = (e: KeyboardEvent) => {
  if (e.key === 'Enter') {
    props.node.submit(editingText.value)
  } else if (e.key === 'Escape') {
    props.node.reset()
  }
}

const handleBlur = () => {
  if (props.node.isEditing) {
    props.node.submit(editingText.value)
  }
}
</script>

<template>
  <div
    class="vue-arborist-node"
    :class="{
      'is-selected': node.isSelected,
      'is-focused': node.isFocused,
      'is-editing': node.isEditing
    }"
    :style="{ paddingLeft: `${node.level * indent}px` }"
  >
    <!-- Expand/Collapse toggle icon -->
    <span
      class="vue-arborist-arrow"
      :class="{ 'is-leaf': node.isLeaf, 'is-open': node.isOpen }"
      @click.stop="node.toggle()"
    >
      <svg
        v-if="!node.isLeaf"
        viewBox="0 0 24 24"
        width="16"
        height="16"
        stroke="currentColor"
        stroke-width="2"
        fill="none"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <polyline points="9 18 15 12 9 6" />
      </svg>
    </span>

    <!-- Checkbox -->
    <span v-if="showCheckbox" class="vue-arborist-checkbox-wrapper" @click.stop="node.toggleCheck()">
      <input
        type="checkbox"
        class="vue-arborist-checkbox"
        :checked="node.isChecked"
        :indeterminate.prop="node.isIndeterminate"
        @click.stop="node.toggleCheck()"
      />
    </span>

    <!-- Folder/File icon -->
    <span class="vue-arborist-icon">
      <!-- Folder icon (Open vs Closed) -->
      <template v-if="!node.isLeaf">
        <!-- Open folder icon -->
        <svg
          v-if="node.isOpen"
          viewBox="0 0 24 24"
          width="16"
          height="16"
          fill="#f59e0b"
          stroke="#d97706"
          stroke-width="1.5"
        >
          <path
            d="M5 19a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4l2 2h4a2 2 0 0 1 2 2v2M5 19h14a2 2 0 0 0 2-1.6l1.8-9A2 2 0 0 0 20.8 8H6.2a2 2 0 0 0-2 1.6L2.4 17.4A2 2 0 0 0 4 19z"
          />
        </svg>
        <!-- Closed folder icon -->
        <svg
          v-else
          viewBox="0 0 24 24"
          width="16"
          height="16"
          fill="#f59e0b"
          stroke="#d97706"
          stroke-width="1.5"
        >
          <path
            d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"
          />
        </svg>
      </template>
      <!-- File icon -->
      <svg
        v-else
        viewBox="0 0 24 24"
        width="16"
        height="16"
        fill="#94a3b8"
        stroke="#64748b"
        stroke-width="1.5"
      >
        <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
        <polyline points="13 2 13 9 20 9" />
      </svg>
    </span>

    <!-- Node Text / Rename Input -->
    <div class="vue-arborist-text-container">
      <input
        v-if="node.isEditing"
        ref="inputRef"
        v-model="editingText"
        class="vue-arborist-input"
        type="text"
        @keydown.stop="handleKeyDown"
        @blur="handleBlur"
        @click.stop
      />
      <span v-else class="vue-arborist-text" @dblclick.stop="node.edit()">
        {{ getNodeName() }}
      </span>
    </div>
  </div>
</template>

<style scoped>
.vue-arborist-node {
  display: flex;
  align-items: center;
  width: 100%;
  height: 100%;
  user-select: none;
  cursor: pointer;
  box-sizing: border-box;
  font-size: 14px;
  color: #334155;
  transition: background-color 0.15s ease;
  border-radius: 4px;
}

.vue-arborist-node:hover {
  background-color: #f1f5f9;
}

.vue-arborist-node.is-selected {
  background-color: #e0e7ff;
  color: #3730a3;
  font-weight: 500;
}

.vue-arborist-node.is-focused {
  outline: 1px solid #6366f1;
  outline-offset: -1px;
}

.vue-arborist-arrow {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  flex-shrink: 0;
  cursor: pointer;
  color: #64748b;
  transition: transform 0.15s ease;
}

.vue-arborist-arrow.is-leaf {
  visibility: hidden;
}

.vue-arborist-arrow.is-open {
  transform: rotate(90deg);
}

.vue-arborist-checkbox-wrapper {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-right: 6px;
  cursor: pointer;
}

.vue-arborist-checkbox {
  width: 15px;
  height: 15px;
  cursor: pointer;
  accent-color: #2563eb;
}

.vue-arborist-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-right: 6px;
  flex-shrink: 0;
}

.vue-arborist-text-container {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.vue-arborist-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  display: block;
}

.vue-arborist-input {
  width: 100%;
  padding: 1px 4px;
  font-size: 13px;
  border: 1px solid #3b82f6;
  border-radius: 2px;
  outline: none;
  background-color: #ffffff;
  box-sizing: border-box;
}
</style>
