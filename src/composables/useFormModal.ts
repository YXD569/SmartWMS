import { ref, type Ref } from 'vue'

/**
 * 表单弹窗状态机：打开 / 编辑 / 提交 / 关闭
 * 收敛「新增和编辑共用一个弹窗」的样板代码
 */
export function useFormModal<T = any>() {
  const visible = ref(false)
  const submitting = ref(false)
  const isEdit = ref(false)
  const current: Ref<T | null> = ref(null) as Ref<T | null>

  function open(row?: T) {
    isEdit.value = !!row
    current.value = row ? { ...row } : (null as unknown as T)
    visible.value = true
  }

  function close() {
    visible.value = false
    current.value = null
  }

  /**
   * 提交：自动处理 loading 与成功后的关闭
   * @param submitter 实际保存逻辑
   * @param reload 保存成功后的刷新回调
   */
  async function submit(submitter: (row: T | null, isEdit: boolean) => Promise<unknown>, reload?: () => void) {
    submitting.value = true
    try {
      await submitter(current.value, isEdit.value)
      close()
      reload?.()
      return true
    } catch {
      return false
    } finally {
      submitting.value = false
    }
  }

  return { visible, submitting, isEdit, current, open, close, submit }
}
