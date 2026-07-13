# NóminaHogar Perú

**Gestión de nóminas para trabajadores del hogar bajo Ley N° 27986**

🔗 **App en vivo → [badpeq.github.io/WebGastos](https://badpeq.github.io/WebGastos/)**

---

## ¿Qué es?

Herramienta web de una sola página (SPA) que calcula y genera boletas de pago para empleadas del hogar, cuidadoras, cocineras y personal doméstico en Perú. Funciona 100% en el navegador, sin servidor ni instalación.

## Funcionalidades

- **Motor de cálculo agnóstico** — selector mensual/quincenal: todos los montos se recalculan al instante con un solo divisor
- **Cálculos legales automáticos** — ONP (13%), AFP (Habitat / Integra / Prima / Profuturo), EsSalud (9%), CTS, Gratificaciones y Vacaciones según Ley 27986
- **Boleta de pago en tiempo real** — preview HTML que se actualiza con cada tecla
- **Número de boleta** con autonumeración correlativa
- **Exportación PDF** de 2 páginas: boleta del período + proyección de costo anual
- **Impresión directa** — `@media print` aísla solo la boleta en A4
- **Gestión de firmas** — drag & drop de imagen, guardada en `localStorage`
- **Tabla de costo anual proyectado** — KPIs, barra de composición y detalle por concepto
- **Historial de pagos** en `localStorage` con nombre del PDF generado, fecha y número de boleta
- **Exportación del historial** en JSON

## Base legal

| Concepto | Base normativa | Cálculo |
|---|---|---|
| ONP | D.L. 19990 | 13% del bruto |
| AFP | Resolución SBS | 10% + comisión + prima de seguro |
| EsSalud | Ley 26790 | 9% del bruto (empleador) |
| CTS | Art. 12 · Ley 27986 | 15 días/año = bruto ÷ 24 |
| Gratificaciones | Art. 13 · Ley 27986 | ½ sueldo en julio + ½ en diciembre |
| Vacaciones | Art. 14 · Ley 27986 | 15 días/año = bruto ÷ 24 |
| Exoneración gratif. | Ley 29351 | Gratificaciones exentas de EsSalud y pensiones |

## Uso

Abre la URL directamente en cualquier navegador:

```
https://badpeq.github.io/WebGastos/
```

No requiere instalación, cuenta ni conexión a internet después de la carga inicial.

## Estructura del repo

```
docs/
└── index.html              # App desplegada en GitHub Pages
Proyectos/NominaHogar/
└── nomina_hogar_peru.html  # Fuente del proyecto
WebGastos/                  # App de gestión de gastos (proyecto paralelo)
```

## Deploy

Rama `v2-advanced` → carpeta `/docs` → GitHub Pages.

Para actualizar la app publicada:

```bash
cp Proyectos/NominaHogar/nomina_hogar_peru.html docs/index.html
git add docs/index.html && git commit -m "deploy: actualización" && git push origin v2-advanced
```
