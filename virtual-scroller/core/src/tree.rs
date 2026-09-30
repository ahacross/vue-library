use crate::axis::{Axis, RangeResult};

#[derive(Clone, Debug)]
pub struct TreeNode {
    pub id: u32,
    pub parent_idx: Option<usize>,
    pub child_indices: Vec<usize>,
    pub depth: u16,
    pub is_expanded: bool,
    pub has_children: bool,
    pub label: String,
}

#[derive(Clone, Debug)]
pub struct TreeVirtualizer {
    pub nodes: Vec<TreeNode>,
    pub visible_indices: Vec<usize>,
    pub axis: Axis,
    pub filter_query: String,
}

#[derive(Copy, Clone, Debug)]
#[repr(C)]
pub struct VisibleNodeView {
    pub id: u32,
    pub depth: u16,
    pub is_expanded: u8,
    pub has_children: u8,
    pub offset: f64,
    pub size: f64,
}

impl TreeVirtualizer {
    pub fn new(default_item_height: f64) -> Self {
        Self {
            nodes: Vec::new(),
            visible_indices: Vec::new(),
            axis: Axis::new(0, default_item_height),
            filter_query: String::new(),
        }
    }

    /// Add a node to the tree
    pub fn add_node(&mut self, id: u32, parent_id: Option<u32>, label: String, is_expanded: bool) -> usize {
        let node_idx = self.nodes.len();
        let mut depth = 0;
        let mut parent_idx = None;

        if let Some(pid) = parent_id {
            // Find parent index
            if let Some(p_idx) = self.nodes.iter().position(|n| n.id == pid) {
                depth = self.nodes[p_idx].depth + 1;
                parent_idx = Some(p_idx);
                self.nodes[p_idx].has_children = true;
                self.nodes[p_idx].child_indices.push(node_idx);
            }
        }

        self.nodes.push(TreeNode {
            id,
            parent_idx,
            child_indices: Vec::new(),
            depth,
            is_expanded,
            has_children: false,
            label,
        });

        node_idx
    }

    /// Batch populate tree from raw flat data
    pub fn clear(&mut self) {
        self.nodes.clear();
        self.visible_indices.clear();
        self.axis.set_count(0);
        self.filter_query.clear();
    }

    /// Toggle expand/collapse of a node by ID
    pub fn toggle_expand(&mut self, id: u32) -> bool {
        if let Some(idx) = self.nodes.iter().position(|n| n.id == id) {
            self.nodes[idx].is_expanded = !self.nodes[idx].is_expanded;
            self.rebuild_visible_list();
            return self.nodes[idx].is_expanded;
        }
        false
    }

    pub fn expand_all(&mut self) {
        for node in &mut self.nodes {
            node.is_expanded = true;
        }
        self.rebuild_visible_list();
    }

    pub fn collapse_all(&mut self) {
        for node in &mut self.nodes {
            node.is_expanded = false;
        }
        self.rebuild_visible_list();
    }

    /// Rebuild the flattened list of visible node indices
    pub fn rebuild_visible_list(&mut self) {
        self.visible_indices.clear();

        if self.filter_query.is_empty() {
            // Normal traversal
            let root_indices: Vec<usize> = self.nodes.iter().enumerate()
                .filter(|(_, n)| n.parent_idx.is_none())
                .map(|(i, _)| i)
                .collect();

            for root_idx in root_indices {
                self.traverse_visible(root_idx);
            }
        } else {
            // Search / Filter with Auto-expanding ancestor path
            let q = self.filter_query.to_lowercase();
            let mut matches = vec![false; self.nodes.len()];
            let mut keep = vec![false; self.nodes.len()];

            // 1. Identify direct matches and collect parents to expand
            let mut parents_to_expand = Vec::new();
            for (i, node) in self.nodes.iter().enumerate() {
                if node.label.to_lowercase().contains(&q) {
                    matches[i] = true;
                    keep[i] = true;
                    let mut curr = node.parent_idx;
                    while let Some(pidx) = curr {
                        keep[pidx] = true;
                        parents_to_expand.push(pidx);
                        curr = self.nodes[pidx].parent_idx;
                    }
                }
            }

            for pidx in parents_to_expand {
                self.nodes[pidx].is_expanded = true;
            }

            // 2. Traverse only nodes marked 'keep'
            let root_indices: Vec<usize> = self.nodes.iter().enumerate()
                .filter(|(i, n)| n.parent_idx.is_none() && keep[*i])
                .map(|(i, _)| i)
                .collect();

            for root_idx in root_indices {
                self.traverse_filtered(root_idx, &keep);
            }
        }

        self.axis.set_count(self.visible_indices.len());
    }

    fn traverse_visible(&mut self, idx: usize) {
        self.visible_indices.push(idx);
        if self.nodes[idx].is_expanded && self.nodes[idx].has_children {
            let children = self.nodes[idx].child_indices.clone();
            for c_idx in children {
                self.traverse_visible(c_idx);
            }
        }
    }

    fn traverse_filtered(&mut self, idx: usize, keep: &[bool]) {
        self.visible_indices.push(idx);
        if self.nodes[idx].is_expanded && self.nodes[idx].has_children {
            let children = self.nodes[idx].child_indices.clone();
            for c_idx in children {
                if keep[c_idx] {
                    self.traverse_filtered(c_idx, keep);
                }
            }
        }
    }

    pub fn set_filter(&mut self, query: &str) {
        self.filter_query = query.trim().to_string();
        self.rebuild_visible_list();
    }

    pub fn compute_range(&self, scroll: f64, viewport: f64, overscan: usize) -> RangeResult {
        self.axis.compute_range(scroll, viewport, overscan)
    }

    pub fn get_visible_count(&self) -> usize {
        self.visible_indices.len()
    }
}
