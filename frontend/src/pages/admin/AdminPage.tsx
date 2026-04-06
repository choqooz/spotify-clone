import { useAuthStore } from "@/stores/useAuthStore";
import { useShallow } from "zustand/react/shallow";
import { Header } from "./components/Header";
import { DashboardStats } from "./components/DashboardStats";
import { Album, Music, Users } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SongsTabContent } from "./components/SongsTabContent";
import { AlbumsTabContent } from "./components/AlbumsTabContent";
import { UsersTable } from "./components/UsersTable";
import { useEffect } from "react";
import { useMusicStore } from "@/stores/useMusicStore";
import { useAdminUsersStore } from "@/stores/useAdminUsersStore";

export const AdminPage = () => {
	const { isAdmin, isLoading } = useAuthStore(
		useShallow((s) => ({ isAdmin: s.isAdmin, isLoading: s.isLoading }))
	);

	const { fetchAlbums, fetchSongs, fetchStats } = useMusicStore(
		useShallow((s) => ({ fetchAlbums: s.fetchAlbums, fetchSongs: s.fetchSongs, fetchStats: s.fetchStats }))
	);

	const { fetchUsers } = useAdminUsersStore(
		useShallow((s) => ({ fetchUsers: s.fetchUsers }))
	);

	useEffect(() => {
		fetchAlbums();
		fetchSongs();
		fetchStats();
		fetchUsers();
	}, [fetchAlbums, fetchSongs, fetchStats, fetchUsers]);

	if (!isAdmin && !isLoading) return <div>Unauthorized</div>;

	return (
		<div
			className='min-h-screen bg-gradient-to-b from-zinc-900 via-zinc-900
   to-black text-zinc-100 p-8'
		>
			<Header />

			<DashboardStats />

			<Tabs defaultValue='songs' className='space-y-6'>
				<TabsList className='p-1 bg-zinc-800/50'>
					<TabsTrigger value='songs' className='data-[state=active]:bg-zinc-700'>
						<Music className='mr-2 size-4' />
						Songs
					</TabsTrigger>
					<TabsTrigger value='albums' className='data-[state=active]:bg-zinc-700'>
						<Album className='mr-2 size-4' />
						Albums
					</TabsTrigger>
					<TabsTrigger value='users' className='data-[state=active]:bg-zinc-700'>
						<Users className='mr-2 size-4' />
						Users
					</TabsTrigger>
				</TabsList>

				<TabsContent value='songs'>
					<SongsTabContent />
				</TabsContent>
				<TabsContent value='albums'>
					<AlbumsTabContent />
				</TabsContent>
				<TabsContent value='users'>
					<UsersTable />
				</TabsContent>
			</Tabs>
		</div>
	);
};
