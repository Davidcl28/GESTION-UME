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
// (tipo SIDEINFO) para entregar un caudal Q por un orificio de diámetro dado,
// según la ecuación clásica de orificio: Q(l/min) = Cd·0,667·d²(mm)·√P(bar).
// Cd (coeficiente de descarga) ≈ 0,9 es un valor típico de catálogo para
// boquillas de bomberos de perfil suave; es un modelo físico estándar, no una
// lectura literal de la tarjeta de la boquilla (que da caudal/alcance ya
// medidos en banco, más precisos si se dispone de ellos).
export function presionBoquillaM(caudalLMin, diametroBoquillaMM, cd = 0.9) {
  const k = cd * 0.667 * diametroBoquillaMM * diametroBoquillaMM;
  if (k <= 0 || caudalLMin <= 0) return 0;
  const presionBar = (caudalLMin / k) ** 2;
  return presionBar * 10.2;
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
  boquilla, // opcional: { diametroMM, cd }
}) {
  const { H0: H0Ajustado, k } = ajustarCurvaCuadratica(curva);
  const H0 = alturaMaximaM != null ? Math.min(H0Ajustado, alturaMaximaM) : H0Ajustado;

  const alturaBomba = (Q) => Math.max(H0 - k * Q * Q, 0);
  const perdidas = (Q) => {
    let total = perdidaTendido(Q, tramos, densidadRelativa);
    if (boquilla) total += presionBoquillaM(Q, boquilla.diametroMM, boquilla.cd) * densidadRelativa;
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
  const presionBoquillaFinal = boquilla ? presionBoquillaM(caudal, boquilla.diametroMM, boquilla.cd) : 0;
  return {
    caudalLMin: Math.round(caudal),
    alturaManometricaTotal: Math.round((desnivelM + perdidasFinal) * 10) / 10,
    perdidaCargaM: Math.round((perdidasFinal - presionBoquillaFinal * densidadRelativa) * 10) / 10,
    presionBoquillaBar: boquilla ? Math.round((presionBoquillaFinal / 10.2) * 100) / 100 : null,
  };
}
