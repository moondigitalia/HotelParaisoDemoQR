/* Catálogo de arranque del demo. El dueño lo cambia desde su panel. */
/* Cada uniforme es una foto real del dueño (frente y espalda, ya recortadas) que la página pone en 3D.
   etiquetas: los colores se sacan solos de la foto; país y equipo los escribe el dueño. */
window.CATALOGO_BASE = [
  {
    id: 'aluxes-lila', nombre: 'Aluxes Capital · Principal', categoria: '', tipo: '3d', destacado: true, orden: 1,
    fotos: { frente: '/assets/catalogo/aluxes-lila-frente.webp', espalda: '', short: '' },
    mini: '/assets/catalogo/aluxes-lila-mini.jpg',
    colorShort: '#f3f3f5', colorCalceta: '#f3f3f5', colorTexto: '#2a2560',
    etiquetas: { colores: ['morado', 'blanco'], pais: 'México', equipo: 'Aluxes Capital' }
  },
  {
    id: 'america-2026', nombre: 'América 2026 · Local', categoria: 'Liga MX', tipo: '3d', destacado: true, orden: 2,
    fotos: { frente: '/assets/catalogo/america-2026-frente.webp', espalda: '/assets/catalogo/america-2026-espalda.webp', short: '/assets/catalogo/america-2026-short.webp' },
    mini: '/assets/catalogo/america-2026-mini.jpg',
    colorShort: '#222531', colorCalceta: '#f2d23c', colorFranja: '#1c2333', colorTexto: '#1c2333',
    etiquetas: { colores: ['amarillo', 'azul'], pais: 'México', equipo: 'Club América Águilas' }
  },
  {
    id: 'cruz-azul-2026-local', nombre: 'Cruz Azul 2026 · Local', categoria: 'Liga MX', tipo: '3d', destacado: true, orden: 3,
    fotos: { frente: '/assets/catalogo/cruz-azul-2026-local-frente.webp', espalda: '/assets/catalogo/cruz-azul-2026-local-espalda.webp', short: '/assets/catalogo/cruz-azul-2026-local-short.webp' },
    mini: '/assets/catalogo/cruz-azul-2026-local-mini.jpg',
    colorShort: '#1f6fc4', colorCalceta: '#1f6fc4', colorFranja: '#f3f3f5', colorTexto: '#ffffff',
    etiquetas: { colores: ['azul', 'blanco'], pais: 'México', equipo: 'Cruz Azul La Máquina Cementera' }
  },
  {
    id: 'cruz-azul-2026-visita', nombre: 'Cruz Azul 2026 · Visita', categoria: 'Liga MX', tipo: '3d', orden: 4,
    fotos: { frente: '/assets/catalogo/cruz-azul-2026-visita-frente.webp', espalda: '/assets/catalogo/cruz-azul-2026-visita-espalda.webp', short: '/assets/catalogo/cruz-azul-2026-visita-short.webp' },
    mini: '/assets/catalogo/cruz-azul-2026-visita-mini.jpg',
    colorShort: '#f3f3f5', colorCalceta: '#f3f3f5', colorFranja: '#1f6fc4', colorTexto: '#1f5fb8',
    etiquetas: { colores: ['blanco', 'azul'], pais: 'México', equipo: 'Cruz Azul La Máquina Cementera' }
  },
  {
    id: 'chivas-2026-local', nombre: 'Chivas 2026 · Local', categoria: 'Liga MX', tipo: '3d', destacado: true, orden: 5,
    fotos: { frente: '/assets/catalogo/chivas-2026-local-frente.webp', espalda: '/assets/catalogo/chivas-2026-local-espalda.webp', short: '/assets/catalogo/chivas-2026-local-short.webp' },
    mini: '/assets/catalogo/chivas-2026-local-mini.jpg',
    colorShort: '#1c2340', colorCalceta: '#1c2340', colorTexto: '#1c2340',
    etiquetas: { colores: ['rojo', 'blanco', 'azul'], pais: 'México', equipo: 'Chivas Guadalajara Rebaño Sagrado' }
  }
];
window.CONFIG_BASE = {
  whatsapp: '',
  horario: [{ dias: [1, 2, 3, 4, 5], abre: '09:00', cierra: '19:00' }, { dias: [6], abre: '09:00', cierra: '18:00' }, { dias: [0], abre: '09:00', cierra: '16:30' }],
  direccion: 'Calle 19 #38, Cancún, Q.R.',
  lema: 'La tienda de las estrellas',
  tallas: ['Niño 6', 'Niño 8', 'Niño 10', 'Niño 12', 'Niño 14', 'Ch', 'M', 'G', 'XG', 'XXG'],
  categorias: ['Liga MX', 'Liga europea', 'Mundial'],
  historia: '',
  calificacion: '4.3',
  opiniones: '150'
};
