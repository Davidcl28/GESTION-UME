// Utilidades de cálculo hidráulico: ajuste de la curva de la bomba
// y estimación de pérdidas de carga en manguera.

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

// Pérdida de carga estimada en la manguera (m de columna de agua)
// para un caudal Q (l/min), longitud L (m) y coeficiente de la manguera.
// pérdida(bar/100m) = coeficiente * (Q/100)^2  →  convertida a metros (1 bar ≈ 10,2 m c.a.)
export function perdidaCargaManguera(caudalLMin, longitudM, coeficiente) {
  const perdidaBarPor100m = coeficiente * (caudalLMin / 100) ** 2;
  const perdidaBarTotal = perdidaBarPor100m * (longitudM / 100);
  return perdidaBarTotal * 10.2;
}

// Resuelve el punto de trabajo real (caudal estable en l/min) de un equipo
// dado un desnivel geométrico, una longitud de manguera y un diámetro: la
// pérdida de carga depende del caudal, y el caudal que da la bomba depende a
// su vez de la altura manométrica total (desnivel + pérdida), así que hay que
// encontrar el punto donde ambas curvas se cruzan. Se resuelve por bisección
// sobre f(Q) = (desnivel + pérdida(Q)) - alturaBomba(Q), que es monótona
// creciente en Q (la pérdida sube con el caudal, la altura de la bomba baja),
// por lo que siempre converge a la única solución — a diferencia de una
// iteración de punto fijo directa, que puede oscilar sin converger cuando la
// pérdida de carga inicial estimada es muy superior a la altura máxima de la
// bomba (típico con curvas de un solo punto, como los circuitos de alta
// presión de algunas autobombas).
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
  longitudManguera,
  coeficienteManguera,
  densidadRelativa = 1,
  alturaMaximaM,
  caudalMaximoLMin,
}) {
  const { H0: H0Ajustado, k } = ajustarCurvaCuadratica(curva);
  const H0 = alturaMaximaM != null ? Math.min(H0Ajustado, alturaMaximaM) : H0Ajustado;

  const alturaBomba = (Q) => Math.max(H0 - k * Q * Q, 0);
  const perdida = (Q) => perdidaCargaManguera(Q, longitudManguera, coeficienteManguera) * densidadRelativa;
  const f = (Q) => desnivelM + perdida(Q) - alturaBomba(Q);

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

  const perdidaFinal = perdida(caudal);
  return {
    caudalLMin: Math.round(caudal),
    alturaManometricaTotal: Math.round((desnivelM + perdidaFinal) * 10) / 10,
    perdidaCargaM: Math.round(perdidaFinal * 10) / 10,
  };
}
