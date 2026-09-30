pub mod axis;
pub mod grid;
pub mod compression;
pub mod sort;

use std::sync::Mutex;
use grid::Grid;
use compression::Compressor;
use sort::IndirectSorter;

static BUFFER: Mutex<Vec<u8>> = Mutex::new(Vec::new());
static GRID_INSTANCE: Mutex<Option<Grid>> = Mutex::new(None);
static RESULT_BUFFER: Mutex<[f64; 8]> = Mutex::new([0.0; 8]);

// ==========================================
// 1. WASM 고압축 & 초고속 복원 인터페이스
// ==========================================

#[no_mangle]
pub extern "C" fn prepare_input(len: usize) -> *mut u8 {
    let mut buf = BUFFER.lock().unwrap();
    buf.clear();
    buf.resize(len, 0);
    buf.as_mut_ptr()
}

#[no_mangle]
pub extern "C" fn compress(level: u8) -> *const u8 {
    let mut buf = BUFFER.lock().unwrap();
    let compressed = Compressor::compress(&buf, level);
    *buf = compressed;
    buf.as_ptr()
}

#[no_mangle]
pub extern "C" fn decompress() -> *const u8 {
    let mut buf = BUFFER.lock().unwrap();
    if let Some(decompressed) = Compressor::decompress(&buf) {
        *buf = decompressed;
        buf.as_ptr()
    } else {
        buf.clear();
        std::ptr::null()
    }
}

#[no_mangle]
pub extern "C" fn get_len() -> usize {
    let buf = BUFFER.lock().unwrap();
    buf.len()
}

// ==========================================
// 2. 2D 가상화 좌표 연산 인터페이스 (Fenwick O(log N))
// ==========================================

#[no_mangle]
pub extern "C" fn grid_init(row_count: usize, col_count: usize, default_row_h: f64, default_col_w: f64) {
    let mut g = GRID_INSTANCE.lock().unwrap();
    *g = Some(Grid::new(row_count, col_count, default_row_h, default_col_w));
}

#[no_mangle]
pub extern "C" fn grid_set_dimensions(row_count: usize, col_count: usize) {
    let mut g = GRID_INSTANCE.lock().unwrap();
    if let Some(ref mut grid) = *g {
        grid.set_dimensions(row_count, col_count);
    }
}

#[no_mangle]
pub extern "C" fn grid_set_row_height(row_idx: usize, height: f64) {
    let mut g = GRID_INSTANCE.lock().unwrap();
    if let Some(ref mut grid) = *g {
        grid.set_row_height(row_idx, height);
    }
}

#[no_mangle]
pub extern "C" fn grid_set_col_width(col_idx: usize, width: f64) {
    let mut g = GRID_INSTANCE.lock().unwrap();
    if let Some(ref mut grid) = *g {
        grid.set_col_width(col_idx, width);
    }
}

#[no_mangle]
pub extern "C" fn grid_set_pinned_cols(start: usize, end: usize) {
    let mut g = GRID_INSTANCE.lock().unwrap();
    if let Some(ref mut grid) = *g {
        grid.set_pinned_cols(start, end);
    }
}

/// 2D 가시 영역 초고속 계산 (이진 탐색)
/// 반환: [row_start, row_end, row_offset, total_height, col_start, col_end, col_offset, total_width]
#[no_mangle]
pub extern "C" fn grid_compute_2d(
    scroll_x: f64,
    scroll_y: f64,
    viewport_w: f64,
    viewport_h: f64,
    overscan_x: usize,
    overscan_y: usize,
) -> *const f64 {
    let g = GRID_INSTANCE.lock().unwrap();
    let mut res_buf = RESULT_BUFFER.lock().unwrap();

    if let Some(ref grid) = *g {
        let res = grid.compute_2d(scroll_x, scroll_y, viewport_w, viewport_h, overscan_x, overscan_y);
        res_buf[0] = res.row_range.start_index as f64;
        res_buf[1] = res.row_range.end_index as f64;
        res_buf[2] = res.row_range.start_offset;
        res_buf[3] = res.row_range.total_size;

        res_buf[4] = res.col_range.start_index as f64;
        res_buf[5] = res.col_range.end_index as f64;
        res_buf[6] = res.col_range.start_offset;
        res_buf[7] = res.col_range.total_size;
    }

    res_buf.as_ptr()
}

// ==========================================
// 3. 인덱스 초고속 간접 정렬 인터페이스
// ==========================================

#[no_mangle]
pub unsafe extern "C" fn sort_indices_f64(
    indices_ptr: *mut u32,
    values_ptr: *const f64,
    len: usize,
    ascending: bool,
) {
    if indices_ptr.is_null() || values_ptr.is_null() || len == 0 {
        return;
    }
    let indices = std::slice::from_raw_parts_mut(indices_ptr, len);
    let values = std::slice::from_raw_parts(values_ptr, len);
    IndirectSorter::sort_indices_f64(indices, values, ascending);
}
