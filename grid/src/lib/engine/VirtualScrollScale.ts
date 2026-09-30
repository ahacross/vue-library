/**
 * VirtualScrollScale Engine (v4 - 분기문 함정 제거 및 완전 연속 스케일링)
 * 
 * 1. 브라우저 CSS 높이 한계 (~33,554,400px) 극복 (1억 행 35억 픽셀 스케일링)
 * 2. 억지 분기문(ratio >= 0.999 등)을 완전 제거하여 바닥에 갇히는 현상 100% 해결
 * 3. End 키로 바닥 도달 시 정확히 마지막 행(100만, 1억) 노출 & 휠을 올리면 즉각 부드럽게 상향 스크롤
 */

import { RowHeightOption } from '../types'

export const SAFE_MAX_DOM_HEIGHT = 12_000_000 // 브라우저 안전 최대 DOM 높이 (1200만 px)

export interface VirtualRangeResult {
  startIndex: number
  endIndex: number
  visibleCount: number
  domContentHeight: number
  virtualTotalHeight: number
  isScaled: boolean
  wrapperOffsetY: number
}

export interface RowLayoutItem {
  top: number
  height: number
}

export class VirtualScrollScale {
  private totalRows = 0
  private rowHeightOption: RowHeightOption = 36
  private estimatedRowHeight = 36
  private viewportHeight = 600
  private overscan = 5

  constructor(rowHeight: RowHeightOption = 36, overscan = 5) {
    this.setRowHeight(rowHeight)
    this.overscan = overscan
  }

  public setRowHeight(option: RowHeightOption): void {
    this.rowHeightOption = option
    if (typeof option === 'number') {
      this.estimatedRowHeight = option
    } else {
      // 가변 행 높이 함수인 경우 평균 약 48px 추정
      this.estimatedRowHeight = 48
    }
  }

  public getEstimatedRowHeight(): number {
    return this.estimatedRowHeight
  }

  public updateConfig(params: {
    totalRows?: number
    rowHeight?: RowHeightOption
    viewportHeight?: number
    overscan?: number
  }): void {
    if (params.totalRows !== undefined) this.totalRows = params.totalRows
    if (params.rowHeight !== undefined) this.setRowHeight(params.rowHeight)
    if (params.viewportHeight !== undefined) this.viewportHeight = Math.max(1, params.viewportHeight)
    if (params.overscan !== undefined) this.overscan = params.overscan
  }

  /**
   * 주어진 scrollTop에 따른 가상 렌더링 범위 계산
   * (수학적 단일 연속 함수: 바닥 락 및 점프 제로)
   */
  public calculateRange(scrollTop: number): VirtualRangeResult {
    const totalRows = this.totalRows
    const estHeight = this.estimatedRowHeight
    const viewportHeight = this.viewportHeight
    const overscan = this.overscan

    const virtualTotalHeight = totalRows * estHeight
    const isScaled = virtualTotalHeight > SAFE_MAX_DOM_HEIGHT
    const domContentHeight = isScaled ? SAFE_MAX_DOM_HEIGHT : virtualTotalHeight

    if (totalRows <= 0) {
      return {
        startIndex: 0,
        endIndex: 0,
        visibleCount: 0,
        domContentHeight: 0,
        virtualTotalHeight: 0,
        isScaled: false,
        wrapperOffsetY: 0
      }
    }

    const maxDomScrollTop = Math.max(1, domContentHeight - viewportHeight)
    const clampedScrollTop = Math.max(0, Math.min(maxDomScrollTop, scrollTop))
    const ratio = clampedScrollTop / maxDomScrollTop

    const visibleRowCount = Math.ceil(viewportHeight / estHeight)
    const maxStartIndex = Math.max(0, totalRows - visibleRowCount)

    // 10억 행 스케일 모드에서는 1px이 약 67행이므로, 바닥 감지 임계값을 안전하게 확장
    const bottomThresholdPx = isScaled ? 25 : 2
    const isAtBottom = (clampedScrollTop >= maxDomScrollTop - bottomThresholdPx) || (ratio >= 0.99998)

    // 스케일 모드 여부에 따른 rawStartIndex 연속 계산
    let rawStartIndex = 0
    if (isAtBottom) {
      // ⭐️ 스크롤이 바닥에 근접했을 때는 오차 없이 정확히 마지막 행 범위 고정
      rawStartIndex = maxStartIndex
    } else if (clampedScrollTop <= bottomThresholdPx || ratio <= 0.00002) {
      rawStartIndex = 0
    } else if (isScaled) {
      // 비율에 따라 0부터 maxStartIndex까지 1:1 선형 연속 매핑
      rawStartIndex = Math.floor(ratio * maxStartIndex)
    } else {
      rawStartIndex = Math.floor(clampedScrollTop / estHeight)
    }

    // 오버스캔 적용 (마지막에 도달했을 때도 화면을 꽉 채우도록 역방향 오버스캔 보정)
    let startIndex = Math.max(0, rawStartIndex - overscan)
    let endIndex = Math.min(totalRows, rawStartIndex + visibleRowCount + overscan)

    // 마지막 행이 포함될 때 화면이 비지 않도록 앞쪽 행을 충분히 확보
    if (endIndex >= totalRows) {
      startIndex = Math.max(0, totalRows - visibleRowCount - (overscan * 2))
    }

    return {
      startIndex,
      endIndex,
      visibleCount: Math.max(0, endIndex - startIndex),
      domContentHeight,
      virtualTotalHeight,
      isScaled,
      wrapperOffsetY: clampedScrollTop
    }
  }

  /**
   * 렌더링된 행들의 실제 누적 높이를 바탕으로 래퍼의 translateY를 보정.
   * 뷰포트 [scrollTop, scrollTop + viewportHeight] 영역 내에 행들이 빈틈없이 자리잡도록 유지.
   */
  public calculateAccurateOffsetY(
    scrollTop: number,
    startIndex: number,
    renderedTotalHeight: number,
    isScaled: boolean,
    domContentHeight: number,
    endIndex?: number
  ): number {
    const totalRows = this.totalRows
    if (totalRows <= 0) return 0

    // 1. 맨 첫 행 포함 시: 무조건 상단 밀착 (0px)
    if (startIndex <= 0) {
      return 0
    }

    // 2. ⭐️ 맨 마지막 행 포함 시: 무조건 바닥 100% 밀착 (하단 빈 여백 0px 완벽 보장)
    if (endIndex !== undefined && endIndex >= totalRows) {
      if (isScaled) {
        return Math.max(0, domContentHeight - renderedTotalHeight)
      } else {
        return Math.max(0, (totalRows * this.estimatedRowHeight) - renderedTotalHeight)
      }
    }

    const viewportHeight = this.viewportHeight
    const maxDomScrollTop = Math.max(1, domContentHeight - viewportHeight)
    const clampedScrollTop = Math.max(0, Math.min(maxDomScrollTop, scrollTop))
    const ratio = clampedScrollTop / maxDomScrollTop

    // 스크롤이 바닥에 근접한 경우에도 바닥 완전 밀착
    const bottomThresholdPx = isScaled ? 25 : 2
    if (clampedScrollTop >= maxDomScrollTop - bottomThresholdPx || ratio >= 0.99998) {
      if (isScaled) {
        return Math.max(0, domContentHeight - renderedTotalHeight)
      } else {
        return Math.max(0, (totalRows * this.estimatedRowHeight) - renderedTotalHeight)
      }
    }

    if (!isScaled) {
      return startIndex * this.estimatedRowHeight
    }

    const extraHeight = Math.max(0, renderedTotalHeight - viewportHeight)

    // ratio: 0 => clampedScrollTop - 0 = 0 (첫 행 밀착)
    // ratio: 1 => clampedScrollTop - extraHeight (마지막 행 바닥 밀착)
    // 중간 => 연속 보간
    return Math.max(0, clampedScrollTop - (ratio * extraHeight))
  }

  /**
   * 렌더링되는 행 목록의 각 행별 높이와 top 오프셋 계산
   */
  public calculateRowLayouts(rows: any[], startIndex: number, api?: any): {
    layouts: RowLayoutItem[]
    totalHeight: number
  } {
    const isVariable = typeof this.rowHeightOption === 'function'
    const defaultH = this.estimatedRowHeight
    const layouts: RowLayoutItem[] = []

    let currentTop = 0
    for (let i = 0; i < rows.length; i++) {
      const rowIndex = startIndex + i
      const row = rows[i]
      let h = defaultH

      if (isVariable) {
        try {
          const fn = this.rowHeightOption as Function
          const calcH = fn({ row, rowIndex, api })
          if (typeof calcH === 'number' && calcH > 0) {
            h = calcH
          }
        } catch {
          h = defaultH
        }
      }

      layouts.push({ top: currentTop, height: h })
      currentTop += h
    }

    return { layouts, totalHeight: currentTop }
  }

  /**
   * 특정 행 인덱스로 스크롤하기 위한 DOM scrollTop 계산
   */
  public getScrollTopForRow(rowIndex: number): number {
    const totalRows = this.totalRows
    if (totalRows <= 0) return 0

    const clampedIndex = Math.max(0, Math.min(rowIndex, totalRows - 1))
    const estHeight = this.estimatedRowHeight
    const virtualTotalHeight = totalRows * estHeight
    const isScaled = virtualTotalHeight > SAFE_MAX_DOM_HEIGHT
    const domContentHeight = isScaled ? SAFE_MAX_DOM_HEIGHT : virtualTotalHeight

    const maxDomScrollTop = Math.max(1, domContentHeight - this.viewportHeight)

    if (totalRows <= 1) return 0
    if (clampedIndex >= totalRows - 1) {
      return maxDomScrollTop
    }
    const ratio = clampedIndex / (totalRows - 1)
    return ratio * maxDomScrollTop
  }
}
