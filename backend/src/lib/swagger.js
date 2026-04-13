import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Spotify Clone API Docs',
      version: '1.0.0',
      description:
        'REST API documentation for the Realtime Spotify Clone. All protected routes require a valid Clerk session token sent as `Authorization: Bearer <token>`.',
    },
    servers: [
      {
        url: 'http://localhost:5000',
        description: 'Development server',
      },
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Clerk session token',
        },
      },
      schemas: {
        Song: {
          type: 'object',
          properties: {
            _id: { type: 'string', example: '64f1a2b3c4d5e6f7a8b9c0d1' },
            title: { type: 'string', example: 'Bohemian Rhapsody' },
            artist: { type: 'string', example: 'Queen' },
            imageUrl: { type: 'string', example: 'https://res.cloudinary.com/demo/image/upload/v1/cover.jpg' },
            audioUrl: { type: 'string', example: 'https://res.cloudinary.com/demo/video/upload/v1/song.mp3' },
            duration: { type: 'number', example: 354 },
            albumId: {
              type: 'string',
              nullable: true,
              example: '64f1a2b3c4d5e6f7a8b9c0d2',
            },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        Album: {
          type: 'object',
          properties: {
            _id: { type: 'string', example: '64f1a2b3c4d5e6f7a8b9c0d2' },
            title: { type: 'string', example: 'A Night at the Opera' },
            artist: { type: 'string', example: 'Queen' },
            imageUrl: { type: 'string', example: 'https://res.cloudinary.com/demo/image/upload/v1/album.jpg' },
            releaseYear: { type: 'number', example: 1975 },
            songs: {
              type: 'array',
              items: { $ref: '#/components/schemas/Song' },
            },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        User: {
          type: 'object',
          properties: {
            _id: { type: 'string', example: '64f1a2b3c4d5e6f7a8b9c0d3' },
            fullName: { type: 'string', example: 'Freddie Mercury' },
            imageUrl: { type: 'string', example: 'https://example.com/avatar.jpg' },
            clerkId: { type: 'string', example: 'user_2abc123def456' },
            isAdmin: { type: 'boolean', example: false },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        Message: {
          type: 'object',
          properties: {
            _id: { type: 'string', example: '64f1a2b3c4d5e6f7a8b9c0d4' },
            senderId: { type: 'string', example: 'user_2abc123def456' },
            receiverId: { type: 'string', example: 'user_2xyz789ghi012' },
            content: { type: 'string', example: 'Hey! Check out this song.' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        Playlist: {
          type: 'object',
          properties: {
            _id: { type: 'string', example: '64f1a2b3c4d5e6f7a8b9c0d5' },
            name: { type: 'string', example: 'My Favorites' },
            description: { type: 'string', example: 'Songs I love' },
            imageUrl: { type: 'string', example: 'https://example.com/playlist.jpg' },
            clerkId: { type: 'string', example: 'user_2abc123def456' },
            songs: {
              type: 'array',
              items: { $ref: '#/components/schemas/Song' },
            },
            isPublic: { type: 'boolean', example: false },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        Favorite: {
          type: 'object',
          properties: {
            _id: { type: 'string', example: '64f1a2b3c4d5e6f7a8b9c0d6' },
            clerkId: { type: 'string', example: 'user_2abc123def456' },
            songId: { type: 'string', example: '64f1a2b3c4d5e6f7a8b9c0d1' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        Stats: {
          type: 'object',
          properties: {
            totalSongs: { type: 'number', example: 150 },
            totalAlbums: { type: 'number', example: 20 },
            totalUsers: { type: 'number', example: 500 },
            totalArtists: { type: 'number', example: 45 },
          },
        },
        DownloadRequest: {
          type: 'object',
          required: ['songId', 'format'],
          properties: {
            songId: { type: 'string', example: '64f1a2b3c4d5e6f7a8b9c0d1' },
            format: { type: 'string', enum: ['mp3', 'flac', 'opus', 'aac'], example: 'mp3' },
            quality: { type: 'string', enum: ['low', 'medium', 'high', 'best'], example: 'high' },
          },
        },
        DownloadStatus: {
          type: 'object',
          properties: {
            downloadKey: { type: 'string', example: 'dl_abc123' },
            status: {
              type: 'string',
              enum: ['pending', 'downloading', 'processing', 'ready', 'error'],
            },
            progress: { type: 'number', example: 65 },
            filename: { type: 'string', example: 'bohemian-rhapsody.mp3' },
            error: { type: 'string', nullable: true },
          },
        },
        Error: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            error: {
              type: 'object',
              properties: {
                message: { type: 'string', example: 'Something went wrong' },
              },
            },
          },
        },
      },
    },
    security: [],
  },
  apis: ['./src/routes/*.js'],
};

const swaggerSpec = swaggerJsdoc(options);

/**
 * Mount Swagger UI on the Express app at /api/docs
 * @param {import('express').Application} app
 */
export function setupSwagger(app) {
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
  app.get('/api/docs.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
  });
}
