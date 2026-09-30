use wasm_bindgen::prelude::*;

pub mod axis;
pub mod grid;
pub mod tree;
pub mod search;
pub mod columnar;

use axis::Axis;
use grid::Grid;
use tree::TreeVirtualizer;
use search::TextFilterIndex;
use columnar::ColumnarTable;

#[wasm_bindgen]
pub struct WasmAxis {
    inner: Axis,
    result_buffer: [f64; 4],
}

#[wasm_bindgen]
impl WasmAxis {
    #[wasm_bindgen(constructor)]
    pub fn new(count: usize, default_size: f64) -> Self {
        Self {
            inner: Axis::new(count, default_size),
            result_buffer: [0.0; 4],
        }
    }

    pub fn set_count(&mut self, count: usize) {
        self.inner.set_count(count);
    }

    pub fn set_item_size(&mut self, idx: usize, size: f64) {
        self.inner.set_item_size(idx, size);
    }

    pub fn total_size(&self) -> f64 {
        self.inner.total_size()
    }

    pub fn offset_of(&self, idx: usize) -> f64 {
        self.inner.offset_of(idx)
    }

    pub fn size_of(&self, idx: usize) -> f64 {
        self.inner.size_of(idx)
    }

    /// Compute visible range and return ptr to [start_idx, end_idx, start_offset, total_size]
    pub fn compute(&mut self, scroll: f64, viewport: f64, overscan: usize) -> *const f64 {
        let res = self.inner.compute_range(scroll, viewport, overscan);
        self.result_buffer[0] = res.start_index as f64;
        self.result_buffer[1] = res.end_index as f64;
        self.result_buffer[2] = res.start_offset;
        self.result_buffer[3] = res.total_size;
        self.result_buffer.as_ptr()
    }
}

#[wasm_bindgen]
pub struct WasmGrid {
    inner: Grid,
    result_buffer: [f64; 8],
}

#[wasm_bindgen]
impl WasmGrid {
    #[wasm_bindgen(constructor)]
    pub fn new(row_count: usize, col_count: usize, default_row_height: f64, default_col_width: f64) -> Self {
        Self {
            inner: Grid::new(row_count, col_count, default_row_height, default_col_width),
            result_buffer: [0.0; 8],
        }
    }

    pub fn set_dimensions(&mut self, row_count: usize, col_count: usize) {
        self.inner.set_dimensions(row_count, col_count);
    }

    pub fn set_row_height(&mut self, row_idx: usize, height: f64) {
        self.inner.set_row_height(row_idx, height);
    }

    pub fn set_col_width(&mut self, col_idx: usize, width: f64) {
        self.inner.set_col_width(col_idx, width);
    }

    pub fn set_pinned_cols(&mut self, start: usize, end: usize) {
        self.inner.set_pinned_cols(start, end);
    }

    pub fn set_pinned_rows(&mut self, start: usize, end: usize) {
        self.inner.set_pinned_rows(start, end);
    }

    pub fn total_width(&self) -> f64 {
        self.inner.cols.total_size()
    }

    pub fn total_height(&self) -> f64 {
        self.inner.rows.total_size()
    }

    pub fn row_offset_of(&self, row: usize) -> f64 {
        self.inner.rows.offset_of(row)
    }

    pub fn col_offset_of(&self, col: usize) -> f64 {
        self.inner.cols.offset_of(col)
    }

    pub fn row_size_of(&self, row: usize) -> f64 {
        self.inner.rows.size_of(row)
    }

    pub fn col_size_of(&self, col: usize) -> f64 {
        self.inner.cols.size_of(col)
    }

    /// Computes visible range for 2D Grid.
    /// Returns pointer to 8 f64 numbers:
    /// [row_start, row_end, row_offset, total_height, col_start, col_end, col_offset, total_width]
    pub fn compute_2d(
        &mut self,
        scroll_x: f64,
        scroll_y: f64,
        viewport_w: f64,
        viewport_h: f64,
        overscan_x: usize,
        overscan_y: usize,
    ) -> *const f64 {
        let res = self.inner.compute_2d(scroll_x, scroll_y, viewport_w, viewport_h, overscan_x, overscan_y);
        self.result_buffer[0] = res.row_range.start_index as f64;
        self.result_buffer[1] = res.row_range.end_index as f64;
        self.result_buffer[2] = res.row_range.start_offset;
        self.result_buffer[3] = res.row_range.total_size;

        self.result_buffer[4] = res.col_range.start_index as f64;
        self.result_buffer[5] = res.col_range.end_index as f64;
        self.result_buffer[6] = res.col_range.start_offset;
        self.result_buffer[7] = res.col_range.total_size;

        self.result_buffer.as_ptr()
    }
}

#[wasm_bindgen]
pub struct WasmTree {
    inner: TreeVirtualizer,
    result_buffer: [f64; 4],
}

#[wasm_bindgen]
impl WasmTree {
    #[wasm_bindgen(constructor)]
    pub fn new(default_item_height: f64) -> Self {
        Self {
            inner: TreeVirtualizer::new(default_item_height),
            result_buffer: [0.0; 4],
        }
    }

    pub fn add_node(&mut self, id: u32, parent_id: i32, label: String, is_expanded: bool) -> usize {
        let pid = if parent_id >= 0 { Some(parent_id as u32) } else { None };
        self.inner.add_node(id, pid, label, is_expanded)
    }

    pub fn finish_build(&mut self) {
        self.inner.rebuild_visible_list();
    }

    pub fn clear(&mut self) {
        self.inner.clear();
    }

    pub fn toggle_expand(&mut self, id: u32) -> bool {
        self.inner.toggle_expand(id)
    }

    pub fn expand_all(&mut self) {
        self.inner.expand_all();
    }

    pub fn collapse_all(&mut self) {
        self.inner.collapse_all();
    }

    pub fn set_filter(&mut self, query: &str) {
        self.inner.set_filter(query);
    }

    pub fn visible_count(&self) -> usize {
        self.inner.get_visible_count()
    }

    pub fn total_size(&self) -> f64 {
        self.inner.axis.total_size()
    }

    pub fn compute(&mut self, scroll: f64, viewport: f64, overscan: usize) -> *const f64 {
        let res = self.inner.compute_range(scroll, viewport, overscan);
        self.result_buffer[0] = res.start_index as f64;
        self.result_buffer[1] = res.end_index as f64;
        self.result_buffer[2] = res.start_offset;
        self.result_buffer[3] = res.total_size;
        self.result_buffer.as_ptr()
    }

    pub fn get_visible_node_id(&self, flat_idx: usize) -> u32 {
        if flat_idx < self.inner.visible_indices.len() {
            let actual_idx = self.inner.visible_indices[flat_idx];
            self.inner.nodes[actual_idx].id
        } else {
            0
        }
    }

    pub fn get_visible_node_depth(&self, flat_idx: usize) -> u16 {
        if flat_idx < self.inner.visible_indices.len() {
            let actual_idx = self.inner.visible_indices[flat_idx];
            self.inner.nodes[actual_idx].depth
        } else {
            0
        }
    }

    pub fn get_visible_node_expanded(&self, flat_idx: usize) -> bool {
        if flat_idx < self.inner.visible_indices.len() {
            let actual_idx = self.inner.visible_indices[flat_idx];
            self.inner.nodes[actual_idx].is_expanded
        } else {
            false
        }
    }

    pub fn get_visible_node_has_children(&self, flat_idx: usize) -> bool {
        if flat_idx < self.inner.visible_indices.len() {
            let actual_idx = self.inner.visible_indices[flat_idx];
            self.inner.nodes[actual_idx].has_children
        } else {
            false
        }
    }

    pub fn get_visible_node_label(&self, flat_idx: usize) -> String {
        if flat_idx < self.inner.visible_indices.len() {
            let actual_idx = self.inner.visible_indices[flat_idx];
            self.inner.nodes[actual_idx].label.clone()
        } else {
            String::new()
        }
    }
}

#[wasm_bindgen]
pub struct WasmSelectFilter {
    inner: TextFilterIndex,
    result_buffer: [f64; 4],
}

#[wasm_bindgen]
impl WasmSelectFilter {
    #[wasm_bindgen(constructor)]
    pub fn new(default_item_height: f64) -> Self {
        Self {
            inner: TextFilterIndex::new(default_item_height),
            result_buffer: [0.0; 4],
        }
    }

    pub fn add_item(&mut self, text: String) {
        self.inner.add_item(text);
    }

    pub fn filter(&mut self, query: &str) {
        self.inner.filter(query);
    }

    pub fn filtered_count(&self) -> usize {
        self.inner.filtered_count()
    }

    pub fn total_size(&self) -> f64 {
        self.inner.axis.total_size()
    }

    pub fn compute(&mut self, scroll: f64, viewport: f64, overscan: usize) -> *const f64 {
        let res = self.inner.compute_range(scroll, viewport, overscan);
        self.result_buffer[0] = res.start_index as f64;
        self.result_buffer[1] = res.end_index as f64;
        self.result_buffer[2] = res.start_offset;
        self.result_buffer[3] = res.total_size;
        self.result_buffer.as_ptr()
    }

    pub fn get_filtered_original_index(&self, flat_idx: usize) -> u32 {
        if flat_idx < self.inner.filtered_indices.len() {
            self.inner.filtered_indices[flat_idx]
        } else {
            0
        }
    }

    pub fn get_original_item(&self, original_idx: usize) -> String {
        if original_idx < self.inner.original_items.len() {
            self.inner.original_items[original_idx].clone()
        } else {
            String::new()
        }
    }

    pub fn get_filtered_indices_ptr(&self) -> *const u32 {
        self.inner.filtered_indices.as_ptr()
    }
}

#[wasm_bindgen]
pub struct WasmColumnarTable {
    inner: ColumnarTable,
    result_buffer_2d: [f64; 8],
}

#[wasm_bindgen]
impl WasmColumnarTable {
    #[wasm_bindgen(constructor)]
    pub fn new(row_height: f64, col_width: f64) -> Self {
        Self {
            inner: ColumnarTable::new(row_height, col_width),
            result_buffer_2d: [0.0; 8],
        }
    }

    pub fn set_dimensions(&mut self, row_count: usize, col_count: usize) {
        self.inner.row_count = row_count;
        self.inner.total_col_count = col_count;
        self.inner.grid.set_dimensions(row_count, col_count);
        self.inner.reset_filter();
    }

    pub fn set_pinned_cols(&mut self, start: usize, end: usize) {
        self.inner.set_pinned_cols(start, end);
    }

    pub fn set_col_width(&mut self, col_idx: usize, width: f64) {
        self.inner.set_col_width(col_idx, width);
    }

    pub fn set_row_height(&mut self, row_idx: usize, height: f64) {
        self.inner.set_row_height(row_idx, height);
    }

    pub fn populate_2d_benchmark(&mut self, row_count: usize, col_count: usize) {
        self.inner.populate_2d_benchmark(row_count, col_count);
    }

    pub fn populate_benchmark(&mut self, count: usize) {
        self.inner.populate_benchmark(count);
    }

    pub fn total_width(&self) -> f64 {
        self.inner.total_width()
    }

    pub fn total_height(&self) -> f64 {
        self.inner.total_height()
    }

    pub fn compute_2d(
        &mut self,
        scroll_x: f64,
        scroll_y: f64,
        viewport_w: f64,
        viewport_h: f64,
        overscan_x: usize,
        overscan_y: usize,
    ) -> *const f64 {
        let res = self.inner.grid.compute_2d(scroll_x, scroll_y, viewport_w, viewport_h, overscan_x, overscan_y);
        self.result_buffer_2d[0] = res.row_range.start_index as f64;
        self.result_buffer_2d[1] = res.row_range.end_index as f64;
        self.result_buffer_2d[2] = res.row_range.start_offset;
        self.result_buffer_2d[3] = res.row_range.total_size;

        self.result_buffer_2d[4] = res.col_range.start_index as f64;
        self.result_buffer_2d[5] = res.col_range.end_index as f64;
        self.result_buffer_2d[6] = res.col_range.start_offset;
        self.result_buffer_2d[7] = res.col_range.total_size;

        self.result_buffer_2d.as_ptr()
    }

    pub fn get_cell_value(&self, filtered_row_idx: usize, col_idx: usize) -> String {
        self.inner.get_cell_value(filtered_row_idx, col_idx)
    }

    pub fn column_count(&self) -> usize {
        self.inner.column_count()
    }

    pub fn column_name(&self, idx: usize) -> String {
        self.inner.column_name(idx)
    }

    pub fn column_type(&self, idx: usize) -> String {
        self.inner.column_type(idx)
    }

    pub fn filter_column(&mut self, col_idx: usize, query: &str) {
        self.inner.filter_column(col_idx, query);
    }

    pub fn sort_by_column(&mut self, col_idx: usize, ascending: bool) {
        self.inner.sort_by_column(col_idx, ascending);
    }

    pub fn filter_dict_column(&mut self, col_idx: usize, query: &str) {
        self.inner.filter_dict_column(col_idx, query);
    }

    pub fn filter_number_range(&mut self, col_idx: usize, min_val: f64, max_val: f64) {
        self.inner.filter_number_range(col_idx, min_val, max_val);
    }

    pub fn reset_filter(&mut self) {
        self.inner.reset_filter();
    }

    pub fn filtered_count(&self) -> usize {
        self.inner.filtered_count()
    }

    pub fn total_count(&self) -> usize {
        self.inner.row_count
    }

    pub fn get_filtered_row_index(&self, filtered_row_idx: usize) -> u32 {
        self.inner.get_filtered_row(filtered_row_idx)
    }

    pub fn get_row_json(&self, filtered_row_idx: usize) -> String {
        self.inner.get_row_json(filtered_row_idx)
    }
}
