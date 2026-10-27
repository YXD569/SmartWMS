<script setup lang="ts">
/**
 * 登录页
 * 视觉：左侧深蓝品牌区（不跟随主题切换，保持品牌一致性），右侧白色表单卡
 * 演示账号：admin / admin123（管理员，全部权限）；stock / 123456（仓管，受限数据权限）
 */
import { ref, reactive } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { useUserStore } from '@/stores/user'

const router = useRouter()
const route = useRoute()
const userStore = useUserStore()

const formRef = ref<FormInstance>()
const loading = ref(false)
const form = reactive({ username: 'admin', password: 'admin123' })

const rules: FormRules = {
  username: [{ required: true, message: '请输入账号', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }]
}

async function onSubmit() {
  if (!formRef.value) return
  await formRef.value.validate(async (valid) => {
    if (!valid) return
    loading.value = true
    try {
      await userStore.login({ username: form.username, password: form.password })
      const redirect = (route.query.redirect as string) || '/dashboard'
      router.push(redirect)
      ElMessage.success('登录成功')
    } catch (e: any) {
      ElMessage.error(e?.message || '账号或密码错误')
    } finally {
      loading.value = false
    }
  })
}

function fillAccount(u: string, p: string) {
  form.username = u
  form.password = p
}
</script>

<template>
  <div class="login-page">
    <!-- 品牌区 -->
    <div class="brand">
      <div class="brand-inner">
        <div class="logo">
          <span class="mark">WMS</span>
          <span class="name">智联仓储管理系统</span>
        </div>
        <h1 class="slogan">让每一件货<br />的流向都可追溯</h1>
        <p class="desc">覆盖采购入库、销售出库、库位调拨与库存盘点的全链路数字化管理，并内置 AI 助手与经营决策大屏。</p>
        <div class="metrics">
          <div class="metric"><b class="num">12</b><span>核心业务模块</span></div>
          <div class="metric"><b class="num">10万</b><span>库存行毫秒级检索</span></div>
          <div class="metric"><b class="num">8</b><span>决策指标看板</span></div>
        </div>
      </div>
    </div>

    <!-- 表单区 -->
    <div class="panel">
      <div class="form-wrap">
        <h2 class="title">账号登录</h2>
        <p class="sub">请使用您的企业账号登录</p>

        <el-form ref="formRef" :model="form" :rules="rules" size="large" @submit.prevent>
          <el-form-item prop="username">
            <el-input v-model="form.username" placeholder="请输入账号" :prefix-icon="'User'" />
          </el-form-item>
          <el-form-item prop="password">
            <el-input
              v-model="form.password"
              type="password"
              placeholder="请输入密码"
              show-password
              :prefix-icon="'Lock'"
              @keyup.enter="onSubmit"
            />
          </el-form-item>
          <el-form-item>
            <el-button type="primary" class="submit" :loading="loading" @click="onSubmit">登 录</el-button>
          </el-form-item>
        </el-form>

        <div class="tips">
          <span>演示账号：</span>
          <el-link type="primary" @click="fillAccount('admin', 'admin123')">admin / admin123（管理员）</el-link>
          <el-divider direction="vertical" />
          <el-link type="primary" @click="fillAccount('stock', '123456')">stock / 123456（仓管）</el-link>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.login-page {
  display: flex;
  height: 100vh;
  background: #fff;
}

.brand {
  flex: 1.15;
  position: relative;
  background: linear-gradient(160deg, #001529 0%, #0a2a5e 55%, #12559f 100%);
  color: #fff;
  display: flex;
  align-items: center;
  padding: 0 8%;
  overflow: hidden;
}
/* 装饰：斜向光带，不参与交互 */
.brand::after {
  content: "";
  position: absolute;
  right: -12%;
  top: -20%;
  width: 460px;
  height: 140%;
  background: rgba(35, 215, 255, 0.10);
  transform: rotate(14deg);
  pointer-events: none;
}
.brand-inner { position: relative; z-index: 1; max-width: 520px; }

.logo { display: flex; align-items: center; gap: 12px; margin-bottom: 56px; }
.logo .mark {
  width: 40px; height: 40px; border-radius: 4px;
  background: #23d7ff; color: #001529;
  display: flex; align-items: center; justify-content: center;
  font-weight: 700; font-size: 14px; letter-spacing: 0.5px;
}
.logo .name { font-size: 17px; letter-spacing: 2px; font-weight: 500; }

.slogan {
  font-size: 42px;
  line-height: 1.22;
  font-weight: 600;
  letter-spacing: 2px;
  margin: 0 0 20px;
}
.desc {
  font-size: 14px;
  line-height: 1.9;
  color: rgba(255, 255, 255, 0.72);
  margin: 0 0 44px;
  max-width: 440px;
}

.metrics { display: flex; gap: 44px; }
.metric { display: flex; flex-direction: column; gap: 4px; }
.metric b { font-size: 26px; font-weight: 600; color: #23d7ff; }
.metric span { font-size: 12.5px; color: rgba(255, 255, 255, 0.6); }

.panel {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #fff;
}
.form-wrap { width: 340px; }
.title { font-size: 24px; font-weight: 600; margin: 0 0 6px; color: #303133; }
.sub { font-size: 13px; color: #909399; margin: 0 0 30px; }

.submit { width: 100%; letter-spacing: 4px; font-weight: 500; }

.tips {
  margin-top: 22px;
  font-size: 12.5px;
  color: #909399;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 2px;
}

@media (max-width: 900px) {
  .brand { display: none; }
  .panel { flex: 1; }
}
</style>
