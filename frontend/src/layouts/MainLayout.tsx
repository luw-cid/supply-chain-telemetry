import {
  AlertOutlined,
  BarChartOutlined,
  DashboardOutlined,
  DeploymentUnitOutlined,
  EnvironmentOutlined,
} from '@ant-design/icons'
import { Layout, Menu, Typography } from 'antd'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'

const { Sider, Header, Content } = Layout

const menuItems = [
  { key: '/dashboard', icon: <DashboardOutlined />, label: 'Dashboard' },
  { key: '/shipments', icon: <DeploymentUnitOutlined />, label: 'Shipments' },
  { key: '/tracking-map', icon: <EnvironmentOutlined />, label: 'Tracking Map' },
  { key: '/alerts', icon: <AlertOutlined />, label: 'Alerts' },
  { key: '/analytics', icon: <BarChartOutlined />, label: 'Analytics' },
]

export default function MainLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const selectedMenuKey = location.pathname.startsWith('/shipments')
    ? '/shipments'
    : location.pathname

  return (
    <Layout className="min-h-screen bg-slate-950">
      <Sider width={230} theme="dark" className="!bg-[#0a0f1c] border-r border-slate-800">
        <div className="px-6 py-5 border-b border-slate-800">
          <Typography.Text className="!text-slate-100 !font-semibold !tracking-wide">
            TELEMETRY OPS
          </Typography.Text>
        </div>
        <Menu
          mode="inline"
          theme="dark"
          selectedKeys={[selectedMenuKey]}
          items={menuItems}
          className="!bg-[#0a0f1c] !border-0 pt-3"
          onClick={({ key }) => navigate(key)}
        />
      </Sider>

      <Layout>
        <Header className="!bg-slate-900 border-b border-slate-800 px-6 flex items-center justify-between">
          <Typography.Text className="!text-slate-100 !text-base !font-semibold">
            Logistics Tracking Platform
          </Typography.Text>
          <Typography.Text className="!text-slate-400">
            Live telemetry simulation
          </Typography.Text>
        </Header>

        <Content className="p-5 md:p-6 bg-slate-950 overflow-auto">
          <div className="page-enter min-h-[calc(100vh-112px)]">
            <Outlet />
          </div>
        </Content>
      </Layout>
    </Layout>
  )
}
