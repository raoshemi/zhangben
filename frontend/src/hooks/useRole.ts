import { useEffect, useState } from 'react';

/**
 * 角色能力中心。
 *
 * 说明：RBAC 的最终判定仍在后端（@Roles 守卫），前端只做「能力可见性」收敛，
 * 避免用户看到必然 403 的按钮。
 *
 * 约定：localStorage.user.role 缺失（例如自动化测试、旧缓存）时视为「角色未知」，
 * 此时不做任何前端限制，由后端兜底 —— 这样不会出现"登录态正常但界面全灰"的误伤。
 */
export type RoleName = 'admin' | 'approver' | 'poster' | 'accountant' | 'viewer';

export interface RoleState {
  /** 未知时为 null */
  role: string | null;
  /** 财务主管 / 系统管理员 */
  isAdmin: boolean;
  /** 已知角色但不是管理员 → 系统设置类写操作应收起 */
  isReadOnly: boolean;
  canApprove: boolean;
  canPost: boolean;
  canVoid: boolean;
  canManageSettings: boolean;
  canManageAssets: boolean;
  canRunClosing: boolean;
}

export function readRole(): string | null {
  try {
    const raw = localStorage.getItem('user');
    if (raw) {
      const u = JSON.parse(raw) as { role?: unknown };
      if (u && typeof u.role === 'string' && u.role.trim()) return u.role;
    }
  } catch {
    /* 缓存损坏时忽略 */
  }
  const direct = localStorage.getItem('role');
  return direct && direct.trim() ? direct : null;
}

export function buildRoleState(role: string | null): RoleState {
  // 角色未知时不收窄能力：界面上"少一个按钮"比"用户以为没权限"更糟，最终由后端 403 兜底
  const known = role != null;
  const isAdmin = role === 'admin';
  const canPost = !known || isAdmin || role === 'poster';
  return {
    role,
    isAdmin,
    isReadOnly: known && !isAdmin,
    canApprove: !known || isAdmin || role === 'approver',
    canPost,
    // 后端 DELETE /vouchers/:id 未加角色限制，前端按「记账员及以上」收敛
    canVoid: !known || canPost || role === 'accountant' || role === 'approver',
    canManageSettings: !known || isAdmin,
    canManageAssets: !known || isAdmin,
    canRunClosing: !known || isAdmin,
  };
}

export function useRole(): RoleState {
  const [role, setRole] = useState<string | null>(() => readRole());

  // 登录/退出会在同一标签页内改写 localStorage，不会触发 storage 事件，
  // 这里用轻量轮询兜底，避免 MainLayout 常驻时角色陈旧。
  useEffect(() => {
    const timer = window.setInterval(() => {
      setRole((prev) => {
        const next = readRole();
        return next === prev ? prev : next;
      });
    }, 2000);
    return () => window.clearInterval(timer);
  }, []);

  return buildRoleState(role);
}
