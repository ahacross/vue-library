<script setup lang="ts" generic="T = any">
import { ref, computed, toRef, watch, type CSSProperties } from 'vue'
import type {
  Id,
  IdAccessor,
  ChildrenAccessor,
  OpenAccessor,
  NodeApi,
  TreeApi,
  MoveEvent,
  RenameEvent,
  DeleteEvent
} from './types'
import { useTree } from './useTree'
import { useVirtualizer } from './useVirtualizer'
import { useTreeDnD } from './useTreeDnD'
import TreeNode from './TreeNode.vue'
import DropIndicator from './DropIndicator.vue'

const props = withDefaults(
  defineProps<{
    // Data & Sizing
    data: T[]
    idAccessor?: IdAccessor<T>
    childrenAccessor?: ChildrenAccessor<T>
    openAccessor?: OpenAccessor<T>
    width?: number | string
    height?: number | string
    rowHeight?: number
    indent?: number
    overscan?: number
    paddingTop?: number
    paddingBottom?: number
    padding?: number

    // State & Open/Close/Check
    defaultOpenAll?: boolean
    openByDefault?: boolean
    showCheckbox?: boolean
    initialOpenIds?: Id[]
    initialSelectedIds?: Id[]
    initialCheckedIds?: Id[]
    selection?: Id

    // Permissions & Behaviors
    selectionFollowsFocus?: boolean
    disableMultiSelection?: boolean
    disableDrag?: boolean | string | ((data: T) => boolean)
    disableDrop?: boolean | string | ((args: { parentNode: NodeApi<T> | null; dragNodes: NodeApi<T>[]; index: number }) => boolean)
    disableEdit?: boolean | string | ((data: T) => boolean)

    // Search
    searchTerm?: string
    searchMatch?: (node: NodeApi<T>, searchTerm: string) => boolean
    searchDebounce?: number

    // ClassNames
    className?: string
    rowClassName?: string | ((node: NodeApi<T>) => string)
  }>(),
  {
    idAccessor: 'id',
    childrenAccessor: 'children',
    openAccessor: 'isOpen',
    width: '100%',
    height: '100%',
    rowHeight: 32,
    indent: 20,
    overscan: 5,
    paddingTop: 0,
    paddingBottom: 0,
    padding: 0,
    defaultOpenAll: false,
    openByDefault: false,
    showCheckbox: false,
    selectionFollowsFocus: false,
    disableMultiSelection: false,
    disableDrag: false,
    disableDrop: false,
    disableEdit: false,
    initialOpenIds: () => [],
    initialSelectedIds: () => [],
    initialCheckedIds: () => [],
    searchTerm: '',
    searchDebounce: 250,
    className: '',
    rowClassName: ''
  }
)

const emit = defineEmits<{
  (e: 'select', nodes: NodeApi<T>[]): void
  (e: 'check', event: { checkedNodes: NodeApi<T>[]; checkedData: T[] }): void
  (e: 'move', event: MoveEvent<T>): void
  (e: 'rename', event: RenameEvent<T>): void
  (e: 'delete', event: DeleteEvent<T>): void
  (e: 'activate', node: NodeApi<T>): void
  (e: 'focus', node: NodeApi<T>): void
  (e: 'toggle', id: Id): void
  (e: 'scroll', event: { scrollTop: number; scrollLeft: number }): void
  (e: 'click', event: MouseEvent): void
  (e: 'contextmenu', event: MouseEvent): void
}>()

const containerRef = ref<HTMLElement | null>(null)
const dataRef = toRef(props, 'data')

const {
  treeApi,
  visibleNodes,
  selectedIds,
  focusedId,
  nodeMap
} = useTree<T>({
  data: dataRef,
  idAccessor: props.idAccessor,
  childrenAccessor: props.childrenAccessor,
  openAccessor: props.openAccessor,
  defaultOpenAll: props.defaultOpenAll,
  openByDefault: props.openByDefault,
  initialOpenIds: props.initialOpenIds,
  initialSelectedIds: props.initialSelectedIds,
  initialCheckedIds: props.initialCheckedIds,
  selectionFollowsFocus: props.selectionFollowsFocus,
  disableMultiSelection: props.disableMultiSelection,
  disableEdit: props.disableEdit,
  searchMatch: props.searchMatch,
  onRename: (event) => emit('rename', event),
  onDelete: (event) => emit('delete', event)
})

// Sync selection prop
watch(
  () => props.selection,
  (newSelectionId) => {
    if (newSelectionId !== undefined && newSelectionId !== null) {
      treeApi.select(newSelectionId)
      treeApi.scrollTo(newSelectionId, 'auto')
    }
  },
  { immediate: true }
)

// Watch selection changes to emit select
watch(
  () => treeApi.selectedIds,
  () => {
    emit('select', treeApi.selectedNodes)
  },
  { deep: true }
)

// Watch focusedId to emit focus
watch(
  () => treeApi.focusedId,
  (id) => {
    if (id !== null) {
      const node = treeApi.get(id)
      if (node) emit('focus', node)
    }
  }
)

// Watch openIds to emit toggle
watch(
  () => treeApi.openIds,
  () => {
    if (treeApi.focusedId !== null) {
      emit('toggle', treeApi.focusedId)
    }
  },
  { deep: true }
)

// Sync search term prop with debounce
let searchDebounceTimer: any = null
watch(
  () => props.searchTerm,
  (term) => {
    if (!props.searchDebounce || props.searchDebounce <= 0) {
      treeApi.setSearchTerm(term || '')
      if (containerRef.value) containerRef.value.scrollTop = 0
      return
    }
    if (searchDebounceTimer) clearTimeout(searchDebounceTimer)
    searchDebounceTimer = setTimeout(() => {
      treeApi.setSearchTerm(term || '')
      if (containerRef.value) containerRef.value.scrollTop = 0
    }, props.searchDebounce)
  },
  { immediate: true }
)

// Virtualization
const countRef = computed(() => visibleNodes.value.length)
const { totalHeight, virtualItems, scrollToIndex } = useVirtualizer({
  count: countRef,
  itemHeight: props.rowHeight,
  overscan: props.overscan,
  containerRef
})

// Bind treeApi.scrollTo
treeApi.scrollTo = (indexOrId: number | Id, align?: 'auto' | 'smart' | 'center' | 'end' | 'start') => {
  let index: number
  if (typeof indexOrId === 'number') {
    index = indexOrId
  } else {
    index = visibleNodes.value.findIndex((n) => n.id === indexOrId)
  }
  if (index >= 0) {
    scrollToIndex(index, align === 'smart' ? 'auto' : align)
  }
}

// Drag & Drop
const {
  dropTarget,
  handleDragStart,
  handleDragOver,
  handleDragLeave,
  handleDrop,
  handleDragEnd
} = useTreeDnD<T>({
  visibleNodes,
  nodeMap,
  itemHeight: props.rowHeight,
  indent: props.indent,
  containerRef,
  disableDrag: props.disableDrag,
  disableDrop: props.disableDrop,
  onMove: (event) => emit('move', event)
})

// Keyboard Navigation
const handleKeyDown = (e: KeyboardEvent) => {
  const nodes = visibleNodes.value
  if (nodes.length === 0) return

  let currentIdx = -1
  if (focusedId.value !== null) {
    currentIdx = nodes.findIndex((n) => n.id === focusedId.value)
  }
  if (currentIdx === -1 && nodes.length > 0) {
    currentIdx = 0
  }

  const currentNode = nodes[currentIdx]

  if (e.key === 'ArrowDown') {
    e.preventDefault()
    const nextIdx = Math.min(nodes.length - 1, currentIdx + 1)
    const nextNode = nodes[nextIdx]
    if (nextNode) {
      treeApi.focus(nextNode.id)
      if (!e.shiftKey) treeApi.select(nextNode.id)
      else treeApi.select(nextNode.id, true, true)
      scrollToIndex(nextIdx, 'auto')
    }
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    const prevIdx = Math.max(0, currentIdx - 1)
    const prevNode = nodes[prevIdx]
    if (prevNode) {
      treeApi.focus(prevNode.id)
      if (!e.shiftKey) treeApi.select(prevNode.id)
      else treeApi.select(prevNode.id, true, true)
      scrollToIndex(prevIdx, 'auto')
    }
  } else if (e.key === 'ArrowRight') {
    e.preventDefault()
    if (currentNode && !currentNode.isLeaf) {
      if (!currentNode.isOpen) {
        currentNode.open()
      } else {
        // Move to first child
        const nextNode = nodes[currentIdx + 1]
        if (nextNode && nextNode.parent?.id === currentNode.id) {
          treeApi.focus(nextNode.id)
          treeApi.select(nextNode.id)
          scrollToIndex(currentIdx + 1, 'auto')
        }
      }
    }
  } else if (e.key === 'ArrowLeft') {
    e.preventDefault()
    if (currentNode) {
      if (!currentNode.isLeaf && currentNode.isOpen) {
        currentNode.close()
      } else if (currentNode.parent) {
        treeApi.focus(currentNode.parent.id)
        treeApi.select(currentNode.parent.id)
        const parentIdx = nodes.findIndex((n) => n.id === currentNode.parent!.id)
        if (parentIdx >= 0) scrollToIndex(parentIdx, 'auto')
      }
    }
  } else if (e.key === ' ' || e.key === 'Enter') {
    e.preventDefault()
    if (currentNode) {
      if (e.key === 'Enter') {
        emit('activate', currentNode)
      } else {
        currentNode.toggle()
      }
    }
  } else if (e.key === 'F2') {
    e.preventDefault()
    if (currentNode) {
      currentNode.edit()
    }
  } else if (e.key === 'Delete' || e.key === 'Backspace') {
    if (selectedIds.value.size > 0) {
      const ids = Array.from(selectedIds.value)
      const selectedNodeList = ids.map((id) => nodeMap.get(id)).filter((n): n is NodeApi<T> => !!n)
      emit('delete', { ids, nodes: selectedNodeList })
    }
  }
}

// Container sizing helper
const containerStyle = computed<CSSProperties>(() => {
  const pTop = props.paddingTop || props.padding || 0
  const pBottom = props.paddingBottom || props.padding || 0

  return {
    width: typeof props.width === 'number' ? `${props.width}px` : props.width,
    height: typeof props.height === 'number' ? `${props.height}px` : props.height,
    paddingTop: `${pTop}px`,
    paddingBottom: `${pBottom}px`,
    position: 'relative',
    overflow: 'auto',
    outline: 'none'
  }
})

const getRowClass = (node: NodeApi<T>) => {
  if (typeof props.rowClassName === 'function') {
    return props.rowClassName(node)
  }
  return props.rowClassName || ''
}

const handleScrollEvent = (e: Event) => {
  const target = e.target as HTMLElement
  emit('scroll', { scrollTop: target.scrollTop, scrollLeft: target.scrollLeft })
}

defineExpose<TreeApi<T>>(treeApi)
</script>

<template>
  <div
    ref="containerRef"
    class="vue-arborist"
    :class="className"
    :style="containerStyle"
    tabindex="0"
    @scroll="handleScrollEvent"
    @click="$emit('click', $event)"
    @contextmenu="$emit('contextmenu', $event)"
    @keydown="handleKeyDown"
    @dragover="handleDragOver"
    @dragleave="handleDragLeave"
    @drop="handleDrop"
    @dragend="handleDragEnd"
  >
    <!-- Virtual height container -->
    <div
      class="vue-arborist-inner"
      :style="{ height: `${totalHeight}px`, position: 'relative', width: '100%' }"
    >
      <!-- Render only virtualized items -->
      <div
        v-for="vItem in virtualItems"
        :key="visibleNodes[vItem.index]?.id ?? vItem.index"
        class="vue-arborist-row"
        :class="getRowClass(visibleNodes[vItem.index])"
        :style="{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: `${vItem.size}px`,
          transform: `translateY(${vItem.start}px)`
        }"
        :draggable="!disableDrag"
        @dragstart="handleDragStart($event, visibleNodes[vItem.index], selectedIds)"
        @click="visibleNodes[vItem.index]?.select($event.metaKey || $event.ctrlKey, $event.shiftKey)"
      >
        <!-- User Custom Node Slot or Default TreeNode -->
        <slot
          :node="visibleNodes[vItem.index]"
          :tree="treeApi"
          :style="{ height: `${vItem.size}px` }"
        >
          <TreeNode
            :node="visibleNodes[vItem.index]"
            :tree="treeApi"
            :indent="indent"
            :show-checkbox="showCheckbox"
          />
        </slot>
      </div>

      <!-- Drop Indicator -->
      <DropIndicator
        v-if="dropTarget"
        :target="dropTarget"
        :item-height="rowHeight"
      />
    </div>
  </div>
</template>

<style scoped>
.vue-arborist {
  box-sizing: border-box;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  user-select: none;
}

.vue-arborist:focus-visible {
  outline: 2px solid #3b82f6;
  outline-offset: -2px;
}

.vue-arborist-row {
  box-sizing: border-box;
  display: flex;
  align-items: center;
}
</style>
