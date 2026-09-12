# GordoDJ - Bot de Música para Discord

**English** · [Español](README.es.md)

Un bot de música para Discord que te permite reproducir música de YouTube, Spotify y SoundCloud directamente en tus canales de voz.

## Características

- Reproducción de música desde múltiples fuentes (YouTube, Spotify, SoundCloud)
- Comandos de control de reproducción (play, pause, resume, skip, stop)
- Control de volumen
- Cola de reproducción con límite de 100 canciones
- Soporte para playlists (máximo 15 canciones por playlist para evitar cuelgues en radios infinitas)
- Control de acceso: solo quien está en el mismo canal de voz que el bot lo controla
- Cooldown de 5s por usuario en `/play` para evitar abuso
- Errores de validación ephemeral (solo los ve quien los provocó)

## Comandos

- `/play [cancion]` - Reproduce una canción o playlist (URL o búsqueda por texto)
- `/stop` - Detiene la música y el bot sale del canal de voz
- `/skip` - Salta a la siguiente canción
- `/pause` - Pausa la canción actual
- `/resume` - Reanuda la canción pausada
- `/queue` - Muestra la lista de canciones en cola
- `/volume [1-100]` - Cambia el volumen del bot
- `/leave` - Hace que el bot salga del canal de voz
- `/help` - Muestra la lista de comandos disponibles

## Requisitos

- Node.js v20.18.1 o superior
- FFmpeg instalado en el sistema (o el contenedor de Docker lo incluye)
- Token de bot de Discord
- ID de aplicación de Discord

## Instalación

1. Clona este repositorio:
   ```
   git clone https://github.com/santino-rosso/BotMusicaDiscord.git
   cd BotMusicaDiscord
   ```

2. Instala las dependencias y el binario de yt-dlp:
   ```
   npm install
   npm run setup:ytdlp
   ```

3. Crea un archivo `.env` en la raíz del proyecto:
   ```
   TOKEN=tu_token_de_discord
   CLIENT_ID=tu_id_de_aplicacion
   ```

4. (Opcional) Para reproducción completa de playlists y álbumes de Spotify, creá una app en [Spotify Developer Dashboard](https://developer.spotify.com/dashboard) y agregá las credenciales al `.env`:
   ```
   SPOTIFY_CLIENT_ID=tu_spotify_client_id
   SPOTIFY_CLIENT_SECRET=tu_spotify_client_secret
   ```
   Sin ellas, Spotify funciona a medias (solo canciones individuales). El audio siempre se reproduce desde YouTube; las credenciales solo habilitan la resolución de listas completas.

5. Inicia el bot:
   ```
   node index.js
   ```

Los comandos slash se registran automáticamente al arrancar (y se re-sincronizan cada 6 horas si cambian).
Los comandos globales pueden tardar hasta 1 hora en aparecer — definí `GUILD_ID` en el `.env` para registro instantáneo mientras probás.

### Docker

```bash
docker compose up -d --build
```

El contenedor incluye healthcheck real (heartbeat cada 30s), límites de memoria/CPU y rotación de logs.

## Configuración en Discord Developer Portal

1. Ve a [Discord Developer Portal](https://discord.com/developers/applications)
2. Crea una nueva aplicación o selecciona una existente
3. Ve a la sección "Bot" y genera un token (guardalo en `.env`)
4. Ve a OAuth2 > URL Generator, selecciona los scopes "bot" y "applications.commands"
5. Selecciona los permisos: View Channels, Send Messages, Embed Links, Read Message History, Connect, Speak
6. Usa la URL generada para invitar al bot a tus servidores

> **Intents**: el bot solo necesita `Guilds`, `GuildMessages` y `GuildVoiceStates` (todos no-privilegiados). No hace falta habilitar Message Content, Server Members ni Presence en el portal.

## Solución de problemas

- **Bot online pero `/` no muestra comandos**: la causa más común. Verificá en orden:
  1. El `.env` debe tener **ambos** `TOKEN` y `CLIENT_ID` de *tu propia* aplicación (Developer Portal > General Information > Application ID). Sin `CLIENT_ID` los logs muestran `❌ Falta CLIENT_ID...` y los comandos nunca se registran. Si lo corregís, solo reiniciá — el bot detecta el cambio y los re-registra solo.
  2. El bot debe estar invitado con el scope `applications.commands` (`node generate-invite.js` ya incluye `scope=bot%20applications.commands`). Si lo invitaste a mano solo con `bot`, re-invitalo con ambos scopes.
  3. Los comandos globales tardan **hasta 1 hora** en aparecer. Esperá + apretá `Ctrl+R` en Discord para refrescar, o definí `GUILD_ID` en el `.env` para comandos de servidor instantáneos mientras probás.
- **"No se pudo reproducir"**: revisá los logs (`docker logs gordodj-bot`). Si aparece `Sign in to confirm you're not a bot`, YouTube está bloqueando la IP; el bot usa el cliente `android` de yt-dlp para evitarlo y, si es necesario, podés montar `cookies.txt` (formato Netscape) en la raíz del proyecto — el contenedor lo detecta automáticamente.
- **Los enlaces no funcionan pero las búsquedas por texto sí**: el binario de yt-dlp falta o quedó truncado (descarga interrumpida durante un build). Las búsquedas no usan yt-dlp (van por SoundCloud), por eso solo fallan los enlaces. El bot verifica el binario al arrancar y avisa; para arreglarlo corré `npm run setup:ytdlp` o recontruí la imagen (`docker compose build`).
- **El bot no responde**: verificá que esté `healthy` (`docker ps`) y que el token del `.env` sea válido.

## Dependencias

- discord.js - Framework para interactuar con la API de Discord
- distube - Reproductor de música para discord.js
- @distube/yt-dlp - Plugin para extracción de YouTube
- @distube/spotify - Plugin para soporte de Spotify
- @distube/soundcloud - Plugin para soporte de SoundCloud
- dotenv - Para manejar variables de entorno

## Testing

```bash
npm test                  # Unit tests (node:test, sin red ni dependencias extra)
npm run test:integration  # Opt-in: red real contra YouTube (requiere binario yt-dlp local)
```

Los tests de integración (`test/integration/`) quedan skipped en `npm test`; cubren la resolución de videos individuales y de radios RD acotadas (`--playlist-end 15`).

## Mejoras futuras

- **Escalado a cientos/miles de servidores**: sharding (una instancia por shard) + Redis para estado compartido + servicio de audio separado (Lavalink) + cookies/proxies rotativos para yt-dlp. El código ya está preparado (estado de colas aislado por guild en DisTube, sin estado global frágil); aplicar cuando el bot alcance ~100+ servidores o se acerque al límite práctico de guilds de discord.js (~2.500).

## Contribuir

¿Querés sumar? Leé [CONTRIBUTING.md](CONTRIBUTING.md) — reglas de oro: nunca commitees secretos, siempre con tests, commits convencionales.

## Licencia

[MIT](LICENSE)

## Autor

[Santino Rosso](https://github.com/santino-rosso)
