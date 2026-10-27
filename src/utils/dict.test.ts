import { describe, it, expect } from 'vitest'
import { STATUS_FLOW, DICT_MAP, dictLabel, dictType, canTransfer, allowedActions } from './dict'

describe('数据字典', () => {
  it('字典取值与标签类型可回退', () => {
    expect(dictLabel('bill_status', 'DRAFT')).toBe('草稿')
    expect(dictType('warn_level', 'HIGH')).toBe('danger')
    // 未知字典/未知值不应抛错，直接回原值
    expect(dictLabel('not_exist', 'X')).toBe('X')
    expect(dictType('io_type', 'UNKNOWN')).toBe('info')
  })

  it('所有字典项的值在表内唯一', () => {
    Object.entries(DICT_MAP).forEach(([key, list]) => {
      const values = list.map((i) => String(i.value))
      expect(new Set(values).size, `字典 ${key} 存在重复值`).toBe(values.length)
    })
  })
})

describe('单据状态机', () => {
  it('允许合法流转', () => {
    expect(canTransfer('DRAFT', 'PENDING')).toBe(true)
    expect(canTransfer('PENDING', 'APPROVED')).toBe(true)
    expect(canTransfer('RUNNING', 'FINISHED')).toBe(true)
  })

  it('拒绝非法流转：不能跳级，也不能从终态继续', () => {
    expect(canTransfer('DRAFT', 'FINISHED')).toBe(false) // 跳级
    expect(canTransfer('FINISHED', 'RUNNING')).toBe(false) // 终态不可逆
    expect(canTransfer('APPROVED', 'DRAFT')).toBe(false)
  })

  it('终态没有可执行动作', () => {
    expect(allowedActions('FINISHED')).toEqual([])
    expect(allowedActions('UNKNOWN_STATUS')).toEqual([])
  })

  it('状态机覆盖所有状态，且不能自流转', () => {
    const keys = Object.keys(STATUS_FLOW)
    expect(keys.length).toBe(6)
    keys.forEach((k) => expect(STATUS_FLOW[k]).not.toContain(k))
  })
})
