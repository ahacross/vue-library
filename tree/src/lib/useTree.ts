import { ref, computed, shallowRef, triggerRef, type Ref } from 'vue'
import type {
  Id,
  IdAccessor,
  ChildrenAccessor,
  OpenAccessor,
  NodeApi,
  TreeApi,
  RenameEvent,
  DeleteEvent
} from './types'

export interface UseTreeOptions<T = any> {
  data: Ref<T[]>
  idAccessor?: IdAccessor<T>
  childrenAccessor?: ChildrenAccessor<T>
  openAccessor?: OpenAccessor<T>
  defaultOpenAll?: boolean
  openByDefault?: boolean
  initialOpenIds?: Id[]
  initialSelectedIds?: Id[]
  initialCheckedIds?: Id[]
  selection?: Ref<Id | undefined>
  selectionFollowsFocus?: boolean
  isMultiSelect?: boolean
  isEditable?: string | boolean | ((data: T) => boolean)
  // Deprecated aliases
  disableMultiSelection?: boolean
  disableEdit?: string | boolean | ((data: T) => boolean)
  searchMatch?: (node: NodeApi<T>, searchTerm: string) => boolean
  onRename?: (event: RenameEvent<T>) => void
  onDelete?: (event: DeleteEvent<T>) => void
}

function resolveAccessor<T, R>(accessor: string | ((item: T) => R) | undefined, item: T, defaultKey: string): R {
  if (typeof accessor === 'function') {
    return accessor(item)
  }
  if (typeof accessor === 'string') {
    return (item as any)[accessor]
  }
  return (item as any)[defaultKey]
}

export function useTree<T = any>(options: UseTreeOptions<T>) {
  const {
    data,
    idAccessor = 'id',
    childrenAccessor = 'children',
    openAccessor = 'isOpen',
    defaultOpenAll = false,
    openByDefault = false,
    initialOpenIds = [],
    initialSelectedIds = [],
    initialCheckedIds = [],
    selectionFollowsFocus = false,
    isMultiSelect = true,
    isEditable = false,
    disableMultiSelection,
    disableEdit,
    searchMatch,
    onRename,
    onDelete
  } = options

  const allowMulti = isMultiSelect && !disableMultiSelection

  const isDefaultOpen = defaultOpenAll || openByDefault
  const openIds = shallowRef<Set<Id>>(new Set(initialOpenIds))
  const selectedIds = shallowRef<Set<Id>>(new Set(initialSelectedIds))
  const checkedIds = shallowRef<Set<Id>>(new Set(initialCheckedIds))
  const focusedId = ref<Id | null>(null)
  const editingId = ref<Id | null>(null)
  const searchTerm = ref('')

  const getId = (item: T): Id => {
    const id = resolveAccessor(idAccessor, item, 'id')
    return id !== undefined ? id : (item as any).__temp_id
  }

  const getChildren = (item: T): T[] | null | undefined => {
    return resolveAccessor(childrenAccessor, item, 'children')
  }

  const nodeMap = new Map<Id, NodeApi<T>>()
  const parentMap = new Map<Id, NodeApi<T> | null>()

  // Helper to check if node or any of its descendants match the search term
  const matchSearch = (item: T, node?: NodeApi<T>): boolean => {
    if (!searchTerm.value.trim()) return true
    const term = searchTerm.value.toLowerCase()

    if (searchMatch && node) {
      if (searchMatch(node, searchTerm.value)) return true
    } else {
      // Fast name/title/id inspection (avoid expensive JSON.stringify on large datasets)
      const name = (item as any)?.name ?? (item as any)?.title ?? resolveAccessor(undefined, item, 'name') ?? getId(item)
      if (name !== undefined && name !== null && String(name).toLowerCase().includes(term)) {
        return true
      }
    }

    const children = getChildren(item)
    if (children && children.length > 0) {
      for (let i = 0; i < children.length; i++) {
        if (matchSearch(children[i])) return true
      }
    }
    return false
  }

  interface InternalTreeContext<T> {
    selectedIds: Ref<Set<Id>>
    checkedIds: Ref<Set<Id>>
    focusedId: Ref<Id | null>
    editingId: Ref<Id | null>
    treeApi: TreeApi<T>
    nodeMap: Map<Id, NodeApi<T>>
  }

  class NodeImpl implements NodeApi<T> {
    id: Id
    data: T
    rowIndex: number
    level: number
    childIndex: number
    isLeaf: boolean
    parent: NodeApi<T> | null
    children: NodeApi<T>[] | null = null
    isDragging = false

    private _tree: InternalTreeContext<T>
    private _isOpen: boolean

    constructor(
      id: Id,
      data: T,
      rowIndex: number,
      level: number,
      childIndex: number,
      isLeaf: boolean,
      isOpen: boolean,
      parent: NodeApi<T> | null,
      tree: InternalTreeContext<T>
    ) {
      this.id = id
      this.data = data
      this.rowIndex = rowIndex
      this.level = level
      this.childIndex = childIndex
      this.isLeaf = isLeaf
      this._isOpen = isOpen
      this.parent = parent
      this._tree = tree
    }

    get isOpen() {
      return this._isOpen
    }
    get isSelected() {
      return this._tree.selectedIds.value.has(this.id)
    }
    get isChecked() {
      return this._tree.treeApi.isChecked(this.id)
    }
    get isIndeterminate() {
      return this._tree.treeApi.isIndeterminate(this.id)
    }
    get isFocused() {
      return this._tree.focusedId.value === this.id
    }
    get isEditing() {
      return this._tree.editingId.value === this.id
    }

    toggle() {
      this._tree.treeApi.toggle(this.id)
    }
    open() {
      this._tree.treeApi.open(this.id)
    }
    close() {
      this._tree.treeApi.close(this.id)
    }
    select(multi?: boolean, range?: boolean) {
      this._tree.treeApi.select(this.id, multi, range)
    }
    deselect() {
      this._tree.treeApi.deselect(this.id)
    }
    check() {
      this._tree.treeApi.check(this.id)
    }
    uncheck() {
      this._tree.treeApi.uncheck(this.id)
    }
    toggleCheck() {
      this._tree.treeApi.toggleCheck(this.id)
    }
    focus() {
      this._tree.treeApi.focus(this.id)
    }
    edit() {
      this._tree.treeApi.edit(this.id)
    }
    submit(newName: string) {
      this._tree.treeApi.submit(this.id, newName)
    }
    reset() {
      this._tree.treeApi.reset()
    }
    isAncestorOf(target: NodeApi<T> | Id): boolean {
      let curr: NodeApi<T> | null =
        typeof target === 'object' && target !== null ? target : this._tree.nodeMap.get(target) || null
      while (curr) {
        if (curr.id === this.id) return true
        curr = curr.parent
      }
      return false
    }
    isDescendantOf(target: NodeApi<T> | Id): boolean {
      const targetId = typeof target === 'object' && target !== null ? target.id : target
      let curr = this.parent
      while (curr) {
        if (curr.id === targetId) return true
        curr = curr.parent
      }
      return false
    }
  }

  // Flatten and build NodeApi instances
  const visibleNodes = computed<NodeApi<T>[]>(() => {
    // Explicitly track reactive dependency on data
    const rawData = data.value || []

    nodeMap.clear()
    parentMap.clear()

    const result: NodeApi<T>[] = []
    let rowIndex = 0

    const ctx: InternalTreeContext<T> = {
      selectedIds,
      checkedIds,
      focusedId,
      editingId,
      treeApi,
      nodeMap
    }

    const term = searchTerm.value.trim().toLowerCase()

    // O(N) single-pass search pre-index
    const matchedIds = new Set<Id>()
    if (term) {
      function addAllDescendants(items: T[]) {
        for (let i = 0; i < items.length; i++) {
          const item = items[i]
          matchedIds.add(getId(item))
          const children = getChildren(item)
          if (children && children.length > 0) {
            addAllDescendants(children)
          }
        }
      }

      function indexMatches(items: T[]): boolean {
        let anyChildMatched = false
        for (let i = 0; i < items.length; i++) {
          const item = items[i]
          const id = getId(item)
          const name = (item as any)?.name ?? (item as any)?.title ?? resolveAccessor(undefined, item, 'name') ?? id
          // Includes substring check (partial match, case-insensitive)
          const isDirectMatch = name !== undefined && name !== null && String(name).toLowerCase().includes(term)

          const children = getChildren(item)
          let hasMatchingChild = false
          if (children && children.length > 0) {
            hasMatchingChild = indexMatches(children)
          }

          if (isDirectMatch) {
            matchedIds.add(id)
            // If this folder itself contains the keyword, show all its contents as well
            if (children && children.length > 0) {
              addAllDescendants(children)
            }
            anyChildMatched = true
          } else if (hasMatchingChild) {
            // If a child contains the keyword, show this parent path
            matchedIds.add(id)
            anyChildMatched = true
          }
        }
        return anyChildMatched
      }
      indexMatches(rawData)
    }

    function traverse(
      items: T[],
      level: number,
      parent: NodeApi<T> | null
    ): NodeApi<T>[] {
      const currentLevelNodes: NodeApi<T>[] = []
      const len = items.length

      for (let childIndex = 0; childIndex < len; childIndex++) {
        const item = items[childIndex]
        const id = getId(item)

        if (term && !matchedIds.has(id)) {
          continue
        }

        const children = getChildren(item)
        const isLeaf = !children || children.length === 0

        const isOpen = term
          ? true
          : isDefaultOpen
          ? !openIds.value.has(`closed:${id}`)
          : openIds.value.has(id) || resolveAccessor(openAccessor, item, 'isOpen') === true

        const nodeApi = new NodeImpl(
          id,
          item,
          rowIndex++,
          level,
          childIndex,
          isLeaf,
          isOpen,
          parent,
          ctx
        )

        nodeMap.set(id, nodeApi)
        parentMap.set(id, parent)
        currentLevelNodes.push(nodeApi)
        result.push(nodeApi)

        if (!isLeaf && isOpen && children && children.length > 0) {
          nodeApi.children = traverse(children, level + 1, nodeApi)
        }
      }

      return currentLevelNodes
    }

    traverse(rawData, 0, null)
    return result
  })

  // Open / Close operations
  const open = (id: Id) => {
    if (defaultOpenAll) {
      openIds.value.delete(`closed:${id}`)
    } else {
      openIds.value.add(id)
    }
    triggerRef(openIds)
  }

  const close = (id: Id) => {
    if (defaultOpenAll) {
      openIds.value.add(`closed:${id}`)
    } else {
      openIds.value.delete(id)
    }
    triggerRef(openIds)
  }

  const toggle = (id: Id) => {
    const node = nodeMap.get(id)
    if (node?.isOpen) {
      close(id)
    } else {
      open(id)
    }
  }

  const openAll = () => {
    if (defaultOpenAll) {
      openIds.value.clear()
    } else {
      // Gather all internal node IDs
      const allIds = new Set<Id>()
      function collect(items: T[]) {
        items.forEach((item) => {
          const id = getId(item)
          const children = getChildren(item)
          if (children && children.length > 0) {
            allIds.add(id)
            collect(children)
          }
        })
      }
      collect(data.value || [])
      openIds.value = allIds
    }
    triggerRef(openIds)
  }

  const closeAll = () => {
    if (defaultOpenAll) {
      const closedIds = new Set<Id>()
      function collect(items: T[]) {
        items.forEach((item) => {
          const id = getId(item)
          const children = getChildren(item)
          if (children && children.length > 0) {
            closedIds.add(`closed:${id}`)
            collect(children)
          }
        })
      }
      collect(data.value || [])
      openIds.value = closedIds
    } else {
      openIds.value.clear()
    }
    triggerRef(openIds)
  }

  const openParents = (id: Id) => {
    let curr = parentMap.get(id)
    while (curr) {
      open(curr.id)
      curr = parentMap.get(curr.id)
    }
  }

  // Selection
  const select = (id: Id, multi = false, range = false) => {
    if (!allowMulti) {
      multi = false
      range = false
    }

    if (range && focusedId.value !== null) {
      const nodes = visibleNodes.value as unknown as NodeApi<T>[]
      const startIdx = nodes.findIndex((n) => n.id === focusedId.value)
      const endIdx = nodes.findIndex((n) => n.id === id)
      if (startIdx !== -1 && endIdx !== -1) {
        const [low, high] = startIdx < endIdx ? [startIdx, endIdx] : [endIdx, startIdx]
        for (let i = low; i <= high; i++) {
          selectedIds.value.add(nodes[i].id)
        }
        triggerRef(selectedIds)
        focusedId.value = id
        return
      }
    }

    if (multi) {
      if (selectedIds.value.has(id)) {
        selectedIds.value.delete(id)
      } else {
        selectedIds.value.add(id)
      }
    } else {
      selectedIds.value.clear()
      selectedIds.value.add(id)
    }
    focusedId.value = id
    triggerRef(selectedIds)
  }

  const deselect = (id: Id) => {
    selectedIds.value.delete(id)
    triggerRef(selectedIds)
  }

  const selectAll = () => {
    if (!allowMulti) return
    const nodes = visibleNodes.value as unknown as NodeApi<T>[]
    nodes.forEach((n) => selectedIds.value.add(n.id))
    triggerRef(selectedIds)
  }

  const deselectAll = () => {
    selectedIds.value.clear()
    triggerRef(selectedIds)
  }

  // Checkbox management
  const isChecked = (id: Id): boolean => {
    const node = nodeMap.get(id)
    if (!node) return checkedIds.value.has(id)

    if (node.isLeaf) {
      return checkedIds.value.has(id)
    }

    // For branch: checked if itself is checked or all its children are checked
    if (checkedIds.value.has(id)) return true

    // Check children recursively
    const children = getChildren(node.data)
    if (children && children.length > 0) {
      return children.every((child) => isChecked(getId(child)))
    }
    return checkedIds.value.has(id)
  }

  const isIndeterminate = (id: Id): boolean => {
    const node = nodeMap.get(id)
    if (!node || node.isLeaf) return false
    if (isChecked(id)) return false

    const children = getChildren(node.data)
    if (!children || children.length === 0) return false

    // Indeterminate if at least one child is checked or indeterminate
    return children.some((child) => {
      const childId = getId(child)
      return isChecked(childId) || isIndeterminate(childId)
    })
  }

  const check = (id: Id) => {
    checkedIds.value.add(id)
    // Also check all descendants
    const node = nodeMap.get(id)
    if (node) {
      const markDescendants = (item: T) => {
        const cList = getChildren(item)
        if (cList) {
          cList.forEach((child) => {
            checkedIds.value.add(getId(child))
            markDescendants(child)
          })
        }
      }
      markDescendants(node.data)
    }
    triggerRef(checkedIds)
  }

  const uncheck = (id: Id) => {
    checkedIds.value.delete(id)
    // Also uncheck all descendants
    const node = nodeMap.get(id)
    if (node) {
      const unmarkDescendants = (item: T) => {
        const cList = getChildren(item)
        if (cList) {
          cList.forEach((child) => {
            checkedIds.value.delete(getId(child))
            unmarkDescendants(child)
          })
        }
      }
      unmarkDescendants(node.data)
    }
    // Also uncheck ancestors if they were directly in checkedIds
    let curr = parentMap.get(id)
    while (curr) {
      checkedIds.value.delete(curr.id)
      curr = parentMap.get(curr.id)
    }
    triggerRef(checkedIds)
  }

  const toggleCheck = (id: Id) => {
    if (isChecked(id)) {
      uncheck(id)
    } else {
      check(id)
    }
  }

  const checkAll = () => {
    const nodes = visibleNodes.value as unknown as NodeApi<T>[]
    nodes.forEach((n) => checkedIds.value.add(n.id))
    triggerRef(checkedIds)
  }

  const uncheckAll = () => {
    checkedIds.value.clear()
    triggerRef(checkedIds)
  }

  // Getters for extracted nodes / data
  const getSelectedNodes = (): NodeApi<T>[] => {
    return Array.from(selectedIds.value)
      .map((id) => nodeMap.get(id))
      .filter((n): n is NodeApi<T> => !!n)
  }

  const getSelectedData = (): T[] => {
    return getSelectedNodes().map((n) => n.data)
  }

  const getCheckedNodes = (): NodeApi<T>[] => {
    const nodes = visibleNodes.value as unknown as NodeApi<T>[]
    return nodes.filter((n) => isChecked(n.id))
  }

  const getCheckedData = (): T[] => {
    return getCheckedNodes().map((n) => n.data)
  }

  const focus = (id: Id) => {
    focusedId.value = id
    if (selectionFollowsFocus) {
      select(id)
    }
  }

  // Edit / Rename
  const canEdit = (node: NodeApi<T>): boolean => {
    if (disableEdit !== undefined) {
      if (typeof disableEdit === 'function') return !disableEdit(node.data)
      if (typeof disableEdit === 'string') return !(node.data as any)[disableEdit]
      return !disableEdit
    }
    if (typeof isEditable === 'function') {
      return Boolean(isEditable(node.data))
    }
    if (typeof isEditable === 'string') {
      return Boolean((node.data as any)[isEditable])
    }
    return Boolean(isEditable)
  }

  const edit = (id: Id) => {
    const node = nodeMap.get(id)
    if (node && !canEdit(node)) return
    editingId.value = id
  }

  const submit = (id: Id, newName: string) => {
    const node = nodeMap.get(id)
    if (node) {
      if (onRename) {
        onRename({ id, node, name: newName })
      } else {
        if (typeof (node.data as any).name !== 'undefined') {
          ;(node.data as any).name = newName
        }
      }
    }
    editingId.value = null
  }

  const deleteNodes = (idOrIds: Id | Id[]) => {
    const ids = Array.isArray(idOrIds) ? idOrIds : [idOrIds]
    const nodes = ids.map((id) => nodeMap.get(id)).filter((n): n is NodeApi<T> => !!n)
    if (onDelete) {
      onDelete({ ids, nodes })
    }
  }

  const deleteSelected = () => {
    if (selectedIds.value.size > 0) {
      deleteNodes(Array.from(selectedIds.value))
    }
  }

  const reset = () => {
    editingId.value = null
  }

  const treeApi: TreeApi<T> = {
    get: (id: Id) => nodeMap.get(id) || null,
    at: (index: number) => (visibleNodes.value as unknown as NodeApi<T>[])[index] || null,
    get visibleNodes() {
      return visibleNodes.value as unknown as NodeApi<T>[]
    },
    get totalCount() {
      return (visibleNodes.value as unknown as NodeApi<T>[]).length
    },
    get selectedIds() {
      return selectedIds.value
    },
    get selectedNodes() {
      return getSelectedNodes()
    },
    get selectedData() {
      return getSelectedData()
    },
    get checkedIds() {
      return checkedIds.value
    },
    get checkedNodes() {
      return getCheckedNodes()
    },
    get checkedData() {
      return getCheckedData()
    },
    get openIds() {
      return openIds.value
    },
    get focusedId() {
      return focusedId.value
    },
    get editingId() {
      return editingId.value
    },
    open,
    close,
    toggle,
    openAll,
    closeAll,
    openParents,
    select,
    deselect,
    selectAll,
    deselectAll,
    getSelectedNodes,
    getSelectedData,
    check,
    uncheck,
    toggleCheck,
    checkAll,
    uncheckAll,
    isChecked,
    isIndeterminate,
    getCheckedNodes,
    getCheckedData,
    focus,
    scrollTo: () => {}, // Bound inside Tree.vue
    edit,
    submit,
    reset,
    delete: deleteNodes,
    deleteSelected,
    get searchTerm() {
      return searchTerm.value
    },
    setSearchTerm: (term: string) => {
      searchTerm.value = term
    },
    get matchCount() {
      return (visibleNodes.value as unknown as NodeApi<T>[]).length
    }
  }

  return {
    treeApi,
    visibleNodes: visibleNodes as unknown as Ref<NodeApi<T>[]>,
    openIds,
    selectedIds,
    focusedId,
    editingId,
    searchTerm,
    nodeMap,
    parentMap,
    getId,
    getChildren
  }
}
