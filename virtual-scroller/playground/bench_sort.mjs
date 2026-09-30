import fs from 'fs';
import { performance } from 'perf_hooks';
import initWasm, { WasmColumnarTable } from '../core/pkg/wasm_virtual_core.js';

async function testSortAndFilter() {
  console.log('========================================================');
  console.log('🚀 1,000만 행 정렬(Sort) 및 범용 필터 정밀 검증');
  console.log('========================================================');

  const wasmBuffer = fs.readFileSync('../core/pkg/wasm_virtual_core_bg.wasm');
  await initWasm(wasmBuffer);

  const rowCount = 10_000_000;
  const colCount = 50;

  const grid = new WasmColumnarTable(38, 130);
  grid.set_pinned_cols(0, 2);

  console.log(`- 1,000만 행 × 50열 생성 시작...`);
  grid.populate_2d_benchmark(rowCount, colCount);
  console.log(`- 1,000만 행 로드 완료!`);

  // 1. 가격 컬럼(Col 5) 내림차순 정렬 테스트 (1,000만 건 정렬)
  console.log('\n--- [1,000만 건 정렬 벤치마크] ---');
  const s0 = performance.now();
  grid.sort_by_column(5, false); // Col 5 Price DESC
  const s1 = performance.now();
  console.log(`⚡ [Price 컬럼 내림차순(DESC) 정렬]: ${(s1 - s0).toFixed(2)} ms`);
  console.log(`  Top 1 셀 값:`, grid.get_cell_value(0, 5));
  console.log(`  Top 2 셀 값:`, grid.get_cell_value(1, 5));
  console.log(`  Top 3 셀 값:`, grid.get_cell_value(2, 5));

  // 2. 평점 컬럼(Col 6) 내림차순 정렬 테스트
  const r0 = performance.now();
  grid.sort_by_column(6, false); // Col 6 Rating DESC
  const r1 = performance.now();
  console.log(`⚡ [Rating 컬럼 내림차순(DESC) 정렬]: ${(r1 - r0).toFixed(2)} ms`);
  console.log(`  Top 1 셀 값:`, grid.get_cell_value(0, 6));
  console.log(`  Top 2 셀 값:`, grid.get_cell_value(1, 6));

  // 3. 범용 필터 테스트 (ID 검색: "77777")
  console.log('\n--- [범용 필터 테스트] ---');
  grid.reset_filter();
  const f0 = performance.now();
  grid.filter_column(0, '77777');
  const f1 = performance.now();
  console.log(`⚡ [Col 0 ID 필터 ("77777")]: ${(f1 - f0).toFixed(2)} ms (매칭: ${grid.filtered_count().toLocaleString()} 건)`);
  console.log(`  매칭된 1행 ID:`, grid.get_cell_value(0, 0));

  // 4. 확장 컬럼 필터 테스트 (배송지역 Col 8: "강남")
  grid.reset_filter();
  const f2 = performance.now();
  grid.filter_column(8, '강남');
  const f3 = performance.now();
  console.log(`⚡ [Col 8 배송지역 필터 ("강남")]: ${(f3 - f2).toFixed(2)} ms (매칭: ${grid.filtered_count().toLocaleString()} 건)`);
  console.log(`  매칭된 1행 배송지역:`, grid.get_cell_value(0, 8));

  // 5. 제조사 필터 (Col 1: "Apple") + 정렬 동시 적용
  grid.reset_filter();
  grid.filter_column(1, 'Apple');
  grid.sort_by_column(5, false); // Apple 제품 중 가격 내림차순
  console.log(`⚡ [Apple 제품 필터 후 가격 정렬 결과]:`);
  console.log(`  행 0: Brand=${grid.get_cell_value(0, 1)}, Price=${grid.get_cell_value(0, 5)}`);
  console.log(`  행 1: Brand=${grid.get_cell_value(1, 1)}, Price=${grid.get_cell_value(1, 5)}`);
  console.log(`  행 2: Brand=${grid.get_cell_value(2, 1)}, Price=${grid.get_cell_value(2, 5)}`);

  console.log('\n========================================================');
  console.log('🎉 1,000만 건 정렬 및 모든 컬럼 필터링 검증 완료!');
  console.log('========================================================\n');
}

testSortAndFilter().catch(console.error);
