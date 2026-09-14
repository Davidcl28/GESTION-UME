import { useMemo, useState } from 'react';
import { catalogoMedios, diametrosManguera, LIMITE_SUCCION_GENERAL_M } from '../data/equipos';
import { estimarPuntoTrabajo } from '../utils/hidraulica';
import './CalculadoraHidraulica.css';

export default function CalculadoraHidraulica() {
  const [medioId, setMedioId] = useState(catalogoMedios[0].id);
  const [alturaSuccion, setAlturaSuccion] = useState(3);
  const [alturaImpulsion, setAlturaImpulsion] = useState(7);
  const [longitudManguera, setLongitudManguera] = useState(40);
  const [diametroId, setDiametroId] = useState('70');
  const [densidad, setDensidad] = useState(1.0);

  const medio = useMemo(() => catalogoMedios.find((m) => m.id === medioId), [medioId]);
  const diametro = useMemo(() => diametrosManguera.find((d) => d.id === diametroId), [diametroId]);

  const desnivelTotal = (Number(alturaSuccion) || 0) + (Number(alturaImpulsion) || 0);

  const resultado = useMemo(
    () =>
      estimarPuntoTrabajo({
        curva: medio.curva,
        desnivelM: desnivelTotal,
        longitudManguera: Number(longitudManguera) || 0,
        coeficienteManguera: diametro.coeficiente,
        densidadRelativa: Number(densidad) || 1,
      }),
    [medio, desnivelTotal, longitudManguera, diametro, densidad]
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
  const caudalMostrado = succionImposible ? 0 : resultado.caudalLMin;
  const perdidaMostrada = succionImposible ? 0 : resultado.perdidaCargaM;
  const alturaTotalMostrada = succionImposible ? desnivelTotal : resultado.alturaManometricaTotal;
  const caudalExcedeManguera = !succionImposible && resultado.caudalLMin > diametro.caudalRecomendadoMax;

  return (
    <div>
      <h3>🧮 Calculadora de Rendimiento y Extracción</h3>
      <div className="calc-grid">
        <div className="calc-form">
          <label>Medio de extracción UME</label>
          <select value={medioId} onChange={(e) => setMedioId(e.target.value)}>
            {catalogoMedios.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nombre}
              </option>
            ))}
          </select>

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

          <label>Distancia de mangueraje de impulsión (bomba → salida, m)</label>
          <input
            type="number"
            min="0"
            value={longitudManguera}
            onChange={(e) => setLongitudManguera(e.target.value)}
          />

          <label>Diámetro de manguera / racor</label>
          <select value={diametroId} onChange={(e) => setDiametroId(e.target.value)}>
            {diametrosManguera.map((d) => (
              <option key={d.id} value={d.id}>
                {d.nombre}
              </option>
            ))}
          </select>

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
            <strong>Pérdida de carga en manguera:</strong> {perdidaMostrada} m
          </p>
          <p>
            <strong>Altura manométrica total resultante:</strong> {alturaTotalMostrada} m
          </p>
          <p>
            <strong>Aplicación principal del equipo:</strong> {medio.uso}
          </p>

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
          {caudalExcedeManguera && (
            <p className="calc-warning">
              ⚠️ El caudal estimado supera el recomendado para manguera de {diametro.nombre} (máx.{' '}
              {diametro.caudalRecomendadoMax} l/min). Valorar diámetro mayor o mangueraje en paralelo.
            </p>
          )}
          {!succionImposible && !caudalExcedeManguera && (
            <p className="calc-ok">✅ Punto de trabajo dentro de los límites recomendados.</p>
          )}

          <p className="calc-note">
            <em>Nota de campo:</em> el caudal se estima ajustando la curva característica de la
            bomba (H = H0 − k·Q²) a los puntos oficiales de la ficha técnica, por lo que baja de
            forma continua con la altura en todo el rango, no solo entre los puntos conocidos.
            Evite trabajar en seco más de 3 minutos en bombas centrífugas convencionales. Calibre
            los coeficientes de pérdida de manguera con datos reales cuando estén disponibles.
          </p>
        </div>
      </div>
    </div>
  );
}
