import { useMemo, useState } from 'react';
import { boquillasSideinfo, catalogoMedios, diametrosManguera, LIMITE_SUCCION_GENERAL_M } from '../data/equipos';
import { estimarPuntoTrabajo } from '../utils/hidraulica';
import './CalculadoraHidraulica.css';

function diametrosDeEquipo(medio) {
  return (medio.diametrosDisponibles || diametrosManguera.map((d) => d.id)).map(
    (id) => diametrosManguera.find((d) => d.id === id)
  );
}

function tramoPorDefecto(diametroId, longitudM = 20) {
  return { diametroId, longitudM };
}

export default function CalculadoraHidraulica() {
  const [medioId, setMedioId] = useState(catalogoMedios[0].id);
  const [alturaSuccion, setAlturaSuccion] = useState(3);
  const [alturaImpulsion, setAlturaImpulsion] = useState(7);
  const [tramos, setTramos] = useState([tramoPorDefecto(catalogoMedios[0].diametrosDisponibles[0], 40)]);
  const [circuitoId, setCircuitoId] = useState(catalogoMedios[0].circuitos?.[0]?.id ?? null);
  const [densidad, setDensidad] = useState(1.0);
  const [usarSideinfo, setUsarSideinfo] = useState(false);
  const [boquillaMM, setBoquillaMM] = useState(boquillasSideinfo[2].mm);

  const medio = useMemo(() => catalogoMedios.find((m) => m.id === medioId), [medioId]);
  const diametrosDelEquipo = useMemo(() => diametrosDeEquipo(medio), [medio]);
  const circuito = useMemo(
    () => medio.circuitos?.find((c) => c.id === circuitoId) || medio.circuitos?.[0] || null,
    [medio, circuitoId]
  );
  const curvaActiva = circuito ? circuito.curva : medio.curva;
  const alturaMaximaM = circuito ? circuito.alturaMaximaM : medio.alturaMaximaM;
  const caudalMaximoLMin = circuito ? circuito.caudalMaximoLMin : medio.caudalMaximoLMin;

  // Al cambiar de equipo, se selecciona automáticamente el primer racor real
  // y el primer circuito de presión disponibles para ese equipo (no todos
  // los equipos tienen los mismos, ni todos tienen varios circuitos), y el
  // tendido se reinicia a un único tramo con ese racor.
  function cambiarMedio(nuevoMedioId) {
    setMedioId(nuevoMedioId);
    const nuevoMedio = catalogoMedios.find((m) => m.id === nuevoMedioId);
    setTramos([tramoPorDefecto(diametrosDeEquipo(nuevoMedio)[0].id, 40)]);
    setCircuitoId(nuevoMedio.circuitos?.[0]?.id ?? null);
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

  const tramosResueltos = useMemo(
    () =>
      tramos.map((t) => {
        const d = diametrosManguera.find((d) => d.id === t.diametroId) || diametrosManguera[0];
        return { diametroMM: Number(d.id), coeficiente: d.coeficiente, longitudM: Number(t.longitudM) || 0, nombre: d.nombre, caudalRecomendadoMax: d.caudalRecomendadoMax };
      }),
    [tramos]
  );

  const desnivelTotal = (Number(alturaSuccion) || 0) + (Number(alturaImpulsion) || 0);

  const boquilla = useMemo(
    () => (usarSideinfo ? boquillasSideinfo.find((b) => b.mm === boquillaMM) : undefined),
    [usarSideinfo, boquillaMM]
  );

  const resultado = useMemo(
    () =>
      estimarPuntoTrabajo({
        curva: curvaActiva,
        desnivelM: desnivelTotal,
        tramos: tramosResueltos,
        densidadRelativa: Number(densidad) || 1,
        alturaMaximaM,
        caudalMaximoLMin,
        boquilla,
      }),
    [curvaActiva, desnivelTotal, tramosResueltos, densidad, alturaMaximaM, caudalMaximoLMin, boquilla]
  );

  // La succión es un límite físico (presión atmosférica), no de potencia de la
  // bomba: por encima de ~8 m (o del límite propio del equipo si es menor)
  // ninguna bomba centrífuga puede aspirar agua, así que el caudal real es 0
  // aunque la curva matemática siga dando un valor. La impulsión no tiene este
  // límite: ahí solo manda la presión que dé la bomba.
  const limiteSuccionAplicable = medio.succionMax != null
    ? Math.min(medio.succionMax, LIMITE_SUCCION_GENERAL_M)
    : LIMITE_SUCCION_GENERAL_M;
  const succionImposible = !medio.sumergible && Number(alturaSuccion) > limiteSuccionAplicable;
  const succionExcedida = medio.succionMax != null && Number(alturaSuccion) > medio.succionMax;
  const limiteGeneralExcedido = !medio.sumergible && Number(alturaSuccion) > LIMITE_SUCCION_GENERAL_M;
  // La altura de impulsión (o el conjunto succión+impulsión) sí puede superar
  // la presión máxima que da la bomba: a diferencia de la succión, no es un
  // límite físico universal, sino el propio de cada equipo.
  const impulsionImposible = !succionImposible && alturaMaximaM != null && desnivelTotal >= alturaMaximaM;
  const sinCaudalPorPerdida = !succionImposible && !impulsionImposible && resultado.caudalLMin === 0;
  const caudalInviable = succionImposible || impulsionImposible || sinCaudalPorPerdida;
  const caudalMostrado = caudalInviable ? 0 : resultado.caudalLMin;
  const perdidaMostrada = succionImposible || impulsionImposible ? 0 : resultado.perdidaCargaM;
  const alturaTotalMostrada =
    succionImposible || impulsionImposible ? desnivelTotal : resultado.alturaManometricaTotal;
  const tramoExcedido = !caudalInviable
    ? tramosResueltos.find((t) => resultado.caudalLMin > t.caudalRecomendadoMax)
    : null;
  const boquillaFueraDeRango =
    !caudalInviable && boquilla && resultado.presionBoquillaBar > boquilla.presionMaxBar;

  return (
    <div>
      <h3>🧮 Calculadora de Rendimiento y Extracción</h3>
      <div className="calc-grid">
        <div className="calc-form">
          <label>Medio de extracción UME</label>
          <select value={medioId} onChange={(e) => cambiarMedio(e.target.value)}>
            {catalogoMedios.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nombre}
              </option>
            ))}
          </select>

          {medio.circuitos && (
            <>
              <label>Circuito / modo de presión</label>
              <select value={circuitoId} onChange={(e) => setCircuitoId(e.target.value)}>
                {medio.circuitos.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </select>
              <p className="calc-hint">
                Este equipo tiene dos cuerpos de bomba independientes y seleccionables en cabina:
                no se pueden combinar. Elija el circuito que va a usar realmente.
              </p>
            </>
          )}

          <p className="calc-hint">
            Rellene las dos si aplican: se suman. Si la bomba está sumergida en el agua, succión =
            0. Si está en superficie con manguera hacia el agua, impulsión será la altura desde la
            bomba hasta el punto de vertido.
          </p>

          <label>
            Altura de succión{medio.sumergible ? ' (no aplica: equipo sumergible)' : ' (agua → bomba, m)'}
          </label>
          <input
            type="number"
            min="0"
            value={alturaSuccion}
            disabled={medio.sumergible}
            onChange={(e) => setAlturaSuccion(e.target.value)}
          />

          <label>Altura de impulsión (bomba → punto de vertido, m)</label>
          <input
            type="number"
            min="0"
            value={alturaImpulsion}
            onChange={(e) => setAlturaImpulsion(e.target.value)}
          />

          <h4>Tendido de manguera</h4>
          <p className="calc-hint">
            Un tendido real casi nunca es de un solo diámetro: se ponen reducciones. Indique
            cuántos tramos de diámetro distinto tiene, y el diámetro/longitud de cada uno, en
            orden desde la bomba hasta la salida. Cada reducción entre tramos también se cuenta
            como una pequeña pérdida de carga adicional.
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
                  <select
                    value={tramo.diametroId}
                    onChange={(e) => actualizarTramo(i, { diametroId: e.target.value })}
                  >
                    {(i === 0 ? diametrosDelEquipo : diametrosManguera).map((d) => (
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
                    onChange={(e) => actualizarTramo(i, { longitudM: e.target.value })}
                  />
                </div>
              </div>
            </div>
          ))}

          <label className="calc-checkbox">
            <input type="checkbox" checked={usarSideinfo} onChange={(e) => setUsarSideinfo(e.target.checked)} />
            Añadir lanza reguladora SIDEINFO al final del tendido
          </label>
          {usarSideinfo && (
            <>
              <label>Boquilla (mm)</label>
              <select value={boquillaMM} onChange={(e) => setBoquillaMM(Number(e.target.value))}>
                {boquillasSideinfo.map((b) => (
                  <option key={b.mm} value={b.mm}>
                    {b.mm} mm (máx. {b.presionMaxBar} bar → {b.caudalMaxLMin} l/min, {b.alcanceMaxM} m)
                  </option>
                ))}
              </select>
              <p className="calc-hint">
                Caudal calibrado con el punto real de la ficha SIDEINFO para esta boquilla (caudal
                = k·√presión, con k ajustada a su dato de presión/caudal máximos). El alcance a
                presiones distintas de la máxima se aproxima igual (alcance ≈ alcanceMáx·√(P/Pmáx)):
                no hay curva punto a punto completa, solo el extremo de cada boquilla.
              </p>
            </>
          )}

          <label>Densidad relativa del fluido (agua = 1.0)</label>
          <input
            type="number"
            step="0.05"
            min="0.5"
            max="2"
            value={densidad}
            onChange={(e) => setDensidad(e.target.value)}
          />
        </div>

        <div className="calc-result">
          <h4>📊 Estimación técnica del punto de trabajo</h4>
          <p>
            <strong>Caudal real estimado:</strong> {caudalMostrado} l/min
          </p>
          <p>
            <strong>Altura geométrica (succión + impulsión):</strong> {desnivelTotal.toFixed(1)} m
          </p>
          <p>
            <strong>Pérdida de carga en el tendido:</strong> {perdidaMostrada} m
          </p>
          <p>
            <strong>Altura manométrica total resultante:</strong> {alturaTotalMostrada} m
          </p>
          {usarSideinfo && !caudalInviable && (
            <p>
              <strong>Boquilla SIDEINFO {boquillaMM} mm:</strong> {resultado.presionBoquillaBar} bar
              · alcance estimado {resultado.alcanceBoquillaM} m
            </p>
          )}
          <p>
            <strong>Aplicación principal del equipo:</strong> {medio.uso}
          </p>

          <div className="calc-limites">
            <strong>Límites de este {circuito ? `circuito (${circuito.nombre})` : 'equipo'}:</strong>
            <ul>
              <li>
                Succión máxima: {medio.sumergible ? 'no aplica (sumergible)' : `${medio.succionMax ?? LIMITE_SUCCION_GENERAL_M} m`}
              </li>
              <li>Altura de impulsión máxima: {alturaMaximaM != null ? `${alturaMaximaM} m` : 'sin dato oficial (estimada)'}</li>
              <li>Caudal máximo de ficha: {caudalMaximoLMin != null ? `${caudalMaximoLMin.toLocaleString('es-ES')} l/min` : 'sin dato oficial'}</li>
            </ul>
            {medio.solidos?.apto && (
              <p className="calc-badge-solidos">🪣 Apto para lodos/sólidos{medio.solidos.detalle ? `: ${medio.solidos.detalle}` : ''}</p>
            )}
            {medio.solidos && !medio.solidos.apto && (
              <p className="calc-badge-limpia">💧 Solo agua limpia (no diseñada para lodos o sólidos)</p>
            )}
          </div>

          <hr />

          {succionImposible && succionExcedida && (
            <p className="calc-danger">
              ⛔ Succión inviable: {alturaSuccion} m supera el límite del equipo seleccionado (
              {medio.succionMax} m). Ninguna bomba puede aspirar por encima de ese límite, sea cual
              sea su potencia: acerque la bomba al agua o sumérjala.
            </p>
          )}
          {succionImposible && !succionExcedida && limiteGeneralExcedido && (
            <p className="calc-danger">
              ⛔ Succión inviable: {alturaSuccion} m supera el límite físico de ~
              {LIMITE_SUCCION_GENERAL_M} m (presión atmosférica). Ninguna bomba centrífuga puede
              aspirar por encima de esa altura: acerque la bomba al agua o sumérjala.
            </p>
          )}
          {impulsionImposible && (
            <p className="calc-danger">
              ⛔ Impulsión inviable: la altura geométrica ({desnivelTotal.toFixed(1)} m) ya supera la
              altura máxima de este {circuito ? 'circuito' : 'equipo'} ({alturaMaximaM} m), antes
              incluso de contar la pérdida en el tendido. Acerque el punto de vertido o use otro
              equipo.
            </p>
          )}
          {sinCaudalPorPerdida && (
            <p className="calc-danger">
              ⛔ Sin caudal viable: la pérdida de carga en el tendido hace que la altura total
              supere la máxima de la bomba. Reduzca la longitud de manguera o use diámetros mayores.
            </p>
          )}
          {tramoExcedido && (
            <p className="calc-warning">
              ⚠️ El caudal estimado supera el recomendado para el tramo de {tramoExcedido.nombre}{' '}
              (máx. {tramoExcedido.caudalRecomendadoMax.toLocaleString('es-ES')} l/min). Valore un
              diámetro mayor en ese tramo.
            </p>
          )}
          {boquillaFueraDeRango && (
            <p className="calc-warning">
              ⚠️ La presión que necesita la boquilla ({resultado.presionBoquillaBar} bar) supera
              con creces su máximo de ficha ({boquilla.presionMaxBar} bar): el equipo elegido es
              demasiado potente para esta boquilla. El alcance mostrado es una extrapolación poco
              fiable; use una boquilla mayor o reduzca el caudal disponible.
            </p>
          )}
          {!caudalInviable && !tramoExcedido && !boquillaFueraDeRango && (
            <p className="calc-ok">✅ Punto de trabajo dentro de los límites recomendados.</p>
          )}

          <p className="calc-note">
            <em>Nota de campo:</em> el caudal se estima ajustando la curva característica de la
            bomba (H = H0 − k·Q²) a los puntos oficiales de la ficha técnica. La pérdida de carga
            en cada tramo usa la tabla real de pérdidas por diámetro (25/45/70 mm) extrapolada al
            resto de diámetros; la pérdida en cada reducción es una estimación (no hay dato oficial
            de racores de reducción en el manual). Evite trabajar en seco más de 3 minutos en
            bombas centrífugas convencionales.
          </p>
        </div>
      </div>
    </div>
  );
}
