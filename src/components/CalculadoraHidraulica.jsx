import { useMemo, useState } from 'react';
import { catalogoMedios, diametrosManguera, LIMITE_SUCCION_GENERAL_M } from '../data/equipos';
import { estimarPuntoTrabajo } from '../utils/hidraulica';
import './CalculadoraHidraulica.css';

export default function CalculadoraHidraulica() {
  const [medioId, setMedioId] = useState(catalogoMedios[0].id);
  const [desnivel, setDesnivel] = useState(10);
  const [longitudManguera, setLongitudManguera] = useState(40);
  const [diametroId, setDiametroId] = useState('70');
  const [densidad, setDensidad] = useState(1.0);
  const [alturaSuccion, setAlturaSuccion] = useState(5);

  const medio = useMemo(() => catalogoMedios.find((m) => m.id === medioId), [medioId]);
  const diametro = useMemo(() => diametrosManguera.find((d) => d.id === diametroId), [diametroId]);

  const resultado = useMemo(
    () =>
      estimarPuntoTrabajo({
        curva: medio.curva,
        desnivelM: Number(desnivel) || 0,
        longitudManguera: Number(longitudManguera) || 0,
        coeficienteManguera: diametro.coeficiente,
        densidadRelativa: Number(densidad) || 1,
      }),
    [medio, desnivel, longitudManguera, diametro, densidad]
  );

  const succionExcedida = medio.succionMax != null && Number(alturaSuccion) > medio.succionMax;
  const limiteGeneralExcedido = Number(alturaSuccion) > LIMITE_SUCCION_GENERAL_M;
  const caudalExcedeManguera = resultado.caudalLMin > diametro.caudalRecomendadoMax;

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

          <label>Desnivel / altura manométrica geométrica (m)</label>
          <input type="number" min="0" value={desnivel} onChange={(e) => setDesnivel(e.target.value)} />

          <label>Distancia de mangueraje (m)</label>
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

          <label>Altura de succión prevista (m)</label>
          <input
            type="number"
            min="0"
            value={alturaSuccion}
            onChange={(e) => setAlturaSuccion(e.target.value)}
          />
        </div>

        <div className="calc-result">
          <h4>📊 Estimación técnica del punto de trabajo</h4>
          <p>
            <strong>Caudal real estimado:</strong> {resultado.caudalLMin} l/min
          </p>
          <p>
            <strong>Pérdida de carga en manguera:</strong> {resultado.perdidaCargaM} m
          </p>
          <p>
            <strong>Altura manométrica total resultante:</strong> {resultado.alturaManometricaTotal} m
          </p>
          <p>
            <strong>Aplicación principal del equipo:</strong> {medio.uso}
          </p>

          <hr />

          {succionExcedida && (
            <p className="calc-warning">
              ⚠️ La altura de succión prevista ({alturaSuccion} m) supera el límite del equipo
              seleccionado ({medio.succionMax} m).
            </p>
          )}
          {!succionExcedida && limiteGeneralExcedido && (
            <p className="calc-warning">
              ⚠️ La altura de succión prevista ({alturaSuccion} m) supera el límite general de{' '}
              {LIMITE_SUCCION_GENERAL_M} m.
            </p>
          )}
          {caudalExcedeManguera && (
            <p className="calc-warning">
              ⚠️ El caudal estimado supera el recomendado para manguera de {diametro.nombre} (máx.{' '}
              {diametro.caudalRecomendadoMax} l/min). Valorar diámetro mayor o mangueraje en paralelo.
            </p>
          )}
          {!succionExcedida && !limiteGeneralExcedido && !caudalExcedeManguera && (
            <p className="calc-ok">✅ Punto de trabajo dentro de los límites recomendados.</p>
          )}

          <p className="calc-note">
            <em>Nota de campo:</em> estimación basada en curvas aproximadas del manual e
            interpolación lineal. Evite trabajar en seco más de 3 minutos en bombas centrífugas
            convencionales. Calibre los coeficientes de pérdida de manguera con datos reales cuando
            estén disponibles.
          </p>
        </div>
      </div>
    </div>
  );
}
