// Utilidades de cálculo hidráulico: interpolación de curvas de bomba
// y estimación de pérdidas de carga en manguera.

// Interpola linealmente el caudal (l/min) de una curva de bomba
// {altura, caudal}[] (ordenada por altura ascendente) para una
// altura manométrica total dada. Fuera de rango, satura al extremo.
export function interpolarCaudal(curva, alturaManometrica) {
  const puntos = [...curva].sort((a, b) => a.altura - b.altura);

  if (alturaManometrica <= puntos[0].altura) return puntos[0].caudal;
  const ultimo = puntos[puntos.length - 1];
  if (alturaManometrica >= ultimo.altura) return Math.max(ultimo.caudal, 0);

  for (let i = 0; i < puntos.length - 1; i++) {
    const p1 = puntos[i];
    const p2 = puntos[i + 1];
    if (alturaManometrica >= p1.altura && alturaManometrica <= p2.altura) {
      const t = (alturaManometrica - p1.altura) / (p2.altura - p1.altura);
      return p1.caudal + t * (p2.caudal - p1.caudal);
    }
  }
  return ultimo.caudal;
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
