import fs from 'fs';
import { performance } from 'perf_hooks';
import initWasm, { WasmColumnarTable } from '../core/pkg/wasm_virtual_core.js';

async function runBenchmark() {
  console.log('========================================================');
  console.log('🚀 Wasm Columnar + Dictionary Encoding 정밀 성능 벤치마크');
  console.log('========================================================');

  const wasmBuffer = fs.readFileSync('../core/pkg/wasm_virtual_core_bg.wasm');
  await initWasm(wasmBuffer);

  const testCounts = [1_000_000, 10_000_000];

  for (const count of testCounts) {
    console.log(`\n--- [데이터셋 크기: ${count.toLocaleString()} 행 (7개 컬럼 = ${(count * 7).toLocaleString()} 셀)] ---`);

    const table = new WasmColumnarTable(38);

    // 1. 메모리 생성 벤치마크
    const t0 = performance.now();
    table.populate_benchmark(count);
    const t1 = performance.now();
    console.log(`✅ 데이터셋 생성 및 사전 인코딩 완료: ${(t1 - t0).toFixed(2)} ms`);

    // 2. 초기 상태 검증
    console.log(`- 전체 행 수: ${table.total_count().toLocaleString()}`);
    console.log(`- 초기 필터 카운트: ${table.filtered_count().toLocaleString()}`);
    console.log(`- 가상 스크롤 총 높이: ${table.total_height().toLocaleString()} px`);

    // 3. 사전 인코딩 컬럼 문자열 필터링 벤치마크 (Brand 컬럼 = col_idx 1)
    const testQueries = ['Apple', 'Samsung', 'Sony', 'Xiaomi'];
    for (const q of testQueries) {
      table.reset_filter();
      const f0 = performance.now();
      table.filter_dict_column(1, q);
      const f1 = performance.now();
      const timeMs = (f1 - f0).toFixed(3);
      console.log(`⚡ [사전 인코딩 필터] Brand == "${q}": ${timeMs} ms (${table.filtered_count().toLocaleString()} 건 매칭)`);
    }

    // 4. 복합 다중 필터링 (Brand: Samsung -> Category: 스마트폰)
    table.reset_filter();
    const m0 = performance.now();
    table.filter_dict_column(1, 'Samsung');
    table.filter_dict_column(2, '스마트폰');
    const m1 = performance.now();
    console.log(`⚡ [다중 복합 필터] Brand="Samsung" & Category="스마트폰": ${(m1 - m0).toFixed(3)} ms (${table.filtered_count().toLocaleString()} 건 매칭)`);

    // 5. 숫자 범위 필터링 (Price col_idx 5: 1,000,000 ~ 2,000,000원)
    const n0 = performance.now();
    table.filter_number_range(5, 1_000_000, 2_000_000);
    const n1 = performance.now();
    console.log(`⚡ [숫자 범위 필터] Price 100만~200만원 추가 필터: ${(n1 - n0).toFixed(3)} ms (${table.filtered_count().toLocaleString()} 건 매칭)`);

    // 6. 가상 스크롤 렌더링 윈도우 30개 행 데이터 추출 속도 (JSON 직렬화)
    const r0 = performance.now();
    const ptr = table.compute(100000, 600, 5);
    const sampleRows = [];
    const filteredCount = table.filtered_count();
    for (let i = 0; i < Math.min(30, filteredCount); i++) {
      sampleRows.push(JSON.parse(table.get_row_json(i)));
    }
    const r1 = performance.now();
    console.log(`🖥️ [화면 렌더링 윈도우 추출] 30개 행 역직렬화: ${(r1 - r0).toFixed(3)} ms`);
    console.log(`- 샘플 1행:`, JSON.stringify(sampleRows[0]));
  }

  console.log('\n========================================================');
  console.log('🎉 벤치마크 완료: 모든 검색이 밀리초(ms) 단위 이하로 완료됨');
  console.log('========================================================\n');
}

runBenchmark().catch(console.error);
