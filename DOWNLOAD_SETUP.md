# 🎵 **Guía de Instalación - Funcionalidad de Descarga**

## 🚀 **Instalación Rápida**

### 1. **Instalar Dependencias**

```bash
# Backend
cd backend
npm install ytdlp-nodejs

# Frontend - las dependencias ya están incluidas
cd frontend
npm install
```

### 2. **Instalar FFmpeg (Requerido)**

FFmpeg es necesario para convertir archivos de audio/video:

```bash
# Ubuntu/Debian
sudo apt update && sudo apt install -y ffmpeg

# macOS (con Homebrew)
brew install ffmpeg

# Windows (con Chocolatey)
choco install ffmpeg
```

### 3. **Verificar Instalación**

El servicio verificará automáticamente:

- `yt-dlp` - Se descarga automáticamente en el primer uso
- `ffmpeg` - Debe estar instalado manualmente (paso anterior)

## 🎛️ **Cómo Usar**

### **Descarga Individual (Canciones/Videos)**

1. **Buscar**: Ve a la página de búsqueda y busca cualquier canción o video
2. **Descargar**: Haz hover sobre un resultado y haz clic en el botón de descarga (ícono ⬇️)
3. **Seguir Progreso**: Haz clic en el botón de descarga flotante (esquina inferior derecha) para ver el progreso

### **Descarga de Álbumes Completos**

1. **Buscar Álbum**: Busca un álbum usando el filtro "Álbumes"
2. **Abrir Álbum**: Haz clic en un álbum para abrir la página dedicada
3. **Descargar**: Haz clic en el botón de descarga en la página del álbum
4. **Seguir Progreso**: Se descargará cada canción del álbum secuencialmente

### **Panel de Descargas**

- **Botón Flotante**: Siempre visible en la esquina inferior derecha
- **Indicador**: Muestra el número de descargas activas
- **Pestañas**:
  - **Active**: Descargas en progreso con barras de progreso
  - **History**: Historial de descargas completadas

## ⚙️ **Configuración de Formato y Calidad**

### **Formatos Disponibles**

**Audio (Recomendado para álbumes):**

- `MP3` - Formato universal, compatible con todo
- `FLAC` - Sin compresión, máxima calidad
- `WAV` - Sin compresión, archivos grandes
- `M4A` - Buena calidad, compatible con Apple
- `AAC` - Buena compresión, buena calidad
- `OPUS` - Moderna, excelente compresión

**Video (Solo canciones individuales):**

- `MP4` - Universal, buena compatibilidad
- `WebM` - Formato web, buena compresión

### **Opciones de Calidad**

**Para Audio:**

- `Highest Quality` - Máxima calidad disponible
- `High/Medium/Low` - Niveles predefinidos
- `10` a `5` - Escala numérica (10 = mejor)

**Para Video:**

- `Highest` - Máxima resolución disponible
- Se adapta automáticamente según el contenido

## 🔧 **Funcionalidades Avanzadas**

### **Progress Tracking en Tiempo Real**

- **WebSocket**: Conexión en tiempo real para actualizaciones de progreso
- **Progreso por Canción**: Para álbumes, ve el progreso de cada canción
- **Progreso General**: Barra de progreso total del álbum
- **Información Detallada**: Velocidad de descarga, tiempo estimado

### **Gestión de Descargas**

- **Cancelar Descargas**: Botón de stop en descargas activas
- **Prevenir Duplicados**: No permite descargar el mismo archivo dos veces
- **Limpieza Automática**: Archivos viejos se eliminan automáticamente
- **Historial**: Mantiene registro de descargas completadas

### **Manejo de Errores**

- **Reintentos Automáticos**: Para errores temporales
- **Notificaciones**: Toast messages con información del estado
- **Logs Detallados**: Para debugging en consola
- **Graceful Degradation**: Continúa con otras canciones si una falla

## 📁 **Estructura de Archivos**

### **Descargas Individuales**

```
backend/downloads/
  ├── Canción - Artista.mp3
  ├── Otro Video - Artista.flac
  └── ...
```

### **Descargas de Álbumes**

```
backend/downloads/
  └── Nombre del Álbum/
      ├── 01. Primera Canción.mp3
      ├── 02. Segunda Canción.mp3
      └── ...
```

## 🛠️ **API Endpoints**

### **Descarga Individual**

```bash
POST /api/download/song
{
  "videoId": "dQw4w9WgXcQ",
  "format": "mp3",
  "quality": "highest"
}
```

### **Descarga de Álbum**

```bash
POST /api/download/album
{
  "albumId": "PLrGnKaKBLJoR...",
  "format": "mp3",
  "quality": "highest"
}
```

### **Estado de Descarga**

```bash
GET /api/download/status/{downloadKey}
GET /api/download/active
```

### **Información de Video**

```bash
GET /api/download/info/{videoId}
```

### **Gestión**

```bash
DELETE /api/download/cancel/{downloadKey}
POST /api/download/cleanup?maxAgeHours=24
GET /api/download/health
```

## 🎯 **Mejores Prácticas**

### **Para Usuarios**

1. **Selecciona el formato correcto**: MP3 para uso general, FLAC para audiófilia
2. **Revisa el progreso**: Usa el panel de descargas para monitorear
3. **Espacio en disco**: Los álbumes pueden ocupar mucho espacio
4. **Conexión estable**: Para descargas largas (álbumes completos)

### **Para Desarrollo**

1. **Testing**: Prueba con videos cortos primero
2. **Logs**: Revisa la consola para errores detallados
3. **Cleanup**: Ejecuta cleanup regularmente en producción
4. **Monitoring**: Usa el health check endpoint

## 🔍 **Troubleshooting**

### **Problemas Comunes**

**"yt-dlp not found"**

- El binario se descarga automáticamente en el primer uso
- En Docker, asegúrate de tener permisos de escritura

**"Download failed"**

- Video puede estar geobloqueado o privado
- Verifica la conexión a internet
- Algunos videos tienen restricciones de descarga

**"WebSocket disconnected"**

- Normal, se reconecta automáticamente
- Revisa el estado de conexión en el panel

**Descargas lentas**

- Depende de la velocidad de internet
- YouTube puede limitar la velocidad
- Prueba con calidad más baja

### **Health Check**

```bash
curl http://localhost:5000/api/download/health
```

**Respuesta esperada:**

```json
{
  "success": true,
  "status": "healthy",
  "ytdlpInstalled": true,
  "ffmpegAvailable": true,
  "activeDownloads": 0,
  "warnings": []
}
```

**Respuesta si FFmpeg no está instalado:**

```json
{
  "success": true,
  "status": "degraded",
  "ytdlpInstalled": true,
  "ffmpegAvailable": false,
  "activeDownloads": 0,
  "warnings": ["FFmpeg not found - audio conversion may fail"]
}
```

## 🚀 **Deployment**

### **Desarrollo Local**

```bash
# Backend
cd backend
npm run dev

# Frontend
cd frontend
npm run dev
```

### **Producción**

**Railway/Render/Vercel:**

- Funciona out-of-the-box
- `ytdlp-nodejs` maneja automáticamente la instalación
- Asegúrate de tener suficiente espacio en disco

**Docker:**

```dockerfile
# En tu Dockerfile del backend
RUN apt-get update && apt-get install -y python3 python3-pip
# ytdlp-nodejs se encarga del resto
```

**VPS/Servidor:**

- Instala Node.js 18+
- `ytdlp-nodejs` maneja las dependencias automáticamente
- Configura cleanup automático con cron

## ⚡ **Performance Tips**

1. **Concurrent Downloads**: Máximo 2-3 descargas simultáneas
2. **Storage**: Implementa cleanup automático cada 24 horas
3. **Memory**: Cada descarga usa ~50-100MB RAM
4. **Network**: Bandwidth intensivo, considera límites
5. **Caching**: Los archivos se sobrescriben si ya existen

## 🎉 **¡Listo para Usar!**

La funcionalidad de descarga está completamente integrada y lista para usar. Prueba descargando una canción individual primero, luego experimenta con álbumes completos.

**¡Disfruta descargando tu música favorita! 🎵**
