/* Catálogo de arranque del demo. El dueño lo cambia desde su panel. */
window.CATALOGO_BASE = [
  {
    id: 'aluxes-principal', nombre: 'Aluxes Capital · Principal', categoria: 'Equipos de la casa', tipo: 'diseno', destacado: true, orden: 1,
    diseno: {
      manga: 'corta', relleno: { tipo: 'img', src: '/assets/tela-lila.jpg', base: '#EEEAFB' }, costados: '#8B7BE0', cuello: '#FFFFFF',
      short: { color: '#FFFFFF' },
      logos: [{ src: '/assets/aluxes-negro.png', pos: 'pecho-izq' }],
      patrocinadores: ['/assets/boulder-blanco.png', '/assets/porfirio-blanco.png', '/assets/moon-blanco.png'],
      colorPatrocinadores: '#2E2763', colorTexto: '#111111', numeroShort: true, sello: true
    }
  },
  {
    id: 'aluxes-secundario', nombre: 'Aluxes Capital · Secundario', categoria: 'Equipos de la casa', tipo: 'diseno', destacado: true, orden: 2,
    diseno: {
      manga: 'larga', relleno: { tipo: 'color', color: '#151515' }, cuello: '#151515',
      short: { color: '#151515' },
      logos: [{ src: '/assets/aluxes-blanco.png', pos: 'pecho-izq' }],
      patrocinadores: ['/assets/boulder-blanco.png', '/assets/porfirio-blanco.png', '/assets/moon-blanco.png'],
      colorTexto: '#FFFFFF', sello: true
    }
  },
  {
    id: 'msport-olas', nombre: 'Olas Turquesa', categoria: 'Diseños M Sport', tipo: 'diseno', orden: 3,
    diseno: {
      manga: 'corta', relleno: { tipo: 'img', src: '/assets/tela-olas.jpg', base: '#BFEDE6' }, cuello: '#FFFFFF',
      short: { color: '#FFFFFF' }, colorTexto: '#1F2A2C', sello: true
    }
  },
  {
    id: 'msport-estrella', nombre: 'Estrella', categoria: 'Diseños M Sport', tipo: 'diseno', orden: 4,
    diseno: {
      manga: 'corta', relleno: { tipo: 'rayas', colores: ['#FFC61A', '#1F2E7A'] }, cuello: '#1F2E7A', costados: '#1F2E7A',
      short: { color: '#1F2E7A' }, colorTexto: '#FFFFFF', sello: true
    }
  },
  {
    id: 'clasico-banda', nombre: 'Banda Roja', categoria: 'Clásicos', tipo: 'diseno', orden: 5,
    diseno: {
      manga: 'corta', relleno: { tipo: 'banda', colores: ['#F7F7F2', '#D7262E', '#111111'] }, cuello: '#D7262E',
      short: { color: '#111111' }, colorTexto: '#111111', sello: true
    }
  },
  {
    id: 'clasico-caribe', nombre: 'Atardecer Caribe', categoria: 'Diseños M Sport', tipo: 'diseno', orden: 6,
    diseno: {
      manga: 'larga', relleno: { tipo: 'degradado', colores: ['#FF8A3D', '#6B2FB3'] }, cuello: '#2A1250',
      short: { color: '#2A1250' }, colorTexto: '#FFFFFF', sello: true
    }
  },
  {
    id: 'clasico-aros', nombre: 'Aros Verdes', categoria: 'Clásicos', tipo: 'diseno', orden: 7,
    diseno: {
      manga: 'corta', relleno: { tipo: 'aros', colores: ['#FFFFFF', '#14804A'] }, cuello: '#14804A',
      short: { color: '#FFFFFF' }, colorTexto: '#111111', sello: true
    }
  }
];
window.CONFIG_BASE = {
  whatsapp: '',
  horario: 'Lun–Vie 9:00–19:00 · Sáb 9:00–18:00 · Dom 9:00–16:30',
  direccion: 'Calle 19 #38, Cancún, Q.R.',
  lema: 'La tienda de las estrellas',
  tallas: ['Niño 6', 'Niño 8', 'Niño 10', 'Niño 12', 'Niño 14', 'Ch', 'M', 'G', 'XG', 'XXG'],
  categorias: ['Equipos de la casa', 'Diseños M Sport', 'Clásicos'],
  historia: '',
  calificacion: '4.3',
  opiniones: '150'
};
