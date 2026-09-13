import { useEffect, useMemo, useRef, useState } from 'react';
import { eliminarManual, guardarManual, listarManuales } from '../utils/manualesDB';
import { extraerFragmento, extraerTextoPDF } from '../utils/pdfTexto';
import './ManualesPDF.css';

function resaltar(texto, query) {
  if (!query) return texto;
  const partes = texto.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'ig'));
  return partes.map((parte, i) =>
    parte.toLowerCase() === query.toLowerCase() ? <mark key={i}>{parte}</mark> : parte
  );
}

export default function ManualesPDF() {
  const [manuales, setManuales] = useState([]);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    listarManuales().then(setManuales).catch(() => setError('No se pudieron cargar los manuales guardados.'));
  }, []);

  async function subirArchivos(files) {
    setSubiendo(true);
    setError('');
    try {
      for (const file of files) {
        if (file.type !== 'application/pdf') continue;
        const buffer = await file.arrayBuffer();
        const paginas = await extraerTextoPDF(buffer);
        const manual = {
          id: `${Date.now()}-${file.name}`,
          nombre: file.name,
          tamano: file.size,
          fecha: new Date().toISOString(),
          paginas,
          blob: file,
        };
        await guardarManual(manual);
        setManuales((prev) => [...prev, manual]);
      }
    } catch {
      setError('Error al procesar uno o más PDF. Verifique que sean documentos válidos.');
    } finally {
      setSubiendo(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  async function borrar(id) {
    await eliminarManual(id);
    setManuales((prev) => prev.filter((m) => m.id !== id));
  }

  function abrirPagina(manual, numeroPagina) {
    const url = URL.createObjectURL(manual.blob);
    window.open(`${url}#page=${numeroPagina}`, '_blank');
  }

  const resultados = useMemo(() => {
    const q = query.trim();
    if (!q) return [];
    const salida = [];
    for (const manual of manuales) {
      for (const pagina of manual.paginas) {
        if (pagina.texto.toLowerCase().includes(q.toLowerCase())) {
          salida.push({
            manual,
            pagina: pagina.numero,
            fragmento: extraerFragmento(pagina.texto, q),
          });
        }
      }
    }
    return salida.slice(0, 100);
  }, [manuales, query]);

  return (
    <div className="manuales-pdf">
      <h3>📄 Manuales PDF</h3>

      <div className="manuales-upload">
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          multiple
          onChange={(e) => subirArchivos(Array.from(e.target.files))}
        />
        {subiendo && <span className="manuales-subiendo">Procesando PDF…</span>}
      </div>
      {error && <p className="manuales-error">{error}</p>}

      {manuales.length > 0 && (
        <ul className="manuales-lista">
          {manuales.map((m) => (
            <li key={m.id}>
              <span>{m.nombre}</span>
              <span className="manuales-meta">{m.paginas.length} pág. · {(m.tamano / 1024).toFixed(0)} KB</span>
              <button onClick={() => borrar(m.id)}>Eliminar</button>
            </li>
          ))}
        </ul>
      )}

      <input
        type="text"
        className="manuales-buscador"
        placeholder="🔍 Buscar dentro de los manuales subidos..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        disabled={manuales.length === 0}
      />

      {query.trim() && (
        <div className="manuales-resultados">
          {resultados.length > 0 ? (
            resultados.map((r, i) => (
              <div key={i} className="manuales-resultado" onClick={() => abrirPagina(r.manual, r.pagina)}>
                <div className="manuales-resultado-cabecera">
                  <strong>{r.manual.nombre}</strong>
                  <span>pág. {r.pagina}</span>
                </div>
                <p>{resaltar(r.fragmento, query.trim())}</p>
              </div>
            ))
          ) : (
            <p className="manuales-vacio">Sin coincidencias en los manuales subidos.</p>
          )}
        </div>
      )}

      {manuales.length === 0 && (
        <p className="manuales-vacio">Sube uno o varios PDF para poder buscar en su contenido.</p>
      )}
    </div>
  );
}
