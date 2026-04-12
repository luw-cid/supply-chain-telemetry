export function roleDisplayLabel(role: string): string {
  const m: Record<string, string> = {
    ADMIN: 'Quản trị',
    OWNER: 'Chủ hàng',
    LOGISTICS: 'Đối tác vận tải',
    AUDITOR: 'Kiểm toán / Hải quan',
  }
  return m[role] || role
}
