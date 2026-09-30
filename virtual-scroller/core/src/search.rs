use crate::axis::{Axis, RangeResult};

/// High-performance in-memory string indexer & filter for List, Select, and Grid
#[derive(Clone, Debug)]
pub struct TextFilterIndex {
    /// Contiguous buffer of items (lowercased for instant match)
    pub lower_items: Vec<String>,
    pub original_items: Vec<String>,
    pub filtered_indices: Vec<u32>,
    pub axis: Axis,
}

impl TextFilterIndex {
    pub fn new(default_item_height: f64) -> Self {
        Self {
            lower_items: Vec::new(),
            original_items: Vec::new(),
            filtered_indices: Vec::new(),
            axis: Axis::new(0, default_item_height),
        }
    }

    /// Load or replace items
    pub fn set_items(&mut self, items: Vec<String>) {
        self.original_items = items;
        self.lower_items = self.original_items.iter().map(|s| s.to_lowercase()).collect();
        self.reset_filter();
    }

    pub fn add_item(&mut self, item: String) {
        self.lower_items.push(item.to_lowercase());
        self.original_items.push(item);
        self.filtered_indices.push((self.original_items.len() - 1) as u32);
        self.axis.set_count(self.filtered_indices.len());
    }

    pub fn reset_filter(&mut self) {
        let count = self.original_items.len();
        self.filtered_indices.clear();
        self.filtered_indices.reserve(count);
        for i in 0..count {
            self.filtered_indices.push(i as u32);
        }
        self.axis.set_count(count);
    }

    /// Run fast substring search over 100,000+ items in milliseconds
    pub fn filter(&mut self, query: &str) {
        let q = query.trim().to_lowercase();
        if q.is_empty() {
            self.reset_filter();
            return;
        }

        self.filtered_indices.clear();
        let q_bytes = q.as_bytes();

        for (idx, lower_str) in self.lower_items.iter().enumerate() {
            if fast_contains(lower_str.as_bytes(), q_bytes) {
                self.filtered_indices.push(idx as u32);
            }
        }

        self.axis.set_count(self.filtered_indices.len());
    }

    pub fn compute_range(&self, scroll: f64, viewport: f64, overscan: usize) -> RangeResult {
        self.axis.compute_range(scroll, viewport, overscan)
    }

    pub fn filtered_count(&self) -> usize {
        self.filtered_indices.len()
    }
}

/// Fast byte-level substring check
#[inline(always)]
fn fast_contains(haystack: &[u8], needle: &[u8]) -> bool {
    if needle.is_empty() {
        return true;
    }
    if needle.len() > haystack.len() {
        return false;
    }
    haystack.windows(needle.len()).any(|w| w == needle)
}
