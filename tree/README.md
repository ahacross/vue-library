# vue-arborist

> A high-performance, virtualized, drag-and-drop tree component for Vue 3 with complete TypeScript generic support.

Vue 3 환경에서 외부 대형 UI 프레임워크(Element Plus, PrimeVue 등) 종속성 없이 단독 컴포넌트로 사용할 수 있는 고성능 트리 컴포넌트입니다. `react-arborist`의 핵심 철학과 아키텍처를 계승하여 구현되었습니다.

---

## 🌟 핵심 특징

1. **Standalone (단독 컴포넌트)**: 복잡한 프레임워크 설치 없이 `<Tree />` 컴포넌트 하나로 동작
2. **TypeScript First**: 데이터 모델 `T`에 대한 완벽한 제네릭 타입 추론 및 `TreeApi<T>`, `NodeApi<T>` 지원
3. **가상 스크롤 (Virtualization)**: 1차원 평탄화(Flat list) + 고효율 Node Class 인스턴스 최적화로 **100,000개(10만 개)** 이상의 대규모 노드도 60fps로 매끄럽게 렌더링
4. **HTML5 Drag & Drop (DnD)**:
   - 노드 순서 변경, 부모 변경, 자식으로 삽입
   - 순환 참조(자신의 하위 트리로 드롭) 자동 방지
   - 시각적 드롭 인디케이터(Drop Line & Highlight Box) 내장
   - **`react-arborist`의 고질적인 버그(#313: 리스트 최하단 드롭 실패) 완벽 해결**
5. **키보드 네비게이션**: `↑/↓` (이동), `→/←` (폴더 열기/닫기/부모이동), `F2` (이름 변경), `Delete` (삭제), `Enter` (활성화)
6. **Scoped Slot & 기본 UI**:
   - 세팅 없이 바로 쓸 수 있는 미려한 기본 UI (폴더/파일 아이콘, 화살표, 인라인 수정)
   - `#default="{ node, tree, style }"` 슬롯을 통한 100% 완전한 커스텀 UI 지원
7. **검색 및 필터링 (`searchTerm`)**: 검색어 일치 노드의 조상 경로 자동 오픈
8. **인터랙티브 문서 & 예제 페이지 내장**: 데모 앱 내 탭 전환을 통해 상세 사용법과 예시 확인 가능

---

## 📦 설치 및 사용법

```bash
npm install vue-arborist
# 또는
pnpm add vue-arborist
```

### 1. 기본 사용법 (Out of the box + Checkbox)

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { Tree, type TreeApi, type MoveEvent, type RenameEvent } from 'vue-arborist'
import 'vue-arborist/style.css'

interface Item {
  id: string
  name: string
  children?: Item[]
}

const treeRef = ref<TreeApi<Item> | null>(null)
const data = ref<Item[]>([
  {
    id: '1',
    name: 'Documents',
    children: [
      { id: '1-1', name: 'Resume.pdf' },
      { id: '1-2', name: 'Portfolio.pdf' }
    ]
  },
  { id: '2', name: 'config.json' }
])

// 🎯 선택된 항목만 추출 (Selected)
const getSelected = () => {
  const selectedNodes = treeRef.value?.getSelectedNodes()
  const selectedData = treeRef.value?.getSelectedData()
  console.log('선택된 데이터:', selectedData)
}

// ☑️ 체크된 항목만 추출 (Checked)
const getChecked = () => {
  const checkedNodes = treeRef.value?.getCheckedNodes()
  const checkedData = treeRef.value?.getCheckedData()
  console.log('체크된 데이터:', checkedData)
}

const onSelect = (nodes) => console.log('선택 변경:', nodes)
const onCheck = ({ checkedNodes, checkedData }) => console.log('체크 변경:', checkedData)
const onMove = (e: MoveEvent<Item>) => console.log('노드 이동:', e)
const onRename = (e: RenameEvent<Item>) => console.log('이름 변경:', e)
</script>

<template>
  <div style="height: 400px; width: 300px; border: 1px solid #ccc;">
    <Tree
      ref="treeRef"
      :data="data"
      :row-height="32"
      :show-checkbox="true"
      @select="onSelect"
      @check="onCheck"
      @move="onMove"
      @rename="onRename"
    />
  </div>
  <button @click="getSelected">선택된 항목 추출</button>
  <button @click="getChecked">체크된 항목 추출</button>
</template>
```

### 2. 커스텀 UI 슬롯 사용법 (`#default`)

```vue
<template>
  <Tree :data="data" :row-height="36" v-slot="{ node, tree }">
    <div
      :style="{ paddingLeft: `${node.level * 20}px` }"
      :class="{ selected: node.isSelected }"
      class="custom-row"
    >
      <button v-if="!node.isLeaf" @click.stop="node.toggle()">
        {{ node.isOpen ? '📂' : '📁' }}
      </button>
      <span v-else>📄</span>
      <span>{{ node.data.name }}</span>
    </div>
  </Tree>
</template>
```

---

## 📖 Props 레퍼런스

`<Tree />` 컴포넌트에 전달할 수 있는 Props 목록입니다.

### 1. 데이터 및 접근자 (Data & Accessors)
| Prop | 타입 | 기본값 | 설명 |
| :--- | :--- | :--- | :--- |
| `data` **(필수)** | `T[]` | - | 트리에 렌더링할 계층형(Tree) 데이터 배열 |
| `idAccessor` | `string \| ((data: T) => Id)` | `'id'` | 각 노드의 고유 키(ID)를 식별하는 필드명 또는 추출 함수 |
| `childrenAccessor` | `string \| ((data: T) => T[] \| null \| undefined)` | `'children'` | 자식 노드 배열에 접근하는 필드명 또는 추출 함수 |
| `openAccessor` | `string \| ((data: T) => boolean)` | `'isOpen'` | 데이터 객체 내에서 펼침 여부를 읽어올 필드명 또는 함수 |

### 2. 크기 및 가상 스크롤 (Sizing & Virtual Scroll)
| Prop | 타입 | 기본값 | 설명 |
| :--- | :--- | :--- | :--- |
| `width` | `number \| string` | `'100%'` | 트리 컨테이너 너비 (숫자 입력 시 `px` 단위) |
| `height` | `number \| string` | `'100%'` | 트리 컨테이너 높이 (가상 스크롤 뷰포트 기준 높이) |
| `rowHeight` | `number` | `32` | 각 노드 행의 고정 높이 (`px`, 가상 스크롤 계산 기준) |
| `indent` | `number` | `20` | 트리 레벨(Depth)당 들여쓰기 너비 (`px`) |
| `overscan` | `number` | `5` | 스크롤 시 화면 상/하단에 미리 렌더링할 버퍼 노드 개수 |
| `paddingTop` / `paddingBottom` / `padding` | `number` | `0` | 트리 내부 상/하단 여백 (`px`) |

### 3. 초기 상태 및 선택 (State & Selection)
| Prop | 타입 | 기본값 | 설명 |
| :--- | :--- | :--- | :--- |
| `showCheckbox` | `boolean` | `false` | 노드 좌측에 3상태(Checked/Indeterminate/Unchecked) 체크박스 표시 여부 |
| `defaultOpenAll` | `boolean` | `false` | 최초 렌더링 시 모든 폴더 노드를 펼쳐서 시작할지 여부 |
| `openByDefault` | `boolean` | `false` | 기본 상태일 때 노드들을 펼침 처리할지 여부 |
| `initialOpenIds` | `Id[]` | `[]` | 처음에 열어둘 노드 ID 배열 |
| `initialSelectedIds`| `Id[]` | `[]` | 처음에 선택해 둘 노드 ID 배열 |
| `initialCheckedIds` | `Id[]` | `[]` | 처음에 체크해 둘 노드 ID 배열 |
| `selection` | `Id` | `undefined` | 외부에서 특정 노드를 단일 선택하고 해당 위치로 자동 스크롤할 때 사용 |

### 4. 동작 및 권한 제어 (Permissions & Behaviors)
| Prop | 타입 | 기본값 | 설명 |
| :--- | :--- | :--- | :--- |
| `isMultiSelect` | `boolean` | `true` | 다중 선택(`Ctrl`/`Cmd`, `Shift` 클릭) 활성화 여부 (단일 선택 모드는 `false`) |
| `isDraggable` | `boolean \| string \| ((data: T) => boolean)` | `true` | 드래그 시작 가능 여부 (전체 불가는 `false`, 조건부 설정은 함수/속성명) |
| `isDroppable` | `boolean \| string \| ((args) => boolean)` | `true` | 드롭 대상 허용 여부 (전체 불가는 `false`, 특정 부모/위치 제한 함수) |
| `isEditable` | `boolean \| string \| ((data: T) => boolean)` | `false` | 노드 이름 수정(`F2` / 인라인 에디트) 활성화 여부 (기본값: `false`로 수정 불가) |
| `selectionFollowsFocus` | `boolean` | `false` | 키보드 방향키 이동 시 선택(`selection`)도 자동으로 따라갈지 여부 |

### 5. 검색 및 스타일링 (Search & Style)
| Prop | 타입 | 기본값 | 설명 |
| :--- | :--- | :--- | :--- |
| `searchTerm` | `string` | `''` | 실시간 필터링 검색어 (입력 시 일치 노드와 부모 경로 자동 펼침) |
| `searchMatch` | `(node: NodeApi<T>, term: string) => boolean` | 자체 포함 검색 | 커스텀 검색 일치 로직 함수 |
| `searchDebounce` | `number` | `250` | 검색어 입력 디바운스 지연 시간 (`ms`) |
| `className` | `string` | `''` | 트리 최상위 컨테이너에 추가할 CSS 클래스 |
| `rowClassName` | `string \| ((node: NodeApi<T>) => string)` | `''` | 각 행(Row) 엘리먼트에 동적으로 추가할 CSS 클래스 |

---

## ⚡ Events 레퍼런스

`<Tree />` 컴포넌트에서 `v-on` 또는 `@` 디렉티브로 수신할 수 있는 이벤트 목록입니다.

### 1. 선택 및 상태 변경 이벤트
| Event | 인자 (Payload) | 설명 |
| :--- | :--- | :--- |
| `@select` | `nodes: NodeApi<T>[]` | 노드의 선택(Selection) 상태가 변경되었을 때 현재 선택된 노드 배열 전달 |
| `@check` | `{ checkedNodes: NodeApi<T>[]; checkedData: T[] }` | 체크박스 선택 상태가 변경되었을 때 체크된 노드 및 원본 데이터 배열 전달 |
| `@activate` | `node: NodeApi<T>` | 노드에서 `Enter` 키를 눌러 실행/활성화했을 때 발생 |
| `@focus` | `node: NodeApi<T>` | 키보드 방향키나 클릭으로 포커스가 이동했을 때 발생 |
| `@toggle` | `id: Id` | 폴더 노드가 펼쳐지거나(`Open`) 닫힐 때(`Close`) 발생 |

### 2. 데이터 변경 / 조작 이벤트
| Event | 인자 (Payload) | 설명 |
| :--- | :--- | :--- |
| `@move` | `event: MoveEvent<T>` | 드래그 앤 드롭으로 노드 위치 이동 시 발생 (`dragNodes`, `parentId`, `index` 등 포함) |
| `@rename` | `event: RenameEvent<T>` | `F2` 또는 인라인 수정 후 새 이름이 확정되었을 때 발생 (`{ id, name, node }`) |
| `@delete` | `event: DeleteEvent<T>` | `Delete`/`Backspace` 키로 노드 삭제 요청 시 발생 (`{ ids, nodes }`) |

### 3. DOM & 스크롤 이벤트
| Event | 인자 (Payload) | 설명 |
| :--- | :--- | :--- |
| `@scroll` | `{ scrollTop: number; scrollLeft: number }` | 트리 영역 내부가 스크롤될 때 발생 |
| `@click` | `event: MouseEvent` | 트리 컨테이너 영역 클릭 시 발생 |
| `@contextmenu` | `event: MouseEvent` | 트리 컨테이너 영역 우클릭 시 발생 (컨텍스트 메뉴 구현용) |

---

## 🔧 인스턴스 메서드 API (`treeRef`)

컴포넌트에 `ref="treeRef"`를 지정하여 사용할 수 있는 `TreeApi<T>` 주요 메서드입니다:

```ts
// 1. 선택 / 체크된 데이터 조회
const selectedData = treeRef.value.getSelectedData() // T[]
const checkedData = treeRef.value.getCheckedData()   // T[]

// 2. 전체 펼침 / 닫힘 제어
treeRef.value.openAll()
treeRef.value.closeAll()
treeRef.value.open(nodeId)
treeRef.value.close(nodeId)

// 3. 체크박스 일괄 제어
treeRef.value.checkAll()
treeRef.value.uncheckAll()

// 4. 노드 검색 및 특정 노드로 스크롤 이동
treeRef.value.scrollTo(nodeId, 'auto') // 'auto' | 'center' | 'start' | 'end'
treeRef.value.setSearchTerm('검색어')
```

---

## 🏃 로컬 데모 실행

```bash
npm run dev
# 또는 데모 빌드
npm run build:demo
```
