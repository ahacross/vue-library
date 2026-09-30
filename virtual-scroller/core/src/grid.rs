use crate::axis::{Axis, RangeResult};

/// 2D Grid Virtualizer (Row Axis + Column Axis + Pinning/Sticky)
#[derive(Clone, Debug)]
pub struct Grid {
    pub rows: Axis,
    pub cols: Axis,
    pub pinned_start_cols: usize,
    pub pinned_end_cols: usize,
    pub pinned_start_rows: usize,
    pub pinned_end_rows: usize,
}

#[derive(Copy, Clone, Debug)]
pub struct GridRangeResult {
    pub row_range: RangeResult,
    pub col_range: RangeResult,
}

impl Grid {
    pub fn new(row_count: usize, col_count: usize, default_row_height: f64, default_col_width: f64) -> Self {
        Self {
            rows: Axis::new(row_count, default_row_height),
            cols: Axis::new(col_count, default_col_width),
            pinned_start_cols: 0,
            pinned_end_cols: 0,
            pinned_start_rows: 0,
            pinned_end_rows: 0,
        }
    }

    pub fn set_dimensions(&mut self, row_count: usize, col_count: usize) {
        self.rows.set_count(row_count);
        self.cols.set_count(col_count);
    }

    pub fn set_row_height(&mut self, row_idx: usize, height: f64) {
        self.rows.set_item_size(row_idx, height);
    }

    pub fn set_col_width(&mut self, col_idx: usize, width: f64) {
        self.cols.set_item_size(col_idx, width);
    }

    pub fn set_pinned_cols(&mut self, start: usize, end: usize) {
        self.pinned_start_cols = start;
        self.pinned_end_cols = end;
    }

    pub fn set_pinned_rows(&mut self, start: usize, end: usize) {
        self.pinned_start_rows = start;
        self.pinned_end_rows = end;
    }

    pub fn compute_2d(
        &self,
        scroll_x: f64,
        scroll_y: f64,
        viewport_w: f64,
        viewport_h: f64,
        overscan_x: usize,
        overscan_y: usize,
    ) -> GridRangeResult {
        let row_range = self.rows.compute_range(scroll_y, viewport_h, overscan_y);
        let col_range = self.cols.compute_range(scroll_x, viewport_w, overscan_x);

        GridRangeResult {
            row_range,
            col_range,
        }
    }
}
