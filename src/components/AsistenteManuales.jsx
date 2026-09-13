import { useMemo, useState } from 'react';
import { baseConocimiento } from '../data/procedimientos';
import ManualesPDF from './ManualesPDF';
import './AsistenteManuales.css';

export default function AsistenteManuales() {
  const [busqueda, setBusqueda] = useState('');

  const resultados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return baseConocimiento;
    return baseConocimiento.filter(
      (item) =>
        item.titulo.toLowerCase().includes(q) ||
        item.descripcion.toLowerCase().includes(q) ||
        item.categoria.toLowerCase().includes(q)
    );
  }, [busqueda]);

  return (
    <div>
      <h3>📚 Asistente de consulta rápida (procedimientos UME)</h3>
      <input
        type="text"
        className="asistente-input"
        placeholder="🔍 Buscar por palabra clave (ej. sacos, corriente, plazos, seguridad)..."
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
      />

      <div className="asistente-lista">
        {resultados.length > 0 ? (
          resultados.map((item) => (
            <div key={item.titulo} className="asistente-ficha">
              <span className="asistente-categoria">{item.categoria}</span>
              <h4>{item.titulo}</h4>
              <p>{item.descripcion}</p>
            </div>
          ))
        ) : (
          <p className="asistente-vacio">No se encontraron coincidencias en los manuales indexados.</p>
        )}
      </div>

      <ManualesPDF />
    </div>
  );
}
