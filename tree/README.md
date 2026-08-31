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
import { Tree, type TreeApi, type MoveEvent } from 'vue-arborist'
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
</script>

<template>
  <div style="height: 400px; width: 300px; border: 1px solid #ccc;">
    <Tree
      ref="treeRef"
      :data="data"
      :row-height="32"
      :show-checkbox="true"
    />
  </div>
  <button @click="getSelected">선택된 항목 추출</button>
  <button @click="getChecked">체크된 항목 추출</button>
</template>
```
</template>
```

### 2. 커스텀 UI 슬롯 사용법 (`#default`)

```vue
<template>
  <Tree :data="data" :row-height="36" v-slot="{ node }">
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

## 🛠️ API 레퍼런스

### `<Tree />` Props

| Prop | Type | Default | 설명 |
| :--- | :--- | :--- | :--- |
| `data` | `T[]` | **Required** | 계층형 트리 데이터 배열 |
| `width` / `height` | `number \| string` | `'100%'` | 트리 컨테이너 너비 / 높이 |
| `rowHeight` | `number` | `32` | 각 노드의 고유 높이 (가상 스크롤 계산용, px) |
| `indent` | `number` | `20` | 레벨당 들여쓰기 크기 (px) |
| `paddingTop` / `paddingBottom` / `padding` | `number` | `0` | 내부 상하단 여백 (px) |
| `overscan` | `number` | `5` | 가상화 렌더링 버퍼 개수 |
| `searchTerm` | `string` | `''` | 실시간 필터링 검색어 |
| `searchMatch` | `(node, term) => boolean` | `loose JSON match` | 커스텀 검색 알고리즘 |
| `defaultOpenAll` / `openByDefault` | `boolean` | `false` | 초기 렌더링 시 전체 폴더 열림 |
| `showCheckbox` | `boolean` | `false` | 부모-자식 연동 체크박스 활성화 |
| `selection` | `Id` | `undefined` | 외부 선택 ID 동기화 (자동 스크롤 및 선택) |
| `selectionFollowsFocus` | `boolean` | `false` | 방향키 포커스 이동 시 선택도 자동 이동 |
| `disableMultiSelection` | `boolean` | `false` | Shift/Ctrl 다중 선택 비활성화 (단일 선택 강제) |
| `disableDrag` | `boolean \| string \| ((data: T) => boolean)` | `false` | 드래그 비활성화 조건 |
| `disableDrop` | `boolean \| string \| Function` | `false` | 드롭 비활성화 조건 |
| `disableEdit` | `boolean \| string \| ((data: T) => boolean)` | `false` | 인라인 이름 변경 비활성화 조건 |
| `className` / `rowClassName` | `string \| ((node) => string)` | `''` | 컨테이너 및 행 커스텀 CSS 클래스 |
| `idAccessor` | `string \| ((data: T) => Id)` | `'id'` | 각 노드의 고유 ID 접근자 |
| `childrenAccessor` | `string \| ((data: T) => T[])` | `'children'` | 자식 노드 배열 접근자 |
| `openAccessor` | `string \| ((data: T) => boolean)` | `'isOpen'` | 데이터 객체 내 열림 상태 키 |

### 🔍 선택/체크된 항목 추출 API (`treeRef`)

컴포넌트 인스턴스에 `ref="treeRef"`를 바인딩하여 선택/체크된 항목만 즉시 추출할 수 있습니다:

```ts
// 1. 단순 선택(Focus/Row Click)된 노드 또는 데이터 추출
const selectedNodes = treeRef.value.getSelectedNodes() // NodeApi<T>[]
const selectedData = treeRef.value.getSelectedData()   // T[] (순수 원본 데이터 객체)

// 2. 체크박스로 선택된 노드 또는 데이터 추출
const checkedNodes = treeRef.value.getCheckedNodes()   // NodeApi<T>[]
const checkedData = treeRef.value.getCheckedData()     // T[] (순수 원본 데이터 객체)

// 3. 일괄 제어
treeRef.value.checkAll()   // 전체 체크
treeRef.value.uncheckAll() // 전체 체크 해제
```

### `<Tree />` Events

- `@move(event: MoveEvent<T>)`: 노드 드래그 앤 드롭 완료 시
- `@rename(event: RenameEvent<T>)`: F2 또는 더블클릭 후 인라인 이름 변경 시
- `@delete(event: DeleteEvent<T>)`: Delete 키로 선택된 노드 삭제 시
- `@activate(node: NodeApi<T>)`: Enter 키 또는 노드 액션 실행 시

---

## 🏃 로컬 데모 실행

```bash
npm run dev
# 또는 데모 빌드
npm run build:demo
```
