import { SignedOut, UserButton } from '@clerk/clerk-react';
import { LayoutDashboardIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { SignInOAuthButtons } from './SignInOAuthButtons';
import { useAuthStore } from '@/stores/useAuthStore';
import { cn } from '@/lib/utils';
import { buttonVariants } from './ui/button';
import { useShallow } from 'zustand/react/shallow';

export const Topbar = () => {
  const { isAdmin } = useAuthStore(useShallow((s) => ({ isAdmin: s.isAdmin })));

  return (
    <div
      className="flex items-center justify-between p-4 sticky top-0 bg-zinc-900/75 
      backdrop-blur-md z-10
    ">
      <div className="flex gap-2 items-center">
        <img src="/rhcp.png" className="size-8" alt="chocolateey logo" />
        <span className="text-xl font-bold">chocolateey</span>
      </div>
      <div className="flex items-center gap-4">
        {isAdmin && (
          <Link
            to={'/admin'}
            className={cn(
              buttonVariants({ variant: 'outline' }),
              'px-2 sm:px-4'
            )}
            title="Admin Dashboard">
            <LayoutDashboardIcon className="size-4 sm:mr-2" />
            <span className="hidden sm:inline">Admin Dashboard</span>
          </Link>
        )}

        <SignedOut>
          <SignInOAuthButtons />
        </SignedOut>

        <UserButton />
      </div>
    </div>
  );
};
