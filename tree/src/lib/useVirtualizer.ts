import { ref, computed, onMounted, onUnmounted, type Ref } from 'vue'

export interface UseVirtualizerOptions {
  count: Ref<number>
  itemHeight: number
  overscan?: number
  containerRef: Ref<HTMLElement | null>
}

export interface VirtualItem {
  index: number
  start: number
  size: number
  end: number
}

export function useVirtualizer(options: UseVirtualizerOptions) {
  const { count, itemHeight, overscan = 5, containerRef } = options
  const scrollTop = ref(0)
  const containerHeight = ref(400)

  let resizeObserver: ResizeObserver | null = null

  const handleScroll = (e: Event) => {
    const target = e.target as HTMLElement
    scrollTop.value = target.scrollTop
  }

  onMounted(() => {
    if (containerRef.value) {
      containerHeight.value = containerRef.value.clientHeight || 400
      containerRef.value.addEventListener('scroll', handleScroll, { passive: true })

      if (typeof ResizeObserver !== 'undefined') {
        resizeObserver = new ResizeObserver((entries) => {
          for (const entry of entries) {
            if (entry.contentRect) {
              containerHeight.value = entry.contentRect.height
            }
          }
        })
        resizeObserver.observe(containerRef.value)
      }
    }
  })

  onUnmounted(() => {
    if (containerRef.value) {
      containerRef.value.removeEventListener('scroll', handleScroll)
    }
    if (resizeObserver) {
      resizeObserver.disconnect()
    }
  })

  const totalHeight = computed(() => count.value * itemHeight)

  const virtualItems = computed<VirtualItem[]>(() => {
    const total = count.value
    if (total === 0) return []

    // Clamp scrollTop so that when count drops abruptly (e.g. searching), virtual items don't disappear
    const maxScroll = Math.max(0, total * itemHeight - containerHeight.value)
    const effectiveScroll = Math.min(scrollTop.value, maxScroll)

    const startIdx = Math.max(0, Math.min(total - 1, Math.floor(effectiveScroll / itemHeight) - overscan))
    const visibleCount = Math.ceil(containerHeight.value / itemHeight)
    const endIdx = Math.min(total - 1, startIdx + visibleCount + overscan * 2)

    const items: VirtualItem[] = []
    for (let i = startIdx; i <= endIdx; i++) {
      items.push({
        index: i,
        start: i * itemHeight,
        size: itemHeight,
        end: (i + 1) * itemHeight
      })
    }
    return items
  })

  const scrollToIndex = (index: number, align: 'auto' | 'start' | 'center' | 'end' = 'auto') => {
    if (!containerRef.value) return
    const targetTop = index * itemHeight
    const currentTop = scrollTop.value
    const viewHeight = containerHeight.value

    if (align === 'start') {
      containerRef.value.scrollTop = targetTop
    } else if (align === 'end') {
      containerRef.value.scrollTop = targetTop - viewHeight + itemHeight
    } else if (align === 'center') {
      containerRef.value.scrollTop = targetTop - viewHeight / 2 + itemHeight / 2
    } else {
      // auto
      if (targetTop < currentTop) {
        containerRef.value.scrollTop = targetTop
      } else if (targetTop + itemHeight > currentTop + viewHeight) {
        containerRef.value.scrollTop = targetTop + itemHeight - viewHeight
      }
    }
  }

  return {
    totalHeight,
    virtualItems,
    scrollToIndex,
    scrollTop,
    containerHeight
  }
}
