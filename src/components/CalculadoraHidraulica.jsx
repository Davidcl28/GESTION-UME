import { useMemo, useState } from 'react';
import { boquillasSideinfo, catalogoMedios, diametrosManguera, LIMITE_SUCCION_GENERAL_M } from '../data/equipos';
import {
  construirBombaSimple,
  combinarBombasSerie,
  combinarBombasParalelo,
  resolverPuntoTrabajoRed,
} from '../utils/hidraulica';
import './CalculadoraHidraulica.css';

function diametrosDeEquipo(medio) {
  return (medio.diametrosDisponibles || diametrosManguera.map((d) => d.id)).map(
    (id) => diametrosManguera.find((d) => d.id === id)
  );
}

function tramoPorDefecto(diametroId, longitudM = 20) {
  return { diametroId, longitudM };
}

function resolverTramo(t) {
  const d = diametrosManguera.find((x) => x.id === t.diametroId) || diametrosManguera[0];
  return {
    diametroMM: Number(d.id),
    coeficiente: d.coeficiente,
    longitudM: Number(t.longitudM) || 0,
    nombre: d.nombre,
    caudalRecomendadoMax: d.caudalRecomendadoMax,
  };
}

function resolverTramos(arr) {
  return arr.map(resolverTramo);
}

function crearSalidaPorDefecto() {
  return {
    tramos: [tramoPorDefecto('45', 20)],
    desnivelExtra: 0,
    usarSideinfo: false,
    boquillaMM: boquillasSideinfo[2].mm,
  };
}

// Datos de curva/topes de un equipo (y, si aplica, de su circuito seleccionado).
function datosEquipo(medio, circuitoId) {
  const circuito = medio.circuitos?.find((c) => c.id === circuitoId) || medio.circuitos?.[0] || null;
  return {
    medio,
    circuito,
    curva: circuito ? circuito.curva : medio.curva,
    alturaMaximaM: circuito ? circuito.alturaMaximaM : medio.alturaMaximaM,
    caudalMaximoLMin: circuito ? circuito.caudalMaximoLMin : medio.caudalMaximoLMin,
  };
}

// Límite de succión aplicable a un equipo: el menor entre el límite físico
// general (~8 m, presión atmosférica) y el propio de la ficha, si la tiene.
function succionInfo(medio, succionValor) {
  const limiteAplicable = medio.succionMax != null ? Math.min(medio.succionMax, LIMITE_SUCCION_GENERAL_M) : LIMITE_SUCCION_GENERAL_M;
  const imposible = !medio.sumergible && Number(succionValor) > limiteAplicable;
  const excedida = medio.succionMax != null && Number(succionValor) > medio.succionMax;
  const limiteGeneralExcedido = !medio.sumergible && Number(succionValor) > LIMITE_SUCCION_GENERAL_M;
  return { imposible, excedida, limiteGeneralExcedido, limiteAplicable };
}

export default function CalculadoraHidraulica() {
  // --- Cadena de equipos de bombeo (1 o 2) ---
  const [numEquipos, setNumEquipos] = useState(1);
  const [modoConexion, setModoConexion] = useState('serie'); // 'serie' | 'paralelo'

  const [medioId0, setMedioId0] = useState(catalogoMedios[0].id);
  const [circuitoId0, setCircuitoId0] = useState(catalogoMedios[0].circuitos?.[0]?.id ?? null);
  const [medioId1, setMedioId1] = useState(catalogoMedios[0].id);
  const [circuitoId1, setCircuitoId1] = useState(catalogoMedios[0].circuitos?.[0]?.id ?? null);

  const [succion0, setSuccion0] = useState(3); // succión del equipo 1 (siempre aplica si no es sumergible)
  const [succion1, setSuccion1] = useState(0); // succión del equipo 2 (solo se usa en modo paralelo)

  const [tramoEnlace, setTramoEnlace] = useState(tramoPorDefecto('45', 10)); // serie: manguera de enlace entre ambos equipos
  const [desnivelEnlace, setDesnivelEnlace] = useState(0);

  const [tramoConexion0, setTramoConexion0] = useState(tramoPorDefecto('45', 5)); // paralelo: conexión de cada equipo al colector
  const [tramoConexion1, setTramoConexion1] = useState(tramoPorDefecto('45', 5));

  // --- Tendido principal (hasta el reparto, si lo hay) ---
  const [alturaImpulsion, setAlturaImpulsion] = useState(7);
  const [tramos, setTramos] = useState([tramoPorDefecto(catalogoMedios[0].diametrosDisponibles[0], 40)]);

  // --- Salidas finales (1 = sin bifurcar, 2 = bifurcación, 3 = trifurcación) ---
  const [numSalidas, setNumSalidas] = useState(1);
  const [salidas, setSalidas] = useState([crearSalidaPorDefecto()]);

  const [densidad, setDensidad] = useState(1.0);

  const medio0 = useMemo(() => catalogoMedios.find((m) => m.id === medioId0), [medioId0]);
  const medio1 = useMemo(() => catalogoMedios.find((m) => m.id === medioId1), [medioId1]);
  const datos0 = useMemo(() => datosEquipo(medio0, circuitoId0), [medio0, circuitoId0]);
  const datos1 = useMemo(() => datosEquipo(medio1, circuitoId1), [medio1, circuitoId1]);
  const diametrosDelEquipo0 = useMemo(() => diametrosDeEquipo(medio0), [medio0]);
  const diametrosDelEquipo1 = useMemo(() => diametrosDeEquipo(medio1), [medio1]);

  const esParalelo = numEquipos === 2 && modoConexion === 'paralelo';
  const esSerie = numEquipos === 2 && modoConexion === 'serie';

  // Al cambiar el equipo 1, se reinicia el tendido principal con su primer
  // racor real y su primer circuito disponible (igual que antes).
  function cambiarMedio0(nuevoMedioId) {
    setMedioId0(nuevoMedioId);
    const nuevoMedio = catalogoMedios.find((m) => m.id === nuevoMedioId);
    setTramos([tramoPorDefecto(diametrosDeEquipo(nuevoMedio)[0].id, 40)]);
    setCircuitoId0(nuevoMedio.circuitos?.[0]?.id ?? null);
    setTramoEnlace((t) => ({ ...t, diametroId: diametrosDeEquipo(nuevoMedio)[0].id }));
    setTramoConexion0((t) => ({ ...t, diametroId: diametrosDeEquipo(nuevoMedio)[0].id }));
  }
  function cambiarMedio1(nuevoMedioId) {
    setMedioId1(nuevoMedioId);
    const nuevoMedio = catalogoMedios.find((m) => m.id === nuevoMedioId);
    setCircuitoId1(nuevoMedio.circuitos?.[0]?.id ?? null);
    setTramoConexion1((t) => ({ ...t, diametroId: diametrosDeEquipo(nuevoMedio)[0].id }));
  }

  function cambiarNumeroTramos(n) {
    setTramos((prev) => {
      const next = prev.slice(0, n);
      while (next.length < n) {
        const anterior = next[next.length - 1] || prev[0];
        next.push(tramoPorDefecto(anterior.diametroId, 10));
      }
      return next;
    });
  }
  function actualizarTramo(indice, cambios) {
    setTramos((prev) => prev.map((t, i) => (i === indice ? { ...t, ...cambios } : t)));
  }

  function cambiarNumeroSalidas(n) {
    setNumSalidas(n);
    setSalidas((prev) => {
      const next = prev.slice(0, n);
      while (next.length < n) next.push(crearSalidaPorDefecto());
      return next;
    });
  }
  function actualizarSalida(indice, cambios) {
    setSalidas((prev) => prev.map((s, i) => (i === indice ? { ...s, ...cambios } : s)));
  }
  function cambiarNumeroTramosSalida(indiceSalida, n) {
    setSalidas((prev) =>
      prev.map((s, i) => {
        if (i !== indiceSalida) return s;
        const next = s.tramos.slice(0, n);
        while (next.length < n) {
          const anterior = next[next.length - 1] || s.tramos[0];
          next.push(tramoPorDefecto(anterior.diametroId, 10));
        }
        return { ...s, tramos: next };
      })
    );
  }
  function actualizarTramoSalida(indiceSalida, indiceTramo, cambios) {
    setSalidas((prev) =>
      prev.map((s, i) =>
        i !== indiceSalida ? s : { ...s, tramos: s.tramos.map((t, j) => (j === indiceTramo ? { ...t, ...cambios } : t)) }
      )
    );
  }

  const tramosResueltos = useMemo(() => resolverTramos(tramos), [tramos]);
  const tramoEnlaceResuelto = useMemo(() => resolverTramo(tramoEnlace), [tramoEnlace]);
  const tramoConexion0Resuelto = useMemo(() => resolverTramo(tramoConexion0), [tramoConexion0]);
  const tramoConexion1Resuelto = useMemo(() => resolverTramo(tramoConexion1), [tramoConexion1]);
  const salidasResueltas = useMemo(
    () =>
      salidas.map((s) => ({
        tramos: resolverTramos(s.tramos),
        boquilla: s.usarSideinfo ? boquillasSideinfo.find((b) => b.mm === s.boquillaMM) : undefined,
        desnivelExtraM: Number(s.desnivelExtra) || 0,
      })),
    [salidas]
  );

  // La succión del equipo 1 (y, en paralelo, también la del equipo 2) se
  // suma a la altura geométrica como siempre, salvo en paralelo: ahí cada
  // succión ya se tiene en cuenta dentro de la combinación de bombas (cada
  // una aspira de su propia fuente antes de llegar al colector común), así
  // que no se vuelve a sumar aquí para no contarla dos veces.
  const desnivelPrincipalM = esParalelo
    ? Number(alturaImpulsion) || 0
    : (Number(succion0) || 0) + (Number(alturaImpulsion) || 0);

  const bomba = useMemo(() => {
    const bombaSimple0 = construirBombaSimple(datos0.curva, datos0.alturaMaximaM, datos0.caudalMaximoLMin);
    if (numEquipos === 1) return bombaSimple0;
    const bombaSimple1 = construirBombaSimple(datos1.curva, datos1.alturaMaximaM, datos1.caudalMaximoLMin);
    if (esSerie) {
      return combinarBombasSerie(bombaSimple0, bombaSimple1, [tramoEnlaceResuelto], Number(desnivelEnlace) || 0, Number(densidad) || 1);
    }
    return combinarBombasParalelo(
      bombaSimple0,
      bombaSimple1,
      {
        desnivelSuccionA: Number(succion0) || 0,
        desnivelSuccionB: Number(succion1) || 0,
        tramosConexionA: [tramoConexion0Resuelto],
        tramosConexionB: [tramoConexion1Resuelto],
      },
      Number(densidad) || 1
    );
  }, [numEquipos, esSerie, datos0, datos1, tramoEnlaceResuelto, desnivelEnlace, tramoConexion0Resuelto, tramoConexion1Resuelto, succion0, succion1, densidad]);

  // ramas/tramosPrincipales: si solo hay 1 salida no hace falta separar un
  // tramo "principal" de uno "de la rama" (es la misma manguera, sin
  // repartidor), así que toda ella se trata como la única rama. Si hay 2-3
  // salidas, el tendido configurado arriba es el tramo común hasta el
  // repartidor, y cada salida añade sus propios tramos a partir de ahí.
  const boquillaUnica = useMemo(
    () => (salidas[0]?.usarSideinfo ? boquillasSideinfo.find((b) => b.mm === salidas[0].boquillaMM) : undefined),
    [salidas]
  );
  const tramosPrincipales = useMemo(() => (numSalidas > 1 ? tramosResueltos : []), [numSalidas, tramosResueltos]);
  const ramas = useMemo(
    () => (numSalidas > 1 ? salidasResueltas : [{ tramos: tramosResueltos, boquilla: boquillaUnica, desnivelExtraM: 0 }]),
    [numSalidas, salidasResueltas, tramosResueltos, boquillaUnica]
  );

  const resultado = useMemo(
    () =>
      resolverPuntoTrabajoRed({
        bomba,
        desnivelPrincipalM,
        tramosPrincipales,
        ramas,
        densidadRelativa: Number(densidad) || 1,
      }),
    [bomba, desnivelPrincipalM, tramosPrincipales, ramas, densidad]
  );

  // --- Viabilidad física ---
  const succionInfo0 = useMemo(() => succionInfo(medio0, succion0), [medio0, succion0]);
  const succionInfo1 = useMemo(() => succionInfo(medio1, succion1), [medio1, succion1]);
  const succionProblema = succionInfo0.imposible || (esParalelo && succionInfo1.imposible);
  const impulsionImposible = !succionProblema && desnivelPrincipalM >= bomba.H0;
  const sinCaudalPorPerdida = !succionProblema && !impulsionImposible && resultado.caudalTotalLMin === 0;
  const caudalInviable = succionProblema || impulsionImposible || sinCaudalPorPerdida;

  const caudalMostrado = caudalInviable ? 0 : resultado.caudalTotalLMin;
  const perdidaMostrada = succionProblema || impulsionImposible ? 0 : resultado.perdidaCargaPrincipalM;
  const alturaTotalMostrada = succionProblema || impulsionImposible ? desnivelPrincipalM : resultado.alturaManometricaTotal;

  const tramoPrincipalExcedido = !caudalInviable ? tramosResueltos.find((t) => resultado.caudalTotalLMin > t.caudalRecomendadoMax) : null;
  const tramosSalidaExcedidos =
    !caudalInviable && numSalidas > 1
      ? resultado.ramas
          .map((r, i) => ({ salida: i + 1, tramo: salidasResueltas[i].tramos.find((t) => r.caudalLMin > t.caudalRecomendadoMax) }))
          .filter((x) => x.tramo)
      : [];
  const boquillasFueraDeRango = !caudalInviable
    ? resultado.ramas
        .map((r, i) => {
          const b = numSalidas > 1 ? salidasResueltas[i].boquilla : boquillaUnica;
          return b && r.presionBoquillaBar > b.presionMaxBar ? { salida: i + 1, boquilla: b, presionBoquillaBar: r.presionBoquillaBar } : null;
        })
        .filter(Boolean)
    : [];

  return (
    <div>
      <h3>🧮 Calculadora de Rendimiento y Extracción</h3>
      <div className="calc-grid">
        <div className="calc-form">
          <h4>1. Equipos de bombeo</h4>
          <label>Número de equipos en la cadena de bombeo</label>
          <select value={numEquipos} onChange={(e) => setNumEquipos(Number(e.target.value))}>
            <option value={1}>1 (un solo equipo)</option>
            <option value={2}>2 (encadenados)</option>
          </select>

          {numEquipos === 2 && (
            <>
              <label>Modo de conexión entre los dos equipos</label>
              <select value={modoConexion} onChange={(e) => setModoConexion(e.target.value)}>
                <option value="serie">En serie (relevo/refuerzo)</option>
                <option value="paralelo">En paralelo (comparten tendido)</option>
              </select>
              <p className="calc-hint">
                <strong>En serie:</strong> el equipo 2 recibe el agua ya impulsada por el equipo 1 (p. ej. una
                motobomba enlazada a la salida de una autobomba para dar más presión a larga distancia). Las dos
                bombean el mismo caudal; sus presiones se suman. <strong>En paralelo:</strong> cada equipo aspira
                de su propia fuente y los dos descargan en un punto común antes de seguir por un tendido
                compartido (p. ej. dos autobombas alimentando la misma manguera). Se asume válvula antirretorno
                en cada salida al colector: ninguna bomba recibe caudal de la otra.
              </p>
            </>
          )}

          <strong>Equipo {numEquipos === 2 ? '1' : ''}</strong>
          <label>Medio de extracción UME</label>
          <select value={medioId0} onChange={(e) => cambiarMedio0(e.target.value)}>
            {catalogoMedios.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nombre}
              </option>
            ))}
          </select>
          {medio0.circuitos && (
            <>
              <label>Circuito / modo de presión</label>
              <select value={circuitoId0} onChange={(e) => setCircuitoId0(e.target.value)}>
                {medio0.circuitos.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </select>
            </>
          )}
          <p className="calc-hint">
            {numEquipos === 1
              ? '📥 Succión + 📤 impulsión: este equipo toma el agua de la fuente y la impulsa él mismo hasta el tendido.'
              : '📥 Succión + 📤 impulsión: este equipo toma el agua de la fuente real.'}
          </p>

          <label>
            Altura de succión del equipo 1{medio0.sumergible ? ' (no aplica: equipo sumergible)' : ' (agua → equipo, m)'}
          </label>
          <input type="number" min="0" value={succion0} disabled={medio0.sumergible} onChange={(e) => setSuccion0(e.target.value)} />

          {numEquipos === 2 && (
            <>
              <strong>Equipo 2</strong>
              <label>Medio de extracción UME</label>
              <select value={medioId1} onChange={(e) => cambiarMedio1(e.target.value)}>
                {catalogoMedios.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nombre}
                  </option>
                ))}
              </select>
              {medio1.circuitos && (
                <>
                  <label>Circuito / modo de presión</label>
                  <select value={circuitoId1} onChange={(e) => setCircuitoId1(e.target.value)}>
                    {medio1.circuitos.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nombre}
                      </option>
                    ))}
                  </select>
                </>
              )}
              <p className="calc-hint">
                {esSerie
                  ? '📤 Solo impulsión: este equipo es un refuerzo/relevo, recibe el agua ya impulsada por el equipo 1 y añade su propia presión.'
                  : '📥 Succión propia + 📤 impulsión al colector: este equipo aspira de su propia fuente, independiente de la del equipo 1.'}
              </p>

              {esParalelo && (
                <>
                  <label>
                    Altura de succión del equipo 2{medio1.sumergible ? ' (no aplica: equipo sumergible)' : ' (agua → equipo, m)'}
                  </label>
                  <input type="number" min="0" value={succion1} disabled={medio1.sumergible} onChange={(e) => setSuccion1(e.target.value)} />
                </>
              )}

              <h4>Conexión entre los dos equipos</h4>
              {esSerie ? (
                <>
                  <label>Manguera de enlace: diámetro</label>
                  <select value={tramoEnlace.diametroId} onChange={(e) => setTramoEnlace((t) => ({ ...t, diametroId: e.target.value }))}>
                    {diametrosDelEquipo0.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.nombre}
                      </option>
                    ))}
                  </select>
                  <label>Longitud de la manguera de enlace (m)</label>
                  <input
                    type="number"
                    min="0"
                    value={tramoEnlace.longitudM}
                    onChange={(e) => setTramoEnlace((t) => ({ ...t, longitudM: e.target.value }))}
                  />
                  <label>Desnivel entre los dos equipos (m, positivo si el equipo 2 está más alto)</label>
                  <input type="number" value={desnivelEnlace} onChange={(e) => setDesnivelEnlace(e.target.value)} />
                </>
              ) : (
                <>
                  <label>Conexión equipo 1 → colector: diámetro</label>
                  <select value={tramoConexion0.diametroId} onChange={(e) => setTramoConexion0((t) => ({ ...t, diametroId: e.target.value }))}>
                    {diametrosDelEquipo0.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.nombre}
                      </option>
                    ))}
                  </select>
                  <label>Longitud (m)</label>
                  <input
                    type="number"
                    min="0"
                    value={tramoConexion0.longitudM}
                    onChange={(e) => setTramoConexion0((t) => ({ ...t, longitudM: e.target.value }))}
                  />
                  <label>Conexión equipo 2 → colector: diámetro</label>
                  <select value={tramoConexion1.diametroId} onChange={(e) => setTramoConexion1((t) => ({ ...t, diametroId: e.target.value }))}>
                    {diametrosDelEquipo1.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.nombre}
                      </option>
                    ))}
                  </select>
                  <label>Longitud (m)</label>
                  <input
                    type="number"
                    min="0"
                    value={tramoConexion1.longitudM}
                    onChange={(e) => setTramoConexion1((t) => ({ ...t, longitudM: e.target.value }))}
                  />
                </>
              )}
            </>
          )}

          <label>Altura de impulsión {numEquipos === 2 ? `tras el ${esSerie ? 'conjunto' : 'colector'}` : '(bomba → tendido)'} (m)</label>
          <input type="number" min="0" value={alturaImpulsion} onChange={(e) => setAlturaImpulsion(e.target.value)} />

          <h4>2. Tendido de manguera {numSalidas > 1 ? '(tramo principal, hasta el repartidor)' : ''}</h4>
          <p className="calc-hint">
            Un tendido real casi nunca es de un solo diámetro: se ponen reducciones. Indique cuántos tramos de
            diámetro distinto tiene, y el diámetro/longitud de cada uno, en orden desde la bomba. Cada reducción
            entre tramos también se cuenta como una pequeña pérdida de carga adicional.
          </p>
          <label>Número de tramos de diámetro distinto</label>
          <select value={tramos.length} onChange={(e) => cambiarNumeroTramos(Number(e.target.value))}>
            {[1, 2, 3, 4].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>

          {tramos.map((tramo, i) => (
            <div key={i} className="calc-tramo">
              <strong>
                Tramo {i + 1}
                {i === 0 ? ' (desde la bomba)' : ''}
              </strong>
              <div className="calc-tramo-campos">
                <div>
                  <label>Diámetro</label>
                  <select value={tramo.diametroId} onChange={(e) => actualizarTramo(i, { diametroId: e.target.value })}>
                    {(i === 0 ? diametrosDelEquipo0 : diametrosManguera).map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.nombre}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label>Longitud (m)</label>
                  <input type="number" min="0" value={tramo.longitudM} onChange={(e) => actualizarTramo(i, { longitudM: e.target.value })} />
                </div>
              </div>
            </div>
          ))}

          <h4>3. Salidas al final del tendido</h4>
          <p className="calc-hint">
            Si en algún punto se pone una bifurcación o trifurcación (un repartidor con varias salidas, cada una
            con su propia manguera y, si se quiere, su propia lanza), indique cuántas salidas hay. El caudal se
            reparte entre ellas según la pérdida de carga propia de cada una: la que tenga menos pérdida se lleva
            más caudal.
          </p>
          <label>Número de salidas</label>
          <select value={numSalidas} onChange={(e) => cambiarNumeroSalidas(Number(e.target.value))}>
            <option value={1}>1 (sin bifurcar)</option>
            <option value={2}>2 (bifurcación)</option>
            <option value={3}>3 (trifurcación)</option>
          </select>

          {numSalidas === 1 ? (
            <>
              <label className="calc-checkbox">
                <input
                  type="checkbox"
                  checked={salidas[0].usarSideinfo}
                  onChange={(e) => actualizarSalida(0, { usarSideinfo: e.target.checked })}
                />
                Añadir lanza reguladora SIDEINFO al final del tendido
              </label>
              {salidas[0].usarSideinfo && (
                <>
                  <label>Boquilla (mm)</label>
                  <select value={salidas[0].boquillaMM} onChange={(e) => actualizarSalida(0, { boquillaMM: Number(e.target.value) })}>
                    {boquillasSideinfo.map((b) => (
                      <option key={b.mm} value={b.mm}>
                        {b.mm} mm (máx. {b.presionMaxBar} bar → {b.caudalMaxLMin} l/min, {b.alcanceMaxM} m)
                      </option>
                    ))}
                  </select>
                </>
              )}
            </>
          ) : (
            salidas.map((salida, i) => (
              <div key={i} className="calc-tramo">
                <strong>Salida {i + 1} (punta de lanza)</strong>
                <label>Número de tramos de esta salida</label>
                <select value={salida.tramos.length} onChange={(e) => cambiarNumeroTramosSalida(i, Number(e.target.value))}>
                  {[1, 2].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
                {salida.tramos.map((tramo, j) => (
                  <div key={j} className="calc-tramo-campos">
                    <div>
                      <label>Diámetro</label>
                      <select value={tramo.diametroId} onChange={(e) => actualizarTramoSalida(i, j, { diametroId: e.target.value })}>
                        {diametrosManguera.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.nombre}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label>Longitud (m)</label>
                      <input
                        type="number"
                        min="0"
                        value={tramo.longitudM}
                        onChange={(e) => actualizarTramoSalida(i, j, { longitudM: e.target.value })}
                      />
                    </div>
                  </div>
                ))}
                <label>Desnivel extra de esta salida (m, p. ej. si sube escaleras)</label>
                <input
                  type="number"
                  value={salida.desnivelExtra}
                  onChange={(e) => actualizarSalida(i, { desnivelExtra: e.target.value })}
                />
                <label className="calc-checkbox">
                  <input type="checkbox" checked={salida.usarSideinfo} onChange={(e) => actualizarSalida(i, { usarSideinfo: e.target.checked })} />
                  Lanza reguladora SIDEINFO en esta salida
                </label>
                {salida.usarSideinfo && (
                  <select value={salida.boquillaMM} onChange={(e) => actualizarSalida(i, { boquillaMM: Number(e.target.value) })}>
                    {boquillasSideinfo.map((b) => (
                      <option key={b.mm} value={b.mm}>
                        {b.mm} mm (máx. {b.presionMaxBar} bar → {b.caudalMaxLMin} l/min, {b.alcanceMaxM} m)
                      </option>
                    ))}
                  </select>
                )}
              </div>
            ))
          )}
          <p className="calc-hint">
            Caudal de boquilla calibrado con el punto real de la ficha SIDEINFO (caudal = k·√presión). El alcance
            a presiones distintas de la máxima se aproxima igual (alcance ≈ alcanceMáx·√(P/Pmáx)).
          </p>

          <label>Densidad relativa del fluido (agua = 1.0)</label>
          <input type="number" step="0.05" min="0.5" max="2" value={densidad} onChange={(e) => setDensidad(e.target.value)} />
        </div>

        <div className="calc-result">
          <h4>📊 Estimación técnica del punto de trabajo</h4>
          <p>
            <strong>Caudal total estimado:</strong> {caudalMostrado} l/min
          </p>
          <p>
            <strong>Altura geométrica:</strong> {desnivelPrincipalM.toFixed(1)} m
          </p>
          <p>
            <strong>Pérdida de carga en el tramo principal:</strong> {perdidaMostrada} m
          </p>
          <p>
            <strong>Altura manométrica total resultante:</strong> {alturaTotalMostrada} m
          </p>

          {numSalidas > 1 && !caudalInviable && (
            <div className="calc-limites">
              <strong>Reparto por salida:</strong>
              <ul>
                {resultado.ramas.map((r, i) => (
                  <li key={i}>
                    Salida {i + 1}: {r.caudalLMin} l/min
                    {salidasResueltas[i].boquilla
                      ? ` · boquilla ${salidasResueltas[i].boquilla.mm} mm → ${r.presionBoquillaBar} bar, alcance ${r.alcanceBoquillaM} m`
                      : ' (manguera abierta, sin lanza)'}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {numSalidas === 1 && salidas[0].usarSideinfo && !caudalInviable && (
            <p>
              <strong>Boquilla SIDEINFO {salidas[0].boquillaMM} mm:</strong> {resultado.ramas[0].presionBoquillaBar} bar · alcance
              estimado {resultado.ramas[0].alcanceBoquillaM} m
            </p>
          )}

          <p>
            <strong>Aplicación equipo 1:</strong> {medio0.uso}
          </p>
          {numEquipos === 2 && (
            <p>
              <strong>Aplicación equipo 2:</strong> {medio1.uso}
            </p>
          )}

          <div className="calc-limites">
            <strong>Límites {numEquipos === 2 ? 'del conjunto' : `de este ${datos0.circuito ? `circuito (${datos0.circuito.nombre})` : 'equipo'}`}:</strong>
            <ul>
              <li>
                Succión equipo 1: {medio0.sumergible ? 'no aplica (sumergible)' : `máx. ${medio0.succionMax ?? LIMITE_SUCCION_GENERAL_M} m`}
              </li>
              {esParalelo && (
                <li>
                  Succión equipo 2: {medio1.sumergible ? 'no aplica (sumergible)' : `máx. ${medio1.succionMax ?? LIMITE_SUCCION_GENERAL_M} m`}
                </li>
              )}
              <li>Altura estática máxima del conjunto: {Math.round(bomba.H0 * 10) / 10} m</li>
              <li>Caudal máximo del conjunto: {bomba.caudalMaximoLMin != null ? `${bomba.caudalMaximoLMin.toLocaleString('es-ES')} l/min` : 'sin dato oficial'}</li>
            </ul>
            {medio0.solidos?.apto && (
              <p className="calc-badge-solidos">🪣 Equipo 1 apto para lodos/sólidos{medio0.solidos.detalle ? `: ${medio0.solidos.detalle}` : ''}</p>
            )}
            {medio0.solidos && !medio0.solidos.apto && <p className="calc-badge-limpia">💧 Equipo 1: solo agua limpia</p>}
          </div>

          <hr />

          {succionInfo0.imposible && succionInfo0.excedida && (
            <p className="calc-danger">
              ⛔ Succión inviable (equipo 1): {succion0} m supera el límite del equipo seleccionado ({medio0.succionMax} m).
              Ninguna bomba puede aspirar por encima de ese límite, sea cual sea su potencia: acerque la bomba al agua o
              sumérjala.
            </p>
          )}
          {succionInfo0.imposible && !succionInfo0.excedida && succionInfo0.limiteGeneralExcedido && (
            <p className="calc-danger">
              ⛔ Succión inviable (equipo 1): {succion0} m supera el límite físico de ~{LIMITE_SUCCION_GENERAL_M} m (presión
              atmosférica). Ninguna bomba centrífuga puede aspirar por encima de esa altura.
            </p>
          )}
          {esParalelo && succionInfo1.imposible && succionInfo1.excedida && (
            <p className="calc-danger">
              ⛔ Succión inviable (equipo 2): {succion1} m supera el límite del equipo seleccionado ({medio1.succionMax} m).
            </p>
          )}
          {esParalelo && succionInfo1.imposible && !succionInfo1.excedida && succionInfo1.limiteGeneralExcedido && (
            <p className="calc-danger">
              ⛔ Succión inviable (equipo 2): {succion1} m supera el límite físico de ~{LIMITE_SUCCION_GENERAL_M} m.
            </p>
          )}
          {impulsionImposible && (
            <p className="calc-danger">
              ⛔ Impulsión inviable: la altura geométrica ({desnivelPrincipalM.toFixed(1)} m) ya supera la altura estática
              máxima del conjunto ({Math.round(bomba.H0 * 10) / 10} m), antes incluso de contar la pérdida en el tendido.
            </p>
          )}
          {sinCaudalPorPerdida && (
            <p className="calc-danger">
              ⛔ Sin caudal viable: la pérdida de carga en el tendido hace que la altura total supere la máxima disponible.
              Reduzca la longitud de manguera o use diámetros mayores.
            </p>
          )}
          {tramoPrincipalExcedido && (
            <p className="calc-warning">
              ⚠️ El caudal total estimado supera el recomendado para el tramo de {tramoPrincipalExcedido.nombre} (máx.{' '}
              {tramoPrincipalExcedido.caudalRecomendadoMax.toLocaleString('es-ES')} l/min).
            </p>
          )}
          {tramosSalidaExcedidos.map((x, i) => (
            <p key={i} className="calc-warning">
              ⚠️ Salida {x.salida}: el caudal estimado supera el recomendado para el tramo de {x.tramo.nombre} (máx.{' '}
              {x.tramo.caudalRecomendadoMax.toLocaleString('es-ES')} l/min).
            </p>
          ))}
          {boquillasFueraDeRango.map((x, i) => (
            <p key={i} className="calc-warning">
              ⚠️ Salida {x.salida}: la presión que necesita la boquilla ({x.presionBoquillaBar} bar) supera su máximo de ficha
              ({x.boquilla.presionMaxBar} bar); el alcance mostrado es poco fiable.
            </p>
          ))}
          {!caudalInviable && !tramoPrincipalExcedido && tramosSalidaExcedidos.length === 0 && boquillasFueraDeRango.length === 0 && (
            <p className="calc-ok">✅ Punto de trabajo dentro de los límites recomendados.</p>
          )}

          <p className="calc-note">
            <em>Nota de campo:</em> el caudal se estima ajustando la curva característica de cada bomba (H = H0 − k·Q²) a
            los puntos oficiales de su ficha. En serie, las presiones de ambos equipos se suman (menos la pérdida del
            tramo de enlace); en paralelo, cada equipo aporta su propio caudal al mismo punto de presión, con
            antirretorno (ninguno recibe caudal del otro). En una bifurcación, el caudal se reparte entre las salidas
            según su propia pérdida de carga. Evite trabajar en seco más de 3 minutos en bombas centrífugas
            convencionales.
          </p>
        </div>
      </div>
    </div>
  );
}
