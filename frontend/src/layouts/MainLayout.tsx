import {
  AlertOutlined,
  ApartmentOutlined,
  BarChartOutlined,
  BellOutlined,
  DashboardOutlined,
  DeploymentUnitOutlined,
  EnvironmentOutlined,
  LogoutOutlined,
  MoonOutlined,
  SunOutlined,
  SwapOutlined,
  TeamOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { Avatar, Badge, Button, Dropdown, Layout, List, Menu, Popover, Tooltip, Typography } from 'antd'
import type { MenuProps } from 'antd'
import { useMemo } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { listAlarms } from '../api/alarms'
import RoleGuard from '../components/RoleGuard'
import { useAuth } from '../contexts/AuthContext'
import { useThemeMode } from '../contexts/ThemeContext'
import { roleDisplayLabel } from '../utils/roles'

const { Sider, Header, Content } = Layout

function buildMenuItems(role: string | undefined): MenuProps['items'] {
  const dashboard = { key: '/dashboard', icon: <DashboardOutlined />, label: 'Dashboard' }
  const ports = { key: '/ports', icon: <EnvironmentOutlined />, label: 'Quản lý cảng' }
  const parties = { key: '/parties', icon: <TeamOutlined />, label: 'Đối tác' }
  const shipments = { key: '/shipments', icon: <DeploymentUnitOutlined />, label: 'Lô hàng' }
  const custodyTransfer = { key: '/custody/transfer', icon: <SwapOutlined />, label: 'Chuyển giao' }
  const custodyChain = { key: '/custody/chain', icon: <ApartmentOutlined />, label: 'Chuỗi sở hữu' }
  const routeOpt = { key: '/analytics/route-optimization', icon: <BarChartOutlined />, label: 'Phân tích lộ trình' }
  const audit = { key: '/audit-alerts', icon: <AlertOutlined />, label: 'Cảnh báo & Kiểm toán' }

  switch (role) {
    case 'OWNER':
      return [dashboard, shipments]
    case 'ADMIN':
      return [dashboard, ports, parties, shipments, custodyTransfer, custodyChain, routeOpt, audit]
    case 'LOGISTICS':
      return [dashboard, ports, parties, shipments, custodyTransfer, custodyChain, routeOpt]
    case 'AUDITOR':
      return [dashboard, parties, shipments, custodyChain, audit]
    default:
      return [dashboard, shipments]
  }
}

function selectedKey(pathname: string): string {
  if (pathname.startsWith('/ports')) return '/ports'
  if (pathname.startsWith('/parties')) return '/parties'
  if (pathname.startsWith('/shipments')) return '/shipments'
  if (pathname.startsWith('/custody')) return pathname.startsWith('/custody/transfer') ? '/custody/transfer' : '/custody/chain'
  if (pathname.startsWith('/analytics')) return '/analytics/route-optimization'
  if (pathname.startsWith('/audit-alerts')) return '/audit-alerts'
  return pathname
}

export default function MainLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, logout } = useAuth()
  const { isDark, toggleMode } = useThemeMode()
  const sk = selectedKey(location.pathname)

  const menuItems = useMemo<MenuProps['items']>(() => buildMenuItems(user?.role), [user?.role])

  const { data: alarmsData } = useQuery({
    queryKey: ['alarms', 'open'],
    queryFn: () => listAlarms({ status: 'OPEN', limit: 30 }),
    refetchInterval: 60_000,
    retry: false,
  })

  const openAlarms = alarmsData?.data ?? []
  const alarmCount = openAlarms.length

  return (
    <Layout
      className={
        isDark ? 'min-h-screen bg-[#030712]' : 'min-h-screen bg-slate-100'
      }
    >
      <Sider
        width={240}
        theme={isDark ? 'dark' : 'light'}
        className={
          isDark
            ? '!bg-[#050816] border-r border-slate-900'
            : '!bg-slate-100 border-r border-slate-200'
        }
      >
        <div
          className={
            isDark ? 'px-6 py-5 border-b border-slate-900' : 'px-6 py-5 border-b border-slate-200'
          }
        >
          <Typography.Text
            className={
              isDark
                ? '!text-slate-100 !font-semibold !tracking-wide'
                : '!text-slate-800 !font-semibold !tracking-wide'
            }
          >
            TELEMETRY OPS
          </Typography.Text>
        </div>
        <Menu
          mode="inline"
          theme={isDark ? 'dark' : 'light'}
          selectedKeys={[sk]}
          items={menuItems}
          className={isDark ? '!bg-[#050816] !border-0 pt-3' : '!bg-slate-100 !border-0 pt-3'}
          onClick={({ key }) => navigate(String(key))}
        />
      </Sider>

      <Layout>
        <Header
          className={
            isDark
              ? '!bg-[#050816] border-b border-slate-900 px-6 flex items-center justify-between gap-4'
              : '!bg-white border-b border-slate-200 px-6 flex items-center justify-between gap-4'
          }
        >
          <Typography.Text
            className={
              isDark
                ? '!text-slate-100 !text-base !font-semibold truncate'
                : '!text-slate-800 !text-base !font-semibold truncate'
            }
          >
            Logistics Tracking Platform
          </Typography.Text>
          <div className="flex items-center gap-3 shrink-0">
            <Tooltip title={isDark ? 'Chế độ sáng' : 'Chế độ tối'}>
              <Button
                type="text"
                icon={isDark ? <SunOutlined className="text-lg text-amber-300" /> : <MoonOutlined className="text-lg text-slate-600" />}
                onClick={toggleMode}
                aria-label="Toggle color mode"
              />
            </Tooltip>
            <Popover
              title="Cảnh báo mở (OPEN)"
              trigger="click"
              placement="bottomRight"
              content={
                openAlarms.length === 0 ? (
                  <Typography.Text type="secondary">Không có cảnh báo OPEN.</Typography.Text>
                ) : (
                  <List
                    size="small"
                    className="max-w-sm max-h-72 overflow-auto"
                    dataSource={openAlarms}
                    renderItem={(a) => (
                      <List.Item>
                        <div>
                          <Typography.Text
                            className={isDark ? '!text-slate-200 block' : '!text-slate-800 block'}
                          >
                            {a.ShipmentID}
                          </Typography.Text>
                          <Typography.Text
                            className={isDark ? '!text-slate-500 text-xs' : '!text-slate-600 text-xs'}
                          >
                            {a.AlarmReason}
                          </Typography.Text>
                        </div>
                      </List.Item>
                    )}
                  />
                )
              }
            >
              <Badge count={alarmCount} size="small" offset={[-2, 2]}>
                <BellOutlined
                  className={
                    isDark
                      ? 'text-xl text-slate-300 cursor-pointer hover:text-sky-400'
                      : 'text-xl text-slate-600 cursor-pointer hover:text-sky-600'
                  }
                />
              </Badge>
            </Popover>

            <Dropdown
              menu={{
                items: [
                  {
                    key: 'role',
                    label: (
                      <span className={isDark ? 'text-slate-400 text-xs' : 'text-slate-600 text-xs'}>
                        Vai trò:{' '}
                        <strong className={isDark ? 'text-slate-200' : 'text-slate-900'}>
                          {roleDisplayLabel(user?.role ?? '')}
                        </strong>
                      </span>
                    ),
                    disabled: true,
                  },
                  { type: 'divider' },
                  {
                    key: 'logout',
                    icon: <LogoutOutlined />,
                    label: 'Đăng xuất',
                    onClick: () => {
                      logout()
                      navigate('/login')
                    },
                  },
                ],
              }}
              placement="bottomRight"
            >
              <div className="flex items-center gap-2 cursor-pointer select-none">
                <Avatar
                  size="small"
                  icon={<UserOutlined />}
                  className={isDark ? 'bg-slate-700' : 'bg-slate-300'}
                />
                <div className="hidden sm:block text-left leading-tight">
                  <Typography.Text
                    className={isDark ? '!text-slate-200 block text-sm' : '!text-slate-800 block text-sm'}
                  >
                    {user?.name}
                  </Typography.Text>
                  <Typography.Text
                    className={isDark ? '!text-slate-500 block text-xs' : '!text-slate-600 block text-xs'}
                  >
                    {user?.email}
                  </Typography.Text>
                </div>
              </div>
            </Dropdown>
          </div>
        </Header>

        <Content className={isDark ? 'p-5 md:p-6 bg-[#030712] overflow-auto' : 'p-5 md:p-6 bg-slate-100 overflow-auto'}>
          <div className="page-enter min-h-[calc(100vh-112px)]">
            <RoleGuard>
              <Outlet />
            </RoleGuard>
          </div>
        </Content>
      </Layout>
    </Layout>
  )
}
