<script setup lang="ts">
import { ref } from 'vue'
import { Tree, type TreeApi, type MoveEvent, type RenameEvent, type DeleteEvent } from './lib'

interface MyCustomItem {
  id: string
  name: string
  isFolder?: boolean
  children?: MyCustomItem[]
}

const activeTab = ref<'demo' | 'docs'>('demo')
const nodeCountOption = ref<number>(1000)
const isGenerating = ref(false)

const docSnippetBasic = `<script setup lang="ts">
import { ref } from 'vue'
import { Tree, type TreeApi, type MoveEvent } from 'vue-arborist'
import 'vue-arborist/style.css'

interface FileItem {
  id: string
  name: string
  children?: FileItem[]
}

const treeRef = ref<TreeApi<FileItem> | null>(null)
const fileData = ref<FileItem[]>([
  {
    id: '1',
    name: 'src',
    children: [
      { id: '1-1', name: 'App.vue' },
      { id: '1-2', name: 'main.ts' }
    ]
  },
  { id: '2', name: 'package.json' }
])

// 선택된 항목만 추출 (Selected)
const getSelectedItems = () => {
  const selectedNodes = treeRef.value?.getSelectedNodes()
  const selectedData = treeRef.value?.getSelectedData()
  console.log('선택된 노드 목록:', selectedNodes, selectedData)
}

// 체크된 항목만 추출 (Checked)
const getCheckedItems = () => {
  const checkedNodes = treeRef.value?.getCheckedNodes()
  const checkedData = treeRef.value?.getCheckedData()
  console.log('체크된 데이터 목록:', checkedData)
}
<\/script>

<template>
  <div style="height: 500px; width: 320px; border: 1px solid #e2e8f0;">
    <Tree
      ref="treeRef"
      :data="fileData"
      :row-height="32"
      :show-checkbox="true"
    />
  </div>
</template>`

const docSnippetCustom = `<template>
  <Tree :data="fileData" :row-height="36" v-slot="{ node, tree }">
    <div
      :style="{ paddingLeft: \`\${node.level * 20}px\` }"
      :class="{ 'bg-blue-100': node.isSelected }"
      class="flex items-center w-full h-full px-2 gap-2 cursor-pointer hover:bg-slate-100"
    >
      <!-- 폴더 열림/닫힘 토글 버튼 -->
      <button v-if="!node.isLeaf" @click.stop="node.toggle()">
        {{ node.isOpen ? '📂' : '📁' }}
      </button>
      <span v-else>📄</span>

      <!-- 커스텀 체크박스 (부모-자식 연동 및 indeterminate 지원) -->
      <input
        type="checkbox"
        :checked="node.isChecked"
        :indeterminate.prop="node.isIndeterminate"
        @click.stop="node.toggleCheck()"
      />

      <!-- 노드 이름 -->
      <span class="text-sm font-medium">{{ node.data.name }}</span>

      <!-- 우측 액션 버튼 -->
      <div class="ml-auto flex gap-1">
        <button @click.stop="node.edit()" class="text-xs text-blue-500">수정</button>
        <button @click.stop="tree.delete(node.id)" class="text-xs text-red-500">삭제</button>
      </div>
    </div>
  </Tree>
</template>`

// Function to generate configurable number of items (up to 100,000)
const generateTreeData = (targetCount: number): MyCustomItem[] => {
  const root: MyCustomItem[] = [
    {
      id: 'src',
      name: 'src',
      children: [
        {
          id: 'components',
          name: 'components',
          children: [
            { id: 'Header.vue', name: 'Header.vue' },
            { id: 'Sidebar.vue', name: 'Sidebar.vue' },
            { id: 'Footer.vue', name: 'Footer.vue' }
          ]
        },
        {
          id: 'assets',
          name: 'assets',
          children: [
            { id: 'logo.svg', name: 'logo.svg' },
            { id: 'style.css', name: 'style.css' }
          ]
        },
        { id: 'App.vue', name: 'App.vue' },
        { id: 'main.ts', name: 'main.ts' }
      ]
    },
    {
      id: 'package.json',
      name: 'package.json'
    },
    {
      id: 'tsconfig.json',
      name: 'tsconfig.json'
    }
  ]

  // If 100k, create 1,000 folders with 100 files each = 100,000 nodes
  // If 10k, create 100 folders with 100 files each = 10,000 nodes
  // If 1k, create 10 folders with 100 files each = 1,000 nodes
  const folders = Math.max(1, Math.floor(targetCount / 100))
  const itemsPerFolder = 100

  let globalIndex = 0
  for (let f = 1; f <= folders; f++) {
    const folderChildren: MyCustomItem[] = []
    for (let i = 1; i <= itemsPerFolder; i++) {
      globalIndex++
      folderChildren.push({
        id: `f-${f}-i-${i}`,
        name: `module_${f}_file_${i}_#${globalIndex}.ts`
      })
    }
    root.push({
      id: `virtual-folder-${f}`,
      name: `Folder ${f} (item #${(f - 1) * itemsPerFolder + 1} ~ #${f * itemsPerFolder})`,
      children: folderChildren
    })
  }

  return root
}

const treeData = ref<MyCustomItem[]>(generateTreeData(1000))
const treeRef = ref<TreeApi<MyCustomItem> | null>(null)
const searchTerm = ref('')
const logMessages = ref<string[]>([])

const changeNodeCount = (count: number) => {
  isGenerating.value = true
  nodeCountOption.value = count
  setTimeout(() => {
    const t0 = performance.now()
    treeData.value = generateTreeData(count)
    const t1 = performance.now()
    addLog(`Generated ${count.toLocaleString()} nodes in ${(t1 - t0).toFixed(1)}ms!`)
    isGenerating.value = false
  }, 20)
}

const addLog = (msg: string) => {
  logMessages.value.unshift(`[${new Date().toLocaleTimeString()}] ${msg}`)
  if (logMessages.value.length > 30) {
    logMessages.value.pop()
  }
}

// Handle DnD Move
const handleMove = (e: MoveEvent<MyCustomItem>) => {
  addLog(`Moved: [${e.dragIds.join(', ')}] -> Parent: ${e.parentId ?? 'root'}, Index: ${e.index}`)

  const removeItems = (items: MyCustomItem[], idsToRemove: Set<string>): MyCustomItem[] => {
    return items
      .filter((item) => !idsToRemove.has(item.id))
      .map((item) => {
        if (item.children) {
          return { ...item, children: removeItems(item.children, idsToRemove) }
        }
        return item
      })
  }

  const idsSet = new Set(e.dragIds.map(String))
  const movedItems = e.dragNodes.map((n) => JSON.parse(JSON.stringify(n.data)))

  let nextData = removeItems(treeData.value, idsSet)

  if (e.parentId === null) {
    nextData.splice(e.index, 0, ...movedItems)
  } else {
    const insertIntoParent = (items: MyCustomItem[]): boolean => {
      for (const item of items) {
        if (item.id === e.parentId) {
          if (!item.children) item.children = []
          item.children.splice(e.index, 0, ...movedItems)
          return true
        }
        if (item.children && insertIntoParent(item.children)) {
          return true
        }
      }
      return false
    }
    insertIntoParent(nextData)
  }

  treeData.value = nextData
}

const handleRename = (e: RenameEvent<MyCustomItem>) => {
  addLog(`Renamed: "${e.node.data.name}" -> "${e.name}"`)
  e.node.data.name = e.name
}

const handleDelete = (e: DeleteEvent<MyCustomItem>) => {
  addLog(`Deleted: [${e.ids.join(', ')}]`)
  const idSet = new Set(e.ids.map(String))
  const filterOut = (items: MyCustomItem[]): MyCustomItem[] => {
    return items
      .filter((i) => !idSet.has(i.id))
      .map((i) => (i.children ? { ...i, children: filterOut(i.children) } : i))
  }
  treeData.value = filterOut(treeData.value)
}

const handleActivate = (node: any) => {
  addLog(`Activated: ${node.data.name}`)
}

const showSelectedNodes = () => {
  if (!treeRef.value) return
  const selectedNodes = treeRef.value.getSelectedNodes()
  const names = selectedNodes.map((n) => n.data.name)
  addLog(`[선택된 항목 추출 (${selectedNodes.length}개)]: ${names.slice(0, 10).join(', ')}${names.length > 10 ? ' ... 외 ' + (names.length - 10) + '개' : ''}`)
  alert(`선택된 항목 (${selectedNodes.length}개):\n\n` + names.slice(0, 20).join('\n') + (names.length > 20 ? `\n... 외 ${names.length - 20}개` : ''))
}

const showCheckedNodes = () => {
  if (!treeRef.value) return
  const checkedNodes = treeRef.value.getCheckedNodes()
  const names = checkedNodes.map((n) => n.data.name)
  addLog(`[체크된 항목 추출 (${checkedNodes.length}개)]: ${names.slice(0, 10).join(', ')}${names.length > 10 ? ' ... 외 ' + (names.length - 10) + '개' : ''}`)
  alert(`체크된 항목 (${checkedNodes.length}개):\n\n` + names.slice(0, 20).join('\n') + (names.length > 20 ? `\n... 외 ${names.length - 20}개` : ''))
}
</script>

<template>
  <div class="app-root">
    <!-- Navbar / Header -->
    <header class="app-header">
      <div class="header-left">
        <span class="logo-badge">Vue 3</span>
        <h1>vue-arborist</h1>
        <span class="version-tag">v0.1.0</span>
      </div>
      <nav class="nav-tabs">
        <button
          class="tab-btn"
          :class="{ active: activeTab === 'demo' }"
          @click="activeTab = 'demo'"
        >
          🎮 인터랙티브 플레이그라운드
        </button>
        <button
          class="tab-btn"
          :class="{ active: activeTab === 'docs' }"
          @click="activeTab = 'docs'"
        >
          📖 사용법 & 예제 문서 (Docs)
        </button>
      </nav>
    </header>

    <!-- TAB 1: INTERACTIVE DEMO PLAYGROUND -->
    <main v-show="activeTab === 'demo'" class="demo-main">
      <div class="control-banner">
        <div class="banner-title">
          <h3>⚡ 대용량 가상화 스트레스 테스트</h3>
          <p>노드 개수를 선택하여 10만 개 노드에서도 60fps로 매끄럽게 동작하는지 테스트해보세요.</p>
        </div>
        <div class="scale-buttons">
          <button
            class="scale-btn"
            :class="{ selected: nodeCountOption === 1000 }"
            :disabled="isGenerating"
            @click="changeNodeCount(1000)"
          >
            1,000개
          </button>
          <button
            class="scale-btn"
            :class="{ selected: nodeCountOption === 10000 }"
            :disabled="isGenerating"
            @click="changeNodeCount(10000)"
          >
            10,000개
          </button>
          <button
            class="scale-btn highlight"
            :class="{ selected: nodeCountOption === 100000 }"
            :disabled="isGenerating"
            @click="changeNodeCount(100000)"
          >
            🔥 100,000개 (10만개)
          </button>
          <button
            class="scale-btn ultra-highlight"
            :class="{ selected: nodeCountOption === 1000000 }"
            :disabled="isGenerating"
            @click="changeNodeCount(1000000)"
          >
            🚀 1,000,000개 (100만개)
          </button>
          <span v-if="isGenerating" class="loading-spin">데이터 생성 중...</span>
        </div>
      </div>

      <div class="demo-toolbar">
        <input
          v-model="searchTerm"
          type="text"
          placeholder="검색 (Enter로 즉시 적용)..."
          class="search-input"
          @keydown.enter="treeRef?.setSearchTerm(searchTerm)"
        />
        <button
          v-if="searchTerm"
          class="btn"
          @click="searchTerm = ''; treeRef?.setSearchTerm('')"
        >
          ✕ 초기화
        </button>
        <button class="btn" @click="treeRef?.openAll()">모두 펼치기 (Open All)</button>
        <button class="btn" @click="treeRef?.closeAll()">모두 닫기 (Close All)</button>
        <button class="btn" @click="treeRef?.selectAll()">전체 선택</button>
        <button class="btn" @click="treeRef?.deselectAll()">선택 해제</button>
        <button class="btn primary" @click="showSelectedNodes">
          🎯 선택된 항목 추출 (Selected)
        </button>
        <button class="btn success" @click="showCheckedNodes">
          ☑️ 체크된 항목 추출 (Checked)
        </button>
        <button class="btn" @click="treeRef?.checkAll()">전체 체크</button>
        <button class="btn" @click="treeRef?.uncheckAll()">전체 체크해제</button>
      </div>

      <div class="demo-body">
        <!-- Tree 1: Default UI with Checkbox -->
        <div class="tree-panel">
          <div class="panel-header">
            <h3>1. 기본 완성형 UI (Checkbox 내장)</h3>
            <span class="badge">기본 내장 렌더러 + 체크박스</span>
          </div>
          <div class="tree-wrapper">
            <Tree
              ref="treeRef"
              :data="treeData"
              :row-height="32"
              :show-checkbox="true"
              :search-term="searchTerm"
              :initial-open-ids="['src', 'components']"
              @move="handleMove"
              @rename="handleRename"
              @delete="handleDelete"
              @activate="handleActivate"
            />
          </div>
        </div>

        <!-- Tree 2: Scoped Slot Custom UI -->
        <div class="tree-panel">
          <div class="panel-header">
            <h3>2. 커스텀 스코프드 슬롯 UI (`#default`)</h3>
            <span class="badge purple">100% 디자인 자유도</span>
          </div>
          <div class="tree-wrapper">
            <Tree
              :data="treeData"
              :row-height="36"
              :search-term="searchTerm"
              @move="handleMove"
              v-slot="{ node }"
            >
              <div
                class="custom-node"
                :class="{ 'is-selected': node.isSelected }"
                :style="{ paddingLeft: `${node.level * 22}px` }"
              >
                <!-- Arrow Toggle Icon -->
                <button
                  v-if="!node.isLeaf"
                  class="custom-arrow-btn"
                  :class="{ 'is-open': node.isOpen }"
                  @click.stop="node.toggle()"
                >
                  ▶
                </button>
                <span v-else class="custom-arrow-placeholder" />

                <!-- Folder / File Icon -->
                <span class="custom-icon" @click.stop="node.toggle()">
                  {{ !node.isLeaf ? (node.isOpen ? '📂' : '📁') : '📄' }}
                </span>

                <!-- Custom Checkbox -->
                <input
                  type="checkbox"
                  class="custom-chk"
                  :checked="node.isChecked"
                  :indeterminate.prop="node.isIndeterminate"
                  @click.stop="node.toggleCheck()"
                />

                <span class="custom-title">{{ node.data.name }}</span>
                <span v-if="node.isLeaf" class="custom-tag">leaf</span>
                <span v-else class="custom-tag folder">{{ node.isOpen ? '열림' : '닫힘' }}</span>
              </div>
            </Tree>
          </div>
        </div>

        <!-- Action Log Panel -->
        <div class="log-panel">
          <div class="panel-header">
            <h3>실시간 이벤트 로그</h3>
            <button class="clear-btn" @click="logMessages = []">지우기</button>
          </div>
          <div class="log-list">
            <div v-for="(log, idx) in logMessages" :key="idx" class="log-item">
              {{ log }}
            </div>
            <div v-if="logMessages.length === 0" class="log-empty">
              노드를 드래그하거나 더블클릭(F2)으로 이름을 변경해보세요.
            </div>
          </div>
        </div>
      </div>
    </main>

    <!-- TAB 2: COMPREHENSIVE DOCUMENTATION & EXAMPLES -->
    <main v-show="activeTab === 'docs'" class="docs-main">
      <article class="markdown-body">
        <h2>📚 vue-arborist 사용 가이드 & 예제 모음</h2>
        <p class="lead">
          <code>vue-arborist</code>는 Vue 3 환경에서 복잡한 UI 라이브러리 없이 독립적으로 동작하는 고성능 가상화 트리 컴포넌트입니다.
          10만 개 이상의 대규모 계층 구조도 1차원 평탄화(Flat Virtualization)를 통해 부드럽게 렌더링합니다.
        </p>

        <hr />

        <h3>1. 설치 방법 (Installation)</h3>
        <pre v-pre><code>npm install vue-arborist
# 또는
pnpm add vue-arborist</code></pre>

        <hr />

        <h3>2. 기본 사용법 (Basic Example)</h3>
        <p>기본 화살표 토글, 폴더/파일 아이콘, 드래그 앤 드롭, 인라인 편집이 모두 내장되어 있어 별도의 렌더러 코드가 필요 없습니다.</p>
        <pre><code v-text="docSnippetBasic"></code></pre>

        <hr />

        <h3>3. 커스텀 UI 슬롯 (Scoped Slot `#default`)</h3>
        <p>자체 디자인 시스템, Tailwind CSS, 또는 커스텀 액션 버튼(삭제, 추가 등)을 배치하려면 기본 슬롯을 활용합니다.</p>
        <pre><code v-text="docSnippetCustom"></code></pre>

        <hr />

        <h3>4. Props 레퍼런스</h3>
        <p><code>&lt;Tree /&gt;</code> 컴포넌트에 전달할 수 있는 속성(Props) 목록입니다.</p>

        <h4 style="margin-top: 16px; color: #3b82f6;">① 데이터 및 접근자 (Data & Accessors)</h4>
        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th style="width: 22%;">Prop</th>
                <th style="width: 28%;">타입</th>
                <th style="width: 15%;">기본값</th>
                <th>설명</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><code>data</code></td>
                <td><code>T[]</code></td>
                <td><span style="color: #ef4444; font-weight: bold;">필수</span></td>
                <td>트리에 렌더링할 계층형 데이터 배열</td>
              </tr>
              <tr>
                <td><code>idAccessor</code></td>
                <td><code>string | ((data: T) => Id)</code></td>
                <td><code>'id'</code></td>
                <td>각 노드의 고유 키(ID)를 식별하는 필드명 또는 추출 함수</td>
              </tr>
              <tr>
                <td><code>childrenAccessor</code></td>
                <td><code>string | ((data: T) => T[])</code></td>
                <td><code>'children'</code></td>
                <td>자식 노드 배열에 접근하는 필드명 또는 추출 함수</td>
              </tr>
              <tr>
                <td><code>openAccessor</code></td>
                <td><code>string | ((data: T) => boolean)</code></td>
                <td><code>'isOpen'</code></td>
                <td>데이터 객체 내에서 열림 상태를 읽어올 필드명 또는 함수</td>
              </tr>
            </tbody>
          </table>
        </div>

        <h4 style="margin-top: 16px; color: #3b82f6;">② 크기 및 가상 스크롤 (Sizing & Virtual Scroll)</h4>
        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th style="width: 22%;">Prop</th>
                <th style="width: 28%;">타입</th>
                <th style="width: 15%;">기본값</th>
                <th>설명</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><code>width</code> / <code>height</code></td>
                <td><code>number | string</code></td>
                <td><code>'100%'</code></td>
                <td>트리 컨테이너의 가로 / 세로 크기 (px 숫자 또는 CSS 단위 문자열)</td>
              </tr>
              <tr>
                <td><code>rowHeight</code></td>
                <td><code>number</code></td>
                <td><code>32</code></td>
                <td>각 노드 행의 고정 높이(px) - 가상 스크롤 렌더링 연산 기준</td>
              </tr>
              <tr>
                <td><code>indent</code></td>
                <td><code>number</code></td>
                <td><code>20</code></td>
                <td>트리 깊이(Level)당 들여쓰기 픽셀</td>
              </tr>
              <tr>
                <td><code>overscan</code></td>
                <td><code>number</code></td>
                <td><code>5</code></td>
                <td>스크롤 시 뷰포트 위/아래에 미리 렌더링할 버퍼 노드 개수</td>
              </tr>
              <tr>
                <td><code>paddingTop</code> / <code>paddingBottom</code> / <code>padding</code></td>
                <td><code>number</code></td>
                <td><code>0</code></td>
                <td>트리 내부 상/하단 여백 (px)</td>
              </tr>
            </tbody>
          </table>
        </div>

        <h4 style="margin-top: 16px; color: #3b82f6;">③ 초기 상태 및 선택/체크 (State & Selection)</h4>
        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th style="width: 22%;">Prop</th>
                <th style="width: 28%;">타입</th>
                <th style="width: 15%;">기본값</th>
                <th>설명</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><code>showCheckbox</code></td>
                <td><code>boolean</code></td>
                <td><code>false</code></td>
                <td>노드 좌측에 3상태(Checked/Indeterminate/Unchecked) 체크박스 활성화</td>
              </tr>
              <tr>
                <td><code>defaultOpenAll</code></td>
                <td><code>boolean</code></td>
                <td><code>false</code></td>
                <td>최초 렌더링 시 모든 폴더 노드를 펼쳐서 표시</td>
              </tr>
              <tr>
                <td><code>openByDefault</code></td>
                <td><code>boolean</code></td>
                <td><code>false</code></td>
                <td>신규 추가되거나 기본 상태일 때 노드들을 펼침 처리</td>
              </tr>
              <tr>
                <td><code>initialOpenIds</code></td>
                <td><code>Id[]</code></td>
                <td><code>[]</code></td>
                <td>초기에 펼쳐둘 노드 ID 목록</td>
              </tr>
              <tr>
                <td><code>initialSelectedIds</code></td>
                <td><code>Id[]</code></td>
                <td><code>[]</code></td>
                <td>초기에 선택해 둘 노드 ID 목록</td>
              </tr>
              <tr>
                <td><code>initialCheckedIds</code></td>
                <td><code>Id[]</code></td>
                <td><code>[]</code></td>
                <td>초기에 체크해 둘 노드 ID 목록</td>
              </tr>
              <tr>
                <td><code>selection</code></td>
                <td><code>Id</code></td>
                <td><code>undefined</code></td>
                <td>외부 상태와 단일 선택 동기화 (값이 변경되면 해당 노드로 자동 스크롤 및 선택)</td>
              </tr>
            </tbody>
          </table>
        </div>

        <h4 style="margin-top: 16px; color: #3b82f6;">④ 동작 및 권한 제어 (Permissions & Behaviors)</h4>
        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th style="width: 22%;">Prop</th>
                <th style="width: 28%;">타입</th>
                <th style="width: 15%;">기본값</th>
                <th>설명</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><code>isMultiSelect</code></td>
                <td><code>boolean</code></td>
                <td><code>true</code></td>
                <td>다중 선택(Shift/Ctrl 클릭) 활성화 여부 (단일 선택 모드 설정 시 <code>false</code> 지정)</td>
              </tr>
              <tr>
                <td><code>isDraggable</code></td>
                <td><code>boolean | string | ((data: T) => boolean)</code></td>
                <td><code>true</code></td>
                <td>드래그 시작 가능 여부 (전체 불가는 <code>false</code>, 조건부 설정은 함수/속성명)</td>
              </tr>
              <tr>
                <td><code>isDroppable</code></td>
                <td><code>boolean | string | Function</code></td>
                <td><code>true</code></td>
                <td>드롭 대상 허용 여부 (전체 불가는 <code>false</code>, 특정 부모/위치 제한 함수)</td>
              </tr>
              <tr>
                <td><code>isEditable</code></td>
                <td><code>boolean | string | ((data: T) => boolean)</code></td>
                <td><code>false</code></td>
                <td>인라인 이름 변경(F2/더블클릭) 활성화 여부 (기본값: false로 수정 불가. 수정 허용 시 <code>true</code> 지정)</td>
              </tr>
              <tr>
                <td><code>selectionFollowsFocus</code></td>
                <td><code>boolean</code></td>
                <td><code>false</code></td>
                <td>방향키 포커스 이동 시 선택(Selection)도 자동으로 함께 동기화</td>
              </tr>
            </tbody>
          </table>
        </div>

        <h4 style="margin-top: 16px; color: #3b82f6;">⑤ 검색 및 스타일 (Search & Style)</h4>
        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th style="width: 22%;">Prop</th>
                <th style="width: 28%;">타입</th>
                <th style="width: 15%;">기본값</th>
                <th>설명</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><code>searchTerm</code></td>
                <td><code>string</code></td>
                <td><code>''</code></td>
                <td>실시간 필터링 검색어 (매칭 노드의 조상 경로 자동 오픈)</td>
              </tr>
              <tr>
                <td><code>searchMatch</code></td>
                <td><code>(node, term) => boolean</code></td>
                <td><code>undefined</code></td>
                <td>커스텀 검색 매칭 함수 (지정하지 않을 경우 이름 및 속성 loose match)</td>
              </tr>
              <tr>
                <td><code>searchDebounce</code></td>
                <td><code>number</code></td>
                <td><code>250</code></td>
                <td>검색어 입력 디바운스 지연 시간 (ms)</td>
              </tr>
              <tr>
                <td><code>className</code></td>
                <td><code>string</code></td>
                <td><code>''</code></td>
                <td>트리 최상위 컨테이너에 적용할 커스텀 CSS 클래스</td>
              </tr>
              <tr>
                <td><code>rowClassName</code></td>
                <td><code>string | ((node) => string)</code></td>
                <td><code>''</code></td>
                <td>각 행 노드 엘리먼트에 동적으로 적용할 CSS 클래스</td>
              </tr>
            </tbody>
          </table>
        </div>

        <hr />

        <h3>5. Events 레퍼런스</h3>
        <p><code>&lt;Tree /&gt;</code> 컴포넌트에서 <code>@이벤트명</code>으로 바인딩할 수 있는 이벤트 목록입니다.</p>

        <h4 style="margin-top: 16px; color: #10b981;">① 선택 및 상태 변경 이벤트</h4>
        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th style="width: 22%;">Event</th>
                <th style="width: 38%;">인자 (Payload)</th>
                <th>설명</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><code>@select</code></td>
                <td><code>nodes: NodeApi&lt;T&gt;[]</code></td>
                <td>노드 선택 상태가 변경되었을 때 현재 선택된 노드 인스턴스 배열 전달</td>
              </tr>
              <tr>
                <td><code>@check</code></td>
                <td><code>{ checkedNodes: NodeApi&lt;T&gt;[]; checkedData: T[] }</code></td>
                <td>체크박스 상태가 변경되었을 때 체크된 노드 및 원본 데이터 배열 전달</td>
              </tr>
              <tr>
                <td><code>@activate</code></td>
                <td><code>node: NodeApi&lt;T&gt;</code></td>
                <td>노드에서 <code>Enter</code> 키를 눌러 실행/활성화했을 때 발생</td>
              </tr>
              <tr>
                <td><code>@focus</code></td>
                <td><code>node: NodeApi&lt;T&gt;</code></td>
                <td>방향키 또는 클릭으로 포커스가 특정 노드로 이동했을 때 발생</td>
              </tr>
              <tr>
                <td><code>@toggle</code></td>
                <td><code>id: Id</code></td>
                <td>폴더 노드가 열리거나 닫힐 때 발생 (토글된 노드 ID 전달)</td>
              </tr>
            </tbody>
          </table>
        </div>

        <h4 style="margin-top: 16px; color: #10b981;">② 데이터 조작 이벤트 (DnD / 수정 / 삭제)</h4>
        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th style="width: 22%;">Event</th>
                <th style="width: 38%;">인자 (Payload)</th>
                <th>설명</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><code>@move</code></td>
                <td><code>event: MoveEvent&lt;T&gt;</code></td>
                <td>드래그 앤 드롭 이동 완료 시 발생 (<code>dragNodes</code>, <code>parentId</code>, <code>index</code> 등 전달)</td>
              </tr>
              <tr>
                <td><code>@rename</code></td>
                <td><code>event: RenameEvent&lt;T&gt;</code></td>
                <td><code>F2</code> 또는 인라인 편집 후 새 이름 확정 시 발생 (<code>{ id, name, node }</code>)</td>
              </tr>
              <tr>
                <td><code>@delete</code></td>
                <td><code>event: DeleteEvent&lt;T&gt;</code></td>
                <td><code>Delete</code>/<code>Backspace</code> 키로 선택 노드 삭제 요청 시 발생 (<code>{ ids, nodes }</code>)</td>
              </tr>
            </tbody>
          </table>
        </div>

        <h4 style="margin-top: 16px; color: #10b981;">③ DOM & 스크롤 이벤트</h4>
        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th style="width: 22%;">Event</th>
                <th style="width: 38%;">인자 (Payload)</th>
                <th>설명</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><code>@scroll</code></td>
                <td><code>{ scrollTop: number; scrollLeft: number }</code></td>
                <td>트리 내부 영역 스크롤 발생 시 전달</td>
              </tr>
              <tr>
                <td><code>@click</code></td>
                <td><code>event: MouseEvent</code></td>
                <td>트리 컨테이너 클릭 이벤트</td>
              </tr>
              <tr>
                <td><code>@contextmenu</code></td>
                <td><code>event: MouseEvent</code></td>
                <td>트리 컨테이너 우클릭 이벤트 (커스텀 컨텍스트 메뉴 연동용)</td>
              </tr>
            </tbody>
          </table>
        </div>

        <hr />

        <h3>6. 인스턴스 메서드 API (<code>treeRef</code>)</h3>
        <p><code>&lt;Tree ref="treeRef" /&gt;</code> 형태로 바인딩하여 트리 컨트롤을 프로그래밍 방식으로 조작할 수 있습니다.</p>

        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th style="width: 30%;">메서드</th>
                <th style="width: 25%;">반환 타입</th>
                <th>설명</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><code>getSelectedNodes()</code></td>
                <td><code>NodeApi&lt;T&gt;[]</code></td>
                <td>현재 선택된 노드 인스턴스 목록 반환</td>
              </tr>
              <tr>
                <td><code>getSelectedData()</code></td>
                <td><code>T[]</code></td>
                <td>현재 선택된 원본 데이터 객체 목록 반환</td>
              </tr>
              <tr>
                <td><code>getCheckedNodes()</code></td>
                <td><code>NodeApi&lt;T&gt;[]</code></td>
                <td>현재 체크박스가 선택된 노드 인스턴스 목록 반환</td>
              </tr>
              <tr>
                <td><code>getCheckedData()</code></td>
                <td><code>T[]</code></td>
                <td>현재 체크박스가 선택된 원본 데이터 객체 목록 반환</td>
              </tr>
              <tr>
                <td><code>openAll()</code> / <code>closeAll()</code></td>
                <td><code>void</code></td>
                <td>모든 폴더 노드 일괄 열기 / 닫기</td>
              </tr>
              <tr>
                <td><code>checkAll()</code> / <code>uncheckAll()</code></td>
                <td><code>void</code></td>
                <td>모든 체크박스 일괄 체크 / 체크 해제</td>
              </tr>
              <tr>
                <td><code>scrollTo(id, align?)</code></td>
                <td><code>void</code></td>
                <td>특정 노드로 가상 스크롤 이동 (<code>'auto' | 'center' | 'start' | 'end'</code>)</td>
              </tr>
              <tr>
                <td><code>setSearchTerm(term)</code></td>
                <td><code>void</code></td>
                <td>검색어 프로그래밍 방식 설정 및 필터링</td>
              </tr>
            </tbody>
          </table>
        </div>

        <hr />

        <h3>5. 단축키 및 인터랙션 안내</h3>
        <ul>
          <li><strong>위/아래 방향키 (<code>↑ / ↓</code>)</strong>: 이전/다음 노드로 포커스 및 선택 이동 (가상 스크롤 자동 동기화)</li>
          <li><strong>오른쪽 방향키 (<code>→</code>)</strong>: 닫힌 폴더 열기 / 열려있는 경우 첫 번째 자식 노드로 이동</li>
          <li><strong>왼쪽 방향키 (<code>←</code>)</strong>: 열린 폴더 닫기 / 닫혀있는 경우 부모 노드로 이동</li>
          <li><strong>F2 키 또는 더블클릭</strong>: 노드 인라인 이름 변경(Rename) 시작 (<code>Enter</code>로 저장, <code>Esc</code>로 취소)</li>
          <li><strong>Delete 키</strong>: 현재 선택된 노드들 일괄 삭제 이벤트(<code>@delete</code>) 발생</li>
          <li><strong>Shift + 클릭 / 방향키</strong>: 연속된 범위의 노드 다중 선택</li>
          <li><strong>Ctrl(Cmd) + 클릭</strong>: 개별 노드 다중 토글 선택</li>
        </ul>
      </article>
    </main>
  </div>
</template>

<style scoped>
.app-root {
  min-height: 100vh;
  background-color: #f8fafc;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  color: #1e293b;
}

.app-header {
  background: #ffffff;
  border-bottom: 1px solid #e2e8f0;
  padding: 14px 28px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.logo-badge {
  background: #42b883;
  color: #ffffff;
  font-size: 11px;
  font-weight: 700;
  padding: 3px 8px;
  border-radius: 4px;
}

.app-header h1 {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
  color: #0f172a;
}

.version-tag {
  font-size: 12px;
  color: #64748b;
  background: #f1f5f9;
  padding: 2px 6px;
  border-radius: 4px;
}

.nav-tabs {
  display: flex;
  gap: 8px;
}

.tab-btn {
  padding: 8px 16px;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 600;
  color: #64748b;
  cursor: pointer;
  transition: all 0.15s ease;
}

.tab-btn:hover {
  color: #0f172a;
  background: #f1f5f9;
}

.tab-btn.active {
  background: #eff6ff;
  color: #2563eb;
  border-color: #bfdbfe;
}

/* PLAYGROUND */
.demo-main {
  max-width: 1400px;
  margin: 0 auto;
  padding: 24px;
}

.control-banner {
  background: linear-gradient(135deg, #1e293b, #0f172a);
  color: #ffffff;
  border-radius: 10px;
  padding: 18px 24px;
  margin-bottom: 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.banner-title h3 {
  margin: 0 0 6px 0;
  font-size: 16px;
  color: #38bdf8;
}

.banner-title p {
  margin: 0;
  font-size: 13px;
  color: #94a3b8;
}

.scale-buttons {
  display: flex;
  gap: 10px;
  align-items: center;
}

.scale-btn {
  padding: 8px 14px;
  background: #334155;
  color: #f1f5f9;
  border: 1px solid #475569;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  transition: all 0.15s;
}

.scale-btn:hover {
  background: #475569;
}

.scale-btn.selected {
  background: #2563eb;
  border-color: #3b82f6;
  font-weight: 600;
}

.scale-btn.highlight.selected {
  background: #ea580c;
  border-color: #f97316;
}

.scale-btn.ultra-highlight.selected {
  background: #dc2626;
  border-color: #ef4444;
}

.loading-spin {
  font-size: 12px;
  color: #fbbf24;
}

.demo-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 16px;
  align-items: center;
}

.search-input {
  padding: 8px 12px;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  font-size: 14px;
  width: 240px;
  outline: none;
}

.search-input:focus {
  border-color: #3b82f6;
}

.btn {
  padding: 8px 12px;
  background-color: #ffffff;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  color: #334155;
  transition: all 0.15s;
}

.btn:hover {
  background-color: #f1f5f9;
  border-color: #94a3b8;
}

.btn.primary {
  background-color: #2563eb;
  color: #ffffff;
  border-color: #1d4ed8;
  font-weight: 600;
}

.btn.primary:hover {
  background-color: #1d4ed8;
}

.btn.success {
  background-color: #059669;
  color: #ffffff;
  border-color: #047857;
  font-weight: 600;
}

.btn.success:hover {
  background-color: #047857;
}

.custom-chk {
  width: 15px;
  height: 15px;
  cursor: pointer;
  accent-color: #2563eb;
}

.demo-body {
  display: grid;
  grid-template-columns: 1.1fr 1.1fr 340px;
  gap: 20px;
}

.tree-panel {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 16px;
  display: flex;
  flex-direction: column;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.panel-header h3 {
  margin: 0;
  font-size: 15px;
  color: #1e293b;
}

.badge {
  font-size: 11px;
  padding: 2px 8px;
  background: #e0f2fe;
  color: #0369a1;
  border-radius: 12px;
  font-weight: 600;
}

.badge.purple {
  background: #f3e8ff;
  color: #7e22ce;
}

.tree-wrapper {
  height: 540px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  overflow: hidden;
  background: #ffffff;
}

.custom-node {
  display: flex;
  align-items: center;
  width: 100%;
  height: 100%;
  gap: 8px;
  cursor: pointer;
  border-radius: 4px;
  transition: background 0.15s;
}

.custom-node:hover {
  background: #f8fafc;
}

.custom-node.is-selected {
  background: #eff6ff;
  color: #1d4ed8;
}

.custom-arrow-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
  font-size: 10px;
  width: 16px;
  height: 16px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #64748b;
  transition: transform 0.15s ease;
}

.custom-arrow-btn.is-open {
  transform: rotate(90deg);
  color: #2563eb;
}

.custom-arrow-placeholder {
  width: 16px;
  display: inline-block;
}

.custom-icon {
  font-size: 14px;
  display: inline-flex;
  align-items: center;
  cursor: pointer;
}

.custom-title {
  font-size: 13px;
  font-weight: 500;
}

.custom-tag {
  font-size: 10px;
  background: #f1f5f9;
  color: #64748b;
  padding: 2px 6px;
  border-radius: 4px;
  margin-left: auto;
  margin-right: 12px;
}

.custom-tag.folder {
  background: #fef3c7;
  color: #b45309;
}

.log-panel {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 16px;
  display: flex;
  flex-direction: column;
}

.clear-btn {
  background: none;
  border: none;
  font-size: 12px;
  color: #64748b;
  cursor: pointer;
}

.clear-btn:hover {
  color: #0f172a;
}

.log-list {
  flex: 1;
  height: 540px;
  overflow-y: auto;
  background: #0f172a;
  border-radius: 6px;
  padding: 12px;
  color: #38bdf8;
  font-family: monospace;
  font-size: 12px;
}

.log-item {
  margin-bottom: 6px;
  word-break: break-all;
}

.log-empty {
  color: #64748b;
  text-align: center;
  margin-top: 40px;
}

/* DOCS */
.docs-main {
  max-width: 960px;
  margin: 0 auto;
  padding: 40px 24px;
}

.markdown-body {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 36px 48px;
}

.markdown-body h2 {
  margin-top: 0;
  font-size: 24px;
  color: #0f172a;
}

.markdown-body p.lead {
  font-size: 15px;
  line-height: 1.6;
  color: #475569;
}

.markdown-body h3 {
  margin-top: 28px;
  font-size: 18px;
  color: #1e293b;
}

.markdown-body pre {
  background: #0f172a;
  color: #e2e8f0;
  padding: 16px 20px;
  border-radius: 8px;
  overflow-x: auto;
  font-size: 13px;
  line-height: 1.5;
}

.markdown-body code {
  font-family: Menlo, Monaco, Consolas, monospace;
}

.markdown-body hr {
  border: 0;
  border-top: 1px solid #e2e8f0;
  margin: 28px 0;
}

.markdown-body ul {
  line-height: 1.8;
  color: #334155;
  font-size: 14px;
}

.table-container {
  overflow-x: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
  margin: 16px 0;
  font-size: 13px;
}

table th, table td {
  padding: 10px 14px;
  border: 1px solid #e2e8f0;
  text-align: left;
}

table th {
  background-color: #f8fafc;
  font-weight: 600;
  color: #334155;
}
</style>
