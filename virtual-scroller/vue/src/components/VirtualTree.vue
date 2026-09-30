<script setup lang="ts">
import { ref } from 'vue';
import { useVirtualTree, TreeNodeItem, VisibleTreeNode } from '../useVirtualTree';
import { vVirtualScroll } from '../vVirtualScroll';

const props = withDefaults(
  defineProps<{
    data: TreeNodeItem[];
    itemHeight?: number;
    searchable?: boolean;
    searchPlaceholder?: string;
  }>(),
  {
    itemHeight: 32,
    searchable: true,
    searchPlaceholder: '트리 노드 검색 (상위 경로 자동 펼침)...',
  }
);

const emit = defineEmits<{
  (e: 'select', node: VisibleTreeNode): void;
}>();

const {
  visibleNodes,
  totalHeight,
  filterQuery,
  setFilter,
  toggleExpand,
  expandAll,
  collapseAll,
  bindContainer,
  onScroll,
} = useVirtualTree({
  data: () => props.data,
  itemHeight: props.itemHeight,
});

const scrollTarget = { bindContainer, onScroll };

const onSearchInput = (e: Event) => {
  const target = e.target as HTMLInputElement;
  setFilter(target.value);
};
</script>

<template>
  <div class="wasm-tree-wrapper">
    <!-- Toolbar -->
    <div v-if="props.searchable" class="wasm-tree-toolbar">
      <input
        type="text"
        class="wasm-tree-search"
        :placeholder="props.searchPlaceholder"
        :value="filterQuery"
        @input="onSearchInput"
      />
      <div class="wasm-tree-actions">
        <button class="tree-btn" @click="expandAll">모두 펼치기</button>
        <button class="tree-btn" @click="collapseAll">모두 접기</button>
      </div>
    </div>

    <!-- Virtual Tree Viewport -->
    <div v-virtual-scroll="scrollTarget" class="wasm-tree-viewport">
      <div
        class="wasm-tree-content"
        :style="{ height: `${totalHeight}px` }"
      >
        <div
          v-for="node in visibleNodes"
          :key="`node-${node.id}`"
          class="wasm-tree-node"
          :style="{
            transform: `translateY(${node.offset}px)`,
            height: `${props.itemHeight}px`,
            paddingLeft: `${node.depth * 20 + 8}px`,
          }"
          @click="emit('select', node)"
        >
          <slot name="node" :node="node" :toggle="() => toggleExpand(node.id)">
            <!-- Expand/Collapse toggle icon -->
            <span
              v-if="node.hasChildren"
              class="tree-arrow"
              :class="{ expanded: node.isExpanded }"
              @click.stop="toggleExpand(node.id)"
            >
              ▶
            </span>
            <span v-else class="tree-arrow-spacer">·</span>

            <span class="node-label">{{ node.label }}</span>
            <span v-if="node.depth > 0" class="node-badge">d:{{ node.depth }}</span>
          </slot>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.wasm-tree-wrapper {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  background: #0f172a;
  border: 1px solid #334155;
  border-radius: 8px;
  overflow: hidden;
}

.wasm-tree-toolbar {
  display: flex;
  gap: 8px;
  padding: 10px;
  background: #1e293b;
  border-bottom: 1px solid #334155;
}

.wasm-tree-search {
  flex: 1;
  background: #0f172a;
  border: 1px solid #475569;
  color: #f8fafc;
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 13px;
  outline: none;
}

.wasm-tree-search:focus {
  border-color: #38bdf8;
}

.tree-btn {
  background: #334155;
  border: none;
  color: #cbd5e1;
  padding: 4px 10px;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  transition: background 0.15s;
}

.tree-btn:hover {
  background: #475569;
  color: #fff;
}

.wasm-tree-viewport {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  position: relative;
}

.wasm-tree-content {
  position: relative;
  width: 100%;
}

.wasm-tree-node {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  display: flex;
  align-items: center;
  gap: 6px;
  box-sizing: border-box;
  color: #e2e8f0;
  font-size: 13px;
  cursor: pointer;
  user-select: none;
  transition: background 0.1s;
}

.wasm-tree-node:hover {
  background: #1e293b;
}

.tree-arrow {
  display: inline-block;
  font-size: 10px;
  color: #94a3b8;
  width: 16px;
  text-align: center;
  transition: transform 0.15s ease;
}

.tree-arrow.expanded {
  transform: rotate(90deg);
  color: #38bdf8;
}

.tree-arrow-spacer {
  display: inline-block;
  width: 16px;
  text-align: center;
  color: #475569;
}

.node-label {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.node-badge {
  font-size: 10px;
  color: #64748b;
  background: #1e293b;
  padding: 1px 5px;
  border-radius: 3px;
}
</style>
