import { ref, shallowRef, type Ref } from 'vue'
import type { Id, NodeApi, DropTarget, DropPosition, MoveEvent } from './types'

export interface UseTreeDnDOptions<T = any> {
  visibleNodes: Ref<NodeApi<T>[]>
  nodeMap: Map<Id, NodeApi<T>>
  itemHeight: number
  indent: number
  containerRef: Ref<HTMLElement | null>
  isDraggable?: boolean | string | ((data: T) => boolean)
  isDroppable?: boolean | string | ((args: { parentNode: NodeApi<T> | null; dragNodes: NodeApi<T>[]; index: number }) => boolean)
  // Deprecated aliases
  disableDrag?: boolean | string | ((data: T) => boolean)
  disableDrop?: boolean | string | ((args: { parentNode: NodeApi<T> | null; dragNodes: NodeApi<T>[]; index: number }) => boolean)
  onMove?: (event: MoveEvent<T>) => void
}

export function useTreeDnD<T = any>(options: UseTreeDnDOptions<T>) {
  const {
    visibleNodes,
    nodeMap,
    itemHeight,
    indent,
    containerRef,
    isDraggable = true,
    isDroppable = true,
    disableDrag,
    disableDrop,
    onMove
  } = options

  const draggingNodes = shallowRef<NodeApi<T>[]>([])
  const dropTarget = ref<DropTarget<T> | null>(null)
  const isDraggingOverTree = ref(false)

  const canDrag = (node: NodeApi<T>): boolean => {
    if (disableDrag !== undefined) {
      if (typeof disableDrag === 'function') return !disableDrag(node.data)
      if (typeof disableDrag === 'string') return !(node.data as any)[disableDrag]
      return !disableDrag
    }
    if (typeof isDraggable === 'function') {
      return Boolean(isDraggable(node.data))
    }
    if (typeof isDraggable === 'string') {
      return Boolean((node.data as any)[isDraggable])
    }
    return Boolean(isDraggable)
  }

  const handleDragStart = (e: DragEvent, node: NodeApi<T>, selectedIds: Set<Id>) => {
    if (!canDrag(node)) {
      e.preventDefault()
      return
    }

    let dragList: NodeApi<T>[] = []
    if (selectedIds.has(node.id)) {
      // Drag all selected nodes
      dragList = Array.from(selectedIds)
        .map((id) => nodeMap.get(id))
        .filter((n): n is NodeApi<T> => !!n)
    } else {
      dragList = [node]
    }

    draggingNodes.value = dragList

    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move'
      e.dataTransfer.setData('text/plain', JSON.stringify(dragList.map((n) => n.id)))
    }
  }

  const calculateDropTarget = (e: DragEvent): DropTarget<T> | null => {
    if (!containerRef.value || draggingNodes.value.length === 0) return null

    const rect = containerRef.value.getBoundingClientRect()
    const relativeY = e.clientY - rect.top + containerRef.value.scrollTop
    const relativeX = e.clientX - rect.left

    const nodes = visibleNodes.value
    const totalCount = nodes.length

    // Special fix for react-arborist bug #313: Dropping below the last item
    if (totalCount === 0) {
      return {
        node: null,
        parentId: null,
        index: 0,
        position: 'inside',
        level: 0,
        top: 0,
        left: 0,
        width: rect.width
      }
    }

    const rawIndex = Math.floor(relativeY / itemHeight)
    const clampedIndex = Math.min(Math.max(0, rawIndex), totalCount - 1)
    const targetNode = nodes[clampedIndex]

    // If mouse is below the last item entirely
    if (rawIndex >= totalCount) {
      return {
        node: null,
        parentId: null,
        index: totalCount,
        position: 'after',
        level: 0,
        top: totalCount * itemHeight,
        left: 0,
        width: rect.width
      }
    }

    const nodeOffset = relativeY - clampedIndex * itemHeight
    const ratio = nodeOffset / itemHeight

    let position: DropPosition = 'inside'
    if (targetNode.isLeaf) {
      position = ratio < 0.5 ? 'before' : 'after'
    } else {
      if (ratio < 0.25) position = 'before'
      else if (ratio > 0.75) position = 'after'
      else position = 'inside'
    }

    // Determine parent & index
    let parentId: Id | null = null
    let dropIndex = 0
    let level = targetNode.level

    if (position === 'inside') {
      parentId = targetNode.id
      dropIndex = 0
      level = targetNode.level + 1
    } else if (position === 'before') {
      parentId = targetNode.parent ? targetNode.parent.id : null
      dropIndex = targetNode.childIndex
      level = targetNode.level
    } else {
      // after
      // If target node is an open folder, dropping "after" means inserting as its first child
      if (!targetNode.isLeaf && targetNode.isOpen) {
        position = 'inside'
        parentId = targetNode.id
        dropIndex = 0
        level = targetNode.level + 1
      } else {
        // Can adjust indentation based on mouse X coordinate (allowing drop to an ancestor level)
        let possibleParent = targetNode.parent
        let targetLevel = Math.max(0, Math.floor(relativeX / indent))
        if (targetLevel > targetNode.level) targetLevel = targetNode.level

        let curr: NodeApi<T> | null = targetNode
        while (curr && curr.level > targetLevel && curr.parent) {
          curr = curr.parent
        }
        possibleParent = curr?.parent || null

        parentId = possibleParent ? possibleParent.id : null
        dropIndex = curr ? curr.childIndex + 1 : targetNode.childIndex + 1
        level = targetLevel
      }
    }

    // Circular check: Can't drop into any dragging node or its descendants
    const isInvalid = draggingNodes.value.some(
      (dragNode) =>
        dragNode.id === parentId ||
        (parentId !== null && dragNode.isAncestorOf(parentId))
    )

    if (isInvalid) return null

    // Check custom isDroppable / disableDrop
    const parentNode = parentId ? nodeMap.get(parentId) || null : null
    if (disableDrop !== undefined) {
      if (typeof disableDrop === 'function') {
        if (disableDrop({ parentNode, dragNodes: draggingNodes.value, index: dropIndex })) {
          return null
        }
      } else if (disableDrop) {
        return null
      }
    } else if (isDroppable !== undefined) {
      if (typeof isDroppable === 'function') {
        if (!isDroppable({ parentNode, dragNodes: draggingNodes.value, index: dropIndex })) {
          return null
        }
      } else if (!isDroppable) {
        return null
      }
    }

    const lineTop =
      position === 'before'
        ? clampedIndex * itemHeight
        : position === 'after'
        ? (clampedIndex + 1) * itemHeight
        : clampedIndex * itemHeight

    return {
      node: targetNode,
      parentId,
      index: dropIndex,
      position,
      level,
      top: lineTop,
      left: level * indent,
      width: rect.width - level * indent
    }
  }

  const handleDragOver = (e: DragEvent) => {
    if (draggingNodes.value.length === 0) return
    e.preventDefault()
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'move'
    }
    isDraggingOverTree.value = true
    dropTarget.value = calculateDropTarget(e)
  }

  const handleDragLeave = (e: DragEvent) => {
    // Only reset if we truly leave the container
    if (!containerRef.value?.contains(e.relatedTarget as HTMLElement)) {
      dropTarget.value = null
      isDraggingOverTree.value = false
    }
  }

  const handleDrop = (e: DragEvent) => {
    e.preventDefault()
    const target = dropTarget.value
    const draggers = [...draggingNodes.value]

    dropTarget.value = null
    draggingNodes.value = []
    isDraggingOverTree.value = false

    if (!target || draggers.length === 0) return

    const parentNode = target.parentId ? nodeMap.get(target.parentId) || null : null

    if (onMove) {
      onMove({
        dragIds: draggers.map((n) => n.id),
        dragNodes: draggers,
        parentId: target.parentId,
        parentNode,
        index: target.index
      })
    }
  }

  const handleDragEnd = () => {
    draggingNodes.value = []
    dropTarget.value = null
    isDraggingOverTree.value = false
  }

  return {
    draggingNodes,
    dropTarget,
    isDraggingOverTree,
    handleDragStart,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleDragEnd
  }
}
