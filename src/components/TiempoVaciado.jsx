import { useMemo, useState } from 'react';
import { catalogoMedios, diametrosManguera } from '../data/equipos';
import { estimarPuntoTrabajo } from '../utils/hidraulica';
import { calcularTiempoVaciado, calcularVolumenM3, formatearDuracion } from '../utils/vaciado';
import './TiempoVaciado.css';

export default function TiempoVaciado() {
  const [largo, setLargo] = useState(15);
  const [ancho, setAncho] = useState(10);
  const [alturaAgua, setAlturaAgua] = useState(0.5);

  const [medioId, setMedioId] = useState(catalogoMedios[0].id);
  const [desnivel, setDesnivel] = useState(2);
  const [longitudManguera, setLongitudManguera] = useState(20);
  const [diametroId, setDiametroId] = useState('70');
  const [numEquipos, setNumEquipos] = useState(1);
  const [factorEficiencia, setFactorEficiencia] = useState(75);

  const medio = useMemo(() => catalogoMedios.find((m) => m.id === medioId), [medioId]);
  const diametro = useMemo(() => diametrosManguera.find((d) => d.id === diametroId), [diametroId]);

  const volumenM3 = useMemo(
    () => calcularVolumenM3(Number(largo) || 0, Number(ancho) || 0, Number(alturaAgua) || 0),
    [largo, ancho, alturaAgua]
  );

  const puntoTrabajo = useMemo(
    () =>
      estimarPuntoTrabajo({
        curva: medio.curva,
        desnivelM: Number(desnivel) || 0,
        longitudManguera: Number(longitudManguera) || 0,
        coeficienteManguera: diametro.coeficiente,
      }),
    [medio, desnivel, longitudManguera, diametro]
  );

  const resultado = useMemo(
    () =>
      calcularTiempoVaciado({
        volumenM3,
        caudalLMinPorEquipo: puntoTrabajo.caudalLMin,
        numEquipos: Number(numEquipos) || 1,
        factorEficiencia: (Number(factorEficiencia) || 0) / 100,
      }),
    [volumenM3, puntoTrabajo, numEquipos, factorEficiencia]
  );

  return (
    <div>
      <h3>⏱️ Tiempo Estimado de Vaciado de una Zona</h3>
      <p className="vaciado-intro">
        Calcula cuánto tardaría en vaciarse una zona anegada (garaje, sótano, nave...) según sus
        dimensiones y el medio de extracción disponible.
      </p>

      <div className="vaciado-grid">
        <div className="vaciado-form">
          <h4>1. Dimensiones de la zona</h4>
          <label>Largo (m)</label>
          <input type="number" min="0" value={largo} onChange={(e) => setLargo(e.target.value)} />

          <label>Ancho (m)</label>
          <input type="number" min="0" value={ancho} onChange={(e) => setAncho(e.target.value)} />

          <label>Altura de la lámina de agua a evacuar (m)</label>
          <input
            type="number"
            min="0"
            step="0.05"
            value={alturaAgua}
            onChange={(e) => setAlturaAgua(e.target.value)}
          />

          <h4>2. Medio de extracción</h4>
          <label>Equipo</label>
          <select value={medioId} onChange={(e) => setMedioId(e.target.value)}>
            {catalogoMedios.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nombre}
              </option>
            ))}
          </select>

          <label>Desnivel hasta el punto de vertido (m)</label>
          <input type="number" min="0" value={desnivel} onChange={(e) => setDesnivel(e.target.value)} />

          <label>Distancia de mangueraje de impulsión (bomba → salida, m)</label>
          <input
            type="number"
            min="0"
            value={longitudManguera}
            onChange={(e) => setLongitudManguera(e.target.value)}
          />

          <label>Diámetro de manguera</label>
          <select value={diametroId} onChange={(e) => setDiametroId(e.target.value)}>
            {diametrosManguera.map((d) => (
              <option key={d.id} value={d.id}>
                {d.nombre}
              </option>
            ))}
          </select>

          <label>Número de equipos en paralelo</label>
          <input
            type="number"
            min="1"
            step="1"
            value={numEquipos}
            onChange={(e) => setNumEquipos(e.target.value)}
          />

          <label>Factor de eficiencia real (%)</label>
          <input
            type="number"
            min="10"
            max="100"
            value={factorEficiencia}
            onChange={(e) => setFactorEficiencia(e.target.value)}
          />
        </div>

        <div className="vaciado-result">
          <h4>📊 Resultado</h4>
          <p>
            <strong>Volumen a evacuar:</strong> {volumenM3.toFixed(1)} m³ ({resultado.litros.toLocaleString('es-ES')} l)
          </p>
          <p>
            <strong>Caudal por equipo:</strong> {puntoTrabajo.caudalLMin} l/min
          </p>
          <p>
            <strong>Caudal total ({numEquipos} equipo{Number(numEquipos) > 1 ? 's' : ''} · {factorEficiencia}% eficiencia):</strong>{' '}
            {resultado.caudalTotalLMin} l/min
          </p>
          <hr />
          <p className="vaciado-tiempo">
            <strong>Tiempo estimado:</strong> {formatearDuracion(resultado.tiempoMinutos)}
          </p>
          <p className="vaciado-note">
            <em>Nota de campo:</em> el factor de eficiencia real reduce el caudal nominal para
            tener en cuenta paradas de cebado, obstrucciones, sedimentos y que la bomba no siempre
            trabaja en su punto óptimo. Ajústelo a la baja (50-60%) en aguas muy sucias o con
            mangueraje complejo, y al alza (85-90%) en condiciones favorables y bombeo continuo.
          </p>
        </div>
      </div>
    </div>
  );
}
