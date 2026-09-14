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
// dado un desnivel geométrico, una longitud de manguera y un diámetro,
// mediante iteración de punto fijo: la pérdida depende del caudal, y el
// caudal depende de la altura manométrica total (desnivel + pérdida).
export function estimarPuntoTrabajo({ curva, desnivelM, longitudManguera, coeficienteManguera, densidadRelativa = 1 }) {
  let caudal = interpolarCaudal(curva, desnivelM);

  for (let i = 0; i < 25; i++) {
    const perdida = perdidaCargaManguera(caudal, longitudManguera, coeficienteManguera) * densidadRelativa;
    const alturaTotal = desnivelM + perdida;
    const nuevoCaudal = interpolarCaudal(curva, alturaTotal);
    if (Math.abs(nuevoCaudal - caudal) < 1) {
      caudal = nuevoCaudal;
      break;
    }
    caudal = nuevoCaudal;
  }

  const perdidaFinal = perdidaCargaManguera(caudal, longitudManguera, coeficienteManguera) * densidadRelativa;
  return {
    caudalLMin: Math.round(caudal),
    alturaManometricaTotal: Math.round((desnivelM + perdidaFinal) * 10) / 10,
    perdidaCargaM: Math.round(perdidaFinal * 10) / 10,
  };
}
