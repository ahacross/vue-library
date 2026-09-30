<script setup lang="ts">
import { CellRendererParams } from '../lib/types'

const props = defineProps<{
  params: CellRendererParams
}>()

const giveBonus = () => {
  const currentSalary = Number(props.params.row.salary) || 0
  const newSalary = currentSalary + 500
  props.params.setValue(newSalary)
  alert(`🎉 [${props.params.row.name}] 직원에게 특별 보너스 500만원이 지급되어 연봉이 ${newSalary.toLocaleString()}만원이 되었습니다!`)
}

const promoteRole = () => {
  const roles = ['Intern', 'Junior', 'Mid', 'Senior', 'Lead', 'Staff', 'Principal', 'Director', 'VP']
  const currentRole = props.params.row.role
  const curIdx = roles.indexOf(currentRole)
  if (curIdx < roles.length - 1) {
    const nextRole = roles[curIdx + 1]
    props.params.row.role = nextRole
    props.params.refreshCell()
  }
}
</script>

<template>
  <div class="action-cell">
    <button class="cell-btn bonus" title="연봉 +500만원" @click.stop="giveBonus">
      💰 보너스
    </button>
    <button class="cell-btn promote" title="승진" @click.stop="promoteRole">
      ⬆ 승진
    </button>
  </div>
</template>

<style scoped>
.action-cell {
  display: flex;
  align-items: center;
  gap: 4px;
  width: 100%;
}

.cell-btn {
  padding: 3px 6px;
  font-size: 11px;
  font-weight: 600;
  border-radius: 4px;
  border: none;
  cursor: pointer;
  transition: opacity 0.15s ease;
}

.cell-btn:hover {
  opacity: 0.85;
}

.cell-btn.bonus {
  background: #fef08a;
  color: #854d0e;
}

.cell-btn.promote {
  background: #e0e7ff;
  color: #3730a3;
}
</style>
