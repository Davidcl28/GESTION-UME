// Catálogo de medios de extracción UME y sus curvas de rendimiento.
// Cada curva es una lista de puntos (altura manométrica total en m, caudal en l/min)
// obtenidos de las fichas técnicas oficiales (MF08-UD02-UA02, "Características y
// empleo de los medios de extracción de la UME"). Cuando la ficha solo da puntos de
// presión (bar), se convierten a metros de columna de agua (1 bar ≈ 10,2 m).
//
// alturaMaximaM y caudalMaximoLMin son topes DUROS tomados literalmente de la
// ficha (p.ej. "altura máx. de bombeo 25 m" o "caudal máximo 1200 l/min"): el
// ajuste de curva es solo una estimación entre/más allá de los puntos
// conocidos, y sin estos topes podría mostrar un caudal por encima del que la
// propia ficha da como máximo real de la bomba, sobre todo con mangueras de
// bajo rozamiento a poca altura. alturaMaximaM solo se rellena cuando la
// ficha da explícitamente una altura/presión máxima (no solo un punto de
// rendimiento a una presión concreta).
//
// solidos indica si el equipo está preparado para lodos/sólidos en
// suspensión (y hasta qué tamaño, si la ficha lo especifica), para poder
// mostrarlo en la calculadora.
export const catalogoMedios = [
  {
    id: 'uro',
    nombre: 'Autobomba A/B URO (bomba Ruberg R-20)',
    uso: 'Agua limpia / baja presión. La más antigua en dotación, sin cuerpo de alta presión.',
    succionMax: 7.5, // ficha "Clasificación de equipos por capacidad de achique"
    alturaMaximaM: 244.8, // punto más alto de la ficha: 500 l/min a 24 bar
    caudalMaximoLMin: 2000, // 2000 l/min a 10 bar (máximo dato de la ficha)
    diametrosDisponibles: ['70', '45', '25'], // racores de salida BARCELONA
    solidos: { apto: false },
    curva: [
      { altura: 102, caudal: 2000 }, // 2000 l/min a 10 bar
      { altura: 204, caudal: 1000 }, // 1000 l/min a 20 bar
      { altura: 244.8, caudal: 500 }, // 500 l/min a 24 bar
    ],
  },
  {
    // La Godiva WT2010 tiene dos cuerpos de bomba independientes y
    // seleccionables (ver "Selector Alta/Baja Presión" en cabina), cada uno
    // con su propia salida: NO es una única curva continua entre ambos
    // puntos, son dos circuitos distintos que no se pueden mezclar.
    id: 'iveco',
    nombre: 'Autobomba A/B IVECO (bomba Godiva WT2010)',
    uso: 'Uso general / contraincendios. Cebado automático por anillo de agua (<30 s con 9 m de mangote).',
    succionMax: 7.8, // ficha "Clasificación de equipos por capacidad de achique"
    diametrosDisponibles: ['70', '45', '25'], // racores de salida BARCELONA
    solidos: { apto: false },
    circuitos: [
      {
        id: 'baja',
        nombre: 'Baja presión (normal)',
        caudalMaximoLMin: 3400, // caudal máx. 3400 l/min a 2 bar
        curva: [
          { altura: 102, caudal: 2000 }, // caudal nominal 2000 l/min a 10 bar
          { altura: 20.4, caudal: 3400 }, // caudal máx. 3400 l/min a 2 bar
        ],
      },
      {
        id: 'alta',
        nombre: 'Alta presión',
        caudalMaximoLMin: 750, // caudal máx. 750 l/min a 2 bar
        curva: [
          { altura: 357, caudal: 350 }, // caudal nominal 350 l/min a 35 bar
          { altura: 20.4, caudal: 750 }, // caudal máx. 750 l/min a 2 bar
        ],
      },
    ],
  },
  {
    // La Rosenbauer NH45 también tiene dos circuitos independientes y
    // seleccionables, con salidas de manguera distintas para cada uno (ver
    // "Salidas Baja presión" / "Salidas Alta presión" en el panel).
    id: 'renault-scania',
    nombre: 'VMI Renault/Scania (bomba Rosenbauer NH45)',
    uso: 'Alto caudal y presión múltiple. La más moderna, vehículo multipropósito (LCIF).',
    succionMax: 7.5, // ficha "Clasificación de equipos por capacidad de achique"
    diametrosDisponibles: ['70', '45', '25'], // racores de salida BARCELONA
    solidos: { apto: false },
    circuitos: [
      {
        id: 'baja',
        nombre: 'Baja presión (normal)',
        caudalMaximoLMin: 4500, // caudal nominal y máx. a 10 bar
        curva: [{ altura: 102, caudal: 4500 }],
      },
      {
        id: 'alta',
        nombre: 'Alta presión',
        caudalMaximoLMin: 600, // caudal máx. 600 l/min a 35 bar
        curva: [
          { altura: 408, caudal: 250 }, // caudal nominal 250 l/min a 40 bar
          { altura: 357, caudal: 600 }, // caudal máx. 600 l/min a 35 bar
        ],
      },
    ],
  },
  {
    id: 'honda-wh75',
    nombre: 'Motobomba Honda WH-75 (dotación A/B IVECO)',
    uso: 'Motobomba portátil de apoyo. Autoaspirante hasta 7,5 m, elevación máx. 75 m. Tolera partículas hasta 0,6 cm.',
    succionMax: 7.5, // ficha "Clasificación de equipos por capacidad de achique"
    alturaMaximaM: 75, // elevación máxima del fabricante
    caudalMaximoLMin: 400, // caudal máx. 24.000 l/h (confirmado en tabla de racores a 4 bar)
    diametrosDisponibles: ['45', '25'], // racores de salida BARCELONA
    solidos: { apto: false },
    curva: [
      { altura: 5, caudal: 400 },
      { altura: 40.8, caudal: 400 }, // 4 bar → 400 l/min (tabla de racores UA02)
      { altura: 75, caudal: 40 }, // elevación máxima del fabricante
    ],
  },
  {
    id: 'honda-wt30x',
    nombre: 'Motobomba Honda WT30X',
    uso: 'Aguas sucias / achique. Racores de 80 mm.',
    succionMax: 7.5, // ficha "Clasificación de equipos por capacidad de achique"
    alturaMaximaM: 25, // altura máx. de bombeo (ficha)
    caudalMaximoLMin: 1210, // caudal máx. 1210 l/min
    diametrosDisponibles: ['80'], // diámetro de orificio de succión/descarga de fábrica
    solidos: { apto: true, detalle: 'Agua turbia, partículas hasta 3,1 cm' },
    curva: [
      { altura: 3, caudal: 1210 },
      { altura: 25, caudal: 60 }, // altura máx. de bombeo 25 m
    ],
  },
  {
    id: 'honda-wt20x',
    nombre: 'Motobomba Honda WT20X',
    uso: 'Aguas sucias / achique. Racores de 50 mm.',
    succionMax: 8,
    alturaMaximaM: 26, // altura máx. de bombeo (ficha)
    caudalMaximoLMin: 700, // caudal máx. 700 l/min (42.000 l/h)
    diametrosDisponibles: ['50'], // diámetro de orificio de succión/descarga de fábrica
    solidos: { apto: true, detalle: 'Aguas sucias / achique (sin tamaño de sólido especificado en ficha)' },
    curva: [
      { altura: 3, caudal: 700 },
      { altura: 20.4, caudal: 710 }, // 2 bar → 710 l/min (tabla de racores UA02)
      { altura: 26, caudal: 40 }, // altura máx. de bombeo 26 m
    ],
  },
  {
    id: 'albatros',
    nombre: 'Motobomba ALBATROS (agua y lodos)',
    uso: 'Especial para líquidos abrasivos y cargados, sólidos hasta 10 cm de diámetro.',
    succionMax: 7,
    alturaMaximaM: 25, // presión máxima (ficha)
    caudalMaximoLMin: 1833, // caudal máx. 110.000 l/h
    diametrosDisponibles: ['70'], // racor de salida BARCELONA
    solidos: { apto: true, detalle: 'Líquidos abrasivos y cargados, sólidos hasta 10 cm de diámetro' },
    curva: [
      { altura: 3, caudal: 1833 },
      { altura: 20.4, caudal: 1833 }, // 2 bar → 1833 l/min (tabla de racores UA02)
      { altura: 25, caudal: 100 }, // presión máxima 25 m
    ],
  },
  {
    id: 'embal',
    nombre: 'Equipo EMBAL (agua y lodos, sobre plataforma)',
    uso: 'Lodos y sólidos hasta 10 cm de diámetro. Distancia máx. aspiración-impulsión 200 m.',
    succionMax: 9, // ficha "Clasificación de equipos por capacidad de achique" (EMBAL Selwood S150)
    alturaMaximaM: 21.3, // altura de impulsión máxima (ficha, confirmada en tabla: 2,2 bar ≈ 22,4 m)
    caudalMaximoLMin: 5333, // capacidad máx. 320 m³/h
    diametrosDisponibles: ['100'], // manguera de dotación BARCELONA 4" (100 mm)
    solidos: { apto: true, detalle: 'Lodos y sólidos en suspensión hasta 10 cm de diámetro' },
    curva: [
      { altura: 5, caudal: 5333 },
      { altura: 12, caudal: 3500 },
      { altura: 21.3, caudal: 100 }, // altura de impulsión máxima
    ],
  },
  {
    id: 'flygt-2660ht',
    nombre: 'Electrobomba sumergible Flygt 2660 HT',
    uso: 'Sumergible. Bombea sólidos hasta 80 mm. Requiere grupo electrógeno de 5 kVA.',
    succionMax: null,
    sumergible: true,
    alturaMaximaM: 55, // altura máx. modelo HT (ficha, confirmada en tabla: 5,5 bar ≈ 56,1 m)
    caudalMaximoLMin: 1667, // 100 m³/h
    diametrosDisponibles: ['100'], // racor de salida Storz 4"
    solidos: { apto: true, detalle: 'Slurry, lodos y aguas residuales, sólidos hasta 80 mm' },
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
    uso: 'Sumergible. Bombea sólidos hasta 1 cm. Mayor caudal que la HT, menor altura.',
    succionMax: null,
    sumergible: true,
    alturaMaximaM: 36, // altura máx. modelo MT (ficha "Clasificación de equipos")
    caudalMaximoLMin: 3360, // caudal máx. (ficha "Clasificación de equipos")
    diametrosDisponibles: ['150'], // racor de salida Storz 6"
    solidos: { apto: true, detalle: 'Agua turbia, sólidos hasta 1 cm' },
    curva: [
      { altura: 5, caudal: 3300 },
      { altura: 20, caudal: 2200 },
      { altura: 36, caudal: 200 }, // altura máx. 36 m
    ],
  },
  {
    id: 'rw2015',
    nombre: 'Electrobomba sumergible RW 2015.2M (aguas fecales)',
    uso: 'Sumergible, monofásica 230V. Profundidad de inmersión hasta 11 m (máx. sumergible 20 m). Partículas hasta 4,5 cm.',
    succionMax: null,
    sumergible: true,
    alturaMaximaM: 11, // presión máxima 1,1 bar ≈ 11 m (ficha "Clasificación de equipos")
    caudalMaximoLMin: 500, // caudal máx. 500 l/min (ficha "Clasificación de equipos")
    diametrosDisponibles: ['45'], // racor de salida BARCELONA
    solidos: { apto: true, detalle: 'Aguas fecales, rodete tipo vórtice, partículas hasta 4,5 cm' },
    curva: [
      { altura: 5, caudal: 400 },
      { altura: 10, caudal: 100 }, // punto de la ficha original: 100 l/min a 10 m
      { altura: 11, caudal: 20 },
    ],
  },
  {
    id: 'sigeflu',
    nombre: 'Sistema SIGEFLU',
    uso: 'Achique masivo / hidrado a gran distancia (hasta 3 km, sobre plataforma o remolque).',
    succionMax: null,
    alturaMaximaM: 123, // 12,1 bar (tabla de racores UA02)
    caudalMaximoLMin: 20400, // 1224 m³/h (tabla de racores UA02)
    diametrosDisponibles: ['150', '100'], // aproximación: racores reales Victaulic/Barcelona 100-250 mm
    solidos: { apto: false },
    curva: [{ altura: 123, caudal: 20400 }], // 12,1 bar → 1224 m³/h (único dato oficial de la tabla)
  },
  {
    // Datos limitados: la ficha solo la menciona en la tabla de racores
    // (un único punto de rendimiento), sin página propia como el resto de
    // motobombas. Tratar el resultado con más cautela que el resto.
    id: 'wick',
    nombre: 'Motobomba WICK',
    uso: 'Datos limitados en la ficha (solo tabla de racores, sin página propia). Contrastar con el manual antes de un uso crítico.',
    succionMax: 8,
    caudalMaximoLMin: 350, // 2 bar → 350 l/min (único dato oficial de la tabla de racores)
    diametrosDisponibles: ['45'], // racor de salida BARCELONA (aspiración NPSH/Storz 50mm con adaptador)
    solidos: { apto: false },
    curva: [{ altura: 20.4, caudal: 350 }], // 2 bar → 350 l/min (único dato oficial)
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
  solidos: { apto: true, detalle: 'Diseñada para succionar agua sucia sin mezclarla con el circuito limpio' },
};

// Diámetros de manguera disponibles y coeficiente de pérdida de carga
// (bar por cada 100 m de manguera, para Q en l/min):
//   pérdida(bar/100m) = coeficiente * (Q/100)^2
// Los coeficientes de 25/45/70mm se han ajustado a la tabla real de pérdidas
// de carga (UME): ~40 puntos (caudal, pérdida) muestran que pérdida =
// c·Q² con muchísima precisión para los tres diámetros, y que a su vez
// c = 5266,9 / d(mm)^5 (regresión log-log casi perfecta entre los tres
// diámetros, pendiente -5,00). El resto de diámetros (50/80/100/150, sin
// dato propio en la tabla) usan ese mismo ajuste d^-5 extrapolado.
export const diametrosManguera = [
  { id: '25', nombre: '25 mm', coeficiente: 5.41, caudalRecomendadoMax: 250 },
  { id: '45', nombre: '45 mm', coeficiente: 0.286, caudalRecomendadoMax: 1000 },
  { id: '50', nombre: '50 mm', coeficiente: 0.16854, caudalRecomendadoMax: 1350 },
  { id: '70', nombre: '70 mm', coeficiente: 0.03144, caudalRecomendadoMax: 3000 },
  { id: '80', nombre: '80 mm', coeficiente: 0.016075, caudalRecomendadoMax: 3500 },
  { id: '100', nombre: '100 mm (rígida/semirrígida)', coeficiente: 0.0052669, caudalRecomendadoMax: 6000 },
  { id: '150', nombre: '150 mm (Storz 6" / rígida)', coeficiente: 0.0006936, caudalRecomendadoMax: 12000 },
];

// Boquillas de lanza reguladora tipo SIDEINFO disponibles al final del
// tendido, en mm de diámetro de orificio.
// Boquillas de lanza reguladora tipo SIDEINFO: datos reales de la ficha
// (boquilla, presión máxima, caudal y alcance en ese punto). k es la
// constante de la relación empírica caudal(l/min) = k·√presión(bar),
// calculada a partir de ese punto real (Q/√P): es la misma forma que la
// ecuación de orificio, pero calibrada directamente con el dato de fábrica
// en vez de asumir un coeficiente de descarga teórico. El alcance a
// presiones distintas de la máxima se aproxima como alcanceMaxM·√(P/PmaxBar)
// (no hay curva punto a punto completa, solo el extremo de cada boquilla y
// las gráficas de las que se ha tomado esta forma).
export const boquillasSideinfo = [
  { mm: 10, presionMaxBar: 4, caudalMaxLMin: 170, alcanceMaxM: 27.5 },
  { mm: 12, presionMaxBar: 4, caudalMaxLMin: 180, alcanceMaxM: 28 },
  { mm: 14, presionMaxBar: 4, caudalMaxLMin: 245, alcanceMaxM: 31 },
  { mm: 16, presionMaxBar: 4.5, caudalMaxLMin: 340, alcanceMaxM: 36 },
  { mm: 18, presionMaxBar: 5, caudalMaxLMin: 454, alcanceMaxM: 37.5 },
  { mm: 20, presionMaxBar: 5, caudalMaxLMin: 617, alcanceMaxM: 38.5 },
  { mm: 22, presionMaxBar: 5, caudalMaxLMin: 735, alcanceMaxM: 39.5 },
  { mm: 24, presionMaxBar: 5, caudalMaxLMin: 858, alcanceMaxM: 41 },
].map((b) => ({ ...b, k: b.caudalMaxLMin / Math.sqrt(b.presionMaxBar) }));

export const LIMITE_SUCCION_GENERAL_M = 8;
