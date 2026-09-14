# PTOI - Gestor Táctico Operativo UME

Herramienta unificada para el Puesto de Mando Avanzado, construida con React + Vite.

## Módulos

- **Calculadora Hidráulica y de Rendimientos**: selección de medio de extracción
  (autobombas, motobombas, EMBAL, SIGEFLU...), cálculo del punto de trabajo real
  (caudal estimado, pérdida de carga y altura manométrica total) a partir del
  desnivel, la distancia y el diámetro de mangueraje, y avisos sobre el límite
  general de succión de 8 m y la compatibilidad de racores.
- **Asistente de Procedimientos**: buscador de fichas tácticas (fases operativas,
  contención, seguridad, rescate) extraídas de los manuales de la UME, más un
  apartado de **Manuales PDF** donde se pueden subir tantos PDF como se quiera
  (procesados en el propio navegador con pdf.js, sin servidor) y buscar texto
  libre dentro de ellos: los resultados muestran el manual, la página y un
  fragmento resaltado, y al pulsar se abre el PDF en esa página. Los manuales
  se guardan en IndexedDB, por lo que persisten entre sesiones sin conexión.
- **Tiempo de Vaciado**: estima cuánto tardaría en vaciarse una zona anegada
  (garaje, sótano, nave...) a partir de sus dimensiones (largo, ancho, altura de
  la lámina de agua), el medio de extracción elegido, el número de equipos en
  paralelo y un factor de eficiencia real configurable.

## Desarrollo

```bash
npm install
npm run dev      # servidor de desarrollo
npm run build    # build de producción
npm run lint     # oxlint
```

## Estructura

```
src/
  data/            catálogo de medios, mangueras y base de procedimientos
  utils/           cálculo hidráulico, tiempo de vaciado, extracción de texto PDF, IndexedDB de manuales
  components/      CalculadoraHidraulica, AsistenteManuales, ManualesPDF, TiempoVaciado
  App.jsx          navegación por pestañas
```

Las curvas de rendimiento de los equipos (`src/data/equipos.js`) están tomadas
de las fichas técnicas oficiales MF08-UD02-UA02 ("Características y empleo de
los medios de extracción de la UME"); los puntos intermedios entre los datos
oficiales de cada curva son interpolaciones lineales. Los coeficientes de
pérdida de carga en manguera son aproximaciones orientativas y deben
calibrarse con datos reales cuando estén disponibles.
