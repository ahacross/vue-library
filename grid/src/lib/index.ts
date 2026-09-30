/**
 * yz-grid - Enterprise High-Performance Data Grid
 * 
 * 1. GridCore: 100% Pure TypeScript Framework-Agnostic Engine (Vanilla, React, Svelte)
 * 2. Grid: Vue 3 Component Adapter Wrapper
 */

// Core (Pure TypeScript, Zero Framework Dependency)
export { GridCore } from './core/GridCore'
export type { GridCoreConfig } from './core/GridCore'

// Vue 3 Adapter Component
import Grid from './components/Grid.vue'
import GridHeader from './components/GridHeader.vue'
import GridStatusBar from './components/GridStatusBar.vue'
import GridCell from './components/GridCell.vue'
import GridContextMenu from './components/GridContextMenu.vue'
import ColumnFilterMenu from './components/ColumnFilterMenu.vue'

export {
  Grid,
  GridHeader,
  GridStatusBar,
  GridCell,
  GridContextMenu,
  ColumnFilterMenu
}
export default Grid

// Engines & Models
export * from './types'
export { VirtualScrollScale, SAFE_MAX_DOM_HEIGHT } from './engine/VirtualScrollScale'
export { RowGroupingEngine } from './engine/RowGroupingEngine'
export { WasmRowModel } from './models/WasmRowModel'
export { ClientRowModel } from './models/ClientRowModel'
export type { ServerFetchCallback, ServerFetchResult, WasmRowModelOptions } from './models/WasmRowModel'
export type { IRowModel } from './models/IRowModel'
