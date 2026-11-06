# Servidor de Ahspai (Órbita)

Servidor multijugador de **Ahspai TCG**, hecho con Órbita (Node.js + WebSocket).

- `server.js` – Órbita (salas, matchmaking, base de datos).
- `scripts.js` – la parte de Ahspai: empezar partidas, recibir jugadas y mandarle a cada jugador lo que puede ver.
- `ahspai/motor.js` – las reglas del juego. `ahspai/cartas.js` – las 62 cartas.

## Correr en tu compu
```
npm install
npm start
```

## Pruebas
```
node ahspai/prueba.js     # reglas
npm test                  # Órbita
```

## Render
- Tipo: **Web Service**, Runtime **Node**
- Build Command: `npm install`
- Start Command: `npm start`
- El puerto lo pone Render solo (variable `PORT`).

En GameMaker (`orb_config`):
```
#macro ORB_HOST   "TU-SERVICIO.onrender.com"
#macro ORB_PORT   443
#macro ORB_SECURE true
```
