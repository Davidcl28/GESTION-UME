import { useMemo, useState } from 'react';
import { turbobomba } from '../data/equipos';
import { turbobombaCaudalSalida } from '../utils/hidraulica';
import './CalculadoraHidraulica.css';

export default function Turbobomba() {
  const [presionEntrada, setPresionEntrada] = useState(6);
  const [alturaAspiracion, setAlturaAspiracion] = useState(4);

  const presionesTabla = turbobomba.tabla.map((f) => f.presionEntradaBar);
  const alturasTabla = [2, 4, 6, 8];
  const fueraDeRangoPresion = Number(presionEntrada) < presionesTabla[0] || Number(presionEntrada) > presionesTabla[presionesTabla.length - 1];
  const fueraDeRangoAltura = Number(alturaAspiracion) < alturasTabla[0] || Number(alturaAspiracion) > alturasTabla[alturasTabla.length - 1];

  const resultado = useMemo(
    () => turbobombaCaudalSalida(Number(presionEntrada) || 0, Number(alturaAspiracion) || 0, turbobomba.tabla),
    [presionEntrada, alturaAspiracion]
  );

  return (
    <div>
      <h3>🌀 Turbobomba (captación con agua motriz)</h3>
      <div className="calc-grid">
        <div className="calc-form">
          <p className="calc-hint">
            La turbobomba no tiene motor propio ni succión directa: la acciona el agua limpia de una autobomba
            o motobomba (agua motriz) y, por efecto venturi, succiona agua sucia desde un punto bajo sin
            mezclar los dos circuitos. Indique la presión de salida de la bomba que la acciona y la altura de
            aspiración (profundidad del punto de achique) para estimar el caudal que necesita y el que
            trasvasa.
          </p>

          <label>Presión de salida de la bomba que acciona la turbobomba (bar)</label>
          <input
            type="number"
            min="0"
            step="0.5"
            value={presionEntrada}
            onChange={(e) => setPresionEntrada(e.target.value)}
          />

          <label>Altura de aspiración (profundidad del punto de achique, m)</label>
          <input
            type="number"
            min="0"
            step="0.5"
            value={alturaAspiracion}
            onChange={(e) => setAlturaAspiracion(e.target.value)}
          />
        </div>

        <div className="calc-result">
          <h4>📊 Resultado estimado</h4>
          <p>
            <strong>Caudal de entrada necesario (agua motriz, desde la bomba):</strong>{' '}
            {Math.round(resultado.caudalEntradaLMin)} l/min
          </p>
          <p>
            <strong>Caudal de salida (trasvasado):</strong> {Math.round(resultado.caudalSalidaLMin)} l/min
          </p>

          {(fueraDeRangoPresion || fueraDeRangoAltura) && (
            <p className="calc-warning">
              ⚠️ {fueraDeRangoPresion && 'La presión indicada está fuera del rango medido en la ficha (4-10 bar). '}
              {fueraDeRangoAltura && 'La altura de aspiración está fuera del rango medido en la ficha (2-8 m). '}
              El resultado se ha acotado al extremo más cercano de los datos reales; tómelo solo como
              orientativo.
            </p>
          )}

          <div className="calc-limites">
            <strong>Ficha técnica:</strong>
            <ul>
              <li>Entrada: {turbobomba.entrada}</li>
              <li>
                Diámetro aprox.: {turbobomba.diametroMM} mm · Altura: {turbobomba.alturaMM} mm · Peso:{' '}
                {turbobomba.pesoKg} kg
              </li>
            </ul>
            <p className="calc-badge-limpia">🪣 {turbobomba.solidos.detalle}</p>
          </div>

          <p className="calc-note">
            <em>Nota de campo:</em> {turbobomba.uso} El caudal se interpola linealmente entre los puntos reales
            de la ficha (presión 4-10 bar, altura de aspiración 2-8 m); fuera de ese rango el valor se acota al
            extremo medido.
          </p>
        </div>
      </div>
    </div>
  );
}
