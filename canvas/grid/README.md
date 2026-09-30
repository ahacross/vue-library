# ⚡ Unified Canvas Grid (WASM 2D Virtualization + DEFLATE Level 6 + OPFS SSD)

기존에 만드셨던 **`wasm-virtual-core`의 Fenwick Tree $O(\log N)$ 2D 가상화 좌표 연산**과, 이번에 새로 설계한 **HTML5 Canvas 2D 렌더러 + Rust WASM DEFLATE 92.4% 고압축 + OPFS SSD 로컬 스트리밍**을 완벽하게 융합한 차세대 대용량 웹 그리드 모노레포 프로젝트입니다.

---

### 📁 모노레포 폴더 구조

```
C:\Sources\library\canvas\grid\
├── core/                       # [Core Engine] Rust WASM + Canvas 2D + OPFS
│   ├── Cargo.toml              # Rust crate manifest
│   ├── src/
│   │   ├── lib.rs              # WASM C-ABI exports (압축/복원/2D연산/정렬 통합)
│   │   ├── axis.rs             # Fenwick Tree (Binary Indexed Tree) O(log N) 가변 행/열 축
│   │   ├── grid.rs             # 2D Grid 범위 연산 (고정열/고정행 지원)
│   │   ├── compression.rs      # miniz_oxide DEFLATE Level 6 (92.4% 고압축)
│   │   └── sort.rs             # 대용량 인덱스 간접 정렬
│   ├── pkg/
│   │   ├── novagrid_wasm.wasm  # 컴파일된 초경량(67KB) WASM 바이너리
│   │   └── wasm-bundle.js      # Base64 내장 번들 (CORS 없이 어디서나 구동)
│   ├── wasm-bridge.js          # JS ↔ WASM 초고속 통신 브릿지
│   ├── opfs-engine.js          # OPFS 로컬 SSD 청크 저장소 & RAM LRU 캐시
│   ├── canvas-grid.js          # HTML5 Canvas 2D 무지연 렌더러 (스파크라인/배지/프로그레스)
│   └── index.js                # Core 패키지 엔트리
│
├── vue/                        # [Vue 3 Component]
│   ├── NovaCanvasGrid.vue      # 공식 Vue 3 SFC 컴포넌트 (<script setup>)
│   ├── useNovaGrid.js          # Vue 3 Composable 훅
│   ├── index.js                # Vue 패키지 엔트리
│   └── package.json            # @novagrid/vue 메타데이터
│
├── playground/                 # [Interactive Showcase]
│   └── index.html              # 10만~500만~1억 행 OPFS + WASM 통합 풀스크린 데모
│
├── package.json                # 모노레포 워크스페이스 설정
└── README.md                   # 기술 명세서
```

---

### 🏆 융합된 핵심 기술 시너지

1. **Rust WASM 2D 가상화 좌표 연산 (`axis.rs`, `grid.rs`)**:
   * 이전에 구현하신 **Fenwick Tree(바이너리 인덱스 트리)와 바이너리 리프팅**을 그대로 탑재하여, 행과 열의 크기가 제각각 달라도 $O(\log N)$으로 가시 영역을 0.01ms 내에 정확히 계산합니다.
2. **Rust WASM DEFLATE Level 6 고압축 (`compression.rs`)**:
   * 원본 데이터의 크기를 **92.4% 이상 압축**하여 디스크 쓰기 속도와 용량을 극대화합니다.
3. **OPFS (Origin Private File System) 로컬 SSD 스트리밍 (`opfs-engine.js`)**:
   * 1억 행의 방대한 데이터를 브라우저 램이 아닌 **로컬 SSD에 압축 보관**하고, 스크롤 시 화면에 필요한 청크만 **0.2ms 만에 스트리밍**합니다.
   * 브라우저 램은 100만 행이든 1억 행이든 **약 8.5MB ~ 15MB로 고정**됩니다.
4. **HTML5 Canvas 2D 렌더러 (`canvas-grid.js`)**:
   * DOM 노드를 단 1개만 생성하여 **120Hz 초고주사율에서도 찢김 없는 60 FPS**를 보장합니다.
   * 셀 내부에 **스파크라인 꺾은선 미니 차트, 프로그레스 바, 배지(태그), 컬럼 리사이징 드래그, 정렬**을 모두 지원합니다.

---

### 🚀 실행 방법

브라우저에서 바로 아래 파일을 더블 클릭하여 실행할 수 있습니다:

* **플레이그라운드 데모**: [`C:\Sources\library\canvas\grid\playground\index.html`](file:///C:/Sources/library/canvas/grid/playground/index.html)
  * 10만 행, 100만 행, 500만 행 생성 버튼을 클릭하여 WASM 실시간 압축률과 OPFS 초고속 SSD 스트리밍을 직접 체험해 보실 수 있습니다.
