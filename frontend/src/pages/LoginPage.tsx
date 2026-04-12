import { LockOutlined, MoonOutlined, SunOutlined, UserOutlined } from '@ant-design/icons'
import { Alert, Button, Card, Form, Input, Tooltip, Typography } from 'antd'
import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { getApiErrorMessage } from '../api/client'
import { useAuth } from '../contexts/AuthContext'
import { useThemeMode } from '../contexts/ThemeContext'

export default function LoginPage() {
  const { isDark, toggleMode } = useThemeMode()
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/dashboard'
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  return (
    <div
      className={
        isDark
          ? 'min-h-screen flex items-center justify-center bg-[#030712] p-4 relative'
          : 'min-h-screen flex items-center justify-center bg-slate-100 p-4 relative'
      }
    >
      <Tooltip title={isDark ? 'Chế độ sáng' : 'Chế độ tối'}>
        <Button
          type="text"
          className="!absolute top-4 right-4"
          icon={isDark ? <SunOutlined className="text-amber-300 text-lg" /> : <MoonOutlined className="text-slate-600 text-lg" />}
          onClick={toggleMode}
        />
      </Tooltip>
      <Card className="dashboard-card w-full max-w-md">
        <Typography.Title
          level={3}
          className={isDark ? '!text-slate-100 !text-center' : '!text-slate-900 !text-center'}
        >
          Đăng nhập
        </Typography.Title>
        <Typography.Paragraph
          className={isDark ? '!text-slate-400 !text-center !mb-6' : '!text-slate-600 !text-center !mb-6'}
        >
          Supply Chain Telemetry
        </Typography.Paragraph>
        {err && (
          <Alert type="error" message={err} className="mb-4" showIcon closable onClose={() => setErr(null)} />
        )}
        <Form
          layout="vertical"
          onFinish={async (v: { email: string; password: string }) => {
            setErr(null)
            setLoading(true)
            try {
              await login(v.email, v.password)
              navigate(from, { replace: true })
            } catch (e) {
              setErr(getApiErrorMessage(e))
            } finally {
              setLoading(false)
            }
          }}
        >
          <Form.Item name="email" label="Email" rules={[{ required: true, type: 'email' }]}>
            <Input prefix={<UserOutlined />} size="large" autoComplete="username" />
          </Form.Item>
          <Form.Item name="password" label="Mật khẩu" rules={[{ required: true }]}>
            <Input.Password prefix={<LockOutlined />} size="large" autoComplete="current-password" />
          </Form.Item>
          <Button type="primary" htmlType="submit" block size="large" loading={loading}>
            Đăng nhập
          </Button>
        </Form>
        <Typography.Text className="!text-slate-500 block text-center mt-4 text-sm">
          Chưa có tài khoản?{' '}
          <Link to="/register" className="text-sky-400">
            Đăng ký
          </Link>
        </Typography.Text>
      </Card>
    </div>
  )
}
