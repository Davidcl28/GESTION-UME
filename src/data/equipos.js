// Catálogo de medios de extracción UME y sus curvas de rendimiento.
// Cada curva es una lista de puntos (altura manométrica total en m, caudal en l/min)
// obtenidos de las fichas técnicas oficiales (MF08-UD02-UA02, "Características y
// empleo de los medios de extracción de la UME"). Cuando la ficha solo da puntos de
// presión (bar), se convierten a metros de columna de agua (1 bar ≈ 10,2 m).
// Se usan para interpolar el caudal real esperado según el punto de trabajo
// (desnivel + pérdidas de manguera). Los tramos sin dato oficial intermedio se
// aproximan linealmente entre los puntos conocidos.
export const catalogoMedios = [
  {
    id: 'uro',
    nombre: 'Autobomba A/B URO (bomba Ruberg R-20)',
    uso: 'Agua limpia / baja presión. La más antigua en dotación, sin cuerpo de alta presión.',
    succionMax: 8,
    curva: [
      { altura: 102, caudal: 2000 }, // 2000 l/min a 10 bar
      { altura: 204, caudal: 1000 }, // 1000 l/min a 20 bar
      { altura: 244.8, caudal: 500 }, // 500 l/min a 24 bar
    ],
  },
  {
    id: 'iveco',
    nombre: 'Autobomba A/B IVECO (bomba Godiva WT2010)',
    uso: 'Uso general / contraincendios. Cebado automático por anillo de agua (<30 s con 9 m de mangote).',
    succionMax: 8,
    curva: [
      { altura: 102, caudal: 3000 }, // 3000 l/min a 10 bar
      { altura: 357, caudal: 350 }, // 350 l/min a 35 bar
    ],
  },
  {
    id: 'renault-scania',
    nombre: 'VMI Renault/Scania (bomba Rosenbauer NH45)',
    uso: 'Alto caudal y presión múltiple. La más moderna, vehículo multipropósito (LCIF).',
    succionMax: 8,
    curva: [
      { altura: 102, caudal: 4500 }, // 4500 l/min a 10 bar (presión normal)
      { altura: 408, caudal: 400 }, // 400 l/min a 40 bar (alta presión)
    ],
  },
  {
    id: 'honda-wh75',
    nombre: 'Motobomba Honda WH-75 (dotación A/B IVECO)',
    uso: 'Motobomba portátil de apoyo. Autoaspirante hasta 8 m, elevación máx. 75 m.',
    succionMax: 8,
    curva: [
      { altura: 5, caudal: 400 }, // caudal medido en prácticas: 4000 l en 10 min
      { altura: 75, caudal: 40 }, // elevación máxima del fabricante
    ],
  },
  {
    id: 'honda-wt30x',
    nombre: 'Motobomba Honda WT30X',
    uso: 'Aguas sucias / achique. Racores de 80 mm.',
    succionMax: 8,
    curva: [
      { altura: 3, caudal: 1200 }, // caudal máx. 1200 l/min (72.000 l/h)
      { altura: 25, caudal: 60 }, // altura máx. de bombeo 25 m
    ],
  },
  {
    id: 'honda-wt20x',
    nombre: 'Motobomba Honda WT20X',
    uso: 'Aguas sucias / achique. Racores de 50 mm.',
    succionMax: 8,
    curva: [
      { altura: 3, caudal: 700 }, // caudal máx. 700 l/min (42.000 l/h)
      { altura: 26, caudal: 40 }, // altura máx. de bombeo 26 m
    ],
  },
  {
    id: 'albatros',
    nombre: 'Motobomba ALBATROS (agua y lodos)',
    uso: 'Especial para líquidos abrasivos y cargados, sólidos hasta 10 cm de diámetro.',
    succionMax: 7,
    curva: [
      { altura: 3, caudal: 1833 }, // caudal máx. 110.000 l/h
      { altura: 25, caudal: 100 }, // presión máxima 25 m
    ],
  },
  {
    id: 'embal',
    nombre: 'Equipo EMBAL (agua y lodos, sobre plataforma)',
    uso: 'Lodos y sólidos hasta 10 cm de diámetro. Distancia máx. aspiración-impulsión 200 m.',
    succionMax: 8.8,
    curva: [
      { altura: 5, caudal: 5333 }, // capacidad máx. 320 m³/h
      { altura: 12, caudal: 3500 },
      { altura: 21.3, caudal: 1200 }, // altura de impulsión máxima
    ],
  },
  {
    id: 'flygt-2660ht',
    nombre: 'Electrobomba sumergible Flygt 2660 HT',
    uso: 'Sumergible. Bombea sólidos hasta 80 mm. Requiere grupo electrógeno de 5 kVA.',
    succionMax: null,
    sumergible: true,
    curva: [
      { altura: 5, caudal: 1600 },
      { altura: 20, caudal: 1200 },
      { altura: 38, caudal: 500 },
      { altura: 55, caudal: 50 }, // altura máx. 55 m
    ],
  },
  {
    id: 'flygt-2660mt',
    nombre: 'Electrobomba sumergible Flygt 2660 MT',
    uso: 'Sumergible. Bombea sólidos hasta 80 mm. Mayor caudal que la HT, menor altura.',
    succionMax: null,
    sumergible: true,
    curva: [
      { altura: 5, caudal: 4000 },
      { altura: 20, caudal: 2500 },
      { altura: 38, caudal: 200 }, // altura máx. 38 m
    ],
  },
  {
    id: 'rw2015',
    nombre: 'Electrobomba sumergible RW 2015.2M (aguas fecales)',
    uso: 'Sumergible, monofásica 230V. Profundidad de inmersión hasta 11 m (máx. sumergible 20 m).',
    succionMax: null,
    sumergible: true,
    curva: [
      { altura: 5, caudal: 150 },
      { altura: 10, caudal: 100 },
      { altura: 20, caudal: 20 },
    ],
  },
  {
    id: 'sigeflu',
    nombre: 'Sistema SIGEFLU',
    uso: 'Achique masivo / hidrado a gran distancia (hasta 3 km).',
    succionMax: null,
    curva: [
      { altura: 20, caudal: 18000 }, // 300 l/seg
      { altura: 60, caudal: 12000 },
      { altura: 120, caudal: 6000 },
    ],
  },
];

// Turbobomba: no tiene curva de altura/caudal convencional (es un eyector accionado
// por el agua limpia de una autobomba, sin motor ni succión propia), por lo que se
// trata aparte en vez de en el catálogo con curva.
export const turbobomba = {
  nombre: 'Turbobomba',
  entrada: '70 mm (opcional 45 mm con reducción)',
  presionEntradaMin: 4,
  presionEntradaMax: 10,
  caudalA10Bar: 756, // l/min
  presionSalida: 2, // bar
  uso: 'Accionada por agua limpia de una autobomba; succiona agua sucia sin mezclar los dos circuitos.',
};

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
