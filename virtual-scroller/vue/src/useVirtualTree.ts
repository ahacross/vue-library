import { ref, shallowRef, computed, unref, watch, MaybeRef } from 'vue';
import { ensureWasmInitialized, WasmTree, parseAxisResult, AxisResult } from '../../core/index';

export type MaybeGetter<T> = MaybeRef<T> | (() => T);

function resolveVal<T>(val: MaybeGetter<T>): T {
  return typeof val === 'function' ? (val as () => T)() : unref(val);
}

export interface TreeNodeItem {
  id: number;
  parentId?: number | null;
  label: string;
  isExpanded?: boolean;
}

export interface VisibleTreeNode {
  id: number;
  depth: number;
  isExpanded: boolean;
  hasChildren: boolean;
  label: string;
  offset: number;
  flatIndex: number;
}

export interface UseVirtualTreeOptions {
  data: MaybeGetter<TreeNodeItem[]>;
  itemHeight?: number;
  overscan?: number;
}

export function useVirtualTree(options: UseVirtualTreeOptions) {
  const itemHeight = options.itemHeight ?? 32;
  const overscan = options.overscan ?? 5;

  const containerRef = shallowRef<HTMLElement | null>(null);
  const wasmTree = shallowRef<WasmTree | null>(null);
  const isReady = ref(false);

  const totalHeight = ref(0);
  const visibleCount = ref(0);
  const startIndex = ref(0);
  const endIndex = ref(0);
  const startOffset = ref(0);
  const filterQuery = ref('');

  let currentScrollTop = 0;
  let currentViewportH = 600;

  const update = () => {
    if (!wasmTree.value || !isReady.value) return;

    const ptr = wasmTree.value.compute(currentScrollTop, currentViewportH, overscan);
    const res: AxisResult = parseAxisResult(ptr);

    startIndex.value = res.startIndex;
    endIndex.value = res.endIndex;
    startOffset.value = res.startOffset;
    totalHeight.value = res.totalSize;
    visibleCount.value = wasmTree.value.visible_count();
  };

  const onScroll = (e?: Event) => {
    if (containerRef.value) {
      currentScrollTop = containerRef.value.scrollTop;
      currentViewportH = containerRef.value.clientHeight || 600;
    }
    update();
  };

  const populateTree = (tree: WasmTree, items: TreeNodeItem[]) => {
    tree.clear();
    if (!Array.isArray(items)) return;
    for (const item of items) {
      const parentId = item.parentId ?? -1;
      tree.add_node(item.id, parentId, item.label, item.isExpanded ?? false);
    }
    tree.finish_build();
  };

  const initTree = async () => {
    await ensureWasmInitialized();
    const tree = new WasmTree(itemHeight);
    const items = resolveVal(options.data);
    populateTree(tree, items);

    wasmTree.value = tree;
    totalHeight.value = tree.total_size();
    visibleCount.value = tree.visible_count();
    isReady.value = true;

    if (containerRef.value) {
      currentViewportH = containerRef.value.clientHeight || 600;
    }
    update();
  };

  watch(
    () => resolveVal(options.data),
    (newData) => {
      if (wasmTree.value) {
        populateTree(wasmTree.value, newData);
        if (filterQuery.value) {
          wasmTree.value.set_filter(filterQuery.value);
        }
        update();
      }
    },
    { deep: false }
  );

  const setFilter = (query: string) => {
    filterQuery.value = query;
    if (wasmTree.value) {
      wasmTree.value.set_filter(query);
      update();
    }
  };

  const toggleExpand = (id: number) => {
    if (wasmTree.value) {
      wasmTree.value.toggle_expand(id);
      update();
    }
  };

  const expandAll = () => {
    if (wasmTree.value) {
      wasmTree.value.expand_all();
      update();
    }
  };

  const collapseAll = () => {
    if (wasmTree.value) {
      wasmTree.value.collapse_all();
      update();
    }
  };

  const bindContainer = (el: HTMLElement) => {
    containerRef.value = el;
    currentScrollTop = el.scrollTop;
    currentViewportH = el.clientHeight || 600;
    update();
  };

  const unbindContainer = () => {
    containerRef.value = null;
  };

  const visibleNodes = computed<VisibleTreeNode[]>(() => {
    if (!wasmTree.value || !isReady.value) return [];
    const list: VisibleTreeNode[] = [];
    const count = visibleCount.value;
    const start = startIndex.value;
    const end = Math.max(endIndex.value, Math.min(count, 30));

    for (let i = start; i < end && i < count; i++) {
      list.push({
        id: wasmTree.value.get_visible_node_id(i),
        depth: wasmTree.value.get_visible_node_depth(i),
        isExpanded: wasmTree.value.get_visible_node_expanded(i),
        hasChildren: wasmTree.value.get_visible_node_has_children(i),
        label: wasmTree.value.get_visible_node_label(i),
        offset: i * itemHeight,
        flatIndex: i,
      });
    }
    return list;
  });

  initTree();

  return {
    containerRef,
    bindContainer,
    unbindContainer,
    onScroll,
    isReady,
    totalHeight,
    visibleCount,
    startIndex,
    endIndex,
    startOffset,
    itemHeight,
    visibleNodes,
    filterQuery,
    setFilter,
    toggleExpand,
    expandAll,
    collapseAll,
    update,
  };
}
