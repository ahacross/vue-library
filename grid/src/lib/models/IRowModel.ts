/**
 * IRowModel Interface
 * 
 * 대용량 데이터 그리드의 데이터 공급자 추상 인터페이스입니다.
 * In-Memory Worker 방식과 Server-Side Streaming 방식을 일관되게 다룰 수 있습니다.
 */

import { FilterModel, RowRangeResponse, SortDirection } from '../types'

export interface IRowModel<T = any> {
  init(): Promise<void>
  destroy(): void
  getTotalRows(): number
  getFilteredRows(): number
  fetchRows(start: number, end: number, lastRow?: T | null): Promise<RowRangeResponse<T>>
  setSort(field: string, direction: SortDirection): Promise<void>
  setFilter(filters: FilterModel): Promise<void>
  updateCell?(rowIndex: number, field: string, value: any): Promise<void> | void
  getMemoryBytes?(): number
}
