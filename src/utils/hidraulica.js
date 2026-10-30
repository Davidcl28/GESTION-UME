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

// Resuelve el punto de trabajo de un sistema con una fuente de presión ya
// combinada ("bomba": una sola, o varias en serie/paralelo) y un tendido
// con 1 a 3 salidas finales (sin bifurcación, con bifurcación o con
// trifurcación). Todas las salidas comparten el mismo punto de reparto (la
// misma altura manométrica justo ahí), así que el caudal se reparte entre
// ellas según la pérdida de carga propia de cada una (su manguera + su
// lanza, si tiene + su desnivel propio, si lo hay): la salida con menos
// pérdida se lleva más caudal, igual que pasaría con mangueras reales
// conectadas a un mismo repartidor.
//
// tramosPrincipales es el tramo común ANTES del reparto (puede ir vacío si
// no hay tramo común, p. ej. cuando solo hay una salida y toda la manguera
// es "la salida"). ramas es la lista de salidas: cada una es
// { tramos, boquilla, desnivelExtraM }, y debe tener siempre al menos un
// tramo de manguera propio (con longitud > 0) si tramosPrincipales va
// vacío, para que el reparto tenga una pérdida de carga real con la que
// resolverse.
export function resolverPuntoTrabajoRed({
  bomba,
  desnivelPrincipalM = 0,
  tramosPrincipales = [],
  ramas,
  densidadRelativa = 1,
}) {
  const diametroEntradaMM = tramosPrincipales.length
    ? tramosPrincipales[tramosPrincipales.length - 1].diametroMM
    : null;

  // Si hay un tramo principal antes del reparto, se añade la pérdida de la
  // reducción/racor del repartidor (diámetro del tramo principal → de cada
  // salida), igual que entre dos tramos cualesquiera de un mismo tendido.
  function tramosDeRamaConEntrada(rama) {
    if (diametroEntradaMM == null || !rama.tramos.length) return rama.tramos;
    return [{ diametroMM: diametroEntradaMM, coeficiente: 0, longitudM: 0 }, ...rama.tramos];
  }

  function perdidaRama(Q, rama) {
    let total = perdidaTendido(Q, tramosDeRamaConEntrada(rama), densidadRelativa);
    if (rama.boquilla) total += presionBoquillaM(Q, rama.boquilla) * densidadRelativa;
    total += rama.desnivelExtraM || 0;
    return total;
  }

  function caudalRama(H, rama) {
    return biseccionCaudal((Q) => perdidaRama(Q, rama), H, true);
  }

  function caudalTotalParaH(H) {
    return ramas.reduce((s, r) => s + caudalRama(H, r), 0);
  }

  // f(H) es monótona creciente en H: al subir H, cada rama admite más
  // caudal (pérdida creciente en Q), el tramo principal pierde más con ese
  // caudal mayor, y la bomba da cada vez menos altura disponible con ese
  // caudal mayor — los tres efectos empujan f hacia arriba. Se busca su
  // cero por bisección, acotada entre 0 y la altura estática máxima de la
  // bomba (cota segura: a más altura que esa, ninguna bomba da presión
  // positiva ni con caudal cero).
  function f(H) {
    const Qtotal = caudalTotalParaH(H);
    const perdidaPrincipal = perdidaTendido(Qtotal, tramosPrincipales, densidadRelativa);
    return desnivelPrincipalM + perdidaPrincipal + H - bomba.alturaBomba(Qtotal);
  }

  let Hsol = 0;
  if (desnivelPrincipalM < bomba.H0 && f(0) < 0) {
    let lo = 0;
    let hi = bomba.H0;
    for (let i = 0; i < 60; i++) {
      const mid = (lo + hi) / 2;
      if (f(mid) > 0) hi = mid;
      else lo = mid;
    }
    Hsol = (lo + hi) / 2;
  }

  const QtotalCrudo = caudalTotalParaH(Hsol);
  const QtotalFinal = bomba.caudalMaximoLMin != null ? Math.min(QtotalCrudo, bomba.caudalMaximoLMin) : QtotalCrudo;
  // Si el tope de ficha recorta el caudal total, se reparte la misma
  // proporción a cada salida: es una aproximación (no se vuelve a resolver
  // el reparto a ese caudal menor), consistente con cómo el resto de la
  // aplicación ya trata los topes duros de ficha, como un recorte final y
  // no como una incógnita más del sistema.
  const factorReparto = QtotalCrudo > 0 ? QtotalFinal / QtotalCrudo : 0;

  const perdidaPrincipalFinal = perdidaTendido(QtotalFinal, tramosPrincipales, densidadRelativa);

  const caudalesRamaFinal = ramas.map((rama) => caudalRama(Hsol, rama) * factorReparto);
  // Si el tope de caudal ha recortado el reparto, la altura en el punto de
  // reparto ya no es la Hsol sin recortar: se recalcula a partir del
  // caudal real (ya recortado) de la primera rama, igual que
  // estimarPuntoTrabajo recalcula su pérdida de carga final con el caudal
  // ya recortado en vez de reutilizar el de la bisección sin recortar.
  const HsolFinal = ramas.length ? perdidaRama(caudalesRamaFinal[0], ramas[0]) : Hsol;

  const resultadosRamas = ramas.map((rama, i) => {
    const Qrama = caudalesRamaFinal[i];
    const perdidaConBoquilla = perdidaRama(Qrama, rama);
    const presionBoquillaFinal = rama.boquilla ? presionBoquillaM(Qrama, rama.boquilla) * densidadRelativa : 0;
    const presionBoquillaBar = rama.boquilla ? Math.round((presionBoquillaFinal / 10.2) * 100) / 100 : null;
    return {
      caudalLMin: Math.round(Qrama),
      perdidaCargaM: Math.round((perdidaConBoquilla - presionBoquillaFinal) * 10) / 10,
      presionBoquillaBar,
      alcanceBoquillaM: rama.boquilla ? Math.round(alcanceBoquillaM(presionBoquillaBar, rama.boquilla) * 10) / 10 : null,
    };
  });

  return {
    caudalTotalLMin: Math.round(QtotalFinal),
    alturaManometricaTotal: Math.round((desnivelPrincipalM + perdidaPrincipalFinal + HsolFinal) * 10) / 10,
    perdidaCargaPrincipalM: Math.round(perdidaPrincipalFinal * 10) / 10,
    alturaEnRepartoM: Math.round(HsolFinal * 10) / 10,
    ramas: resultadosRamas,
  };
}
