import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { usePlaylistStore } from '@/stores/usePlaylistStore';
import { ListMusic, Plus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useShallow } from 'zustand/react/shallow';

export const PlaylistsPage = () => {
  const { playlists, isLoading, fetchPlaylists, createPlaylist, deletePlaylist } =
    usePlaylistStore(
      useShallow((s) => ({
        playlists: s.playlists,
        isLoading: s.isLoading,
        fetchPlaylists: s.fetchPlaylists,
        createPlaylist: s.createPlaylist,
        deletePlaylist: s.deletePlaylist,
      }))
    );
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    fetchPlaylists();
  }, [fetchPlaylists]);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setIsCreating(true);
    const playlist = await createPlaylist(name.trim());
    setIsCreating(false);
    if (playlist) {
      setName('');
      setOpen(false);
    }
  };

  return (
    <div className="h-full">
      <ScrollArea className="h-full rounded-md">
        <div className="relative min-h-full">
          <div
            className="absolute inset-0 bg-gradient-to-b from-[#4a3080]/80 via-zinc-900/80 to-zinc-900 pointer-events-none"
            aria-hidden="true"
          />

          <div className="relative z-10 p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <ListMusic className="h-8 w-8 text-green-400" />
                <h1 className="text-3xl font-bold">Your Playlists</h1>
              </div>

              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-green-500 hover:bg-green-400 text-black font-semibold">
                    <Plus className="h-4 w-4 mr-2" />
                    New Playlist
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-zinc-900 border-zinc-700">
                  <DialogHeader>
                    <DialogTitle className="text-white">Create playlist</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 pt-2">
                    <Input
                      placeholder="Playlist name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                      className="bg-zinc-800 border-zinc-600 text-white placeholder:text-zinc-500"
                      autoFocus
                    />
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        onClick={() => setOpen(false)}
                        className="text-zinc-400 hover:text-white">
                        Cancel
                      </Button>
                      <Button
                        onClick={handleCreate}
                        disabled={!name.trim() || isCreating}
                        className="bg-green-500 hover:bg-green-400 text-black font-semibold disabled:opacity-50">
                        Create
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {/* Playlist grid */}
            {isLoading ? (
              <div className="text-zinc-400">Loading playlists...</div>
            ) : playlists.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-zinc-400">
                <ListMusic className="h-16 w-16 mb-4 opacity-40" />
                <p className="text-lg">No playlists yet</p>
                <p className="text-sm mt-1">Create your first playlist to get started</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {playlists.map((playlist) => (
                  <div key={playlist._id} className="group relative">
                    <Link
                      to={`/playlists/${playlist._id}`}
                      className="block bg-zinc-800/50 hover:bg-zinc-800 rounded-md p-4 transition-colors cursor-pointer">
                      {/* Cover */}
                      <div className="w-full aspect-square rounded-md bg-zinc-700 mb-3 flex items-center justify-center overflow-hidden">
                        <ListMusic className="h-10 w-10 text-zinc-500" />
                      </div>
                      <p className="font-medium text-white truncate">{playlist.name}</p>
                      <p className="text-xs text-zinc-400 mt-1">
                        {new Date(playlist.createdAt).toLocaleDateString()}
                      </p>
                    </Link>

                    {/* Delete button */}
                    <button
                      onClick={() => deletePlaylist(playlist._id)}
                      className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-full bg-zinc-900/80 hover:bg-red-500/20 text-zinc-400 hover:text-red-400">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </ScrollArea>
    </div>
  );
};
