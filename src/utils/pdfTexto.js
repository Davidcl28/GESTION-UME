// Extracción de texto de un PDF en el navegador usando pdf.js.
// Se importa de forma diferida para no incluir pdf.js en el bundle principal.
async function cargarPdfjs() {
  const pdfjsLib = await import('pdfjs-dist');
  const { default: pdfjsWorker } = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;
  return pdfjsLib;
}

// Devuelve [{ numero, texto }] con el texto de cada página del PDF.
export async function extraerTextoPDF(arrayBuffer) {
  const pdfjsLib = await cargarPdfjs();
  const doc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const paginas = [];

  for (let numero = 1; numero <= doc.numPages; numero++) {
    const pagina = await doc.getPage(numero);
    const contenido = await pagina.getTextContent();
    const texto = contenido.items.map((item) => item.str).join(' ').replace(/\s+/g, ' ').trim();
    paginas.push({ numero, texto });
  }

  return paginas;
}

// Construye un fragmento de texto alrededor de la primera coincidencia de "query".
export function extraerFragmento(texto, query, radio = 80) {
  const idx = texto.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return texto.slice(0, radio * 2);
  const inicio = Math.max(0, idx - radio);
  const fin = Math.min(texto.length, idx + query.length + radio);
  return `${inicio > 0 ? '…' : ''}${texto.slice(inicio, fin)}${fin < texto.length ? '…' : ''}`;
}
