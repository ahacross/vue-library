# YZ-Grid 🚀👑

> **Rust WebAssembly 기반 10억 행 (1 Billion Rows) 초경량 엔터프라이즈 데이터 그리드**  
> 순수 TypeScript 코어 + Vue 3 래퍼 지원. 브라우저 메모리 **단 2.8MB**로 1,000,000,000건의 데이터를 **60FPS**로 렌더링하고 탐색합니다.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)
[![Vue 3](https://img.shields.io/badge/Vue-3.x-brightgreen.svg)](https://vuejs.org/)
[![Rust](https://img.shields.io/badge/Rust-WebAssembly-orange.svg)](https://rustwasm.github.io/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

---

## ✨ 핵심 기능 (Features)

- 🦀 **Rust WebAssembly 단일화 엔진**: C/Rust 수준의 Zero-Allocation, Zero-Copy 바이너리 아키텍처로 1.8마이크로초 뷰포트 슬라이싱.
- 💎 **100% 프레임워크-프리(Framework-Agnostic) TS 코어**: `GridCore` 클래스로 바닐라 JS, React, Svelte 어디서든 Vue 없이 단독 구동.
- ⚡ **10억 건(1 Billion Rows) 지원**: 360억 픽셀 가상 스크롤 선형 스케일러 탑재, 휠 1틱당 1행 단위 정밀 전수 탐색 지원.
- 🏢 **엔터프라이즈 5대 기능 기본 탑재**:
  1. **행 그룹핑 및 실시간 집계 (Row Grouping & Aggregations)**: 부서별/직급별 아코디언 트리 및 평균/합계 롤업.
  2. **다단 그룹 헤더 및 컬럼 드래그 (Column Reordering)**: 2단 계층 헤더 및 마우스 드래그 앤 드롭 열 재배치.
  3. **엑셀 스타일 세트 필터 (Excel Set Filter)**: 헤더 팝업 체크박스 다중 선택 및 실시간 검색.
  4. **셀 범위 선택 및 엑셀 클립보드 (Excel Clipboard)**: `Ctrl+C`로 복사하여 **실제 Excel/Google Sheets에 그대로 붙여넣기** 가능.
  5. **우클릭 컨텍스트 메뉴 & CSV 내보내기**: 한글 깨짐 방지 UTF-8 BOM 탑재.
- 🎨 **커스텀 컴포넌트 렌더러 & 가변 행 높이**: ag-Grid 호환 셀 렌더러 및 행마다 자유로운 36px~64px 높이 지원.

---

## 📦 설치 방법 (Installation)

```bash
npm install yz-grid
# or
yarn add yz-grid
# or
pnpm add yz-grid
```

> **로컬 프로젝트 참조 시:**  
> `npm install ../path/to/yz-grid`

---

## 🚀 빠른 시작 (Quick Start)

### 1) 순수 TypeScript / Vanilla JS (React, Svelte, No-Framework)
Vue 없이 순수 TypeScript만으로 어디서든 마운트할 수 있습니다:
```typescript
import { GridCore, WasmRowModel } from 'yz-grid'
import 'yz-grid/style.css'

const container = document.getElementById('my-grid')!

// 1. Rust WASM 10억 건 모델 생성
const rowModel = new WasmRowModel(1_000_000_000)

// 2. 순수 TS 코어 엔진 마운트 (Zero Vue Dependency!)
const grid = new GridCore(container, {
  rowModel,
  columns: [
    { field: 'id', headerName: '사번', width: 100, pinned: 'left' },
    { field: 'name', headerName: '이름', width: 150 },
    { field: 'department', headerName: '부서', width: 140 },
    { field: 'salary', headerName: '연봉', width: 140, align: 'right' }
  ]
})

// 이벤트 구독 및 API 제어
grid.on('rowClick', (row, index) => console.log('클릭:', row))
grid.exportToCsv('10억건.csv')
```

### 2) Vue 3 컴포넌트 어댑터 사용 시
```vue
<script setup lang="ts">
import { Grid, WasmRowModel, ColumnDef } from 'yz-grid'
import 'yz-grid/style.css'

const rowModel = new WasmRowModel(1_000_000_000)
const columns: ColumnDef[] = [
  { field: 'id', headerName: '사번', width: 100, pinned: 'left' },
  { field: 'name', headerName: '이름', width: 150 },
  { field: 'department', headerName: '부서', width: 140 },
  { field: 'salary', headerName: '연봉', width: 140, align: 'right' }
]
</script>

<template>
  <!-- 3. 템플릿에 배치 -->
  <div style="height: 600px; width: 100%;">
    <Grid :row-model="rowModel" :columns="columns" />
  </div>
</template>
```

---

## 💡 주요 엔터프라이즈 기능 가이드

### 1. 다단 그룹 헤더 (Multi-level Group Headers)
```vue
<script setup lang="ts">
const columnGroups = [
  {
    groupId: 'basicInfo',
    headerName: '👤 인적사항',
    children: ['id', 'name']
  },
  {
    groupId: 'jobDetails',
    headerName: '💼 조직 및 보상',
    children: ['department', 'salary']
  }
]
</script>

<template>
  <Grid
    :row-model="rowModel"
    :columns="columns"
    :column-groups="columnGroups"
  />
</template>
```

### 2. 행 그룹핑 및 실시간 롤업 집계 (Row Grouping & Aggregations)
```vue
<script setup lang="ts">
const rowGrouping = {
  field: 'department', // 부서별 그룹핑
  expanded: true,      // 기본 펼침 여부
  aggregations: [
    { field: 'salary', type: 'avg' } // 부서별 평균 연봉 자동 롤업 계산
  ]
}
</script>

<template>
  <Grid
    :row-model="rowModel"
    :columns="columns"
    :row-grouping="rowGrouping"
  />
</template>
```

### 3. 실제 백엔드 DB 연동 (Server-Side Streaming / SSRM)
브라우저 메모리 과부하를 방지하기 위해 사용자가 스크롤하는 영역만 그때그때 서버에 요청합니다:
```typescript
const serverModel = new WasmRowModel({
  // totalRows를 사전에 알지 못해도 백엔드 응답의 totalRows로 자동 동기화됩니다.
  serverFetchCallback: async ({ startRow, endRow, sortField, sortDirection }) => {
    const params = new URLSearchParams({
      start: String(startRow),
      limit: String(endRow - startRow)
    })
    if (sortField) params.set('sort_field', sortField)
    if (sortDirection) params.set('sort_dir', sortDirection)

    const res = await fetch(`/api/grid/rows?${params.toString()}`)
    const data = await res.json()

    // { rows, totalRows } 객체 또는 rows 배열 반환 지원
    return {
      rows: data.rows,
      totalRows: data.total_rows
    }
  }
})
```

### 4. 네이티브 Excel (.xlsx) 내보내기 & GridApi
CSV와 달리 서식 및 숫자 형식이 온전히 보존되는 실제 Microsoft Excel 통합 문서(`.xlsx`) 파일로 즉시 다운로드합니다:
```vue
<script setup lang="ts">
import { ref } from 'vue'

const gridRef = ref<any>(null)

// 실제 Excel (.xlsx) 파일 다운로드 (SheetJS 동적 온디맨드 로딩)
const handleExport = async () => {
  await gridRef.value?.exportToXlsx('직원_데이터_10억건.xlsx')
}
</script>
```

### 5. 데이터 없음 및 검색 결과 없음 커스텀 (No Data / No Results)
데이터가 아예 없거나, 검색/필터 결과가 일치하지 않을 때 표시할 문구를 Prop 또는 Slot으로 자유롭게 설정할 수 있습니다:
```vue
<template>
  <Grid
    :row-model="rowModel"
    :columns="columns"
    no-data-message="등록된 직원이 존재하지 않습니다."
    no-result-message="일치하는 검색 결과가 없습니다."
  >
    <!-- 슬롯으로 아이콘이나 버튼 등 풍부한 UI 커스텀도 가능 -->
    <template #no-result>
      <div style="text-align: center; padding: 20px;">
        <span style="font-size: 40px;">🔍</span>
        <h3>일치하는 조건이 없습니다</h3>
        <p>검색어나 필터 조건을 초기화해 보세요.</p>
      </div>
    </template>
  </Grid>
</template>
```

---

## 📊 기술 아키텍처 및 벤치마크

| 항목 | 일반 자바스크립트 그리드 | **YZ-Grid (Rust WASM)** |
| :--- | :--- | :--- |
| **최대 지원 행 수** | 약 100만 건 (한계 도달) | **10억 건 (1,000,000,000 rows)** |
| **메모리 점유** | 1,000만 건 기준 3GB~OOM | **단 2.8 MB (완전 불변 고정)** |
| **뷰포트 슬라이싱 속도** | 15 ms ~ 40 ms | **0.0018 ms (1.8 마이크로초)** |
| **WASM 모듈 크기** | - | **단 21 KB (Gzip 9.6 KB)** |
| **스크롤 프레임레이트** | 20 ~ 40 FPS | **안정적인 60 FPS 고정** |

---

## 📄 라이선스 (License)

MIT License. 누구나 자유롭게 상업용 및 개인 프로젝트에 사용할 수 있습니다.
