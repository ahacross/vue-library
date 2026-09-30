<script setup lang="ts">
import { ref, computed } from 'vue';
import { VirtualTree, TreeNodeItem, VisibleTreeNode } from '@wasm-virtual/vue';

const targetNodeCount = ref(50000); // 50,000 hierarchical tree nodes!
const selectedNode = ref<VisibleTreeNode | null>(null);

// Generate large-scale hierarchical tree data
const generateTreeData = (count: number): TreeNodeItem[] => {
  const items: TreeNodeItem[] = [];
  const rootCount = Math.max(10, Math.floor(count / 100));
  let currentId = 1;

  // Level 0: Roots (e.g. Regions / Departments)
  for (let r = 1; r <= rootCount && currentId <= count; r++) {
    const rootId = currentId++;
    items.push({
      id: rootId,
      parentId: null,
      label: `📁 [본부 ${r}] 대한민국 글로벌 사업총괄`,
      isExpanded: r <= 3, // First 3 expanded
    });

    // Level 1: Teams
    const teamCount = 8;
    for (let t = 1; t <= teamCount && currentId <= count; t++) {
      const teamId = currentId++;
      items.push({
        id: teamId,
        parentId: rootId,
        label: `📂 [팀 ${r}-${t}] 플랫폼 코어 개발팀`,
        isExpanded: t === 1,
      });

      // Level 2: Projects
      const projCount = 10;
      for (let p = 1; p <= projCount && currentId <= count; p++) {
        const projId = currentId++;
        items.push({
          id: projId,
          parentId: teamId,
          label: `📁 [프로젝트 ${r}-${t}-${p}] Wasm 가상화 코어 시스템`,
          isExpanded: false,
        });

        // Level 3: Files / Tasks
        const taskCount = 10;
        for (let k = 1; k <= taskCount && currentId <= count; k++) {
          const leafId = currentId++;
          items.push({
            id: leafId,
            parentId: projId,
            label: `📄 [작업 #${leafId}] 고성능 엔진 최적화_${k}.rs`,
            isExpanded: false,
          });
        }
      }
    }
  }

  return items;
};

const treeData = computed(() => generateTreeData(targetNodeCount.value));

const onSelectNode = (node: VisibleTreeNode) => {
  selectedNode.value = node;
};
</script>

<template>
  <div class="tree-demo-root">
    <!-- Controls bar -->
    <div class="demo-controls">
      <div class="control-group">
        <label>노드 개수 (Nodes):</label>
        <div class="btn-group">
          <button
            :class="{ active: targetNodeCount === 5000 }"
            @click="targetNodeCount = 5000"
          >
            5천 노드
          </button>
          <button
            :class="{ active: targetNodeCount === 20000 }"
            @click="targetNodeCount = 20000"
          >
            2만 노드
          </button>
          <button
            :class="{ active: targetNodeCount === 50000 }"
            @click="targetNodeCount = 50000"
          >
            🔥 5만 노드
          </button>
          <button
            :class="{ active: targetNodeCount === 100000 }"
            @click="targetNodeCount = 100000"
          >
            ⚡ 10만 노드
          </button>
        </div>
      </div>

      <div class="stats-badge">
        <span>총 생성된 계층 노드:</span>
        <strong>{{ treeData.length.toLocaleString() }} 개</strong>
        <span class="highlight-tag">Wasm Instant Auto-expand Search</span>
      </div>
    </div>

    <!-- Tree Viewport + Inspector -->
    <div class="tree-content-area">
      <div class="tree-container">
        <VirtualTree
          :key="targetNodeCount"
          :data="treeData"
          :item-height="32"
          search-placeholder="트리 검색 (예: 작업 #45, Wasm, 팀 1-2 등)..."
          @select="onSelectNode"
        />
      </div>

      <!-- Detail Card -->
      <div class="tree-inspector">
        <h3 class="inspector-title">선택된 노드 정보</h3>
        <div v-if="selectedNode" class="inspector-body">
          <div class="info-row">
            <span class="info-label">노드 ID:</span>
            <span class="info-val">#{{ selectedNode.id }}</span>
          </div>
          <div class="info-row">
            <span class="info-label">계층 깊이 (Depth):</span>
            <span class="info-val">{{ selectedNode.depth }} 단계</span>
          </div>
          <div class="info-row">
            <span class="info-label">라벨 (Label):</span>
            <span class="info-val highlight">{{ selectedNode.label }}</span>
          </div>
          <div class="info-row">
            <span class="info-label">자식 존재 여부:</span>
            <span class="info-val">{{ selectedNode.hasChildren ? '있음' : '리프 노드' }}</span>
          </div>
          <div class="info-row">
            <span class="info-label">펼침 상태:</span>
            <span class="info-val">{{ selectedNode.isExpanded ? '펼쳐짐' : '접힘' }}</span>
          </div>
        </div>
        <div v-else class="empty-hint">
          트리의 노드를 클릭하면 상세 정보가 표시됩니다.
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tree-demo-root {
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

.tree-content-area {
  display: flex;
  gap: 12px;
  flex: 1;
  min-height: 0;
}

.tree-container {
  flex: 2;
  height: 100%;
}

.tree-inspector {
  flex: 1;
  background: #131d31;
  border: 1px solid #1e293b;
  border-radius: 8px;
  padding: 16px;
  display: flex;
  flex-direction: column;
}

.inspector-title {
  font-size: 14px;
  color: #f1f5f9;
  border-bottom: 1px solid #334155;
  padding-bottom: 8px;
  margin-bottom: 12px;
}

.inspector-body {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.info-row {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.info-label {
  font-size: 11px;
  color: #64748b;
}

.info-val {
  font-size: 13px;
  color: #cbd5e1;
}

.info-val.highlight {
  color: #38bdf8;
  font-weight: 500;
}

.empty-hint {
  color: #64748b;
  font-size: 13px;
  margin-top: 20px;
  text-align: center;
}
</style>
