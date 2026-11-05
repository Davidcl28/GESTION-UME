// Utilidades de cálculo hidráulico: ajuste de la curva de la bomba,
// pérdidas de carga en tendidos de manguera (con reducciones de diámetro)
// y presión/caudal en una lanza reguladora (tipo SIDEINFO) al final del tendido.

// Las fichas del manual solo dan 2-4 puntos (caudal, altura) de la curva real
// de la bomba, normalmente a presiones altas (10-40 bar). Para poder estimar
// el caudal también en el rango de alturas bajas (el habitual al achicar un
// garaje o sótano, unos pocos metros), se ajusta la forma característica de
// una bomba centrífuga H(Q) = H0 - k·Q² por mínimos cuadrados sobre los
// puntos oficiales, en vez de interpolar linealmente entre ellos. Así el
// caudal decrece de forma continua y realista con la altura en todo el rango,
// no solo entre los puntos conocidos.
function ajustarCurvaCuadratica(curva) {
  const datos = curva.map((p) => ({ x: p.caudal ** 2, h: p.altura }));

  if (datos.length === 1) {
    const { x, h } = datos[0];
    const k = x > 0 ? h / (x * 3) : 1e-6; // pendiente conservadora arbitraria
    return { H0: h + k * x, k };
  }

  const n = datos.length;
  const xBar = datos.reduce((s, d) => s + d.x, 0) / n;
  const hBar = datos.reduce((s, d) => s + d.h, 0) / n;
  let num = 0;
  let den = 0;
  for (const d of datos) {
    num += (d.x - xBar) * (d.h - hBar);
    den += (d.x - xBar) ** 2;
  }
  const pendiente = den !== 0 ? num / den : -1e-6; // pendiente = -k
  const k = pendiente < 0 ? -pendiente : 1e-6;
  const H0 = hBar - pendiente * xBar;
  return { H0, k };
}

// Caudal (l/min) que entrega la bomba para una altura manométrica dada,
// según la curva H0 - k·Q² ajustada a los puntos oficiales de la ficha.
export function interpolarCaudal(curva, alturaManometrica) {
  const { H0, k } = ajustarCurvaCuadratica(curva);
  if (alturaManometrica >= H0) return 0;
  return Math.sqrt((H0 - alturaManometrica) / k);
}

// Pérdida de carga en un tramo de manguera (m de columna de agua), a partir
// de la tabla real de pérdidas de carga (bar/100m) por diámetro: los datos
// oficiales siguen con altísima precisión pérdida = coeficiente·(Q/100)²
// para los tres diámetros de la tabla (25/45/70mm; exponente 2 verificado
// sobre ~40 puntos de tabla), así que se generaliza igual al resto de
// diámetros. coeficiente ya viene ajustado a esa tabla por diámetro
// (ver diametrosManguera en data/equipos.js).
export function perdidaCargaManguera(caudalLMin, longitudM, coeficiente) {
  const perdidaBarPor100m = coeficiente * (caudalLMin / 100) ** 2;
  const perdidaBarTotal = perdidaBarPor100m * (longitudM / 100);
  return perdidaBarTotal * 10.2;
}

// Pérdida de carga (m) en una reducción/ensanchamiento de diámetro dentro de
// un tendido mixto. No hay datos oficiales de pérdida por racor de reducción
// en el manual, así que se estima con la fórmula clásica de pérdida singular
// en contracciones/ensanchamientos bruscos (K·v²/2g); es una aproximación,
// normalmente pequeña frente a la pérdida en la propia manguera, pero se
// incluye para no ignorarla en tendidos con muchos cambios de diámetro.
function perdidaReduccionM(caudalLMin, diametroAnteriorMM, diametroActualMM) {
  if (diametroAnteriorMM === diametroActualMM) return 0;
  const caudalM3s = caudalLMin / 60000;
  const velocidad = (diametroMM) => caudalM3s / (Math.PI * (diametroMM / 2000) ** 2);
  const v1 = velocidad(diametroAnteriorMM);
  const v2 = velocidad(diametroActualMM);
  const g = 9.81;
  if (diametroActualMM < diametroAnteriorMM) {
    // Contracción (racor de reducción): K ≈ 0.3, típico de un acoplamiento
    // roscado/racor rápido (no una contracción brusca de tubería industrial).
    return (0.3 * v2 * v2) / (2 * g);
  }
  // Ensanchamiento: pérdida de Borda-Carnot.
  return ((v1 - v2) ** 2) / (2 * g);
}

// Pérdida de carga total (m) de un tendido con uno o varios tramos de
// distinto diámetro en serie, incluyendo la pérdida en cada racor de
// reducción entre tramos consecutivos.
export function perdidaTendido(caudalLMin, tramos, densidadRelativa = 1) {
  let total = 0;
  tramos.forEach((tramo, i) => {
    total += perdidaCargaManguera(caudalLMin, tramo.longitudM, tramo.coeficiente) * densidadRelativa;
    if (i > 0) {
      total += perdidaReduccionM(caudalLMin, tramos[i - 1].diametroMM, tramo.diametroMM) * densidadRelativa;
    }
  });
  return total;
}

// Presión necesaria (m de columna de agua) en una lanza/boquilla reguladora
// tipo SIDEINFO para entregar un caudal dado, a partir del dato real de
// fábrica de la boquilla (caudal(l/min) = k·√presión(bar), con k calibrada
// directamente sobre el punto de rendimiento a presión máxima de la ficha:
// ver boquillasSideinfo en data/equipos.js).
export function presionBoquillaM(caudalLMin, boquilla) {
  if (!boquilla || boquilla.k <= 0 || caudalLMin <= 0) return 0;
  const presionBar = (caudalLMin / boquilla.k) ** 2;
  return presionBar * 10.2;
}

// Alcance del chorro (m) para una presión dada, aproximado a partir del único
// punto de rendimiento conocido de la boquilla (a su presión máxima) con
// alcance(P) ≈ alcanceMax·√(P/Pmax): no hay curva punto a punto completa,
// pero esa es la tendencia que muestran las gráficas de la ficha SIDEINFO.
export function alcanceBoquillaM(presionBar, boquilla) {
  if (!boquilla || presionBar <= 0) return 0;
  return boquilla.alcanceMaxM * Math.sqrt(presionBar / boquilla.presionMaxBar);
}

// Resuelve el punto de trabajo real (caudal estable en l/min) de un equipo
// dado un desnivel geométrico y un tendido (uno o varios tramos de manguera,
// con sus reducciones, y opcionalmente una lanza al final): la pérdida total
// depende del caudal, y el caudal que da la bomba depende a su vez de la
// altura manométrica total (desnivel + pérdidas), así que hay que encontrar
// el punto donde ambas curvas se cruzan. Se resuelve por bisección sobre
// f(Q) = (desnivel + pérdidas(Q)) - alturaBomba(Q), que es monótona creciente
// en Q (las pérdidas suben con el caudal, la altura de la bomba baja), por lo
// que siempre converge a la única solución — a diferencia de una iteración de
// punto fijo directa, que puede oscilar sin converger cuando la pérdida de
// carga inicial estimada es muy superior a la altura máxima de la bomba
// (típico con curvas de un solo punto, como los circuitos de alta presión de
// algunas autobombas).
// alturaMaximaM y caudalMaximoLMin (opcionales) son topes duros tomados
// literalmente de la ficha del equipo (p.ej. "altura máx. de bombeo 25 m" o
// "caudal máximo 1200 l/min"). El ajuste cuadrático es solo una estimación
// entre/más allá de los puntos oficiales, y a alturas muy bajas puede
// proyectar un caudal por encima del máximo real de la bomba (limitada
// mecánicamente por el propio rodete, no solo por la presión); estos topes
// evitan que la calculadora muestre un punto de trabajo que la ficha
// descarta explícitamente.
export function estimarPuntoTrabajo({
  curva,
  desnivelM,
  tramos,
  densidadRelativa = 1,
  alturaMaximaM,
  caudalMaximoLMin,
  boquilla, // opcional: entrada de boquillasSideinfo (con su k precalculada)
}) {
  const { H0: H0Ajustado, k } = ajustarCurvaCuadratica(curva);
  const H0 = alturaMaximaM != null ? Math.min(H0Ajustado, alturaMaximaM) : H0Ajustado;

  const alturaBomba = (Q) => Math.max(H0 - k * Q * Q, 0);
  const perdidas = (Q) => {
    let total = perdidaTendido(Q, tramos, densidadRelativa);
    if (boquilla) total += presionBoquillaM(Q, boquilla) * densidadRelativa;
    return total;
  };
  const f = (Q) => desnivelM + perdidas(Q) - alturaBomba(Q);

  let caudal = 0;
  if (desnivelM < H0 && f(0) < 0) {
    let lo = 0;
    let hi = Math.sqrt(H0 / k); // caudal a altura manométrica 0 (cota superior)
    for (let i = 0; i < 60; i++) {
      const mid = (lo + hi) / 2;
      if (f(mid) > 0) hi = mid;
      else lo = mid;
    }
    caudal = (lo + hi) / 2;
  }

  if (caudalMaximoLMin != null) {
    caudal = Math.min(caudal, caudalMaximoLMin);
  }

  const perdidasFinal = perdidas(caudal);
  const presionBoquillaFinal = boquilla ? presionBoquillaM(caudal, boquilla) : 0;
  const presionBoquillaBar = boquilla ? Math.round((presionBoquillaFinal / 10.2) * 100) / 100 : null;
  return {
    caudalLMin: Math.round(caudal),
    alturaManometricaTotal: Math.round((desnivelM + perdidasFinal) * 10) / 10,
    perdidaCargaM: Math.round((perdidasFinal - presionBoquillaFinal * densidadRelativa) * 10) / 10,
    presionBoquillaBar,
    alcanceBoquillaM: boquilla ? Math.round(alcanceBoquillaM(presionBoquillaBar, boquilla) * 10) / 10 : null,
  };
}

// ===================== Cadenas de bombas y tendidos con bifurcación =====================
// Generalización usada solo por la Calculadora Hidráulica cuando se activan
// las opciones avanzadas (varios equipos en cadena, o varias salidas al
// final del tendido). No sustituye a estimarPuntoTrabajo (que sigue usando
// TiempoVaciado.jsx sin cambios): es la misma física, expresada de forma
// que se puede componer (varias bombas, varias salidas) sin tener que
// resolver un sistema de ecuaciones distinto para cada combinación.
//
// La idea clave es que toda "fuente de presión" (una bomba sola, dos en
// serie, dos en paralelo) se puede representar igual: una función
// alturaBomba(Q) que da la altura manométrica disponible para un caudal Q,
// siempre decreciente con Q (como cualquier curva de bomba centrífuga), más
// su altura estática máxima H0 (a caudal 0) y su caudal máximo de ficha.
// Y toda "demanda" (un tendido con 1 a 3 salidas) se puede representar al
// revés: cuánto caudal pasa por ella para una altura manométrica H dada en
// el punto de reparto, siempre creciente con H. Resolver el punto de
// trabajo es, en los dos casos, encontrar dónde esas dos curvas se cruzan.

const CAUDAL_MAX_BISECCION = 50000; // l/min: cota superior generosa para acotar las bisecciones de caudal (ningún equipo del catálogo supera los 20.400 l/min de SIGEFLU)

// Bisección genérica: halla el caudal Q en [0, hi] tal que f(Q) = objetivo,
// cuando f es monótona en ese rango (creciente o decreciente según el
// parámetro). Se usa tanto para repartir caudal entre salidas como para
// repartirlo entre bombas en paralelo.
function biseccionCaudal(f, objetivo, creciente, hi = CAUDAL_MAX_BISECCION) {
  let lo = 0;
  let h = hi;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + h) / 2;
    const val = f(mid);
    const porEncima = creciente ? val > objetivo : val < objetivo;
    if (porEncima) h = mid;
    else lo = mid;
  }
  return (lo + h) / 2;
}

// Convierte la curva oficial de un equipo (y su tope de ficha) en el objeto
// "bomba" que usan las funciones de combinación y de reparto de abajo: una
// función altura disponible = f(caudal) (monótona decreciente, el mismo
// ajuste H0 - k·Q² que usa estimarPuntoTrabajo), su altura estática máxima
// H0 y su caudal máximo de ficha.
export function construirBombaSimple(curva, alturaMaximaM, caudalMaximoLMin) {
  const { H0: H0Ajustado, k } = ajustarCurvaCuadratica(curva);
  const H0 = Math.max(alturaMaximaM != null ? Math.min(H0Ajustado, alturaMaximaM) : H0Ajustado, 0);
  return {
    alturaBomba: (Q) => Math.max(H0 - k * Q * Q, 0),
    H0,
    caudalMaximoLMin: caudalMaximoLMin ?? null,
  };
}

// Dos equipos conectados EN SERIE: uno impulsa al siguiente (p. ej. una
// motobomba enlazada a la salida de una autobomba para dar más presión a
// larga distancia, un "relevo"). Por la manguera de enlace pasa el mismo
// caudal que por las dos bombas (es la misma agua, un único camino), así
// que la presión que entrega la segunda se SUMA a la que llega de la
// primera, restando la pérdida de carga (y el desnivel, si lo hay) en esa
// manguera de enlace: es el mismo principio que el "relevo"/tandem pumping
// en bomberos (la presión de descarga de cada bomba se suma, menos el
// rozamiento del tramo que las conecta). El caudal máximo combinado lo
// limita la bomba más débil de las dos: ambas bombean el mismo caudal, y
// ninguna puede superar su propio tope de ficha.
export function combinarBombasSerie(bombaA, bombaB, tramosEnlace = [], desnivelEnlaceM = 0, densidadRelativa = 1) {
  const alturaBomba = (Q) => {
    const perdidaEnlace = perdidaTendido(Q, tramosEnlace, densidadRelativa) + desnivelEnlaceM;
    const alturaLlegaAB = Math.max(bombaA.alturaBomba(Q) - perdidaEnlace, 0);
    return alturaLlegaAB + bombaB.alturaBomba(Q);
  };
  const H0 = Math.max(bombaA.H0 + bombaB.H0 - desnivelEnlaceM, 0);
  const caps = [bombaA.caudalMaximoLMin, bombaB.caudalMaximoLMin].filter((v) => v != null);
  const caudalMaximoLMin = caps.length ? Math.min(...caps) : null;
  return { alturaBomba, H0, caudalMaximoLMin };
}

// Dos equipos conectados EN PARALELO: cada uno aspira de su propia fuente
// (o está sumergido) y descarga en un punto común (colector) antes de
// seguir por un tendido compartido - p. ej. dos autobombas alimentando la
// misma manguera de gran diámetro. Se asume que cada salida al colector
// lleva su propia válvula antirretorno (práctica estándar en estas
// maniobras): ninguna bomba puede recibir caudal "hacia atrás" de la otra,
// así que si la presión que pide el colector ya supera lo que una de las
// bombas puede dar por sí sola, esa bomba sencillamente no aporta caudal
// (0 l/min) y toda la aportación la hace la otra. El caudal máximo
// combinado es la SUMA de los topes de ficha de las dos (a diferencia de
// la serie): cada una puede dar hasta su propio máximo al mismo tiempo.
export function combinarBombasParalelo(
  bombaA,
  bombaB,
  { desnivelSuccionA = 0, desnivelSuccionB = 0, tramosConexionA = [], tramosConexionB = [] } = {},
  densidadRelativa = 1
) {
  const disponibleA = (Q) =>
    Math.max(bombaA.alturaBomba(Q) - desnivelSuccionA - perdidaTendido(Q, tramosConexionA, densidadRelativa), 0);
  const disponibleB = (Q) =>
    Math.max(bombaB.alturaBomba(Q) - desnivelSuccionB - perdidaTendido(Q, tramosConexionB, densidadRelativa), 0);

  const H0 = Math.max(disponibleA(0), disponibleB(0));

  function caudalDeA(H) {
    if (H >= disponibleA(0)) return 0;
    return biseccionCaudal(disponibleA, H, false);
  }
  function caudalDeB(H) {
    if (H >= disponibleB(0)) return 0;
    return biseccionCaudal(disponibleB, H, false);
  }
  const caudalTotalParaH = (H) => caudalDeA(H) + caudalDeB(H);

  const caps = [bombaA.caudalMaximoLMin, bombaB.caudalMaximoLMin];
  const caudalMaximoLMin = caps.every((v) => v != null) ? caps[0] + caps[1] : null;

  // Altura disponible conjunta para un caudal total dado: se invierte
  // caudalTotalParaH (decreciente en H) para hallar la H que reparte ese
  // caudal total entre las dos bombas (respetando el antirretorno: ninguna
  // aporta menos de 0).
  function alturaBomba(Qtotal) {
    let lo = 0;
    let hi = H0;
    for (let i = 0; i < 60; i++) {
      const mid = (lo + hi) / 2;
      if (caudalTotalParaH(mid) < Qtotal) hi = mid;
      else lo = mid;
    }
    return (lo + hi) / 2;
  }

  return { alturaBomba, H0, caudalMaximoLMin, caudalDeA, caudalDeB };
}

const ALTURA_MAX_BISECCION = 1000; // m: cota superior generosa para acotar las bisecciones de altura (ningún equipo del catálogo supera los 260 m de la Black Panther BP4)

// Un tendido real largo rara vez tiene una única bifurcación al final: se
// pueden poner varias, en puntos distintos (p. ej. una a los 200 m de
// manguera y, en una de sus salidas, otra más adelante). Se modela como un
// ÁRBOL: cada "nodo" tiene sus propios tramos de manguera (el tramo que
// recorre antes de terminar o de volver a bifurcarse) y, opcionalmente,
// una bifurcación en 2-3 ramas, cada una de ellas otro nodo igual
// (recursivo: una rama puede volver a bifurcarse más adelante).
//   nodo = {
//     tramos: [...],            // manguera propia de este nodo
//     desnivelPropioM: 0,       // desnivel propio de este tramo (p. ej. escaleras)
//     bifurcacion: null | { ramas: [nodo, nodo, ...] },
//     boquilla, usarSideinfo... // solo relevante si no bifurca (es una hoja/punta de lanza)
//   }
//
// Para cada nodo se construye su "perfil": la relación entre el caudal que
// entra por él y la altura manométrica que hace falta en su entrada para
// ello (y su inversa). Resolver esto con una bisección en cada nivel de
// bifurcación, anidada dentro de la bisección del nivel anterior, tiene un
// coste que crece exponencialmente con la profundidad del árbol (cada
// nivel multiplica el coste del siguiente por ~60 iteraciones): con dos o
// tres bifurcaciones en cadena deja de ser viable en la práctica. Por eso
// se calcula de abajo a arriba y UNA SOLA VEZ, en vez de recalcularse en
// cada consulta:
//  - En una hoja, las pérdidas (manguera, reducciones, boquilla) son
//    exactamente proporcionales a Q² — perdidaCargaManguera,
//    perdidaReduccionM y presionBoquillaM no tienen término constante ni
//    lineal, solo cuadrático — así que se invierten en forma CERRADA, sin
//    aproximación ni bisección.
//  - En un nodo que bifurca no hay forma cerrada (es la suma de varias
//    raíces cuadradas con coeficientes distintos, una por rama), así que
//    se tabula barriendo la altura en el punto de reparto y usando los
//    perfiles YA CONSTRUIDOS de sus ramas (que ya son búsquedas en tabla,
//    no bisecciones) para cada muestra. El coste de construir un nodo pasa
//    a ser proporcional al número de muestras, no exponencial con la
//    profundidad, y cada consulta posterior (evaluar/invertir) es una
//    búsqueda binaria en esa tabla.
const NUM_MUESTRAS_PERFIL = 200;

// Busca por interpolación lineal en una tabla ordenada (por construcción,
// estrictamente creciente en los tres campos a la vez: más altura en el
// punto de reparto da más caudal, y más caudal da más altura de entrada).
// Fuera de rango por debajo se trunca al primer valor; por encima se
// extrapola linealmente con la pendiente del último tramo (para que un
// caudal mayor que el muestreado, p. ej. por el tope de ficha de una
// cadena de bombas muy potente, no quede sin resolver).
function buscarEnTabla(muestras, campoEntrada, valorEntrada, campoSalida) {
  const n = muestras.length;
  if (valorEntrada <= muestras[0][campoEntrada]) return muestras[0][campoSalida];
  const ultima = muestras[n - 1];
  if (valorEntrada >= ultima[campoEntrada]) {
    const previa = muestras[n - 2];
    const denom = ultima[campoEntrada] - previa[campoEntrada];
    const pendiente = denom !== 0 ? (ultima[campoSalida] - previa[campoSalida]) / denom : 0;
    return ultima[campoSalida] + pendiente * (valorEntrada - ultima[campoEntrada]);
  }
  let lo = 0;
  let hi = n - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (muestras[mid][campoEntrada] < valorEntrada) lo = mid;
    else hi = mid;
  }
  const a = muestras[lo];
  const b = muestras[hi];
  const denom = b[campoEntrada] - a[campoEntrada];
  const t = denom !== 0 ? (valorEntrada - a[campoEntrada]) / denom : 0;
  return a[campoSalida] + t * (b[campoSalida] - a[campoSalida]);
}

function construirPerfilNodo(nodo, diametroEntradaMM, densidadRelativa) {
  const tramosConEntrada =
    diametroEntradaMM != null && nodo.tramos.length
      ? [{ diametroMM: diametroEntradaMM, coeficiente: 0, longitudM: 0 }, ...nodo.tramos]
      : nodo.tramos;

  if (!nodo.bifurcacion) {
    if (nodo.cerrada) {
      // Llave cerrada (salida de reserva): resistencia infinita, nunca pasa
      // caudal por aquí sea cual sea la presión disponible, así que todo el
      // caudal lo reparten las demás salidas abiertas del mismo punto.
      return { evaluar: () => Infinity, invertir: () => 0 };
    }
    // Qref es arbitrario (>0): como la pérdida es exactamente A·Q², calibrar
    // A con un único punto de referencia da el coeficiente exacto, no una
    // aproximación.
    const Qref = 1000;
    const perdidaEnQref =
      perdidaTendido(Qref, tramosConEntrada, densidadRelativa) +
      (nodo.boquilla ? presionBoquillaM(Qref, nodo.boquilla) * densidadRelativa : 0);
    const A = perdidaEnQref / (Qref * Qref);
    const B = nodo.desnivelPropioM || 0;
    return {
      evaluar: (Q) => A * Q * Q + B,
      invertir: (H) => (A <= 0 || H <= B ? 0 : Math.sqrt((H - B) / A)),
    };
  }

  const diametroSalida = nodo.tramos.length ? nodo.tramos[nodo.tramos.length - 1].diametroMM : diametroEntradaMM;
  const perfilesRamas = nodo.bifurcacion.ramas.map((r) => construirPerfilNodo(r, diametroSalida, densidadRelativa));

  const muestras = [];
  for (let i = 0; i <= NUM_MUESTRAS_PERFIL; i++) {
    const frac = i / NUM_MUESTRAS_PERFIL;
    const Hreparto = ALTURA_MAX_BISECCION * frac * frac; // más densidad de muestras a alturas bajas, donde la curva cambia más
    const Qreparto = perfilesRamas.reduce((s, p) => s + p.invertir(Hreparto), 0);
    const Hentrada = perdidaTendido(Qreparto, tramosConEntrada, densidadRelativa) + (nodo.desnivelPropioM || 0) + Hreparto;
    muestras.push({ Hreparto, Q: Qreparto, H: Hentrada });
  }

  return {
    evaluar: (Q) => buscarEnTabla(muestras, 'Q', Q, 'H'),
    invertir: (H) => buscarEnTabla(muestras, 'H', H, 'Q'),
    repartoParaCaudal: (Q) => buscarEnTabla(muestras, 'Q', Q, 'Hreparto'),
    perfilesRamas,
    diametroSalida,
  };
}

// Recorre el árbol (una vez resuelto el caudal que entra por la raíz)
// repartiendo ese caudal entre todas las hojas, usando los perfiles ya
// construidos (búsquedas en tabla). out[] acumula el resultado de cada
// hoja en el mismo orden en que aparecen en el árbol.
//
// Hreparto es la altura manométrica (m) en el punto exacto donde esta
// hoja arranca (el reparto de la bifurcación de la que cuelga, o la
// propia bomba si no hay bifurcación): es la presión que le "llega" a esa
// salida antes de que su propia manguera empiece a perderla. Con una
// boquilla SIDEINFO, esa presión se consume regulándola (se muestra ya la
// presión real en la boquilla, más informativa). Sin boquilla (manguera o
// lanza abierta), toda esa presión se disipa en el propio tendido de la
// salida hasta llegar a caudal con la punta abierta a la atmósfera (0 de
// lectura en un manómetro ahí), así que Hreparto es la presión de
// referencia útil: cuánta hay disponible en ese punto del repartidor,
// antes de que la propia manguera de la salida la vaya consumiendo. En
// una salida cerrada (sin caudal), al no haber pérdida de carga, esa
// misma Hreparto es exactamente lo que marcaría un manómetro ahí mismo.
function descenderPerfil(Q, nodo, perfil, diametroEntradaMM, densidadRelativa, Hreparto, out) {
  if (!nodo.bifurcacion) {
    const presionEnRepartoBar = Math.round((Hreparto / 10.2) * 100) / 100;
    if (nodo.cerrada) {
      out.push({
        nodo,
        caudalLMin: 0,
        perdidaCargaM: 0,
        presionBoquillaBar: null,
        alcanceBoquillaM: null,
        presionEnRepartoBar,
      });
      return;
    }
    const tramosConEntrada =
      diametroEntradaMM != null && nodo.tramos.length
        ? [{ diametroMM: diametroEntradaMM, coeficiente: 0, longitudM: 0 }, ...nodo.tramos]
        : nodo.tramos;
    const perdidaBoquilla = nodo.boquilla ? presionBoquillaM(Q, nodo.boquilla) * densidadRelativa : 0;
    const presionBoquillaBar = nodo.boquilla ? Math.round((perdidaBoquilla / 10.2) * 100) / 100 : null;
    const perdidaPropia = perdidaTendido(Q, tramosConEntrada, densidadRelativa) + (nodo.desnivelPropioM || 0);
    out.push({
      nodo,
      caudalLMin: Math.round(Q),
      presionEnRepartoBar,
      perdidaCargaM: Math.round(perdidaPropia * 10) / 10,
      presionBoquillaBar,
      alcanceBoquillaM: nodo.boquilla ? Math.round(alcanceBoquillaM(presionBoquillaBar, nodo.boquilla) * 10) / 10 : null,
    });
    return;
  }

  const HrepartoRamas = perfil.repartoParaCaudal(Q);
  nodo.bifurcacion.ramas.forEach((r, i) => {
    const perfilRama = perfil.perfilesRamas[i];
    const Qr = perfilRama.invertir(HrepartoRamas);
    descenderPerfil(Qr, r, perfilRama, perfil.diametroSalida, densidadRelativa, HrepartoRamas, out);
  });
}

// Resuelve el punto de trabajo de un sistema con una fuente de presión ya
// combinada ("bomba": una sola, o varias en serie/paralelo) y un tendido
// representado como un ÁRBOL de bifurcaciones (nodoRaiz): cada "nodo"
// tiene sus propios tramos de manguera (el tramo que recorre antes de
// terminar en una punta de lanza o de volver a bifurcarse) y,
// opcionalmente, una bifurcación en 2-3 ramas, cada una de ellas otro nodo
// igual (recursivo: una rama puede volver a bifurcarse más adelante, para
// colocar varias bifurcaciones en puntos distintos de un mismo tendido
// largo, no solo una al final).
//   nodo = {
//     tramos: [...],            // manguera propia de este nodo
//     desnivelPropioM: 0,       // desnivel propio de este tramo (p. ej. escaleras)
//     bifurcacion: null | { ramas: [nodo, nodo, ...] },
//     boquilla,                 // solo relevante si no bifurca (es una hoja/punta de lanza)
//     cerrada: false,           // solo relevante si no bifurca: llave cerrada (salida de reserva), nunca pasa caudal por aquí
//   }
// Si el tope de caudal de ficha recorta el resultado, se vuelve a recorrer
// el árbol entero con el caudal ya recortado (no es una aproximación por
// factor de reparto: cada bifurcación se resuelve de nuevo para ese
// caudal, exactamente igual que si ese hubiera sido el caudal real desde
// el principio).
export function resolverPuntoTrabajoArbol({ bomba, desnivelPrincipalM = 0, nodoRaiz, densidadRelativa = 1 }) {
  const perfilRaiz = construirPerfilNodo(nodoRaiz, null, densidadRelativa);

  function f(Q) {
    return desnivelPrincipalM + perfilRaiz.evaluar(Q) - bomba.alturaBomba(Q);
  }

  let Qsol = 0;
  if (desnivelPrincipalM < bomba.H0 && f(0) < 0) {
    let lo = 0;
    let hi = CAUDAL_MAX_BISECCION;
    for (let i = 0; i < 60; i++) {
      const mid = (lo + hi) / 2;
      if (f(mid) > 0) hi = mid;
      else lo = mid;
    }
    Qsol = (lo + hi) / 2;
  }

  const QsolFinal = bomba.caudalMaximoLMin != null ? Math.min(Qsol, bomba.caudalMaximoLMin) : Qsol;
  const perdidaTotal = perfilRaiz.evaluar(QsolFinal);

  const hojas = [];
  descenderPerfil(QsolFinal, nodoRaiz, perfilRaiz, null, densidadRelativa, perdidaTotal, hojas);

  return {
    caudalTotalLMin: Math.round(QsolFinal),
    alturaManometricaTotal: Math.round((desnivelPrincipalM + perdidaTotal) * 10) / 10,
    perdidaCargaTotalM: Math.round(perdidaTotal * 10) / 10,
    hojas,
  };
}

// ===================== Turbobomba =====================
// La turbobomba no tiene curva H(Q) propia (ver turbobomba en
// data/equipos.js): su rendimiento solo se conoce en los puntos reales de
// su ficha (4 presiones de entrada x 4 alturas de aspiración). Fuera de
// esos puntos se interpola linealmente en las dos variables; fuera del
// rango medido (presión < 4 o > 10 bar, altura < 2 o > 8 m) se acota al
// extremo más cercano en vez de extrapolar sin dato real que lo respalde.
function interpolarLineal(x, x0, y0, x1, y1) {
  if (x1 === x0) return y0;
  const t = (x - x0) / (x1 - x0);
  return y0 + t * (y1 - y0);
}

const ALTURAS_TURBOBOMBA = [2, 4, 6, 8];

function salidaEnFilaTurbobomba(fila, alturaM) {
  const alturaClamp = Math.min(Math.max(alturaM, ALTURAS_TURBOBOMBA[0]), ALTURAS_TURBOBOMBA[ALTURAS_TURBOBOMBA.length - 1]);
  for (let i = 0; i < ALTURAS_TURBOBOMBA.length - 1; i++) {
    const a = ALTURAS_TURBOBOMBA[i];
    const b = ALTURAS_TURBOBOMBA[i + 1];
    if (alturaClamp >= a && alturaClamp <= b) {
      return interpolarLineal(alturaClamp, a, fila.salidaPorAlturaLMin[a], b, fila.salidaPorAlturaLMin[b]);
    }
  }
  return fila.salidaPorAlturaLMin[ALTURAS_TURBOBOMBA[ALTURAS_TURBOBOMBA.length - 1]];
}

// Dada la presión de salida de la bomba que acciona la turbobomba (bar) y
// la altura de aspiración (profundidad del punto de achique, m), devuelve
// el caudal de entrada (agua motriz) que necesita y el caudal de salida
// (trasvasado) resultante, interpolando sobre la tabla real de la ficha.
export function turbobombaCaudalSalida(presionEntradaBar, alturaAspiracionM, tabla) {
  const pClamp = Math.min(Math.max(presionEntradaBar, tabla[0].presionEntradaBar), tabla[tabla.length - 1].presionEntradaBar);
  for (let i = 0; i < tabla.length - 1; i++) {
    const filaA = tabla[i];
    const filaB = tabla[i + 1];
    if (pClamp >= filaA.presionEntradaBar && pClamp <= filaB.presionEntradaBar) {
      const salidaA = salidaEnFilaTurbobomba(filaA, alturaAspiracionM);
      const salidaB = salidaEnFilaTurbobomba(filaB, alturaAspiracionM);
      return {
        caudalEntradaLMin: interpolarLineal(pClamp, filaA.presionEntradaBar, filaA.caudalEntradaLMin, filaB.presionEntradaBar, filaB.caudalEntradaLMin),
        caudalSalidaLMin: interpolarLineal(pClamp, filaA.presionEntradaBar, salidaA, filaB.presionEntradaBar, salidaB),
      };
    }
  }
  const ultima = tabla[tabla.length - 1];
  return { caudalEntradaLMin: ultima.caudalEntradaLMin, caudalSalidaLMin: salidaEnFilaTurbobomba(ultima, alturaAspiracionM) };
}
