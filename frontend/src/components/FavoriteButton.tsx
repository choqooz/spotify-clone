import { Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useFavoriteStore } from '@/stores/useFavoriteStore';
import { cn } from '@/lib/utils';

interface FavoriteButtonProps {
  songId: string;
  size?: 'sm' | 'default' | 'icon';
  className?: string;
}

export const FavoriteButton = ({ songId, size = 'icon', className }: FavoriteButtonProps) => {
  const isFav = useFavoriteStore((s) => s.isFavorite(songId));
  const addFavorite = useFavoriteStore((s) => s.addFavorite);
  const removeFavorite = useFavoriteStore((s) => s.removeFavorite);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isFav) removeFavorite(songId);
    else addFavorite(songId);
  };

  return (
    <Button
      size={size}
      variant="ghost"
      onClick={handleClick}
      className={cn('text-zinc-400 hover:text-white', isFav && 'text-red-500 hover:text-red-400', className)}
    >
      <Heart className={cn('size-4', isFav && 'fill-current')} />
    </Button>
  );
};
