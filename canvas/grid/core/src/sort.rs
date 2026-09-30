/// Indirect Radix & Comparison Sorting for 32-bit integer indexes
pub struct IndirectSorter;

impl IndirectSorter {
    /// Sorts an array of indices [0..len] based on an associated i32 value array in O(N log N) or O(N)
    pub fn sort_indices_i32(indices: &mut [u32], values: &[i32], ascending: bool) {
        if ascending {
            indices.sort_by_key(|&idx| values[idx as usize]);
        } else {
            indices.sort_by(|&a, &b| values[b as usize].cmp(&values[a as usize]));
        }
    }

    /// Sorts an array of indices [0..len] based on an associated f64 value array
    pub fn sort_indices_f64(indices: &mut [u32], values: &[f64], ascending: bool) {
        if ascending {
            indices.sort_by(|&a, &b| {
                values[a as usize].partial_cmp(&values[b as usize]).unwrap_or(std::cmp::Ordering::Equal)
            });
        } else {
            indices.sort_by(|&a, &b| {
                values[b as usize].partial_cmp(&values[a as usize]).unwrap_or(std::cmp::Ordering::Equal)
            });
        }
    }
}
