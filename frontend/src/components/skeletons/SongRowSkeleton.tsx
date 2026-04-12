export const SongRowSkeleton = () => {
  return (
    <div className="grid grid-cols-[16px_4fr_2fr_1fr] gap-4 px-4 py-2 animate-pulse">
      {/* # */}
      <div className="flex items-center justify-center">
        <div className="h-4 w-4 bg-zinc-800 rounded" />
      </div>

      {/* Title + image */}
      <div className="flex items-center gap-3">
        <div className="size-10 bg-zinc-800 rounded flex-shrink-0" />
        <div className="space-y-2 flex-1 min-w-0">
          <div className="h-4 bg-zinc-800 rounded w-3/4" />
          <div className="h-3 bg-zinc-800 rounded w-1/2" />
        </div>
      </div>

      {/* Released Date / Artist */}
      <div className="flex items-center">
        <div className="h-4 bg-zinc-800 rounded w-2/3" />
      </div>

      {/* Duration */}
      <div className="flex items-center">
        <div className="h-4 bg-zinc-800 rounded w-10" />
      </div>
    </div>
  );
};
