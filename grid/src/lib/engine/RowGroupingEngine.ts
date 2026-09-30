/**
 * RowGroupingEngine
 * 
 * 엔터프라이즈 행 그룹핑(Row Grouping) 및 실시간 롤업 집계(Aggregations) 엔진.
 * 부서별/직급별 아코디언 접기/펼치기 및 합계/평균/인원수 계산을 지원합니다.
 */

import { RowGroupConfig } from '../types'

export interface GroupRowItem {
  __isGroup: boolean
  __groupField: string
  __groupValue: string
  __isExpanded: boolean
  __childCount: number
  __aggregations: Record<string, number>
  [key: string]: any
}

export class RowGroupingEngine {
  private expandedGroups = new Set<string>()

  constructor(defaultExpanded = true) {
    if (defaultExpanded) {
      // 기본 모두 펼침
    }
  }

  public isExpanded(groupValue: string): boolean {
    return this.expandedGroups.has(groupValue)
  }

  public toggleGroup(groupValue: string): void {
    if (this.expandedGroups.has(groupValue)) {
      this.expandedGroups.delete(groupValue)
    } else {
      this.expandedGroups.add(groupValue)
    }
  }

  public expandAll(groupValues: string[]): void {
    for (const v of groupValues) {
      this.expandedGroups.add(v)
    }
  }

  public collapseAll(): void {
    this.expandedGroups.clear()
  }

  /**
   * 행 목록을 그룹화하고 실시간 집계를 계산하여 평탄화된 목록(Flattened List) 반환
   */
  public groupRows(rows: any[], config: RowGroupConfig): any[] {
    const field = config.field
    const groupsMap = new Map<string, any[]>()

    // 1. 기준 필드로 그룹 분류
    for (const row of rows) {
      const key = String(row[field] ?? '기타')
      let list = groupsMap.get(key)
      if (!list) {
        list = []
        groupsMap.set(key, list)
      }
      list.push(row)
    }

    const result: any[] = []

    // 2. 각 그룹별 헤더 생성 및 집계(Aggregations) 계산
    for (const [groupValue, childRows] of groupsMap.entries()) {
      const isExp = this.expandedGroups.has(groupValue)

      // 실시간 집계 (인원수, 합계, 평균)
      const aggResults: Record<string, number> = {
        count: childRows.length
      }

      if (config.aggregations) {
        for (const agg of config.aggregations) {
          let sum = 0
          for (const cr of childRows) {
            sum += Number(cr[agg.field]) || 0
          }
          if (agg.type === 'sum') {
            aggResults[agg.field] = sum
          } else if (agg.type === 'avg') {
            aggResults[agg.field] = childRows.length > 0 ? (sum / childRows.length) : 0
          } else if (agg.type === 'count') {
            aggResults[agg.field] = childRows.length
          }
        }
      }

      // 그룹 헤더 행
      const groupHeader: GroupRowItem = {
        __isGroup: true,
        __groupField: field,
        __groupValue: groupValue,
        __isExpanded: isExp,
        __childCount: childRows.length,
        __aggregations: aggResults,
        id: `group-${groupValue}`,
        [field]: groupValue
      }

      result.push(groupHeader)

      // 펼쳐진 상태인 경우 자식 행들 주입
      if (isExp) {
        for (const cr of childRows) {
          result.push(cr)
        }
      }
    }

    return result
  }
}
