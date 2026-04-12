import { SongRowSkeleton } from './SongRowSkeleton';

export const AlbumHeaderSkeleton = () => {
  return (
    <div className="relative min-h-full">
      {/* bg gradient */}
      <div
        className="absolute inset-0 bg-gradient-to-b from-[#5038a0]/80 via-zinc-900/80 to-zinc-900 pointer-events-none"
        aria-hidden="true"
      />

      <div className="relative z-10 animate-pulse">
        {/* Header: large image + meta */}
        <div className="flex p-6 gap-6 pb-8">
          <div className="w-[240px] h-[240px] bg-zinc-800 rounded shadow-xl flex-shrink-0" />
          <div className="flex flex-col justify-end gap-3 flex-1">
            <div className="h-4 bg-zinc-800 rounded w-16" />
            <div className="h-14 bg-zinc-800 rounded w-3/4" />
            <div className="flex items-center gap-2">
              <div className="h-4 bg-zinc-800 rounded w-32" />
              <div className="h-4 bg-zinc-800 rounded w-20" />
              <div className="h-4 bg-zinc-800 rounded w-16" />
            </div>
          </div>
        </div>

        {/* Play button area */}
        <div className="px-6 pb-4">
          <div className="w-14 h-14 rounded-full bg-zinc-800" />
        </div>

        {/* Table header */}
        <div className="bg-black/20 backdrop-blur-sm">
          <div className="grid grid-cols-[16px_4fr_2fr_1fr] gap-4 px-10 py-2 border-b border-white/5">
            <div className="h-4 bg-zinc-800 rounded" />
            <div className="h-4 bg-zinc-800 rounded w-12" />
            <div className="h-4 bg-zinc-800 rounded w-24" />
            <div className="h-4 bg-zinc-800 rounded w-8" />
          </div>

          {/* Song rows */}
          <div className="px-6">
            <div className="space-y-2 py-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <SongRowSkeleton key={i} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
