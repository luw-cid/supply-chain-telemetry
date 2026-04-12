import { MoonOutlined, SunOutlined } from '@ant-design/icons'
import { Button, Card, Form, Input, Tooltip, Typography, message } from 'antd'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api, getApiErrorMessage } from '../api/client'
import { useThemeMode } from '../contexts/ThemeContext'

export default function RegisterPage() {
  const { isDark, toggleMode } = useThemeMode()
  const navigate = useNavigate()
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
          Đăng ký
        </Typography.Title>
        <Form
          layout="vertical"
          onFinish={async (v: { name: string; email: string; phone: string; password: string }) => {
            setLoading(true)
            try {
              await api.post('/api/auth/register', v)
              message.success('Đăng ký thành công. Vui lòng đăng nhập.')
              navigate('/login')
            } catch (e) {
              message.error(getApiErrorMessage(e))
            } finally {
              setLoading(false)
            }
          }}
        >
          <Form.Item name="name" label="Họ tên" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="email" label="Email" rules={[{ required: true, type: 'email' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="phone" label="Điện thoại" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="password" label="Mật khẩu" rules={[{ required: true, min: 8 }]}>
            <Input.Password />
          </Form.Item>
          <Button type="primary" htmlType="submit" block loading={loading}>
            Đăng ký
          </Button>
        </Form>
        <Typography.Text
          className={isDark ? '!text-slate-500 block text-center mt-4' : '!text-slate-600 block text-center mt-4'}
        >
          <Link to="/login" className="text-sky-500">
            Quay lại đăng nhập
          </Link>
        </Typography.Text>
      </Card>
    </div>
  )
}
