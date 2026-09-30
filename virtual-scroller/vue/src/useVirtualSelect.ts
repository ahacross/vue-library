import { ref, shallowRef, computed, unref, watch, MaybeRef } from 'vue';
import { ensureWasmInitialized, WasmSelectFilter, parseAxisResult, AxisResult } from '../../core/index';

export type MaybeGetter<T> = MaybeRef<T> | (() => T);

function resolveVal<T>(val: MaybeGetter<T>): T {
  return typeof val === 'function' ? (val as () => T)() : unref(val);
}

// Maximum safe pixel height for DOM elements across all browsers (including 150% and 200% DPI displays)
const MAX_DOM_HEIGHT = 10_000_000;

export interface VisibleOption {
  originalIndex: number;
  label: string;
  offset: number;
  flatIndex: number;
}

export interface UseVirtualSelectOptions {
  items: MaybeGetter<string[]>;
  itemHeight?: number;
  overscan?: number;
}

export function useVirtualSelect(options: UseVirtualSelectOptions) {
  const itemHeight = options.itemHeight ?? 32;
  const overscan = options.overscan ?? 5;

  const containerRef = shallowRef<HTMLElement | null>(null);
  const wasmSelect = shallowRef<WasmSelectFilter | null>(null);
  const isReady = ref(false);

  const rawTotalHeight = ref(0);
  const domTotalHeight = ref(0);
  const filteredCount = ref(0);
  const startIndex = ref(0);
  const endIndex = ref(0);
  const startOffset = ref(0);
  const query = ref('');

  let currentScrollTop = 0;
  let currentViewportH = 300;

  const getScrollScale = () => {
    if (rawTotalHeight.value <= MAX_DOM_HEIGHT) return 1;
    const maxVirtual = Math.max(1, rawTotalHeight.value - currentViewportH);
    const maxDom = Math.max(1, MAX_DOM_HEIGHT - currentViewportH);
    return maxVirtual / maxDom;
  };

  const update = () => {
    if (!wasmSelect.value || !isReady.value) return;

    const scale = getScrollScale();
    const virtualScrollTop = currentScrollTop * scale;

    const ptr = wasmSelect.value.compute(virtualScrollTop, currentViewportH, overscan);
    const res: AxisResult = parseAxisResult(ptr);

    startIndex.value = res.startIndex;
    endIndex.value = res.endIndex;
    startOffset.value = res.startOffset;
    rawTotalHeight.value = res.totalSize;
    filteredCount.value = wasmSelect.value.filtered_count();

    if (rawTotalHeight.value > MAX_DOM_HEIGHT) {
      domTotalHeight.value = MAX_DOM_HEIGHT;
    } else {
      domTotalHeight.value = rawTotalHeight.value;
    }
  };

  const onScroll = (e?: Event) => {
    if (containerRef.value) {
      currentScrollTop = containerRef.value.scrollTop;
      currentViewportH = containerRef.value.clientHeight || 300;
    }
    update();
  };

  const populateItems = (engine: WasmSelectFilter, list: string[]) => {
    if (!Array.isArray(list)) return;
    for (let i = 0; i < list.length; i++) {
      engine.add_item(list[i]);
    }
  };

  const initSelect = async () => {
    await ensureWasmInitialized();
    const engine = new WasmSelectFilter(itemHeight);
    const list = resolveVal(options.items);
    populateItems(engine, list);

    wasmSelect.value = engine;
    rawTotalHeight.value = engine.total_size();
    filteredCount.value = engine.filtered_count();
    isReady.value = true;

    if (rawTotalHeight.value > MAX_DOM_HEIGHT) {
      domTotalHeight.value = MAX_DOM_HEIGHT;
    } else {
      domTotalHeight.value = rawTotalHeight.value;
    }

    if (containerRef.value) {
      currentViewportH = containerRef.value.clientHeight || 300;
    }
    update();
  };

  watch(
    () => resolveVal(options.items),
    (newList) => {
      if (wasmSelect.value) {
        const engine = new WasmSelectFilter(itemHeight);
        populateItems(engine, newList);
        if (query.value) {
          engine.filter(query.value);
        }
        wasmSelect.value = engine;
        update();
      }
    },
    { deep: false }
  );

  const setQuery = (newQuery: string) => {
    query.value = newQuery;
    if (wasmSelect.value) {
      wasmSelect.value.filter(newQuery);
      if (containerRef.value) {
        containerRef.value.scrollTop = 0;
        currentScrollTop = 0;
      }
      update();
    }
  };

  const bindContainer = (el: HTMLElement) => {
    containerRef.value = el;
    currentScrollTop = el.scrollTop;
    currentViewportH = el.clientHeight || 300;
    update();
  };

  const unbindContainer = () => {
    containerRef.value = null;
  };

  const visibleOptions = computed<VisibleOption[]>(() => {
    if (!wasmSelect.value || !isReady.value) return [];
    const list: VisibleOption[] = [];
    const count = filteredCount.value;
    const start = startIndex.value;
    const end = Math.max(endIndex.value, Math.min(count, 20));
    const scale = getScrollScale();
    const virtualScrollTop = currentScrollTop * scale;

    for (let i = start; i < end && i < count; i++) {
      const originalIndex = wasmSelect.value.get_filtered_original_index(i);
      const label = wasmSelect.value.get_original_item(originalIndex);
      
      const itemVirtualTop = i * itemHeight;
      const domOffset = scale === 1
        ? itemVirtualTop
        : currentScrollTop + (itemVirtualTop - virtualScrollTop);

      list.push({
        originalIndex,
        label,
        offset: domOffset,
        flatIndex: i,
      });
    }
    return list;
  });

  initSelect();

  return {
    containerRef,
    bindContainer,
    unbindContainer,
    onScroll,
    isReady,
    totalHeight: domTotalHeight,
    rawTotalHeight,
    filteredCount,
    startIndex,
    endIndex,
    startOffset,
    itemHeight,
    visibleOptions,
    query,
    setQuery,
    update,
  };
}
