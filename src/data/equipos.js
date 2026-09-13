// Catálogo de medios de extracción UME y sus curvas de rendimiento.
// Cada curva es una lista de puntos (altura manométrica total en m, caudal en l/min)
// tomados/aproximados de las fichas técnicas del manual. Se usan para interpolar
// el caudal real esperado según el punto de trabajo (desnivel + pérdidas de manguera).
export const catalogoMedios = [
  {
    id: 'uro',
    nombre: 'Autobomba URO (Ruberg R-20)',
    uso: 'Agua limpia / baja presión',
    succionMax: 8,
    curva: [
      { altura: 10, caudal: 2000 },
      { altura: 40, caudal: 1600 },
      { altura: 80, caudal: 1000 },
      { altura: 240, caudal: 400 },
    ],
  },
  {
    id: 'iveco',
    nombre: 'Autobomba IVECO (Godiva WT 2010)',
    uso: 'Uso general / contraincendios',
    succionMax: 8,
    curva: [
      { altura: 10, caudal: 3000 },
      { altura: 50, caudal: 2400 },
      { altura: 100, caudal: 1600 },
      { altura: 350, caudal: 500 },
    ],
  },
  {
    id: 'renault',
    nombre: 'VMI Renault/Scania (Rosenbauer NH45)',
    uso: 'Alto caudal y presión múltiple',
    succionMax: 8,
    curva: [
      { altura: 10, caudal: 4500 },
      { altura: 60, caudal: 3600 },
      { altura: 120, caudal: 2400 },
      { altura: 400, caudal: 800 },
    ],
  },
  {
    id: 'honda30',
    nombre: 'Motobomba Honda WT30X',
    uso: 'Aguas sucias / achique',
    succionMax: 8,
    curva: [
      { altura: 3, caudal: 1200 },
      { altura: 10, caudal: 950 },
      { altura: 20, caudal: 600 },
      { altura: 25, caudal: 250 },
    ],
  },
  {
    id: 'embal',
    nombre: 'Equipo EMBAL (Agua y Lodos)',
    uso: 'Lodos y sólidos hasta 10 cm',
    succionMax: 8.5,
    curva: [
      { altura: 5, caudal: 5333 }, // 320 m3/h
      { altura: 12, caudal: 4000 },
      { altura: 21.3, caudal: 1500 },
    ],
  },
  {
    id: 'sigeflu',
    nombre: 'Sistema SIGEFLU',
    uso: 'Achique masivo / hidrado a gran distancia',
    succionMax: null,
    curva: [
      { altura: 20, caudal: 18000 }, // 300 l/seg
      { altura: 60, caudal: 12000 },
      { altura: 120, caudal: 6000 },
    ],
  },
];

// Diámetros de manguera disponibles y coeficiente de pérdida de carga
// aproximado (bar por cada 100 m de manguera, para Q en l/min):
//   pérdida(bar/100m) = coeficiente * (Q/100)^2
// Los coeficientes son valores orientativos de referencia en bomberos/UME
// y deben calibrarse con las curvas reales del manual cuando estén disponibles.
export const diametrosManguera = [
  { id: '25', nombre: '25 mm', coeficiente: 0.9, caudalRecomendadoMax: 250 },
  { id: '45', nombre: '45 mm', coeficiente: 0.15, caudalRecomendadoMax: 1000 },
  { id: '70', nombre: '70 mm', coeficiente: 0.03, caudalRecomendadoMax: 3000 },
  { id: '100', nombre: '100 mm (rígida/semirrígida)', coeficiente: 0.008, caudalRecomendadoMax: 6000 },
];

export const LIMITE_SUCCION_GENERAL_M = 8;
