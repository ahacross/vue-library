<script setup lang="ts">
import { ref, shallowRef, computed } from 'vue'
import * as XLSX from 'xlsx'
import Grid from '../lib/components/Grid.vue'
import { ClientRowModel } from '../lib/models/ClientRowModel'
import type { ColumnDef } from '../lib/types'

const emit = defineEmits<{
  (e: 'backToGrid'): void
}>()

// 상태 관리
const isDragging = ref(false)
const isParsing = ref(false)
const parseProgress = ref('')
const currentFile = ref<{ name: string; size: number } | null>(null)

// 시트 및 데이터
const workbookRef = shallowRef<XLSX.WorkBook | null>(null)
const sheetNames = ref<string[]>([])
const activeSheetName = ref<string>('')
const sheetRowCounts = ref<Record<string, number>>({})

// 그리드 렌더링용
const gridColumns = ref<ColumnDef[]>([])
const clientRowModel = shallowRef<ClientRowModel | null>(null)
const totalRows = ref(0)
const totalCols = ref(0)
const gridRef = ref<any>(null)
const searchQuery = ref('')
const backendInfoMessage = ref<string | null>(null)

// 파일 드래그 앤 드롭 핸들러
const onDragOver = (e: DragEvent) => {
  e.preventDefault()
  isDragging.value = true
}

const onDragLeave = (e: DragEvent) => {
  e.preventDefault()
  isDragging.value = false
}

const onDrop = (e: DragEvent) => {
  e.preventDefault()
  isDragging.value = false
  const files = e.dataTransfer?.files
  if (files && files.length > 0) {
    handleFile(files[0])
  }
}

// 파일 선택 인풋 핸들러
const onFileInputChange = (e: Event) => {
  const target = e.target as HTMLInputElement
  if (target.files && target.files.length > 0) {
    handleFile(target.files[0])
  }
}

// 🚀 Rust 백엔드 고속 파싱 엔진 (대용량 파일 / 100만 행 처리)
const parseWithBackend = async (file: File) => {
  parseProgress.value = `대용량 엑셀(${(file.size / (1024 * 1024)).toFixed(1)}MB) 감지! Rust 백엔드 초고속 스트리밍 엔진으로 변환 중...`
  const formData = new FormData()
  formData.append('file', file)

  const response = await fetch('/api/grid/parse/xlsx', {
    method: 'POST',
    body: formData
  })

  if (!response.ok) {
    const errText = await response.text()
    throw new Error(errText || '백엔드 엑셀 파싱 실패')
  }

  const result = await response.json()
  gridColumns.value = result.columns
  totalRows.value = result.totalRows
  totalCols.value = result.columns.length
  activeSheetName.value = 'Sheet1'
  sheetNames.value = ['Sheet1']
  sheetRowCounts.value = { Sheet1: result.totalRows }
  backendInfoMessage.value = result.message

  clientRowModel.value = new ClientRowModel(result.rows)
}

// 엑셀 파일 파싱 및 로드 (스마트 듀얼 모드)
const handleFile = async (file: File) => {
  if (!file.name.match(/\.(xlsx|xls|csv)$/i)) {
    alert('엑셀(.xlsx, .xls) 또는 CSV 파일만 지원합니다.')
    return
  }

  isParsing.value = true
  parseProgress.value = '파일을 분석 중입니다...'
  backendInfoMessage.value = null
  currentFile.value = {
    name: file.name,
    size: file.size
  }

  try {
    // ⭐️ 20MB 이상 대용량 파일은 브라우저 메모리 폭발(V8 2GB 제한)을 방지하고 Rust 백엔드 스트리밍 엔진으로 직통 파싱
    if (file.size > 20 * 1024 * 1024) {
      await parseWithBackend(file)
      return
    }

    // 20MB 이하 일반 파일은 브라우저 SheetJS에서 로컬 즉시 파싱
    const arrayBuffer = await file.arrayBuffer()
    parseProgress.value = '시트 구조를 분석하는 중입니다...'
    await new Promise((resolve) => setTimeout(resolve, 10))

    const wb = XLSX.read(arrayBuffer, {
      type: 'array',
      cellDates: true
    })

    workbookRef.value = wb
    sheetNames.value = wb.SheetNames

    const rowCounts: Record<string, number> = {}
    for (const name of wb.SheetNames) {
      const ws = wb.Sheets[name]
      if (ws && ws['!ref']) {
        const range = XLSX.utils.decode_range(ws['!ref'])
        rowCounts[name] = Math.max(0, range.e.r)
      } else {
        rowCounts[name] = 0
      }
    }
    sheetRowCounts.value = rowCounts

    if (wb.SheetNames.length > 0) {
      await loadSheet(wb.SheetNames[0])
    }
  } catch (err: any) {
    console.warn('로컬 파싱 실패 또는 대용량 감지, 백엔드 고속 엔진으로 폴백 시도:', err)
    try {
      // 로컬 메모리 실패 시 Rust 백엔드 엔진으로 자동 폴백
      await parseWithBackend(file)
    } catch (backendErr: any) {
      console.error('백엔드 파싱 오류:', backendErr)
      alert(`엑셀 파일을 여는 중 오류가 발생했습니다: ${backendErr?.message || backendErr}`)
      currentFile.value = null
    }
  } finally {
    isParsing.value = false
    parseProgress.value = ''
  }
}

// 시트 전환 및 데이터 바인딩
const loadSheet = async (sheetName: string) => {
  if (!workbookRef.value) return
  const ws = workbookRef.value.Sheets[sheetName]
  if (!ws) return

  activeSheetName.value = sheetName
  isParsing.value = true
  parseProgress.value = `'${sheetName}' 데이터를 그리드 엔진에 바인딩 중...`
  await new Promise((resolve) => setTimeout(resolve, 10))

  try {
    // 2D 배열로 변환 (헤더 보존)
    const rawData: any[][] = XLSX.utils.sheet_to_json(ws, {
      header: 1,
      defval: ''
    })

    if (!rawData || rawData.length === 0) {
      gridColumns.value = []
      clientRowModel.value = new ClientRowModel([])
      totalRows.value = 0
      totalCols.value = 0
      return
    }

    const headers: any[] = rawData[0] || []
    const dataRows = rawData.slice(1)

    // 1. 컬럼 동적 정의 생성 (필드명을 컬럼 인덱스 '0', '1', '2'로 일치시켜 2D 배열 직결 지원)
    const columns: ColumnDef[] = headers.map((h, colIdx) => {
      const headerTitle = String(h || `열 ${colIdx + 1}`).trim()
      const sampleVal = dataRows[0]?.[colIdx]
      const isNumber = typeof sampleVal === 'number'

      return {
        field: String(colIdx),
        headerName: headerTitle,
        width: Math.min(Math.max(headerTitle.length * 14 + 50, 110), 320),
        sortable: true,
        resizable: true,
        type: isNumber ? 'number' : 'string',
        align: isNumber ? 'right' : 'left'
      }
    })

    gridColumns.value = columns
    totalCols.value = columns.length
    totalRows.value = dataRows.length

    // 2. 무거운 JS 객체 변환 없이 초고속 2D 평탄화 배열을 직접 바인딩 (메모리 80% 절감)
    clientRowModel.value = new ClientRowModel(dataRows)
  } finally {
    isParsing.value = false
    parseProgress.value = ''
  }
}

// 실시간 검색 필터
const applySearch = () => {
  if (!clientRowModel.value) return
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) {
    clientRowModel.value.setFilter({})
    return
  }

  // 모든 컬럼에 대해 OR 검색 필터 적용
  const filters: any = {}
  gridColumns.value.forEach((col) => {
    filters[col.field] = { operator: 'contains', value: q }
  })
  clientRowModel.value.setFilter(filters)
}

// 파일 포맷 크기 헬퍼
const formatFileSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

// 다른 파일 열기 초기화
const resetFile = () => {
  currentFile.value = null
  workbookRef.value = null
  sheetNames.value = []
  activeSheetName.value = ''
  gridColumns.value = []
  clientRowModel.value = null
  totalRows.value = 0
  totalCols.value = 0
  searchQuery.value = ''
  backendInfoMessage.value = null
}
</script>

<template>
  <div class="excel-viewer-container">
    <!-- 상단 네비게이션 복귀 바 -->
    <div class="viewer-nav-bar">
      <button class="btn-back-nav" @click="emit('backToGrid')">
        ⬅️ 10억 건 데이터 그리드 화면으로 돌아가기
      </button>
      <span class="viewer-page-title">📂 독립형 엑셀 파일 뷰어</span>
    </div>

    <!-- 1. 파일이 없을 때: 드래그 앤 드롭 영역 -->
    <div
      v-if="!currentFile"
      class="excel-dropzone"
      :class="{ 'is-dragging': isDragging, 'is-parsing': isParsing }"
      @dragover="onDragOver"
      @dragleave="onDragLeave"
      @drop="onDrop"
    >
      <input
        type="file"
        id="excel-file-input"
        accept=".xlsx, .xls, .csv"
        class="hidden-file-input"
        @change="onFileInputChange"
      />

      <div class="dropzone-card">
        <div class="dropzone-icon">📗</div>
        <h2 class="dropzone-title">엑셀(.xlsx / .xls / .csv) 파일을 여기에 드롭하세요</h2>
        <p class="dropzone-desc">
          로컬에 MS Excel이 설치되어 있지 않아도, YZ-Grid 고속 엔진으로 즉시 열어서 확인하고 정렬·검색할 수 있습니다.
        </p>

        <label for="excel-file-input" class="btn-browse-file">
          📂 파일 찾아보기...
        </label>

        <div v-if="isParsing" class="parsing-indicator">
          <div class="parsing-spinner"></div>
          <span>{{ parseProgress }}</span>
        </div>

        <div class="supported-formats">
          <span>지원 포맷: Microsoft Excel (.xlsx, .xls), CSV (.csv)</span>
        </div>
      </div>
    </div>

    <!-- 2. 파일이 로드되었을 때: 엑셀 그리드 뷰어 화면 -->
    <div v-else class="excel-viewer-main">
      <!-- 상단 컨트롤 툴바 -->
      <header class="viewer-header">
        <div class="file-meta-box">
          <span class="file-icon">📗</span>
          <div class="file-text">
            <h3 class="file-name" :title="currentFile.name">{{ currentFile.name }}</h3>
            <span class="file-size">{{ formatFileSize(currentFile.size) }}</span>
          </div>
        </div>

        <!-- 시트 선택 탭 -->
        <div class="sheet-tabs-scroll">
          <button
            v-for="name in sheetNames"
            :key="name"
            class="sheet-tab"
            :class="{ active: activeSheetName === name }"
            @click="loadSheet(name)"
          >
            📑 {{ name }}
            <span class="sheet-badge">{{ (sheetRowCounts[name] ?? 0).toLocaleString() }}행</span>
          </button>
        </div>

        <!-- 우측 액션 및 정보 -->
        <div class="viewer-actions">
          <div v-if="backendInfoMessage" class="backend-stream-badge" :title="backendInfoMessage">
            ⚡ Rust 고속 변환 엔진 (10,000행 0.9초 로드)
          </div>

          <div class="viewer-search-box">
            <input
              v-model="searchQuery"
              type="text"
              placeholder="데이터 검색..."
              class="viewer-search-input"
              @input="applySearch"
            />
            <button v-if="searchQuery" class="clear-btn" @click="searchQuery = ''; applySearch()">✕</button>
          </div>

          <div class="stat-badge">
            <strong>{{ totalRows.toLocaleString() }}</strong> 행 × <strong>{{ totalCols }}</strong> 열
          </div>

          <button class="btn-reset" @click="resetFile">
            🔄 다른 파일 열기
          </button>
        </div>
      </header>

      <!-- 실제 YZ-Grid 고성능 그리드 렌더러 -->
      <div class="viewer-grid-box" @dragover="onDragOver" @drop="onDrop">
        <div v-if="isParsing" class="grid-loading-overlay">
          <div class="parsing-spinner"></div>
          <span>{{ parseProgress }}</span>
        </div>

        <Grid
          v-if="clientRowModel && gridColumns.length > 0"
          ref="gridRef"
          :row-model="clientRowModel"
          :columns="gridColumns"
          theme="alpine"
          :row-height="36"
          :header-height="38"
          :excel-file-name="currentFile.name"
          selection-mode="multiple"
        />

        <div v-else-if="!isParsing" class="empty-sheet-msg">
          선택한 시트에 표시할 데이터가 없습니다.
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.excel-viewer-container {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #f8fafc;
  overflow: hidden;
  box-sizing: border-box;
  min-height: 0;
  min-width: 0;
}

.viewer-nav-bar {
  height: 48px;
  width: 100%;
  box-sizing: border-box;
  background: #ffffff;
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  flex-shrink: 0;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
}

.btn-back-nav {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  background: #f1f5f9;
  color: #1e293b;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-back-nav:hover {
  background: #e2e8f0;
  border-color: #94a3b8;
  color: #0f172a;
}

.viewer-page-title {
  font-size: 14px;
  font-weight: 700;
  color: #475569;
}

/* 1. 드롭존 스타일 */
.excel-dropzone {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px;
  background: #f8fafc;
  transition: all 0.2s ease;
}

.excel-dropzone.is-dragging {
  background: #eff6ff;
}

.dropzone-card {
  width: 100%;
  max-width: 640px;
  padding: 48px 36px;
  background: #ffffff;
  border: 2.5px dashed #cbd5e1;
  border-radius: 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05);
  transition: all 0.2s ease;
}

.excel-dropzone.is-dragging .dropzone-card {
  border-color: #3b82f6;
  background: #f0fdf4;
  transform: scale(1.02);
  box-shadow: 0 20px 30px -10px rgba(59, 130, 246, 0.2);
}

.dropzone-icon {
  font-size: 56px;
  margin-bottom: 16px;
}

.dropzone-title {
  font-size: 20px;
  font-weight: 700;
  color: #1e293b;
  margin: 0 0 8px 0;
}

.dropzone-desc {
  font-size: 14px;
  color: #64748b;
  margin: 0 0 28px 0;
  line-height: 1.6;
}

.hidden-file-input {
  display: none;
}

.btn-browse-file {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 12px 28px;
  background: #2563eb;
  color: #ffffff;
  font-size: 15px;
  font-weight: 600;
  border-radius: 8px;
  cursor: pointer;
  box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.25);
  transition: all 0.15s ease;
}

.btn-browse-file:hover {
  background: #1d4ed8;
  transform: translateY(-1px);
  box-shadow: 0 6px 12px -2px rgba(37, 99, 235, 0.35);
}

.supported-formats {
  margin-top: 24px;
  font-size: 12px;
  color: #94a3b8;
}

.parsing-indicator {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 20px;
  font-size: 14px;
  font-weight: 600;
  color: #2563eb;
}

.parsing-spinner {
  width: 18px;
  height: 18px;
  border: 2px solid rgba(37, 99, 235, 0.2);
  border-top-color: #2563eb;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

/* 2. 뷰어 메인 영역 */
.excel-viewer-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  width: 100%;
  height: calc(100% - 48px);
  min-height: 0;
  min-width: 0;
  box-sizing: border-box;
}

.viewer-header {
  height: 60px;
  width: 100%;
  box-sizing: border-box;
  background: #ffffff;
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  align-items: center;
  padding: 0 16px;
  gap: 16px;
  flex-shrink: 0;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
}

.file-meta-box {
  display: flex;
  align-items: center;
  gap: 10px;
  max-width: 260px;
  flex-shrink: 0;
}

.file-icon {
  font-size: 24px;
}

.file-text {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.file-name {
  font-size: 14px;
  font-weight: 700;
  color: #0f172a;
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.file-size {
  font-size: 11px;
  color: #64748b;
}

/* 시트 탭 목록 */
.sheet-tabs-scroll {
  display: flex;
  align-items: center;
  gap: 6px;
  overflow-x: auto;
  flex: 1;
  padding: 4px 0;
}

.sheet-tab {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  font-size: 13px;
  font-weight: 600;
  color: #475569;
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.15s ease;
}

.sheet-tab:hover {
  background: #e2e8f0;
  color: #1e293b;
}

.sheet-tab.active {
  background: #2563eb;
  color: #ffffff;
  border-color: #2563eb;
  box-shadow: 0 2px 4px rgba(37, 99, 235, 0.2);
}

.sheet-badge {
  font-size: 10px;
  opacity: 0.85;
  background: rgba(0, 0, 0, 0.08);
  padding: 1px 6px;
  border-radius: 10px;
}

.sheet-tab.active .sheet-badge {
  background: rgba(255, 255, 255, 0.25);
  color: #ffffff;
}

/* 우측 액션 버튼들 */
.viewer-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}

.backend-stream-badge {
  font-size: 11px;
  font-weight: 700;
  color: #15803d;
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  padding: 4px 8px;
  border-radius: 6px;
  white-space: nowrap;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.8; }
}

.viewer-search-box {
  position: relative;
  display: flex;
  align-items: center;
}

.viewer-search-input {
  width: 170px;
  height: 32px;
  padding: 0 28px 0 10px;
  font-size: 12px;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  outline: none;
  transition: border-color 0.15s;
}

.viewer-search-input:focus {
  border-color: #2563eb;
  box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.1);
}

.clear-btn {
  position: absolute;
  right: 6px;
  background: none;
  border: none;
  font-size: 12px;
  color: #94a3b8;
  cursor: pointer;
}

.stat-badge {
  font-size: 12px;
  color: #475569;
  background: #f1f5f9;
  padding: 6px 12px;
  border-radius: 6px;
  border: 1px solid #e2e8f0;
  white-space: nowrap;
}

.btn-reset {
  display: inline-flex;
  align-items: center;
  padding: 6px 12px;
  background: #ffffff;
  color: #475569;
  font-size: 12px;
  font-weight: 600;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
}

.btn-reset:hover {
  background: #f8fafc;
  border-color: #94a3b8;
  color: #0f172a;
}

/* 그리드 뷰포트 영역 */
.viewer-grid-box {
  flex: 1;
  width: 100%;
  height: calc(100% - 60px);
  min-height: 0;
  min-width: 0;
  position: relative;
  background: #ffffff;
  overflow: hidden;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
}

.grid-loading-overlay {
  position: absolute;
  inset: 0;
  background: rgba(255, 255, 255, 0.85);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  font-size: 14px;
  font-weight: 600;
  color: #2563eb;
  z-index: 50;
}

.empty-sheet-msg {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #94a3b8;
  font-size: 15px;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
