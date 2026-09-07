import { useAuthStore } from '../store/auth';

export function usePermissions() {
  const user = useAuthStore(state => state.user);
  
  const hasPermission = (permission: string) => {
    if (!user) return false;
    const perms = user.permissions || [];
    if (user.role === 'admin' || perms.includes('*') || perms.includes('all')) return true;
    return perms.includes(permission);
  };

  return { hasPermission };
}
