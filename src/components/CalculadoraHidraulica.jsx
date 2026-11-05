import { useMemo, useState } from 'react';
import { boquillasSideinfo, catalogoMedios, diametrosManguera, LIMITE_SUCCION_GENERAL_M } from '../data/equipos';
import { construirBombaSimple, combinarBombasSerie, combinarBombasParalelo, resolverPuntoTrabajoArbol } from '../utils/hidraulica';
import './CalculadoraHidraulica.css';

// Diámetros reales que admite la salida de un equipo. Si para un diámetro
// de racor hay también variantes de marca/resistencia concretas (HR,
// BLINDEX, GOMDUR, GOMTEX...), se ofrecen igualmente aquí: el racor es el
// mismo tamaño, solo cambia la manguera que se le acople, así que no tiene
// sentido restringirlas a tramos posteriores - es justo en circuitos de
// alta presión (donde la manguera genérica puede quedarse corta de
// presión de trabajo) donde más falta hace poder elegirlas ya en el
// primer tramo.
function diametrosDeEquipo(medio) {
  const ids = medio.diametrosDisponibles || diametrosManguera.map((d) => d.id);
  const idsConVariantes = ids.flatMap((id) => {
    const variantes = diametrosManguera.filter((d) => d.id === id || d.id === `${id}hr` || d.id.startsWith(`${id}-`));
    return variantes.length ? variantes.map((v) => v.id) : [id];
  });
  return idsConVariantes.map((id) => diametrosManguera.find((d) => d.id === id));
}

function tramoPorDefecto(diametroId, longitudM = 20) {
  return { diametroId, longitudM };
}

function resolverTramo(t) {
  const d = diametrosManguera.find((x) => x.id === t.diametroId) || diametrosManguera[0];
  return { diametroMM: Number(d.id), coeficiente: d.coeficiente, longitudM: Number(t.longitudM) || 0 };
}

function resolverTramos(arr) {
  return arr.map(resolverTramo);
}

// --- Árbol de tendido (bifurcaciones en cualquier punto, no solo al final) ---
// Cada "nodo" es un tramo (1 o varias secciones de manguera de distinto
// diámetro) que termina en una punta de lanza (hoja) o que, en el punto
// exacto donde el usuario lo decida, se bifurca en 2-3 salidas, cada una
// otro nodo igual (así se puede anidar: una salida de una bifurcación
// puede volver a bifurcarse más adelante).
function crearNodoHoja(diametroId, longitudM = 20) {
  return {
    tramos: [tramoPorDefecto(diametroId, longitudM)],
    desnivelPropio: 0,
    bifurcacion: null, // null | { ramas: [nodo, nodo, ...] }
    usarSideinfo: false,
    boquillaMM: boquillasSideinfo[2].mm,
    cerrada: false, // salida de reserva (p. ej. para un foco secundario): no fluye ahora, no consume presión del sistema
  };
}

function actualizarTramoNodo(nodo, indice, cambios) {
  return { ...nodo, tramos: nodo.tramos.map((t, i) => (i === indice ? { ...t, ...cambios } : t)) };
}

function añadirTramoNodo(nodo) {
  const ultimo = nodo.tramos[nodo.tramos.length - 1];
  return { ...nodo, tramos: [...nodo.tramos, tramoPorDefecto(ultimo.diametroId, 20)] };
}

function quitarUltimoTramoNodo(nodo) {
  if (nodo.tramos.length <= 1) return nodo;
  return { ...nodo, tramos: nodo.tramos.slice(0, -1) };
}

function sumaLongitudHasta(tramos, indice) {
  return tramos.slice(0, indice + 1).reduce((s, t) => s + (Number(t.longitudM) || 0), 0);
}

// Bifurca el tendido a una distancia dada desde el inicio del tramo
// "indice" (puede ser antes de su final: así se puede poner la
// bifurcación a mitad de un tramo largo, p. ej. a los 50 m de uno de
// 100, sin tener que haberlo metido ya partido en dos). El propio tramo
// se recorta a esa distancia; lo que quedaba de él (el resto de su
// longitud), los tramos siguientes que ya hubiera, y la lanza que ya
// tuviera configurada este nodo, pasan a ser la primera rama (la
// continuación recta); se añaden n-1 ramas nuevas (vacías) para las
// salidas nuevas.
function bifurcarEnTramo(nodo, indice, n, distanciaM) {
  const tramo = nodo.tramos[indice];
  const longitudTotal = Number(tramo.longitudM) || 0;
  const distancia = Math.min(Math.max(Number(distanciaM) || 0, 0), longitudTotal);
  const remanente = longitudTotal - distancia;

  const tramosAntes = [...nodo.tramos.slice(0, indice), { ...tramo, longitudM: distancia }];
  const restoTramosOriginal = nodo.tramos.slice(indice + 1);
  const tramosDespues = remanente > 0 ? [{ diametroId: tramo.diametroId, longitudM: remanente }, ...restoTramosOriginal] : restoTramosOriginal;

  const huboAlgoDespues = tramosDespues.length > 0 || nodo.usarSideinfo || nodo.cerrada;
  const primeraRama = huboAlgoDespues
    ? { tramos: tramosDespues, desnivelPropio: 0, bifurcacion: null, usarSideinfo: nodo.usarSideinfo, boquillaMM: nodo.boquillaMM, cerrada: nodo.cerrada }
    : crearNodoHoja(tramo.diametroId, 20);
  const ramas = [primeraRama];
  while (ramas.length < n) ramas.push(crearNodoHoja(tramo.diametroId, 20));
  return { tramos: tramosAntes, desnivelPropio: nodo.desnivelPropio, bifurcacion: { ramas }, usarSideinfo: false, boquillaMM: boquillasSideinfo[2].mm, cerrada: false };
}

function quitarBifurcacion(nodo) {
  return { ...nodo, bifurcacion: null };
}

function actualizarRama(nodo, indice, nuevaRama) {
  return { ...nodo, bifurcacion: { ramas: nodo.bifurcacion.ramas.map((r, i) => (i === indice ? nuevaRama : r)) } };
}

// Convierte el nodo "de estado de la UI" al nodo que espera resolverPuntoTrabajoArbol.
function resolverNodo(nodo) {
  return {
    tramos: resolverTramos(nodo.tramos),
    desnivelPropioM: Number(nodo.desnivelPropio) || 0,
    bifurcacion: nodo.bifurcacion ? { ramas: nodo.bifurcacion.ramas.map(resolverNodo) } : null,
    boquilla: !nodo.bifurcacion && nodo.usarSideinfo ? boquillasSideinfo.find((b) => b.mm === nodo.boquillaMM) : undefined,
    cerrada: !nodo.bifurcacion && !!nodo.cerrada,
  };
}

// Recoge todas las hojas (puntas de lanza) del árbol, en el mismo orden en
// que las devuelve resolverPuntoTrabajoArbol (recorrido de las ramas en
// orden, en profundidad), junto con una etiqueta legible de su ruta.
function recolectarHojas(nodo, ruta = []) {
  if (!nodo.bifurcacion) return [{ nodo, etiqueta: ruta.length ? ruta.join(' → ') : 'Salida única' }];
  return nodo.bifurcacion.ramas.flatMap((r, i) => recolectarHojas(r, [...ruta, `Salida ${i + 1}`]));
}

// Recorre el árbol acumulando, para cada nodo (no solo las hojas), el
// caudal que lo atraviesa (suma de sus hojas descendientes) y comprueba si
// supera el recomendado para alguno de sus propios tramos.
function recolectarAvisosTramos(nodo, caudalesHoja, cursor, avisos) {
  let caudalNodo;
  if (!nodo.bifurcacion) {
    caudalNodo = caudalesHoja[cursor.i];
    cursor.i++;
  } else {
    caudalNodo = nodo.bifurcacion.ramas.reduce((s, r) => s + recolectarAvisosTramos(r, caudalesHoja, cursor, avisos), 0);
  }
  nodo.tramos.forEach((t) => {
    const d = diametrosManguera.find((x) => x.id === t.diametroId);
    if (d && caudalNodo > d.caudalRecomendadoMax) avisos.push({ nombre: d.nombre, caudalRecomendadoMax: d.caudalRecomendadoMax });
  });
  return caudalNodo;
}

// Recoge, en un Set, los id de todos los diámetros de manguera usados en
// cualquier punto del árbol (para el aviso de presión máxima: la presión
// total del sistema es la misma para cualquier tramo que esté pegado a la
// bomba, así que se comprueba contra todos los diámetros presentes, no
// solo los de las hojas).
function recolectarDiametrosUsados(nodo, set) {
  nodo.tramos.forEach((t) => set.add(t.diametroId));
  if (nodo.bifurcacion) nodo.bifurcacion.ramas.forEach((r) => recolectarDiametrosUsados(r, set));
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

// Editor recursivo de un nodo del árbol de tendido. Los tramos se añaden
// uno a uno (pueden ser del mismo diámetro que el anterior, p. ej. varias
// mangueras seguidas resumidas en uno solo más largo, o de uno distinto,
// p. ej. una reducción): justo después de CADA tramo se puede decidir si
// el tendido sigue, termina ahí (lanza o salida abierta), o se bifurca o
// trifurca - y a qué distancia exacta dentro de ese tramo, aunque sea a
// mitad de uno largo (p. ej. a los 50 m de un tramo de 100): no hace
// falta meterlo ya partido en dos, la app lo recorta sola.
function EditorNodo({ nodo, onChange, diametrosPrimerTramo, titulo }) {
  const [pendiente, setPendiente] = useState(null); // { indice, n, distancia } | null

  function elegirDespuesDeTramo(indice, valor, longitudTramo) {
    if (valor === 'seguir') {
      setPendiente(null);
      return;
    }
    const n = valor === 'bifurca3' ? 3 : 2;
    setPendiente({ indice, n, distancia: longitudTramo });
  }

  function confirmarBifurcacion() {
    if (!pendiente) return;
    onChange(bifurcarEnTramo(nodo, pendiente.indice, pendiente.n, pendiente.distancia));
    setPendiente(null);
  }

  return (
    <div className="calc-tramo calc-nodo">
      <strong>{titulo}</strong>
      <p className="calc-hint">
        Añada los tramos de este tendido en orden, del mismo diámetro que el anterior o de uno distinto
        (p. ej. una reducción). Justo después de cualquiera de ellos puede decidir si se bifurca o trifurca, y
        a qué distancia exacta: por ejemplo, para bifurcar a los 50 m de un tramo de 100 m, no hace falta
        meterlo ya partido en dos tramos de 50 - indique 100 m y, al elegir que se bifurca, escriba 50 como
        distancia.
      </p>

      {nodo.tramos.map((tramo, i) => (
        <div key={i} className="calc-nodo-tramo">
          <div className="calc-tramo-campos">
            <div>
              <label>Diámetro {i === 0 ? '' : `(tramo ${i + 1})`}</label>
              <select value={tramo.diametroId} onChange={(e) => onChange(actualizarTramoNodo(nodo, i, { diametroId: e.target.value }))}>
                {(i === 0 ? diametrosPrimerTramo : diametrosManguera).map((d) => (
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
                onChange={(e) => onChange(actualizarTramoNodo(nodo, i, { longitudM: e.target.value }))}
              />
            </div>
          </div>
          {!nodo.bifurcacion && (
            <>
              <label>¿Qué hay después de este tramo (a los {sumaLongitudHasta(nodo.tramos, i)} m desde la bomba)?</label>
              <select
                value={pendiente?.indice === i ? (pendiente.n === 3 ? 'bifurca3' : 'bifurca2') : 'seguir'}
                onChange={(e) => elegirDespuesDeTramo(i, e.target.value, tramo.longitudM)}
              >
                <option value="seguir">{i === nodo.tramos.length - 1 ? 'Fin (lanza o salida abierta)' : 'Nada, sigue con el siguiente tramo'}</option>
                <option value="bifurca2">Se bifurca en 2 salidas</option>
                <option value="bifurca3">Se bifurca en 3 salidas</option>
              </select>
              {pendiente?.indice === i && (
                <div className="calc-bifurcacion-pendiente">
                  <label>¿A qué distancia del inicio de este tramo (de {tramo.longitudM} m en total)?</label>
                  <input
                    type="number"
                    min="0"
                    max={tramo.longitudM}
                    value={pendiente.distancia}
                    onChange={(e) => setPendiente({ ...pendiente, distancia: e.target.value })}
                  />
                  <div className="calc-tramo-acciones">
                    <button type="button" onClick={confirmarBifurcacion}>
                      ✓ Confirmar bifurcación aquí
                    </button>
                    <button type="button" onClick={() => setPendiente(null)}>
                      ✕ Cancelar
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      ))}

      {!nodo.bifurcacion && (
        <div className="calc-tramo-acciones">
          <button type="button" onClick={() => onChange(añadirTramoNodo(nodo))}>
            + Añadir otro tramo
          </button>
          {nodo.tramos.length > 1 && (
            <button type="button" onClick={() => onChange(quitarUltimoTramoNodo(nodo))}>
              ✕ Quitar el último tramo
            </button>
          )}
        </div>
      )}

      <label>Desnivel propio de este tendido (m, p. ej. si sube escaleras)</label>
      <input type="number" value={nodo.desnivelPropio} onChange={(e) => onChange({ ...nodo, desnivelPropio: e.target.value })} />

      {!nodo.bifurcacion && (
        <>
          <label>¿Qué hay en la punta de esta salida?</label>
          <select
            value={nodo.cerrada ? 'cerrada' : nodo.usarSideinfo ? 'sideinfo' : 'abierta'}
            onChange={(e) => {
              const v = e.target.value;
              onChange({ ...nodo, cerrada: v === 'cerrada', usarSideinfo: v === 'sideinfo' });
            }}
          >
            <option value="abierta">Manguera / lanza abierta (sin regular presión)</option>
            <option value="sideinfo">Lanza reguladora SIDEINFO</option>
            <option value="cerrada">Cerrada (de reserva, p. ej. para un foco secundario)</option>
          </select>
          {nodo.cerrada && (
            <p className="calc-hint">
              Esta salida se trata como si su llave estuviera cerrada: no fluye agua por ella ahora, y todo el
              caudal disponible lo reparten las demás salidas abiertas.
            </p>
          )}
          {!nodo.cerrada && nodo.usarSideinfo && (
            <select value={nodo.boquillaMM} onChange={(e) => onChange({ ...nodo, boquillaMM: Number(e.target.value) })}>
              {boquillasSideinfo.map((b) => (
                <option key={b.mm} value={b.mm}>
                  {b.mm} mm (máx. {b.presionMaxBar} bar → {b.caudalMaxLMin} l/min, {b.alcanceMaxM} m)
                </option>
              ))}
            </select>
          )}
        </>
      )}

      {nodo.bifurcacion && (
        <>
          <div className="calc-tramo-acciones">
            <button type="button" onClick={() => onChange(quitarBifurcacion(nodo))}>
              ✕ Quitar esta bifurcación (se pierde lo configurado en sus salidas)
            </button>
          </div>
          <div className="calc-ramas">
            {nodo.bifurcacion.ramas.map((rama, i) => (
              <EditorNodo
                key={i}
                nodo={rama}
                onChange={(nuevaRama) => onChange(actualizarRama(nodo, i, nuevaRama))}
                diametrosPrimerTramo={diametrosManguera}
                titulo={`↳ Salida ${i + 1} de esta bifurcación`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
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
  // Con un solo equipo (no sumergible), se elige si lo que se va a medir es
  // la succión (achique: el equipo saca agua de un punto bajo, p. ej. un
  // sótano inundado) o la impulsión (incendio: el equipo empuja agua por un
  // tendido largo, aspirando de una fuente a su mismo nivel o casi). Solo se
  // usa el campo del modo elegido; el otro queda a 0 para no sumarlo dos
  // veces. Con 2 equipos, o si el equipo 1 es sumergible, no hace falta
  // elegir: se muestran los campos que correspondan sin este selector.
  const [modoAltura0, setModoAltura0] = useState('succion'); // 'succion' | 'impulsion'

  const [tramoEnlace, setTramoEnlace] = useState(tramoPorDefecto('45', 10)); // serie: manguera de enlace entre ambos equipos
  const [desnivelEnlace, setDesnivelEnlace] = useState(0);

  const [tramoConexion0, setTramoConexion0] = useState(tramoPorDefecto('45', 5)); // paralelo: conexión de cada equipo al colector
  const [tramoConexion1, setTramoConexion1] = useState(tramoPorDefecto('45', 5));

  // --- Tendido (árbol de bifurcaciones) ---
  // Empieza a 0 porque el modo por defecto del equipo 1 es succión (ver
  // modoAltura0): si empezara con un valor de ejemplo, ese valor se
  // sumaría al cálculo aunque su campo esté oculto por el modo elegido.
  const [alturaImpulsion, setAlturaImpulsion] = useState(0);
  const [nodoRaiz, setNodoRaiz] = useState(crearNodoHoja(catalogoMedios[0].diametrosDisponibles[0], 40));

  const [densidad, setDensidad] = useState(1.0);

  const medio0 = useMemo(() => catalogoMedios.find((m) => m.id === medioId0), [medioId0]);
  const medio1 = useMemo(() => catalogoMedios.find((m) => m.id === medioId1), [medioId1]);
  const datos0 = useMemo(() => datosEquipo(medio0, circuitoId0), [medio0, circuitoId0]);
  const datos1 = useMemo(() => datosEquipo(medio1, circuitoId1), [medio1, circuitoId1]);
  const diametrosDelEquipo0 = useMemo(() => diametrosDeEquipo(medio0), [medio0]);
  const diametrosDelEquipo1 = useMemo(() => diametrosDeEquipo(medio1), [medio1]);

  const esParalelo = numEquipos === 2 && modoConexion === 'paralelo';
  const esSerie = numEquipos === 2 && modoConexion === 'serie';

  // Al cambiar el equipo 1, se reinicia el tendido con su primer racor
  // real y su primer circuito disponible (igual que antes).
  function cambiarMedio0(nuevoMedioId) {
    setMedioId0(nuevoMedioId);
    const nuevoMedio = catalogoMedios.find((m) => m.id === nuevoMedioId);
    setNodoRaiz(crearNodoHoja(diametrosDeEquipo(nuevoMedio)[0].id, 40));
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

  function cambiarModoAltura0(modo) {
    setModoAltura0(modo);
    if (modo === 'succion') setAlturaImpulsion(0);
    else setSuccion0(0);
  }

  const tramoEnlaceResuelto = useMemo(() => resolverTramo(tramoEnlace), [tramoEnlace]);
  const tramoConexion0Resuelto = useMemo(() => resolverTramo(tramoConexion0), [tramoConexion0]);
  const tramoConexion1Resuelto = useMemo(() => resolverTramo(tramoConexion1), [tramoConexion1]);
  const nodoRaizResuelto = useMemo(() => resolverNodo(nodoRaiz), [nodoRaiz]);

  // La succión del equipo 1 (y, en paralelo, también la del equipo 2) se
  // suma a la altura geométrica como siempre, salvo en paralelo: ahí cada
  // succión ya se tiene en cuenta dentro de la combinación de bombas (cada
  // una aspira de su propia fuente antes de llegar al colector común), así
  // que no se vuelve a sumar aquí para no contarla dos veces.
  const desnivelPrincipalM = esParalelo
    ? Number(alturaImpulsion) || 0
    : (medio0.sumergible ? 0 : Number(succion0) || 0) + (Number(alturaImpulsion) || 0);

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

  const resultado = useMemo(
    () =>
      resolverPuntoTrabajoArbol({
        bomba,
        desnivelPrincipalM,
        nodoRaiz: nodoRaizResuelto,
        densidadRelativa: Number(densidad) || 1,
      }),
    [bomba, desnivelPrincipalM, nodoRaizResuelto, densidad]
  );

  const hojasUI = useMemo(() => recolectarHojas(nodoRaiz), [nodoRaiz]);
  const hayBifurcacion = !!nodoRaiz.bifurcacion;

  // --- Viabilidad física ---
  const succionInfo0 = useMemo(() => succionInfo(medio0, succion0), [medio0, succion0]);
  const succionInfo1 = useMemo(() => succionInfo(medio1, succion1), [medio1, succion1]);
  const succionProblema = succionInfo0.imposible || (esParalelo && succionInfo1.imposible);
  const impulsionImposible = !succionProblema && desnivelPrincipalM >= bomba.H0;
  const sinCaudalPorPerdida = !succionProblema && !impulsionImposible && resultado.caudalTotalLMin === 0;
  const caudalInviable = succionProblema || impulsionImposible || sinCaudalPorPerdida;

  const caudalMostrado = caudalInviable ? 0 : resultado.caudalTotalLMin;
  const perdidaMostrada = succionProblema || impulsionImposible ? 0 : resultado.perdidaCargaTotalM;
  const alturaTotalMostrada = succionProblema || impulsionImposible ? desnivelPrincipalM : resultado.alturaManometricaTotal;

  const avisosTramos = useMemo(() => {
    if (caudalInviable) return [];
    const avisos = [];
    recolectarAvisosTramos(nodoRaiz, resultado.hojas.map((h) => h.caudalLMin), { i: 0 }, avisos);
    return avisos;
  }, [caudalInviable, nodoRaiz, resultado]);

  const boquillasFueraDeRango = useMemo(() => {
    if (caudalInviable) return [];
    return resultado.hojas
      .map((h, i) => {
        const nodoHoja = hojasUI[i]?.nodo;
        const b = nodoHoja?.usarSideinfo ? boquillasSideinfo.find((x) => x.mm === nodoHoja.boquillaMM) : null;
        return b && h.presionBoquillaBar > b.presionMaxBar ? { etiqueta: hojasUI[i].etiqueta, boquilla: b, presionBoquillaBar: h.presionBoquillaBar } : null;
      })
      .filter(Boolean);
  }, [caudalInviable, resultado, hojasUI]);

  // Presión máxima que aguanta la propia manguera (no la bomba): la presión
  // del sistema es más alta cuanto más cerca de la bomba, así que se
  // compara la presión total (la máxima posible en cualquier punto) contra
  // el límite de CADA diámetro usado en el tendido, estén donde estén. Es
  // un aviso conservador: un tramo muy alejado de la bomba, tras perder
  // mucha presión por el camino, podría no llegar realmente a ese nivel.
  const presionTotalBar = !caudalInviable ? resultado.alturaManometricaTotal / 10.2 : 0;
  const avisosPresionManguera = useMemo(() => {
    if (caudalInviable) return [];
    const idsUsados = new Set();
    recolectarDiametrosUsados(nodoRaiz, idsUsados);
    const avisos = [];
    idsUsados.forEach((id) => {
      const d = diametrosManguera.find((x) => x.id === id);
      if (d && d.presionTrabajoBar != null && presionTotalBar > d.presionTrabajoBar) {
        avisos.push({
          nombre: d.nombre,
          presionTrabajoBar: d.presionTrabajoBar,
          presionRoturaBar: d.presionRoturaBar,
          superaRotura: d.presionRoturaBar != null && presionTotalBar > d.presionRoturaBar,
        });
      }
    });
    return avisos;
  }, [caudalInviable, nodoRaiz, presionTotalBar]);

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

          {numEquipos === 1 && !medio0.sumergible ? (
            <>
              <label>¿Qué va a medir: succión o impulsión?</label>
              <select value={modoAltura0} onChange={(e) => cambiarModoAltura0(e.target.value)}>
                <option value="succion">Succión (achique: saca agua de un punto bajo, p. ej. un sótano inundado)</option>
                <option value="impulsion">Impulsión (incendio: empuja agua por un tendido largo)</option>
              </select>
              {modoAltura0 === 'succion' ? (
                <>
                  <label>Altura de succión (agua → equipo, m)</label>
                  <input type="number" min="0" value={succion0} onChange={(e) => setSuccion0(e.target.value)} />
                </>
              ) : (
                <>
                  <label>Altura de impulsión (equipo → tendido, m)</label>
                  <input type="number" min="0" value={alturaImpulsion} onChange={(e) => setAlturaImpulsion(e.target.value)} />
                </>
              )}
              <p className="calc-hint">
                Succión e impulsión se suman en el cálculo final: si en su caso aplican las dos a la vez (p. ej.
                el equipo está unos metros por debajo del agua y además empuja varios metros más arriba),
                escriba la suma de ambas en el campo del modo elegido.
              </p>
            </>
          ) : (
            <>
              <label>
                Altura de succión del equipo 1{medio0.sumergible ? ' (no aplica: equipo sumergible)' : ' (agua → equipo, m)'}
              </label>
              <input type="number" min="0" value={succion0} disabled={medio0.sumergible} onChange={(e) => setSuccion0(e.target.value)} />
            </>
          )}

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

          {!(numEquipos === 1 && !medio0.sumergible) && (
            <>
              <label>Altura de impulsión {numEquipos === 2 ? `tras el ${esSerie ? 'conjunto' : 'colector'}` : '(bomba → tendido)'} (m)</label>
              <input type="number" min="0" value={alturaImpulsion} onChange={(e) => setAlturaImpulsion(e.target.value)} />
            </>
          )}

          <h4>2. Tendido de manguera</h4>
          <p className="calc-hint">
            Indique el tendido desde la bomba. En cualquier punto puede decidir que se bifurca o trifurca (un
            repartidor con varias salidas, cada una con su propia manguera y, si se quiere, su propia lanza); y
            cada una de esas salidas puede, a su vez, volver a bifurcarse más adelante. El caudal se reparte en
            cada bifurcación según la pérdida de carga propia de cada salida: la que tenga menos pérdida se
            lleva más caudal.
          </p>
          <EditorNodo nodo={nodoRaiz} onChange={setNodoRaiz} diametrosPrimerTramo={diametrosDelEquipo0} titulo="Tendido principal (desde la bomba)" />

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
            <strong>Pérdida de carga en el tendido:</strong> {perdidaMostrada} m
          </p>
          <p>
            <strong>Altura manométrica total resultante:</strong> {alturaTotalMostrada} m
          </p>

          {hayBifurcacion && !caudalInviable && (
            <div className="calc-limites">
              <strong>Reparto por salida:</strong>
              <ul>
                {resultado.hojas.map((h, i) => (
                  <li key={i}>
                    {hojasUI[i].etiqueta}: {h.caudalLMin} l/min
                    {hojasUI[i].nodo.cerrada
                      ? ` (cerrada, de reserva) · presión en la salida: ${h.presionEnRepartoBar} bar`
                      : hojasUI[i].nodo.usarSideinfo
                      ? ` · boquilla ${hojasUI[i].nodo.boquillaMM} mm → ${h.presionBoquillaBar} bar, alcance ${h.alcanceBoquillaM} m`
                      : ` (lanza/manguera abierta) · presión disponible en el repartidor antes de esta manguera: ${h.presionEnRepartoBar} bar`}
                  </li>
                ))}
              </ul>
              <p className="calc-hint">
                La "presión disponible" de una salida abierta es la que hay justo antes de su propia manguera
                (en la bifurcación): con la punta abierta y el caudal fluyendo libremente, un manómetro puesto
                ahí mismo marcaría 0, porque toda esa presión se consume en la propia manguera hasta la punta.
                Sirve para saber si, por ejemplo, cabría poner ahí una lanza/boquilla sin quedarse corto.
              </p>
            </div>
          )}
          {!hayBifurcacion && !nodoRaiz.cerrada && nodoRaiz.usarSideinfo && !caudalInviable && (
            <p>
              <strong>Boquilla SIDEINFO {nodoRaiz.boquillaMM} mm:</strong> {resultado.hojas[0].presionBoquillaBar} bar · alcance
              estimado {resultado.hojas[0].alcanceBoquillaM} m
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
          {avisosTramos.map((a, i) => (
            <p key={i} className="calc-warning">
              ⚠️ El caudal que pasa por un tramo de {a.nombre} supera el recomendado (máx. {a.caudalRecomendadoMax.toLocaleString('es-ES')}{' '}
              l/min).
            </p>
          ))}
          {boquillasFueraDeRango.map((x, i) => (
            <p key={i} className="calc-warning">
              ⚠️ {x.etiqueta}: la presión que necesita la boquilla ({x.presionBoquillaBar} bar) supera su máximo de ficha (
              {x.boquilla.presionMaxBar} bar); el alcance mostrado es poco fiable.
            </p>
          ))}
          {avisosPresionManguera.map((a, i) =>
            a.superaRotura ? (
              <p key={i} className="calc-danger">
                ⛔ PELIGRO: la presión total del sistema ({presionTotalBar.toFixed(1)} bar) supera la de ROTURA de la manguera de{' '}
                {a.nombre} (~{a.presionRoturaBar} bar). Riesgo de reventón si ese tramo está cerca de la bomba: use una manguera de
                mayor resistencia (HR) o reduzca la presión de la bomba en ese tendido.
              </p>
            ) : (
              <p key={i} className="calc-warning">
                ⚠️ La manguera de {a.nombre} está pensada para hasta {a.presionTrabajoBar} bar de trabajo, y la presión total del
                sistema ({presionTotalBar.toFixed(1)} bar) la supera. Es un aviso conservador (compara con la presión máxima en la
                bomba): solo hay riesgo real si ese tramo concreto está cerca de ella, antes de perder presión por el camino.
              </p>
            )
          )}
          {!caudalInviable && avisosTramos.length === 0 && boquillasFueraDeRango.length === 0 && avisosPresionManguera.length === 0 && (
            <p className="calc-ok">✅ Punto de trabajo dentro de los límites recomendados.</p>
          )}

          <p className="calc-note">
            <em>Nota de campo:</em> el caudal se estima ajustando la curva característica de cada bomba (H = H0 − k·Q²) a
            los puntos oficiales de su ficha. En serie, las presiones de ambos equipos se suman (menos la pérdida del
            tramo de enlace); en paralelo, cada equipo aporta su propio caudal al mismo punto de presión, con
            antirretorno (ninguno recibe caudal del otro). En cada bifurcación, el caudal se reparte entre las salidas
            según su propia pérdida de carga. Evite trabajar en seco más de 3 minutos en bombas centrífugas
            convencionales.
          </p>
        </div>
      </div>
    </div>
  );
}
