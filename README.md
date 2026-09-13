# PTOI - Gestor Táctico Operativo UME

Herramienta unificada para el Puesto de Mando Avanzado, construida con React + Vite.

## Módulos

- **Calculadora Hidráulica y de Rendimientos**: selección de medio de extracción
  (autobombas, motobombas, EMBAL, SIGEFLU...), cálculo del punto de trabajo real
  (caudal estimado, pérdida de carga y altura manométrica total) a partir del
  desnivel, la distancia y el diámetro de mangueraje, y avisos sobre el límite
  general de succión de 8 m y la compatibilidad de racores.
- **Asistente de Procedimientos**: buscador de fichas tácticas (fases operativas,
  contención, seguridad, rescate) extraídas de los manuales de la UME.

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
  utils/           cálculo hidráulico (interpolación de curvas, pérdidas de carga)
  components/      CalculadoraHidraulica, AsistenteManuales
  App.jsx          navegación por pestañas
```

Las curvas de rendimiento y los coeficientes de pérdida de carga son
aproximaciones orientativas; deben calibrarse con los datos reales de las
fichas técnicas del manual cuando estén disponibles.
