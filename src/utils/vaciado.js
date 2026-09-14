// Estimación del tiempo de vaciado de una zona anegada (garaje, sótano, nave...)
// a partir de sus dimensiones y del caudal de extracción disponible.

export function calcularVolumenM3(largoM, anchoM, alturaAguaM) {
  return Math.max(0, largoM) * Math.max(0, anchoM) * Math.max(0, alturaAguaM);
}

// factorEficiencia (0-1): reduce el caudal nominal para tener en cuenta paradas
// de cebado, obstrucciones, sedimentos y que la bomba no siempre trabaja a su
// punto óptimo durante toda la operación.
export function calcularTiempoVaciado({ volumenM3, caudalLMinPorEquipo, numEquipos = 1, factorEficiencia = 0.75 }) {
  const litros = volumenM3 * 1000;
  const caudalTotalLMin = caudalLMinPorEquipo * Math.max(1, numEquipos) * Math.max(0.1, Math.min(1, factorEficiencia));
  const tiempoMinutos = caudalTotalLMin > 0 ? litros / caudalTotalLMin : Infinity;

  return {
    litros: Math.round(litros),
    caudalTotalLMin: Math.round(caudalTotalLMin),
    tiempoMinutos,
    tiempoHoras: tiempoMinutos / 60,
  };
}

export function formatearDuracion(minutos) {
  if (!Number.isFinite(minutos)) return 'N/D';
  const horas = Math.floor(minutos / 60);
  const min = Math.round(minutos % 60);
  if (horas === 0) return `${min} min`;
  return `${horas} h ${min} min`;
}
