import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useYouTubeStore } from '@/stores/useYouTubeStore';
import { usePlayerStore } from '@/stores/usePlayerStore';
import { Search, Loader, Play, Pause } from 'lucide-react';
import { Topbar } from '@/components/Topbar';
import { Song } from '@/types';
import confetti from 'canvas-confetti';
import { useNavigate } from 'react-router-dom';
import { useDebounce } from '@/hooks/useDebounce';
import { QualityDropdown } from '@/components/QualityDropdown';
import { useShallow } from 'zustand/react/shallow';

export const SearchPage = () => {
  const {
    searchQuery,
    searchType,
    searchResults,
    searchSuggestions,
    isLoading,
    isLoadingSuggestions,
    error,
    searchYouTube,
    getSearchSuggestions,
    setSearchType,
    clearResults,
    clearSuggestions,
  } = useYouTubeStore(
    useShallow((s) => ({
      searchQuery: s.searchQuery,
      searchType: s.searchType,
      searchResults: s.searchResults,
      searchSuggestions: s.searchSuggestions,
      isLoading: s.isLoading,
      isLoadingSuggestions: s.isLoadingSuggestions,
      error: s.error,
      searchYouTube: s.searchYouTube,
      getSearchSuggestions: s.getSearchSuggestions,
      setSearchType: s.setSearchType,
      clearResults: s.clearResults,
      clearSuggestions: s.clearSuggestions,
    }))
  );
  const { currentSong, isPlaying, playAlbum, togglePlay } = usePlayerStore(
    useShallow((s) => ({
      currentSong: s.currentSong,
      isPlaying: s.isPlaying,
      playAlbum: s.playAlbum,
      togglePlay: s.togglePlay,
    }))
  );
  const navigate = useNavigate();
  const [inputValue, setInputValue] = useState('');
  const [displayText, setDisplayText] = useState('¿que escuchamos?');
  const [isAnimatingOut, setIsAnimatingOut] = useState(false);
  const [isAnimatingIn, setIsAnimatingIn] = useState(false);
  const [showEasterEgg, setShowEasterEgg] = useState(false);
  const [isEasterEggFadingOut, setIsEasterEggFadingOut] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Debounce para las sugerencias
  const debouncedSearchValue = useDebounce(inputValue, 300);

  // Handle text transition animation when searchQuery changes
  useEffect(() => {
    const typeLabels = {
      songs: 'canciones',
      albums: 'álbumes',
      videos: 'videos',
    };

    const newText = searchQuery
      ? `${typeLabels[searchType]} para "${searchQuery}"`
      : '¿que escuchamos?';

    // If text is different, animate the transition
    if (newText !== displayText) {
      // Start exit animation
      setIsAnimatingOut(true);

      setTimeout(() => {
        // Change text and start enter animation
        setDisplayText(newText);
        setIsAnimatingOut(false);
        setIsAnimatingIn(true);

        setTimeout(() => {
          // End enter animation
          setIsAnimatingIn(false);
        }, 300);
      }, 200);
    }
  }, [searchQuery, searchType, displayText]);

  // Auto-search when search type changes (if there's already a query)
  useEffect(() => {
    if (searchQuery && searchQuery.trim()) {
      searchYouTube(searchQuery, searchType);
    }
    // searchQuery and searchYouTube intentionally omitted: this only fires on
    // tab switch (searchType), not on every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchType]);

  // Get search suggestions when user types
  useEffect(() => {
    if (
      debouncedSearchValue &&
      debouncedSearchValue.trim().length >= 2 &&
      isFocused
    ) {
      getSearchSuggestions(debouncedSearchValue);
      setShowSuggestions(true);
    } else {
      clearSuggestions();
      setShowSuggestions(false);
    }
  }, [debouncedSearchValue, isFocused, getSearchSuggestions, clearSuggestions]);

  // Handle click outside to close suggestions
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Easter egg function
  const triggerEasterEgg = () => {
    // Trigger confetti with theme-appropriate colors
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: [
        '#22c55e',
        '#16a34a',
        '#84cc16',
        '#eab308',
        '#f59e0b',
        '#10b981',
      ],
    });

    // Show message
    setShowEasterEgg(true);
    setIsEasterEggFadingOut(false);

    // Start fade out animation after 2 seconds
    setTimeout(() => {
      setIsEasterEggFadingOut(true);
    }, 2000);

    // Completely hide message after fade out completes
    setTimeout(() => {
      setShowEasterEgg(false);
      setIsEasterEggFadingOut(false);
    }, 2500);
  };

  // Check for easter egg keywords
  const checkEasterEgg = (searchTerm: string) => {
    const lowerSearch = searchTerm.toLowerCase();
    const easterEggKeywords = [
      'john frusciante',
      'rhcp',
      'red hot chili peppers',
    ];

    return easterEggKeywords.some((keyword) => lowerSearch.includes(keyword));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim()) {
      // Check for easter egg before searching
      if (checkEasterEgg(inputValue)) {
        triggerEasterEgg();
      }
      searchYouTube(inputValue, searchType);
    }
  };

  const handlePlay = (youtubeSong: any) => {
    const isCurrentSong = currentSong?._id === youtubeSong.videoId;
    if (isCurrentSong) {
      togglePlay();
      return;
    }

    // Build the full queue from all current search results so next/prev work correctly
    const queue: Song[] = searchResults.map((r: any) => ({
      _id: r.videoId,
      title: r.title,
      artist: r.artist,
      albumId: null,
      imageUrl: r.imageUrl,
      audioUrl: null,
      duration: r.duration,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      videoId: r.videoId,
      isYouTube: true,
    }));

    const startIndex = queue.findIndex((s) => s._id === youtubeSong.videoId);
    playAlbum(queue, startIndex === -1 ? 0 : startIndex);
  };

  const handleAlbumClick = (album: any) => {
    // Navegar a la página de álbum de YouTube
    const albumId = album.albumId || album.videoId || album._id;
    if (albumId) {
      navigate(`/youtube-albums/${albumId}`);
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    setInputValue(suggestion);
    setShowSuggestions(false);
    setIsFocused(false);
    inputRef.current?.blur();

    // Trigger search with suggestion
    if (checkEasterEgg(suggestion)) {
      triggerEasterEgg();
    }
    searchYouTube(suggestion, searchType);
  };

  const handleInputFocus = () => {
    setIsFocused(true);
    if (inputValue.trim().length >= 2 && searchSuggestions.length > 0) {
      setShowSuggestions(true);
    }
  };

  const handleInputBlur = () => {
    // Delay blur to allow suggestion click
    setTimeout(() => {
      setIsFocused(false);
      setShowSuggestions(false);
    }, 150);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputValue(value);

    if (value.trim().length < 2) {
      setShowSuggestions(false);
      clearSuggestions();
    }
  };

  return (
    <main className="rounded-md overflow-hidden h-full bg-gradient-to-b from-zinc-800 to-zinc-900">
      <Topbar />

      {/* Easter Egg Message */}
      {showEasterEgg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
          <div
            className={`bg-gradient-to-r from-green-700 via-emerald-700 to-green-800 text-white px-8 py-4 rounded-xl shadow-2xl transition-all duration-500 ${
              isEasterEggFadingOut
                ? 'animate-out fade-out zoom-out-50'
                : 'animate-in zoom-in-50 fade-in'
            }`}>
            <p className="text-xl font-bold text-center">
              🎸 ¡Que buen gusto de música eh, kudos to you! 🎸
            </p>
          </div>
        </div>
      )}
      <ScrollArea className="h-[calc(100vh-180px)]">
        <div className="p-4 sm:p-6">
          {/* Title - shows search results or default with animation */}
          <div className="flex items-center justify-between mb-6">
            <div className="relative overflow-hidden">
              <h1
                className={`text-2xl sm:text-3xl font-bold ${
                  isAnimatingOut
                    ? 'animate-out slide-out-to-left duration-200'
                    : isAnimatingIn
                    ? 'animate-in slide-in-from-left duration-300'
                    : ''
                }`}>
                {displayText}
              </h1>
            </div>
            {searchQuery && searchResults.length > 0 && (
              <Button
                variant="link"
                className="text-sm text-zinc-400 hover:text-white"
                onClick={clearResults}>
                Clear results
              </Button>
            )}
          </div>

          {/* Search Form */}
          <div className="mb-8">
            <form onSubmit={handleSubmit} className="flex gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-zinc-400 size-4" />
                <Input
                  ref={inputRef}
                  type="text"
                  placeholder="Search for songs, artists, albums..."
                  value={inputValue}
                  onChange={handleInputChange}
                  onFocus={handleInputFocus}
                  onBlur={handleInputBlur}
                  className="pl-10 bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-400"
                />

                {/* Search Suggestions Dropdown */}
                {showSuggestions &&
                  (searchSuggestions.length > 0 || isLoadingSuggestions) && (
                    <div
                      ref={suggestionsRef}
                      className="absolute z-50 w-full mt-1 bg-zinc-800 border border-zinc-700 rounded-md shadow-lg max-h-60 overflow-y-auto">
                      {isLoadingSuggestions ? (
                        <div className="p-3 text-center text-zinc-400">
                          <Loader className="size-4 animate-spin mx-auto mb-2" />
                          <span className="text-sm">
                            Loading suggestions...
                          </span>
                        </div>
                      ) : (
                        searchSuggestions.map((suggestion, index) => (
                          <div
                            key={index}
                            onClick={() => handleSuggestionClick(suggestion)}
                            className="px-4 py-2 text-white hover:bg-zinc-700 cursor-pointer flex items-center gap-3 border-b border-zinc-700 last:border-b-0">
                            <Search className="size-4 text-zinc-400" />
                            <span className="truncate">{suggestion}</span>
                          </div>
                        ))
                      )}
                    </div>
                  )}
              </div>
              <Button
                type="submit"
                disabled={isLoading || !inputValue.trim()}
                className="bg-green-500 hover:bg-green-400 text-black">
                {isLoading ? (
                  <Loader className="size-4 animate-spin" />
                ) : (
                  <Search className="size-4" />
                )}
                Search
              </Button>
            </form>

            {/* Search Type Buttons */}
            <div className="flex gap-2 mt-4">
              <Button
                variant={searchType === 'songs' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSearchType('songs')}
                className={
                  searchType === 'songs'
                    ? 'bg-green-500 hover:bg-green-400 text-black'
                    : 'border-zinc-700 text-zinc-300 hover:text-white hover:border-zinc-600'
                }>
                Canciones
              </Button>
              <Button
                variant={searchType === 'albums' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSearchType('albums')}
                className={
                  searchType === 'albums'
                    ? 'bg-green-500 hover:bg-green-400 text-black'
                    : 'border-zinc-700 text-zinc-300 hover:text-white hover:border-zinc-600'
                }>
                Álbumes
              </Button>
              <Button
                variant={searchType === 'videos' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSearchType('videos')}
                className={
                  searchType === 'videos'
                    ? 'bg-green-500 hover:bg-green-400 text-black'
                    : 'border-zinc-700 text-zinc-300 hover:text-white hover:border-zinc-600'
                }>
                Videos
              </Button>
            </div>
          </div>

          {/* Search Results */}
          {searchQuery && (
            <div className="mb-8">
              {isLoading && (
                <div className="flex items-center justify-center py-12">
                  <Loader className="size-8 animate-spin text-green-500" />
                  <span className="ml-2 text-zinc-400">
                    Searching YouTube...
                  </span>
                </div>
              )}

              {error && (
                <div className="text-center py-12">
                  <p className="text-red-400 mb-4">{error}</p>
                  <Button
                    onClick={() => searchYouTube(searchQuery)}
                    variant="outline">
                    Try again
                  </Button>
                </div>
              )}

              {!isLoading &&
                !error &&
                searchResults.length === 0 &&
                searchQuery && (
                  <div className="text-center py-12">
                    <p className="text-zinc-400">
                      No results found for "{searchQuery}"
                    </p>
                  </div>
                )}

              {/* Results - Responsive design: list on mobile, grid on desktop */}
              {!isLoading && searchResults.length > 0 && (
                <div className="space-y-2 lg:space-y-0 lg:grid lg:grid-cols-3 lg:gap-4">
                  {searchResults.map((item) => (
                    <div
                      key={item.videoId}
                      onClick={
                        searchType === 'albums'
                          ? () => handleAlbumClick(item)
                          : undefined
                      }
                      className={`flex lg:flex-col items-center lg:items-start bg-zinc-800/50 rounded-md overflow-hidden
                        hover:bg-zinc-700/50 transition-colors group relative ${
                          searchType === 'albums' ? 'cursor-pointer' : ''
                        }`}>
                      <img
                        src={item.imageUrl}
                        alt={item.title}
                        className="w-16 sm:w-20 lg:w-full h-16 sm:h-20 lg:h-48 lg:aspect-square object-cover flex-shrink-0"
                      />
                      <div className="flex-1 lg:flex-none p-4 min-w-0 lg:w-full">
                        <p className="font-medium truncate">{item.title}</p>
                        <p className="text-sm text-zinc-400 truncate">
                          {item.artist}
                        </p>
                        {/* Solo mostrar duración para canciones y videos */}
                        {(searchType === 'songs' || searchType === 'videos') &&
                          item.duration > 0 && (
                            <p className="text-xs text-zinc-500 mt-1">
                              {Math.floor(item.duration / 60)}:
                              {(item.duration % 60).toString().padStart(2, '0')}
                            </p>
                          )}
                      </div>

                      {/* Play & Download Buttons - solo para canciones y videos */}
                      {(searchType === 'songs' || searchType === 'videos') && (
                        <div className="flex items-center gap-2 mr-4 lg:mr-0 lg:absolute lg:bottom-4 lg:right-4">
                          {/* Download Button with Quality Dropdown */}
                          <div className="opacity-0 group-hover:opacity-100 lg:translate-y-2 lg:group-hover:translate-y-0 transition-all">
                            <QualityDropdown
                              videoId={item.videoId}
                              title={item.title}
                              artist={item.artist}
                              size="icon"
                              variant="outline"
                              contentType={
                                searchType === 'songs' ? 'songs' : 'videos'
                              }
                            />
                          </div>

                          {/* Play Button */}
                          <Button
                            size="icon"
                            onClick={() => handlePlay(item)}
                            className={`w-8 h-8 lg:w-10 lg:h-10 bg-green-500 hover:bg-green-400 hover:scale-105 transition-all
                              opacity-0 group-hover:opacity-100 lg:translate-y-2 lg:group-hover:translate-y-0 ${
                                currentSong?._id === item.videoId
                                  ? 'opacity-100 lg:translate-y-0'
                                  : ''
                              }`}>
                            {currentSong?._id === item.videoId && isPlaying ? (
                              <Pause className="size-3 lg:size-4 text-black" />
                            ) : (
                              <Play className="size-3 lg:size-4 text-black" />
                            )}
                          </Button>
                        </div>
                      )}

                      {/* Album indicator */}
                      {searchType === 'albums' && (
                        <div className="mr-4 lg:mr-0 lg:absolute lg:bottom-4 lg:right-4 opacity-0 group-hover:opacity-100 transition-all">
                          <div className="bg-green-500 hover:bg-green-400 hover:scale-105 transition-all rounded-full p-3">
                            <Play className="size-4 text-black" />
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Initial state */}
          {!searchQuery && (
            <div className="text-center py-24">
              <Search className="size-16 text-zinc-600 mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">Search</h3>
              <p className="text-zinc-400">
                Discover millions of songs from 🤫
              </p>
            </div>
          )}
        </div>
      </ScrollArea>
    </main>
  );
};


