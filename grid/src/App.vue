<script setup lang="ts">
import { ref, computed, onMounted, shallowRef, markRaw } from 'vue'
import {
  Grid,
  WasmRowModel,
  ColumnDef,
  ColumnGroupDef,
  RowGroupConfig,
  CellRendererParams
} from './lib'
import ActionCellRenderer from './components/ActionCellRenderer.vue'
import RatingProgressRenderer from './components/RatingProgressRenderer.vue'
import ExcelViewer from './components/ExcelViewer.vue'

// 최상단 페이지 탭: 'benchmark' | 'excel-viewer' (기본: 10억 건 그리드 화면 유지)
const currentView = ref<'benchmark' | 'excel-viewer'>('benchmark')

// 현재 선택된 행 수
const rowCount = ref<number>(1_000_000)
const isLoading = ref<boolean>(false)
const currentTheme = ref<'alpine' | 'dark'>('alpine')
const activeMode = ref<'wasm' | 'ssrm' | 'real_db_ssrm' | 'infinite100m' | 'wasm1b'>('wasm')
const searchQuery = ref<string>('')
const generationDurationMs = ref<number>(0)
const isVariableHeight = ref<boolean>(false)
const isGroupHeadersEnabled = ref<boolean>(true)
const isRowGroupingEnabled = ref<boolean>(false)
const lastEditedMessage = ref<string | null>(null)
let toastTimer: any = null

// 엔터프라이즈 다단 그룹 헤더 설정
const columnGroups: ColumnGroupDef[] = [
  {
    groupId: 'basicInfo',
    headerName: '👤 직원 기본 인적사항',
    children: ['id', 'name', 'joinYear']
  },
  {
    groupId: 'jobDetails',
    headerName: '💼 소속 조직 및 직무',
    children: ['department', 'role']
  },
  {
    groupId: 'compAndRating',
    headerName: '💰 보상 및 성과 평가',
    children: ['salary', 'rating', 'status']
  }
]

// 50컬럼 전용 엔터프라이즈 다단 그룹 헤더
const columnGroups50: ColumnGroupDef[] = [
  {
    groupId: 'basicInfo',
    headerName: '👤 기본 인적사항',
    children: ['id', 'emp_no', 'user_name', 'email']
  },
  {
    groupId: 'jobDetails',
    headerName: '🏢 소속 조직 및 직무',
    children: ['department', 'job_title', 'role_level', 'status', 'hire_date']
  },
  {
    groupId: 'compensation',
    headerName: '💰 급여 및 보상 체계',
    children: ['salary', 'bonus']
  },
  {
    groupId: 'performance',
    headerName: '⭐ 업무 성과 및 근태 현황',
    children: [
      'performance_score',
      'project_count',
      'completed_tasks',
      'overtime_hours',
      'training_hours',
      'cert_count',
      'kpi_score',
      'attendance_rate',
      'work_location'
    ]
  },
  {
    groupId: 'systemSecurity',
    headerName: '💻 IT 시스템 및 보안',
    children: [
      'country_code',
      'ip_address',
      'mac_address',
      'os_name',
      'browser_name',
      'login_count',
      'failed_logins',
      'last_login_at',
      'password_changed_at',
      'is_mfa_enabled',
      'is_admin'
    ]
  },
  {
    groupId: 'financeBilling',
    headerName: '💳 재무 및 계약/청구',
    children: [
      'bank_name',
      'account_no',
      'credit_score',
      'annual_budget',
      'spent_budget',
      'tax_rate',
      'currency',
      'payment_terms',
      'billing_status',
      'last_payment_date'
    ]
  },
  {
    groupId: 'customMetrics',
    headerName: '📈 확장 지표 및 태그',
    children: [
      'custom_flag_1',
      'custom_flag_2',
      'ext_code_a',
      'ext_code_b',
      'metric_a',
      'metric_b',
      'rank_level',
      'tags',
      'created_at'
    ]
  }
]

const activeColumnGroups = computed(() => {
  if (!isGroupHeadersEnabled.value) return undefined
  return activeMode.value === 'real_db_ssrm' ? columnGroups50 : columnGroups
})

// 엔터프라이즈 행 그룹핑 및 실시간 롤업 집계 설정
const rowGroupingConfig = computed<RowGroupConfig | undefined>(() => {
  if (!isRowGroupingEnabled.value) return undefined
  return {
    field: 'department',
    expanded: true,
    aggregations: [
      { field: 'salary', type: 'avg' },
      { field: 'rating', type: 'avg' }
    ]
  }
})

const handleCellChange = (field: string, value: any, rowIndex: number) => {
  lastEditedMessage.value = `✏️ [${field}] 값이 '${value}'(으)로 실시간 수정되었습니다! (${rowIndex + 1}번째 행)`
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => {
    lastEditedMessage.value = null
  }, 3500)
}

// 그리드 레퍼런스
const gridRef = ref<any>(null)

// 활성 RowModel (단 하나의 통합 Rust WASM 엔진으로 단일화!)
const activeRowModel = shallowRef<WasmRowModel | null>(null)
let unifiedWasmModel: WasmRowModel | null = null

// 동적 / 가변 행 높이 함수
const dynamicRowHeight = (params: any) => {
  if (!isVariableHeight.value) return 36
  const role = params.row?.role
  // 직급이나 특정 조건에 따라 36px ~ 64px 동적 가변 높이 적용
  if (role === 'Director' || role === 'VP') return 64
  if (role === 'Lead' || role === 'Principal') return 52
  if (params.rowIndex % 4 === 0) return 46
  return 36
}

// 컬럼 정의 (ag-Grid 형태의 ColumnDefs)
const columns: ColumnDef[] = [
  {
    field: 'id',
    headerName: '사번 (ID)',
    width: 100,
    pinned: 'left',
    sortable: true,
    valueFormatter: (val: any) => (val !== undefined && val !== null ? Number(val).toLocaleString() : '')
  },
  {
    field: 'name',
    headerName: '직원명',
    width: 150,
    sortable: true
  },
  {
    field: 'department',
    headerName: '부서 (Dept)',
    width: 140,
    sortable: true
  },
  {
    field: 'role',
    headerName: '직급 (Role)',
    width: 130,
    sortable: true,
    cellRenderer: (params: CellRendererParams) => {
      const role = params.value
      if (role === 'VP' || role === 'Director') {
        return `👑 ${role}`
      }
      return role
    }
  },
  {
    field: 'salary',
    headerName: '연봉 (Salary)',
    width: 140,
    align: 'right',
    sortable: true,
    valueFormatter: (val: any) => `${Number(val || 0).toLocaleString()} 만원`
  },
  {
    field: 'rating',
    headerName: '인사평가 (컴포넌트 렌더러 / 실시간 수정)',
    width: 160,
    sortable: true,
    cellRenderer: markRaw(RatingProgressRenderer)
  },
  {
    field: 'status',
    headerName: '재직상태',
    width: 110,
    align: 'center',
    sortable: true
  },
  {
    field: 'joinYear',
    headerName: '입사년도',
    width: 100,
    align: 'center',
    sortable: true
  },
  {
    field: 'actions',
    headerName: '관리 / 셀 컨트롤',
    width: 160,
    pinned: 'right',
    sortable: false,
    cellRenderer: markRaw(ActionCellRenderer)
  }
]

// 👑 50컬럼 정의 (실제 PostgreSQL 'big_grid_50cols' 연동용)
const columns50: ColumnDef[] = [
  { field: 'id', headerName: 'ID', width: 90, pinned: 'left', sortable: true },
  { field: 'emp_no', headerName: '사번', width: 120, pinned: 'left', sortable: true },
  { field: 'user_name', headerName: '성명', width: 130, pinned: 'left', sortable: true },
  { field: 'email', headerName: '이메일', width: 190, sortable: true },
  { field: 'department', headerName: '부서', width: 130, sortable: true },
  { field: 'job_title', headerName: '직책', width: 150, sortable: true },
  { field: 'role_level', headerName: '직급', width: 110, sortable: true },
  { field: 'status', headerName: '재직상태', width: 110, sortable: true, align: 'center' },
  { field: 'hire_date', headerName: '입사일', width: 120, sortable: true, align: 'center' },
  { field: 'salary', headerName: '연봉', width: 140, sortable: true, align: 'right', valueFormatter: (v: any) => `${Number(v || 0).toLocaleString()} 원` },
  { field: 'bonus', headerName: '보너스', width: 130, sortable: true, align: 'right', valueFormatter: (v: any) => `${Number(v || 0).toLocaleString()} 원` },
  { field: 'performance_score', headerName: '성과점수', width: 110, sortable: true, align: 'center' },
  { field: 'project_count', headerName: '프로젝트수', width: 110, sortable: true, align: 'center' },
  { field: 'completed_tasks', headerName: '완료태스크', width: 110, sortable: true, align: 'center' },
  { field: 'overtime_hours', headerName: '초과근무(h)', width: 110, sortable: true, align: 'right' },
  { field: 'training_hours', headerName: '교육시간(h)', width: 110, sortable: true, align: 'right' },
  { field: 'cert_count', headerName: '자격증수', width: 100, sortable: true, align: 'center' },
  { field: 'kpi_score', headerName: 'KPI달성도', width: 110, sortable: true, align: 'center' },
  { field: 'attendance_rate', headerName: '출근율(%)', width: 110, sortable: true, align: 'center' },
  { field: 'work_location', headerName: '근무지', width: 130, sortable: true },
  { field: 'country_code', headerName: '국가코드', width: 100, sortable: true, align: 'center' },
  { field: 'ip_address', headerName: 'IP주소', width: 140, sortable: true },
  { field: 'mac_address', headerName: 'MAC주소', width: 160, sortable: true },
  { field: 'os_name', headerName: '운영체제', width: 130, sortable: true },
  { field: 'browser_name', headerName: '브라우저', width: 110, sortable: true },
  { field: 'login_count', headerName: '로그인수', width: 110, sortable: true, align: 'right' },
  { field: 'failed_logins', headerName: '실패횟수', width: 110, sortable: true, align: 'center' },
  { field: 'last_login_at', headerName: '최근접속일시', width: 190, sortable: true },
  { field: 'password_changed_at', headerName: '비번변경일시', width: 190, sortable: true },
  { field: 'is_mfa_enabled', headerName: 'MFA활성', width: 100, sortable: true, align: 'center' },
  { field: 'is_admin', headerName: '관리자여부', width: 100, sortable: true, align: 'center' },
  { field: 'bank_name', headerName: '거래은행', width: 120, sortable: true },
  { field: 'account_no', headerName: '계좌번호', width: 150, sortable: true },
  { field: 'credit_score', headerName: '신용점수', width: 110, sortable: true, align: 'center' },
  { field: 'annual_budget', headerName: '연간예산', width: 150, sortable: true, align: 'right', valueFormatter: (v: any) => `${Number(v || 0).toLocaleString()} 원` },
  { field: 'spent_budget', headerName: '집행예산', width: 150, sortable: true, align: 'right', valueFormatter: (v: any) => `${Number(v || 0).toLocaleString()} 원` },
  { field: 'tax_rate', headerName: '세율(%)', width: 100, sortable: true, align: 'right' },
  { field: 'currency', headerName: '통화', width: 90, sortable: true, align: 'center' },
  { field: 'payment_terms', headerName: '결제조건', width: 120, sortable: true },
  { field: 'billing_status', headerName: '청구상태', width: 120, sortable: true, align: 'center' },
  { field: 'last_payment_date', headerName: '최근결제일', width: 120, sortable: true, align: 'center' },
  { field: 'custom_flag_1', headerName: '플래그A', width: 90, sortable: true, align: 'center' },
  { field: 'custom_flag_2', headerName: '플래그B', width: 90, sortable: true, align: 'center' },
  { field: 'ext_code_a', headerName: '확장코드A', width: 120, sortable: true },
  { field: 'ext_code_b', headerName: '확장코드B', width: 120, sortable: true },
  { field: 'metric_a', headerName: '지표A', width: 110, sortable: true, align: 'right' },
  { field: 'metric_b', headerName: '지표B', width: 110, sortable: true, align: 'right' },
  { field: 'rank_level', headerName: '등급레벨', width: 100, sortable: true, align: 'center' },
  { field: 'tags', headerName: '태그', width: 150, sortable: true },
  { field: 'created_at', headerName: '생성일시', width: 190, sortable: true }
]

const activeColumnsList = shallowRef<ColumnDef[]>(columns)

// 🚀 통합 Rust WASM 엔진으로 데이터 스케일 전환 (10만 ~ 10억 건 완전 단일화)
const loadWasmScale = async (count: number) => {
  isLoading.value = true
  activeColumnsList.value = columns
  rowCount.value = count
  activeMode.value = count >= 1_000_000_000 ? 'wasm1b' : (count >= 100_000_000 ? 'infinite100m' : 'wasm')

  const t0 = performance.now()
  if (!unifiedWasmModel) {
    unifiedWasmModel = new WasmRowModel(count)
    await unifiedWasmModel.init()
  } else {
    unifiedWasmModel.setRowCount(count)
  }
  generationDurationMs.value = performance.now() - t0

  activeRowModel.value = unifiedWasmModel
  isLoading.value = false

  if (gridRef.value) {
    gridRef.value.scrollToRow(0)
  }
}

// 🌐 SSRM (Server-Side Streaming) 모드도 WasmRowModel 콜백으로 통합!
const switchToServerSide = async () => {
  isLoading.value = true
  activeColumnsList.value = columns
  activeMode.value = 'ssrm'
  const mockServerTotal = 100_000_000

  const ssrmWasmModel = new WasmRowModel({
    totalRows: mockServerTotal,
    serverFetchCallback: async (params: any) => {
      await new Promise((resolve) => setTimeout(resolve, 15))
      const rows: any[] = []
      for (let i = params.startRow; i < params.endRow; i++) {
        if (i >= mockServerTotal) break
        rows.push({
          _rawIndex: i,
          id: i + 1,
          name: `Server User ${(i + 1).toLocaleString()}`,
          department: ['Engineering', 'Design', 'Product', 'Sales'][(i * 3) % 4],
          role: ['Senior', 'Lead', 'Principal', 'Director'][(i * 5) % 4],
          salary: 4000 + ((i * 137) % 11000),
          rating: 3.0 + Math.round(((i * 23) % 20)) / 10.0,
          status: ['ACTIVE', 'REMOTE'][(i * 11) % 2],
          joinYear: 2018 + (i % 8)
        })
      }
      return rows
    }
  })

  await ssrmWasmModel.init()
  activeRowModel.value = ssrmWasmModel
  rowCount.value = mockServerTotal
  isLoading.value = false

  if (gridRef.value) {
    gridRef.value.scrollToRow(0)
  }
}

// 🐘 실제 PostgreSQL DB (100만 건 x 50컬럼) 실시간 스트리밍 모드!
const switchToRealDbSSRM = async () => {
  isLoading.value = true
  activeMode.value = 'real_db_ssrm'
  activeColumnsList.value = columns50

  const realDbModel = new WasmRowModel({
    totalRows: 1_000_000,
    serverFetchCallback: async (params: any) => {
      const { startRow, endRow, sortField, sortDirection, lastRow } = params
      const queryParams = new URLSearchParams({
        start: String(startRow),
        limit: String(endRow - startRow)
      })
      if (sortField) queryParams.set('sort_field', sortField)
      if (sortDirection) queryParams.set('sort_dir', sortDirection)
      if (lastRow && typeof lastRow.id === 'number') {
        queryParams.set('after_id', String(lastRow.id))
      }

      const res = await fetch(`/api/grid/rows?${queryParams.toString()}`)
      const data = await res.json()
      return {
        rows: data.rows,
        totalRows: data.total_rows
      }
    }
  })

  await realDbModel.init()
  activeRowModel.value = realDbModel
  rowCount.value = realDbModel.getTotalRows()
  isLoading.value = false

  if (gridRef.value) {
    gridRef.value.scrollToRow(0)
  }
}

// 점프 네비게이션
const jumpToRow = (index: number) => {
  if (gridRef.value) {
    gridRef.value.scrollToRow(index)
  }
}

const selectedDept = ref<string | null>(null)
const isMatchCase = ref(false)

// 🔍 전체 데이터셋 대상 초고속 전역 검색 및 필터
const applyFilter = (dept?: string) => {
  if (!activeRowModel.value) return
  if (dept !== undefined) {
    selectedDept.value = dept || null
  }

  const filterModel: any = {}
  if (selectedDept.value) {
    filterModel.department = { operator: 'equals', value: selectedDept.value }
  }
  if (searchQuery.value && searchQuery.value.trim()) {
    filterModel.query = {
      operator: 'contains',
      value: searchQuery.value.trim(),
      matchCase: isMatchCase.value
    }
  }

  activeRowModel.value.setFilter(filterModel).then(() => {
    if (gridRef.value) {
      gridRef.value.scrollToRow(0)
      gridRef.value.refresh()
    }
  })
}

// 테마 토글
const toggleTheme = () => {
  currentTheme.value = currentTheme.value === 'alpine' ? 'dark' : 'alpine'
}

onMounted(() => {
  // 기본 1,000,000건(1M) Rust WASM 엔진으로 시작
  loadWasmScale(1_000_000)
})
</script>

<template>
  <div class="app-root-wrapper" :class="{ 'demo-dark': currentTheme === 'dark' }">
    <!-- 🌟 최상단 공통 글로벌 네비게이션 헤더 바 -->
    <header class="global-navbar">
      <div class="navbar-brand">
        <span class="brand-icon">⚡</span>
        <span class="brand-name">YZ-Grid Suite</span>
        <span class="brand-sub">WebAssembly Data Grid</span>
      </div>

      <nav class="navbar-tabs">
        <button
          class="nav-tab-item"
          :class="{ active: currentView === 'excel-viewer' }"
          @click="currentView = 'excel-viewer'"
        >
          📂 엑셀(.xlsx) 파일 뷰어
          <span class="tab-chip">Drop & Open</span>
        </button>
        <button
          class="nav-tab-item"
          :class="{ active: currentView === 'benchmark' }"
          @click="currentView = 'benchmark'"
        >
          🚀 10억 건 벤치마크 그리드
        </button>
      </nav>

      <div class="navbar-actions">
        <button class="theme-btn" @click="toggleTheme">
          {{ currentTheme === 'alpine' ? '🌙 다크 모드' : '☀️ 라이트 모드' }}
        </button>
      </div>
    </header>

    <!-- 1. 엑셀 파일 뷰어 페이지 (Drag & Drop) -->
    <main v-if="currentView === 'excel-viewer'" class="view-panel">
      <ExcelViewer @back-to-grid="currentView = 'benchmark'" />
    </main>

    <!-- 2. 10억 건 벤치마크 페이지 -->
    <div v-else class="demo-container">
      <!-- Top Header -->
      <header class="demo-header">
        <div class="demo-title-area">
          <h1>
            ⚡ Vue Hyper Grid
            <span class="badge-tag">ag-Grid 대안</span>
            <span class="badge-tag highlight">10,000,000+ 행 초고속 지원</span>
          </h1>
          <p class="demo-subtitle">
            Web Worker + TypedArray Columnar Storage(SoA) + String Dictionary 압축 + 33.5Mpx 브라우저 한계 극복 가상 스크롤 엔진
          </p>
        </div>

        <div class="demo-actions">
          <button class="theme-btn" @click="toggleTheme">
            {{ currentTheme === 'alpine' ? '🌙 다크 모드' : '☀️ 라이트 모드' }}
          </button>
        </div>
      </header>

    <!-- Controls & Benchmark Bar -->
    <section class="demo-toolbar">
      <div class="toolbar-group">
        <span class="group-label">📊 데이터 행 수:</span>
        <button
          class="btn"
          :class="{ active: rowCount === 100_000 && activeMode !== 'ssrm' }"
          :disabled="isLoading"
          @click="loadWasmScale(100_000)"
        >
          10만 건 (100K)
        </button>
        <button
          class="btn"
          :class="{ active: rowCount === 1_000_000 && activeMode !== 'ssrm' }"
          :disabled="isLoading"
          @click="loadWasmScale(1_000_000)"
        >
          100만 건 (1M)
        </button>
        <button
          class="btn btn-primary"
          :class="{ active: rowCount === 10_000_000 && activeMode !== 'ssrm' }"
          :disabled="isLoading"
          @click="loadWasmScale(10_000_000)"
        >
          🚀 1,000만 건 (10M)
        </button>
        <button
          class="btn btn-ultra"
          :class="{ active: rowCount === 100_000_000 && activeMode !== 'ssrm' }"
          :disabled="isLoading"
          @click="loadWasmScale(100_000_000)"
        >
          💥 1억 건 (100M)
        </button>
        <button
          class="btn btn-wasm"
          :class="{ active: rowCount === 1_000_000_000 && activeMode !== 'ssrm' }"
          :disabled="isLoading"
          @click="loadWasmScale(1_000_000_000)"
        >
          👑 10억 건 (1 Billion - Rust WASM)
        </button>
        <button
          class="btn btn-secondary"
          :class="{ active: activeMode === 'ssrm' }"
          :disabled="isLoading"
          @click="switchToServerSide"
        >
          🌐 가상 SSRM 모드
        </button>
        <button
          class="btn btn-real-db"
          :class="{ active: activeMode === 'real_db_ssrm' }"
          :disabled="isLoading"
          @click="switchToRealDbSSRM"
        >
          🐘 실제 DB 100만건 x 50컬럼 (SSRM)
        </button>
      </div>

      <div class="toolbar-group">
        <span class="group-label">⚙️ 행 높이:</span>
        <button
          class="btn"
          :class="{ active: isVariableHeight }"
          @click="isVariableHeight = !isVariableHeight"
        >
          {{ isVariableHeight ? '📐 가변 높이 (ON: 36~64px)' : '📏 고정 높이 (36px)' }}
        </button>
      </div>

      <div class="toolbar-group">
        <span class="group-label">🎯 빠른 이동:</span>
        <button class="btn btn-sm" @click="jumpToRow(0)">처음 (0행)</button>
        <button class="btn btn-sm" @click="jumpToRow(Math.floor(rowCount / 2))">
          중간 ({{ (rowCount / 2).toLocaleString() }}행)
        </button>
        <button class="btn btn-sm" @click="jumpToRow(rowCount - 1)">
          끝 ({{ (rowCount - 1).toLocaleString() }}행)
        </button>
      </div>

      <div class="toolbar-group">
        <span class="group-label">🏢 엔터프라이즈:</span>
        <button
          class="btn"
          :class="{ active: isGroupHeadersEnabled }"
          @click="isGroupHeadersEnabled = !isGroupHeadersEnabled"
        >
          {{ isGroupHeadersEnabled ? '📑 다단 헤더 (ON)' : '📑 다단 헤더 (OFF)' }}
        </button>
        <button
          class="btn"
          :class="{ active: isRowGroupingEnabled }"
          @click="isRowGroupingEnabled = !isRowGroupingEnabled"
        >
          {{ isRowGroupingEnabled ? '📂 부서별 그룹핑 (ON)' : '📂 부서별 그룹핑 (OFF)' }}
        </button>
        <button
          class="btn btn-primary"
          :disabled="gridRef?.isExportingExcel"
          title="백엔드 고속 스트리밍 엔진 또는 로컬 스트리밍으로 엑셀(.xlsx)을 다운로드합니다."
          @click="gridRef?.exportToXlsx()"
        >
          <span v-if="gridRef?.isExportingExcel" class="btn-spinner"></span>
          <span>{{ gridRef?.isExportingExcel ? '⏳ 엑셀 파일 생성 중...' : '📊 엑셀(.xlsx) 내보내기' }}</span>
        </button>
        <button
          class="btn btn-secondary"
          title="로컬 엑셀 파일(.xlsx)을 드롭하여 바로 열어보는 뷰어 페이지로 이동합니다."
          @click="currentView = 'excel-viewer'"
        >
          📂 엑셀 파일 뷰어로 이동 ➔
        </button>
      </div>

      <div class="toolbar-group">
        <span class="group-label">🔎 전역 실시간 검색:</span>
        <input
          v-model="searchQuery"
          type="text"
          placeholder="이름(Alex Kim 등), 부서, 직급, 사번..."
          class="global-search-input"
          @input="applyFilter()"
        />
        <label class="match-case-label" title="체크 시 영문 대소문자를 엄격히 구분하여 검색합니다">
          <input
            v-model="isMatchCase"
            type="checkbox"
            class="match-case-checkbox"
            @change="applyFilter()"
          />
          <span class="match-case-text">Aa 대소문자 구분</span>
        </label>
        <button v-if="searchQuery" class="btn btn-sm" @click="searchQuery = ''; applyFilter()">✕</button>
      </div>

      <div class="toolbar-group">
        <span class="group-label">🏢 부서 필터:</span>
        <button class="btn btn-sm" :class="{ active: selectedDept === 'Engineering' }" @click="applyFilter('Engineering')">개발팀</button>
        <button class="btn btn-sm" :class="{ active: selectedDept === 'Design' }" @click="applyFilter('Design')">디자인팀</button>
        <button class="btn btn-sm" :class="{ active: selectedDept === 'Product' }" @click="applyFilter('Product')">기획팀</button>
        <button class="btn btn-sm" :class="{ active: !selectedDept }" @click="applyFilter('')">전체부서</button>
      </div>
    </section>

    <!-- Architecture & Memory Comparison Alert -->
    <div class="tech-comparison-panel">
      <div class="comparison-card">
        <div class="comp-header danger">
          ❌ 일반 JS 객체 배열 (1,000만 ~ 1억 건)
        </div>
        <div class="comp-body">
          <p>• 1,000만 건 = <strong>약 3GB RAM</strong> / 1억 건 = <strong>25GB~35GB RAM 소모</strong></p>
          <p>• V8 힙 4GB 한계 초과로 <strong>브라우저 즉시 크래시(OOM)</strong></p>
          <p>• 1억 행 높이 35억 픽셀로 <strong>브라우저 CSS 33.5Mpx 한계 100배 초과</strong></p>
        </div>
      </div>

      <div class="comparison-card highlight-card">
        <div class="comp-header success">
          ⚡ Rust WebAssembly 단일화 엔진 (10만 ~ 10억 건 + SSRM 통합)
        </div>
        <div class="comp-body">
          <p>• <strong>단 21KB Rust WASM 엔진</strong>으로 10만 건부터 <strong>10억 건(1,000,000,000)</strong>까지 1.8㎲ 네이티브 속도 단일화</p>
          <p>• <strong>Zero-Allocation & Zero-Copy</strong>: 10억 건을 탐색해도 브라우저 메모리 <strong>단 2.8MB로 완전 고정</strong></p>
          <p>• <strong>엔터프라이즈 5대 기능 탑재</strong>: 다단 헤더, 컬럼 드래그 이동, 엑셀 세트 필터, 셀 범위 선택/복사(`Ctrl+C`), 우클릭 컨텍스트 메뉴</p>
        </div>
      </div>
    </div>

    <!-- Main Grid Viewport Container -->
    <main class="grid-wrapper">
      <Grid
        v-if="activeRowModel"
        ref="gridRef"
        :row-model="activeRowModel"
        :columns="activeColumnsList"
        :column-groups="activeColumnGroups"
        :row-grouping="rowGroupingConfig"
        :theme="currentTheme"
        :row-height="isVariableHeight ? dynamicRowHeight : 36"
        :header-height="38"
        :loading="isLoading"
        :excel-file-name="activeMode === 'real_db_ssrm' ? 'DB_50컬럼_직원기록_100만건.xlsx' : '직원_인사데이터.xlsx'"
        :data-url="'/api/grid/rows'"
        :export-url="activeMode === 'real_db_ssrm' ? '/api/grid/export/xlsx' : undefined"
        no-data-message="데이터가 없습니다."
        no-result-message="결과가 없습니다."
        selection-mode="multiple"
        @cell-change="handleCellChange"
      >
        <!-- 부서 커스텀 태그 뱃지 슬롯 -->
        <template #cell-department="{ value }">
          <span class="dept-badge" :class="`dept-${String(value).toLowerCase()}`">
            {{ value }}
          </span>
        </template>

        <!-- 상태 커스텀 뱃지 슬롯 -->
        <template #cell-status="{ value }">
          <span class="status-badge" :class="`status-${String(value).toLowerCase()}`">
            {{ value }}
          </span>
        </template>
      </Grid>

      <!-- 셀 실시간 수정 알림 토스트 -->
      <transition name="toast-fade">
        <div v-if="lastEditedMessage" class="cell-edit-toast">
          {{ lastEditedMessage }}
        </div>
      </transition>
      </main>
    </div>
  </div>
</template>

<style scoped>
.app-root-wrapper {
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100%;
  max-width: 100%;
  overflow: hidden;
  box-sizing: border-box;
  background-color: #f8fafc;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
}

.global-navbar {
  height: 52px;
  background: #ffffff;
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  flex-shrink: 0;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  z-index: 100;
}

.demo-dark .global-navbar {
  background: #0f172a;
  border-bottom-color: #1e293b;
}

.navbar-brand {
  display: flex;
  align-items: center;
  gap: 8px;
}

.brand-icon {
  font-size: 20px;
}

.brand-name {
  font-size: 16px;
  font-weight: 800;
  color: #0f172a;
  letter-spacing: -0.02em;
}

.demo-dark .brand-name {
  color: #f8fafc;
}

.brand-sub {
  font-size: 11px;
  font-weight: 500;
  color: #64748b;
  margin-left: 4px;
}

.navbar-tabs {
  display: flex;
  align-items: center;
  gap: 8px;
}

.nav-tab-item {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 7px 16px;
  font-size: 14px;
  font-weight: 600;
  color: #64748b;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.nav-tab-item:hover {
  color: #0f172a;
  background: #f1f5f9;
}

.demo-dark .nav-tab-item:hover {
  color: #f8fafc;
  background: #1e293b;
}

.nav-tab-item.active {
  color: #2563eb;
  background: #eff6ff;
  border-color: #bfdbfe;
  font-weight: 700;
}

.demo-dark .nav-tab-item.active {
  color: #60a5fa;
  background: #1e3a8a33;
  border-color: #1e40af;
}

.tab-chip {
  font-size: 10px;
  font-weight: 700;
  color: #ffffff;
  background: #2563eb;
  padding: 1px 6px;
  border-radius: 10px;
  text-transform: uppercase;
}

.view-panel {
  flex: 1;
  height: calc(100vh - 52px);
  width: 100%;
  max-width: 100%;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  min-height: 0;
  min-width: 0;
  box-sizing: border-box;
}

.demo-container {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 52px);
  padding: 14px 20px;
  box-sizing: border-box;
  background-color: #f1f5f9;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  color: #1e293b;
  overflow: hidden;
}

.demo-dark {
  background-color: #020617;
  color: #f8fafc;
}

.demo-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.demo-title-area h1 {
  margin: 0;
  font-size: 22px;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 10px;
}

.badge-tag {
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 9999px;
  background-color: #e2e8f0;
  color: #475569;
}

.badge-tag.highlight {
  background: linear-gradient(135deg, #2563eb, #3b82f6);
  color: #ffffff;
}

.demo-subtitle {
  margin: 4px 0 0 0;
  font-size: 12px;
  opacity: 0.75;
}

.demo-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  align-items: center;
  padding: 10px 14px;
  background-color: #ffffff;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
  margin-bottom: 12px;
}

.demo-dark .demo-toolbar {
  background-color: #0f172a;
  border-color: #334155;
}

.toolbar-group {
  display: flex;
  align-items: center;
  gap: 6px;
}

.group-label {
  font-size: 12px;
  font-weight: 600;
  opacity: 0.8;
  margin-right: 4px;
}

.btn {
  padding: 6px 12px;
  font-size: 12px;
  font-weight: 500;
  border-radius: 6px;
  border: 1px solid #cbd5e1;
  background: #ffffff;
  color: #334155;
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn:hover:not(:disabled) {
  background: #f8fafc;
  border-color: #94a3b8;
}

.btn.active {
  background: #2563eb;
  color: #ffffff;
  border-color: #1d4ed8;
}

.btn-primary {
  background: #eff6ff;
  border-color: #3b82f6;
  color: #1d4ed8;
  font-weight: 600;
}

.btn-primary:hover:not(:disabled) {
  background: #2563eb;
  color: #ffffff;
}

.btn-ultra {
  background: #fff1f2;
  border-color: #f43f5e;
  color: #e11d48;
  font-weight: 700;
}

.btn-ultra:hover:not(:disabled) {
  background: #e11d48;
  color: #ffffff;
}

.btn-ultra.active {
  background: #e11d48 !important;
  color: #ffffff !important;
  border-color: #be123c !important;
}

.btn-wasm {
  background: linear-gradient(135deg, #fef3c7 0%, #ede9fe 100%);
  border-color: #8b5cf6;
  color: #6d28d9;
  font-weight: 700;
  box-shadow: 0 1px 2px 0 rgba(139, 92, 246, 0.2);
}

.btn-wasm:hover:not(:disabled) {
  background: linear-gradient(135deg, #fde68a 0%, #ddd6fe 100%);
  color: #5b21b6;
}

.btn-wasm.active {
  background: linear-gradient(135deg, #7c3aed 0%, #d97706 100%) !important;
  color: #ffffff !important;
  border-color: #6d28d9 !important;
  box-shadow: 0 2px 4px 0 rgba(124, 58, 237, 0.4);
}

.btn-secondary {
  background: #faf5ff;
  border-color: #a855f7;
  color: #7e22ce;
}

.btn-real-db {
  background: linear-gradient(135deg, #ecfdf5 0%, #dbeafe 100%);
  border-color: #059669;
  color: #065f46;
  font-weight: 700;
}

.btn-real-db:hover:not(:disabled) {
  background: linear-gradient(135deg, #d1fae5 0%, #bfdbfe 100%);
  color: #047857;
}

.btn-real-db.active {
  background: linear-gradient(135deg, #059669 0%, #2563eb 100%) !important;
  color: #ffffff !important;
  border-color: #047857 !important;
  box-shadow: 0 2px 4px 0 rgba(5, 150, 105, 0.4);
}

.btn-sm {
  padding: 4px 8px;
  font-size: 11px;
}

.global-search-input {
  padding: 5px 10px;
  border-radius: 6px;
  border: 1px solid #cbd5e1;
  font-size: 12px;
  width: 200px;
  outline: none;
  background: #ffffff;
  color: #1e293b;
  transition: all 0.2s;
}

.global-search-input:focus {
  border-color: #3b82f6;
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
}

.demo-dark .global-search-input {
  background: #1e293b;
  border-color: #334155;
  color: #f8fafc;
}

.match-case-label {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  user-select: none;
  font-size: 11px;
  font-weight: 600;
  color: #64748b;
  padding: 4px 6px;
  border-radius: 4px;
  transition: all 0.15s;
}

.match-case-label:hover {
  background: rgba(0, 0, 0, 0.04);
  color: #1e293b;
}

.demo-dark .match-case-label {
  color: #94a3b8;
}

.demo-dark .match-case-label:hover {
  background: rgba(255, 255, 255, 0.06);
  color: #f8fafc;
}

.match-case-checkbox {
  cursor: pointer;
  accent-color: #3b82f6;
}

.theme-btn {
  padding: 6px 12px;
  font-size: 12px;
  font-weight: 600;
  border-radius: 6px;
  border: 1px solid #cbd5e1;
  background: #ffffff;
  cursor: pointer;
}

.demo-dark .theme-btn {
  background: #1e293b;
  color: #f8fafc;
  border-color: #334155;
}

/* Architecture Comparison Cards */
.tech-comparison-panel {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-bottom: 12px;
}

.comparison-card {
  padding: 10px 14px;
  border-radius: 8px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  font-size: 12px;
  line-height: 1.5;
}

.demo-dark .comparison-card {
  background: #0f172a;
  border-color: #334155;
}

.highlight-card {
  border-color: #93c5fd;
  background: #f0f9ff;
}

.demo-dark .highlight-card {
  background: #082f49;
  border-color: #0284c7;
}

.comp-header {
  font-weight: 700;
  margin-bottom: 6px;
  font-size: 13px;
}

.comp-header.danger {
  color: #dc2626;
}

.comp-header.success {
  color: #0284c7;
}

.comp-body p {
  margin: 2px 0;
}

/* Grid Wrapper */
.grid-wrapper {
  flex-grow: 1;
  min-height: 400px;
  height: 100%;
  border-radius: 8px;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
  display: flex;
  flex-direction: column;
  position: relative;
  overflow: hidden;
}

/* Badges */
.dept-badge {
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  background: #f1f5f9;
  color: #475569;
}

.dept-engineering { background: #dbeafe; color: #1e40af; }
.dept-design { background: #fce7f3; color: #9d174d; }
.dept-product { background: #fef3c7; color: #92400e; }
.dept-sales { background: #dcfce7; color: #166534; }

.status-badge {
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 10px;
  font-weight: 700;
}

.status-active { background: #dcfce7; color: #15803d; }
.status-on_leave { background: #fef9c3; color: #a16207; }
.status-remote { background: #e0e7ff; color: #4338ca; }
.status-contract { background: #f3e8ff; color: #7e22ce; }

/* 실시간 수정 알림 토스트 */
.cell-edit-toast {
  position: fixed;
  bottom: 24px;
  right: 32px;
  background: #1e293b;
  color: #f8fafc;
  padding: 10px 18px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.2), 0 4px 6px -2px rgba(0, 0, 0, 0.1);
  border-left: 4px solid #3b82f6;
  z-index: 9999;
}

.toast-fade-enter-active,
.toast-fade-leave-active {
  transition: all 0.25s ease;
}

.toast-fade-enter-from,
.toast-fade-leave-to {
  opacity: 0;
  transform: translateY(12px);
}

/* 엑셀 다운로드 버튼 스피너 애니메이션 */
.btn-spinner {
  display: inline-block;
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255, 255, 255, 0.35);
  border-top-color: #ffffff;
  border-radius: 50%;
  animation: spin-btn 0.75s linear infinite;
  margin-right: 7px;
  vertical-align: middle;
}

@keyframes spin-btn {
  to {
    transform: rotate(360deg);
  }
}
</style>
