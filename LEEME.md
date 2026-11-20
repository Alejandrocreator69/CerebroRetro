# ¿Quién eres? ¿Te conoces? · Web retro del cerebro

## Publicar
Sube **todo el contenido** de esta carpeta (incluido el archivo oculto `.htaccess`) a la raíz de tu hosting o a una subcarpeta, por ejemplo `/cerebro/`. No hay que compilar nada.

Funciona también abriendo `index.html` con doble clic: no usa módulos JS y Three.js va incluido en `lib/`.

## Archivos
- `index.html`: estructura y textos del manual (lo que se lee al hacer scroll).
- `styles.css`: estética arcade y synthwave (colores en `:root`).
- `lib/manifest.js`: **contenido editable**: regiones, quiz, emociones, logros y puntos.
- `main.js`: niveles del juego (los textos largos de cada nivel están en `VIEWS`).
- `js/brain3d.js`: cerebro 3D procedural y shader (modo anatómico y modo holograma).
- `js/audio.js`: música synthwave original y efectos 8-bit, generados en vivo (sin mp3).
- `lib/three.min.js`: Three.js r160 local.

## Trucos
- Enlace directo a un nivel: `index.html#nivel-7` (del 1 al 9).
- El récord (HI-SCORE) y la preferencia de música se guardan en el navegador del visitante.
- Cada vez que cambies CSS o JS, actualiza `?v=20261120` en `index.html` con la fecha del día.
- Si un ordenador antiguo va lento, baja los valores `84` y `60` en `buildBrain()` de `js/brain3d.js`.
