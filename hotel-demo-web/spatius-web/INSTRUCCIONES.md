Como integrar esto en HotelParaisoDemoQR

1. Sube spatius-web/ y api/spatius/token.js a hotel-demo-web (ya hecho via Claude).

2. 2. En Vercel: Build Command = cd spatius-web && npm install && npm run build (ya hecho).
   3. Agregar variables LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET.
  
   4. 3. index.html ya tiene la pestaña "Avatar 2" integrada (ya hecho).
     
      4. 4. Verificar en DevTools -> Network que el .wasm de AvatarKit cargue con status 200
         5. y Content-Type: application/wasm.
        
         6. 5. Correr el agente local (agent.py) para probar de punta a punta.
            6. 
