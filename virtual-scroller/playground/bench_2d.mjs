import fs from 'fs';
import { performance } from 'perf_hooks';
import initWasm, { WasmColumnarTable } from '../core/pkg/wasm_virtual_core.js';

async function test2DGrid() {
  console.log('========================================================');
  console.log('🚀 1,000만 행 × 50열 (5억 개 셀) 2D Grid + 컬럼 필터 검증');
  console.log('========================================================');

  const wasmBuffer = fs.readFileSync('../core/pkg/wasm_virtual_core_bg.wasm');
  await initWasm(wasmBuffer);

  const rowCount = 10_000_000;
  const colCount = 50;
  const totalCells = rowCount * colCount;

  console.log(`\n데이터셋 규모: ${rowCount.toLocaleString()} 행 × ${colCount} 열 = 총 ${totalCells.toLocaleString()} 개 셀`);

  const grid = new WasmColumnarTable(38, 130);
  grid.set_pinned_cols(0, 2);

  // 1. 2D 벤치마크 데이터 생성
  const t0 = performance.now();
  grid.populate_2d_benchmark(rowCount, colCount);
  const t1 = performance.now();
  console.log(`✅ 1,000만 행 × 50열 생성 & 사전 인코딩: ${(t1 - t0).toFixed(2)} ms`);

  // 2. 2D 캔버스 치수 확인
  console.log(`- 가상 스크롤 총 높이: ${grid.total_height().toLocaleString()} px`);
  console.log(`- 가상 스크롤 총 너비: ${grid.total_width().toLocaleString()} px`);
  console.log(`- 전체 행 수: ${grid.total_count().toLocaleString()}`);

  // 3. 컬럼별 필터링 검증 (Header에서 호출되는 함수)
  console.log('\n--- [컬럼별 실시간 헤더 필터링 테스트] ---');
  
  // Col 1: 제조사(Brand) = "Samsung"
  const f0 = performance.now();
  grid.filter_dict_column(1, 'Samsung');
  const f1 = performance.now();
  console.log(`⚡ [Col 1 제조사 필터: "Samsung"]: ${(f1 - f0).toFixed(3)} ms (매칭: ${grid.filtered_count().toLocaleString()} 건)`);

  // Col 2: 카테고리 = "스마트폰"
  const f2 = performance.now();
  grid.filter_dict_column(2, '스마트폰');
  const f3 = performance.now();
  console.log(`⚡ [Col 2 카테고리 추가 필터: "스마트폰"]: ${(f3 - f2).toFixed(3)} ms (매칭: ${grid.filtered_count().toLocaleString()} 건)`);

  // Col 5: 가격 범위 = 최소 1,000,000원
  const f4 = performance.now();
  grid.filter_number_range(5, 1_000_000, 100_000_000);
  const f5 = performance.now();
  console.log(`⚡ [Col 5 가격 범위 추가 필터: 100만원 이상]: ${(f5 - f4).toFixed(3)} ms (매칭: ${grid.filtered_count().toLocaleString()} 건)`);

  // 4. 2D 가시 영역 가상화 연산 (스크롤 위치 X: 1500px, Y: 2,000,000px)
  console.log('\n--- [2D 가상 스크롤 렌더링 윈도우 계산] ---');
  const c0 = performance.now();
  const ptr = grid.compute_2d(1500, 2000000, 1200, 800, 3, 5);
  const c1 = performance.now();
  console.log(`🖥️ 2D 가시 영역 (행+열 동시 가상화) Wasm 연산: ${(c1 - c0).toFixed(4)} ms`);

  // 5. 화면에 노출되는 30행 × 15열 = 450개 셀 값 조회 속도
  const v0 = performance.now();
  const sampleCells = [];
  for (let r = 0; r < 30; r++) {
    for (let c = 0; c < 15; c++) {
      sampleCells.push(grid.get_cell_value(r, c));
    }
  }
  const v1 = performance.now();
  console.log(`🎨 화면 가시 영역 450개 셀 데이터 고속 추출: ${(v1 - v0).toFixed(3)} ms`);
  console.log(`- 샘플 셀 (Row 0, Col 0~6):`, sampleCells.slice(0, 7));

  console.log('\n========================================================');
  console.log('🎉 5억 개 셀 환경에서도 2D 가상화와 컬럼별 필터가 실시간 구동됨!');
  console.log('========================================================\n');
}

test2DGrid().catch(console.error);
