import type { Directive, DirectiveBinding } from 'vue';

export interface VirtualScrollBindable {
  bindContainer: (el: HTMLElement) => void;
  unbindContainer?: () => void;
  onScroll?: (e: Event) => void;
}

const elementMap = new WeakMap<HTMLElement, {
  resizeObserver: ResizeObserver;
  scrollHandler: (e: Event) => void;
  target: VirtualScrollBindable;
}>();

/**
 * v-virtual-scroll directive
 * Automatically handles ResizeObserver, passive scroll listener, and connects to Wasm virtualizers
 */
export const vVirtualScroll: Directive<HTMLElement, VirtualScrollBindable> = {
  mounted(el: HTMLElement, binding: DirectiveBinding<VirtualScrollBindable>) {
    const target = binding.value;
    if (!target || typeof target.bindContainer !== 'function') {
      console.warn('[v-virtual-scroll] Invalid virtualizer target passed to directive');
      return;
    }

    target.bindContainer(el);

    const scrollHandler = (e: Event) => {
      if (target.onScroll) {
        target.onScroll(e);
      }
    };

    el.addEventListener('scroll', scrollHandler, { passive: true });

    const resizeObserver = new ResizeObserver(() => {
      // Trigger scroll/size recomputation
      if (target.onScroll) {
        target.onScroll(new Event('scroll'));
      }
    });
    resizeObserver.observe(el);

    requestAnimationFrame(() => {
      if (target.onScroll) {
        target.onScroll(new Event('scroll'));
      }
    });

    elementMap.set(el, { resizeObserver, scrollHandler, target });
  },

  unmounted(el: HTMLElement) {
    const record = elementMap.get(el);
    if (record) {
      el.removeEventListener('scroll', record.scrollHandler);
      record.resizeObserver.disconnect();
      if (record.target.unbindContainer) {
        record.target.unbindContainer();
      }
      elementMap.delete(el);
    }
  },
};
