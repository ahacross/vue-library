/// Fenwick Tree (Binary Indexed Tree) for O(log N) prefix sum updates and queries
#[derive(Clone, Debug)]
pub struct FenwickTree {
    tree: Vec<f64>,
    size: usize,
}

impl FenwickTree {
    pub fn new(size: usize, initial_val: f64) -> Self {
        let mut tree = vec![0.0; size + 1];
        for i in 1..=size {
            tree[i] += initial_val;
            let parent = i + (i & (!i + 1));
            if parent <= size {
                tree[parent] += tree[i];
            }
        }
        Self { tree, size }
    }

    /// Update value at index (0-indexed) by delta
    pub fn add(&mut self, idx: usize, delta: f64) {
        let mut i = idx + 1;
        while i <= self.size {
            self.tree[i] += delta;
            i += i & (!i + 1);
        }
    }

    /// Query sum in [0, idx) (0-indexed exclusive, so sum of first `idx` elements)
    pub fn prefix_sum(&self, count: usize) -> f64 {
        let mut sum = 0.0;
        let mut i = count.min(self.size);
        while i > 0 {
            sum += self.tree[i];
            i -= i & (!i + 1);
        }
        sum
    }

    /// Total sum of all elements
    pub fn total_sum(&self) -> f64 {
        self.prefix_sum(self.size)
    }

    /// Find the largest index such that prefix_sum(idx) <= target (Binary lifting: O(log N))
    pub fn find_index_for_offset(&self, target: f64) -> usize {
        if target <= 0.0 {
            return 0;
        }
        let mut idx = 0;
        let mut sum = 0.0;
        // Find highest power of 2 <= size
        let mut step = 1;
        while (step << 1) <= self.size {
            step <<= 1;
        }

        while step > 0 {
            let next_idx = idx + step;
            if next_idx <= self.size && (sum + self.tree[next_idx]) < target {
                idx = next_idx;
                sum += self.tree[idx];
            }
            step >>= 1;
        }
        idx
    }
}

/// 1D Virtualization Axis (Rows or Columns)
#[derive(Clone, Debug)]
pub struct Axis {
    pub count: usize,
    pub default_size: f64,
    pub is_fixed: bool,
    pub fenwick: Option<FenwickTree>,
    pub custom_sizes: Vec<Option<f64>>,
}

#[derive(Copy, Clone, Debug)]
pub struct RangeResult {
    pub start_index: u32,
    pub end_index: u32,
    pub start_offset: f64,
    pub total_size: f64,
}

impl Axis {
    pub fn new(count: usize, default_size: f64) -> Self {
        Self {
            count,
            default_size: default_size.max(1.0),
            is_fixed: true,
            fenwick: None,
            custom_sizes: Vec::new(),
        }
    }

    pub fn set_count(&mut self, new_count: usize) {
        if self.count == new_count {
            return;
        }
        self.count = new_count;
        if !self.is_fixed {
            // Rebuild or resize fenwick tree
            let mut tree = FenwickTree::new(new_count, self.default_size);
            self.custom_sizes.resize(new_count, None);
            for (i, opt_size) in self.custom_sizes.iter().enumerate() {
                if let Some(size) = opt_size {
                    let delta = size - self.default_size;
                    tree.add(i, delta);
                }
            }
            self.fenwick = Some(tree);
        }
    }

    pub fn set_item_size(&mut self, idx: usize, size: f64) {
        if idx >= self.count {
            return;
        }
        if self.is_fixed {
            self.is_fixed = false;
            self.fenwick = Some(FenwickTree::new(self.count, self.default_size));
            self.custom_sizes = vec![None; self.count];
        }

        let old_size = self.custom_sizes[idx].unwrap_or(self.default_size);
        let delta = size - old_size;
        self.custom_sizes[idx] = Some(size);
        if let Some(ref mut tree) = self.fenwick {
            tree.add(idx, delta);
        }
    }

    pub fn total_size(&self) -> f64 {
        if self.count == 0 {
            return 0.0;
        }
        if self.is_fixed {
            self.count as f64 * self.default_size
        } else if let Some(ref tree) = self.fenwick {
            tree.total_sum()
        } else {
            self.count as f64 * self.default_size
        }
    }

    pub fn offset_of(&self, idx: usize) -> f64 {
        if idx == 0 || self.count == 0 {
            return 0.0;
        }
        let clamped = idx.min(self.count);
        if self.is_fixed {
            clamped as f64 * self.default_size
        } else if let Some(ref tree) = self.fenwick {
            tree.prefix_sum(clamped)
        } else {
            clamped as f64 * self.default_size
        }
    }

    pub fn size_of(&self, idx: usize) -> f64 {
        if idx >= self.count {
            return 0.0;
        }
        if self.is_fixed {
            self.default_size
        } else {
            self.custom_sizes.get(idx).and_then(|&s| s).unwrap_or(self.default_size)
        }
    }

    pub fn compute_range(&self, scroll: f64, viewport: f64, overscan: usize) -> RangeResult {
        if self.count == 0 {
            return RangeResult {
                start_index: 0,
                end_index: 0,
                start_offset: 0.0,
                total_size: 0.0,
            };
        }

        let total = self.total_size();
        let scroll = scroll.max(0.0).min(total);
        let max_visible_offset = scroll + viewport;

        let (raw_start, raw_end) = if self.is_fixed {
            let start = (scroll / self.default_size).floor() as usize;
            let end = (max_visible_offset / self.default_size).ceil() as usize;
            (start, end)
        } else if let Some(ref tree) = self.fenwick {
            let start = tree.find_index_for_offset(scroll);
            let end = (tree.find_index_for_offset(max_visible_offset) + 1).min(self.count);
            (start, end)
        } else {
            let start = (scroll / self.default_size).floor() as usize;
            let end = (max_visible_offset / self.default_size).ceil() as usize;
            (start, end)
        };

        let start_idx = raw_start.saturating_sub(overscan).min(self.count - 1);
        let end_idx = (raw_end + overscan).min(self.count);
        let start_offset = self.offset_of(start_idx);

        RangeResult {
            start_index: start_idx as u32,
            end_index: end_idx as u32,
            start_offset,
            total_size: total,
        }
    }
}
