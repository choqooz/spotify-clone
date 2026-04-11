export interface Song {
  _id: string;
  title: string;
  artist: string;
  albumId: string | null;
  imageUrl: string;
  audioUrl: string | null; // Can be null for YouTube songs
  duration: number;
  createdAt: string;
  updatedAt: string;
  // YouTube-specific fields
  videoId?: string; // YouTube video ID
  isYouTube?: boolean; // Flag to identify YouTube songs
}

export interface Album {
  _id: string;
  title: string;
  artist: string;
  imageUrl: string;
  releaseYear: number;
  songs: Song[];
}

export interface Stats {
  totalSongs: number;
  totalAlbums: number;
  totalUsers: number;
  totalArtists: number;
}

export interface Message {
  _id: string;
  senderId: string;
  receiverId: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface Playlist {
  _id: string;
  name: string;
  description: string;
  imageUrl: string;
  clerkId: string;
  songs: Song[];
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface User {
  _id: string;
  clerkId: string;
  fullName: string;
  imageUrl: string;
  isAdmin?: boolean;
}

export interface YouTubeSong {
  videoId: string;
  albumId?: string;
  title: string;
  artist: string;
  duration: number;
  thumbnails?: Array<{
    url: string;
    width: number;
    height: number;
  }>;
  imageUrl?: string;
}
