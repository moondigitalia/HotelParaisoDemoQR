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
