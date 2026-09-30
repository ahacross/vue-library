# Vue Library Collection

Vue 3 기반의 고성능 엔터프라이즈 프론트엔드 라이브러리 모음입니다.

## 1. `tree` (`vue-arborist`)
- Vue 3를 위한 드래그앤드롭 고성능 트리 컴포넌트 라이브러리

## 2. `grid` (`vue-hyper-grid`)
- **ag-Grid 대체 가능 초고성능 Vue 3 데이터 그리드**
- **10,000,000건(천만 행) 이상 대용량 데이터 60FPS 완벽 지원**
- **4대 핵심 기술**:
  - **TypedArray Columnar Storage (SoA)**: 원시 메모리 버퍼로 객체 메모리 95% 이상 절감 (10M건 기준 150MB 수준)
  - **String Dictionary Encoding**: 반복 문자열 사전 압축으로 V8 가비지 컬렉터(GC) 부하 제로화
  - **Web Worker 분리 & Index Sort**: 메인 스레드 멈춤 없이 100만/1,000만 행 즉시 인덱스 정렬 및 필터링
  - **VirtualScrollScale 엔진**: Chrome 등 브라우저의 33.5Mpx DOM 높이 한계를 극복하는 스케일링 가상 스크롤러
- **ag-Grid 주요 기능 지원**:
  - 좌/우 컬럼 고정 (Pinned / Freeze Columns)
  - 컬럼 드래그 너비 조절 (Column Resize)
  - 다중 정렬 (Multi-sort) 및 필터
  - 행 선택 (Single / Multi / Range Select, 체크박스)
  - 셀 커스텀 슬롯 렌더링
  - SSRM (Server-Side Row Model) 원격 스트리밍 모드 지원
  - 실시간 성능 벤치마크 HUD (FPS, 렌더링 타임, RAM 사용량)

## 3. `virtual-scroller` (`wasm-virtual-scroller`)
- **Rust + WebAssembly 기반 초경량(54KB) 고성능 범용 가상 스크롤 라이브러리**
- **1,000,000건(100만 건) 가상화 60FPS 완벽 지원**
- **주요 특징**:
  - **2D Grid**: 행과 열 동시 가상 스크롤 + 틀고정(Sticky Pinning)
  - **Tree Virtualizer**: 계층형 트리 평탄화 + 검색 시 상위 부모 경로 자동 펼침(Auto-expand)
  - **Select Virtualizer**: 100만 개 옵션 Wasm 바이트 스캔으로 인풋 렉 없는 실시간 검색
  - **Zero-Copy Architecture**: Wasm 선형 메모리 TypedArray 직독으로 FFI 복사 비용 제로화
  - **Vue 3 자동 디렉티브(`v-virtual-scroll`) 및 컴포넌트(`VirtualGrid`, `VirtualTree`, `VirtualSelect`) 기본 제공**
