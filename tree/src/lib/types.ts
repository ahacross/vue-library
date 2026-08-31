export type Id = string | number

export interface TreeNodeData {
  id?: Id
  name?: string
  children?: TreeNodeData[] | null
  isLeaf?: boolean
  isOpen?: boolean
  isSelected?: boolean
  [key: string]: any
}

export type BoolFunc<T> = (data: T) => boolean

export type IdAccessor<T> = string | ((data: T) => Id)
export type ChildrenAccessor<T> = string | ((data: T) => T[] | null | undefined)
export type OpenAccessor<T> = string | ((data: T) => boolean)
export type SearchMatch<T> = (node: NodeApi<T>, searchTerm: string) => boolean

export interface NodeApi<T = any> {
  id: Id
  data: T
  rowIndex: number
  level: number
  childIndex: number
  isLeaf: boolean
  isOpen: boolean
  isSelected: boolean
  isFocused: boolean
  isEditing: boolean
  isDragging: boolean
  isChecked: boolean
  isIndeterminate: boolean
  children: NodeApi<T>[] | null
  parent: NodeApi<T> | null
  
  // Actions
  toggle: () => void
  open: () => void
  close: () => void
  select: (multi?: boolean, range?: boolean) => void
  deselect: () => void
  check: () => void
  uncheck: () => void
  toggleCheck: () => void
  focus: () => void
  edit: () => void
  submit: (newName: string) => void
  reset: () => void
  
  // Ancestor / Descendant queries
  isAncestorOf: (nodeOrId: NodeApi<T> | Id) => boolean
  isDescendantOf: (nodeOrId: NodeApi<T> | Id) => boolean
}

export interface TreeApi<T = any> {
  // Queries
  get: (id: Id) => NodeApi<T> | null
  at: (index: number) => NodeApi<T> | null
  visibleNodes: NodeApi<T>[]
  totalCount: number
  
  // State getters
  selectedIds: Set<Id>
  selectedNodes: NodeApi<T>[]
  selectedData: T[]
  checkedIds: Set<Id>
  checkedNodes: NodeApi<T>[]
  checkedData: T[]
  openIds: Set<Id>
  focusedId: Id | null
  editingId: Id | null
  
  // Operations
  open: (id: Id) => void
  close: (id: Id) => void
  toggle: (id: Id) => void
  openAll: () => void
  closeAll: () => void
  openParents: (id: Id) => void
  
  // Selection
  select: (id: Id, multi?: boolean, range?: boolean) => void
  deselect: (id: Id) => void
  selectAll: () => void
  deselectAll: () => void
  getSelectedNodes: () => NodeApi<T>[]
  getSelectedData: () => T[]
  
  // Checkbox Selection
  check: (id: Id) => void
  uncheck: (id: Id) => void
  toggleCheck: (id: Id) => void
  checkAll: () => void
  uncheckAll: () => void
  isChecked: (id: Id) => boolean
  isIndeterminate: (id: Id) => boolean
  getCheckedNodes: () => NodeApi<T>[]
  getCheckedData: () => T[]
  
  focus: (id: Id) => void
  scrollTo: (indexOrId: number | Id, align?: 'auto' | 'smart' | 'center' | 'end' | 'start') => void
  
  edit: (id: Id) => void
  submit: (id: Id, newName: string) => void
  reset: () => void
  delete: (idOrIds: Id | Id[]) => void
  deleteSelected: () => void
  
  // Search / Filter
  searchTerm: string
  setSearchTerm: (term: string) => void
  matchCount: number
}

export type DropPosition = 'before' | 'after' | 'inside'

export interface DropTarget<T = any> {
  node: NodeApi<T> | null
  parentId: Id | null
  index: number
  position: DropPosition
  level: number
  top: number
  left: number
  width: number
}

export interface MoveEvent<T = any> {
  dragIds: Id[]
  dragNodes: NodeApi<T>[]
  parentId: Id | null
  parentNode: NodeApi<T> | null
  index: number
}

export interface RenameEvent<T = any> {
  id: Id
  node: NodeApi<T>
  name: string
}

export interface DeleteEvent<T = any> {
  ids: Id[]
  nodes: NodeApi<T>[]
}

export interface CreateEvent<T = any> {
  parentId: Id | null
  parentNode: NodeApi<T> | null
  index: number
  type: 'leaf' | 'internal'
}
