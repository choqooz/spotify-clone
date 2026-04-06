import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { useAdminUsersStore } from '@/stores/useAdminUsersStore';
import { useShallow } from 'zustand/react/shallow';
import { Shield, ShieldOff, Loader } from 'lucide-react';
import { User } from '@/types';

export const UsersTable = () => {
  const { users, isLoading, toggleAdmin } = useAdminUsersStore(
    useShallow((s) => ({ users: s.users, isLoading: s.isLoading, toggleAdmin: s.toggleAdmin }))
  );

  if (isLoading) return <div className="flex justify-center py-8"><Loader className="animate-spin size-6 text-zinc-400" /></div>;

  return (
    <div className="bg-zinc-800/50 rounded-lg overflow-hidden">
      <table className="w-full">
        <thead className="bg-zinc-900/50">
          <tr>
            <th className="text-left p-4 text-zinc-400 font-medium text-sm">User</th>
            <th className="text-left p-4 text-zinc-400 font-medium text-sm">Clerk ID</th>
            <th className="text-left p-4 text-zinc-400 font-medium text-sm">Role</th>
            <th className="text-right p-4 text-zinc-400 font-medium text-sm">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-700/50">
          {users.map((user) => (
            <UserRow key={user._id} user={user} onToggle={() => toggleAdmin(user._id)} />
          ))}
        </tbody>
      </table>
    </div>
  );
};

const UserRow = ({ user, onToggle }: { user: User; onToggle: () => void }) => (
  <tr className="hover:bg-zinc-800/30 transition-colors">
    <td className="p-4">
      <div className="flex items-center gap-3">
        <Avatar className="size-9">
          <AvatarImage src={user.imageUrl} />
          <AvatarFallback>{user.fullName[0]}</AvatarFallback>
        </Avatar>
        <span className="text-sm font-medium text-white">{user.fullName}</span>
      </div>
    </td>
    <td className="p-4">
      <span className="text-xs text-zinc-400 font-mono">{user.clerkId.slice(0, 16)}…</span>
    </td>
    <td className="p-4">
      {user.isAdmin ? (
        <span className="flex items-center gap-1 text-xs text-emerald-400 font-medium">
          <Shield className="size-3" /> Admin
        </span>
      ) : (
        <span className="text-xs text-zinc-500">User</span>
      )}
    </td>
    <td className="p-4 text-right">
      <Button
        size="sm"
        variant="outline"
        onClick={onToggle}
        className="text-xs border-zinc-600 hover:border-zinc-400"
      >
        {user.isAdmin ? <><ShieldOff className="size-3 mr-1" />Revoke</> : <><Shield className="size-3 mr-1" />Make Admin</>}
      </Button>
    </td>
  </tr>
);
