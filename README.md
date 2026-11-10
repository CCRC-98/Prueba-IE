# Prueba técnica full-stack: reservas de electrolineras

Aplicación inicial en Next.js para una evaluación local de 30 minutos de análisis y 60 minutos de desarrollo. Los datos son completamente ficticios.

## Requisitos

- Node.js 20.9 o posterior
- npm

## Ejecutar

```bash
npm install
npm run dev
```

Abre <http://localhost:3000>. Para revisar que el proyecto compile, ejecuta `npm run build`.

## Fase 1: análisis (30 minutos)

La pantalla principal contiene el caso, un glosario, un mapa de reglas dadas y decisiones abiertas, y seis preguntas guía. Las preguntas 1 a 5 son las principales; la 6 es un extra de revisión de código si queda tiempo.

El candidato puede:

- Ver pistas opcionales, una por una, en cada pregunta.
- Registrar sus respuestas y, al final, un bloque de **Supuestos y reglas que faltan**.
- Guardar todo con **Guardar respuestas en JSON**. El servidor crea una carpeta por envío en `candidate-results/<nombre>-<fecha>-<id>/answers.json`. No se usa `localStorage` ni `sessionStorage`.
- Ver un temporizador de tiempo transcurrido. Si intenta cerrar la página con cambios sin guardar, el navegador pide confirmación.

Cada respuesta guardada incluye `questionId`, la pregunta, la respuesta, `hintsUsed` y, en el archivo global, los supuestos y el tiempo transcurrido. Las pistas no penalizan; se registran para que el evaluador entienda el proceso.

### Conceptos que el candidato debe distinguir

| Concepto | Qué es | Duración |
|---|---|---|
| **Reserva (slot)** | Bloque futuro que el usuario aparta para usar un cargador. | 1 hora o más. |
| **Ventana OCPP** | Instrucción que se envía al cargador para iniciar la carga. | 10–15 minutos; en este ejercicio, 15. |
| **Sesión** | Uso real del cargador por un vehículo. Puede terminar antes de la reserva. | Hasta el máximo del tipo: AC 5 h, DC 2 h. |

La tarifa plana no paga la energía: paga la reserva del cargador. Si el conductor asiste, se devuelve; si no llega dentro de la ventana de gracia, se retiene como penalidad.

### Reglas dadas y decisiones abiertas

**Dadas:** horarios por localidad, máximo de sesión (AC 5 h, DC 2 h), mínimo de reserva (1 h), tarifa plana (AC COP 20.000, DC COP 22.000), intervalos `[inicio, fin)`, fecha de demostración fija y ventana de gracia de 15 min.

**Abiertas:** granularidad de horarios (`:15`, `:17` o solo `:00/:30`), máximo de duración de una reserva, qué pasa cuando una sesión termina antes de su máximo estimado, qué pasa con el resto del slot después de un no-show, cómo se vinculan sesiones y reservas, y concurrencia.

El candidato debe detectar estas decisiones, proponer un supuesto y justificarlo. No hay una única respuesta correcta para las decisiones abiertas.

## Fase 2: ejercicio (60 minutos)

Completa la página `/reservas` y crea `POST /api/reservations`.

### Requisitos mínimos

1. Construir una pantalla para indicar usuario, cargador, inicio y duración o fin de la reserva.
2. Mostrar los slots del cargador en la fecha de demostración, según la granularidad definida (por defecto, 30 minutos), y deshabilitar los que se cruzan con reservas confirmadas o sesiones activas.
3. Validar cargador existente, duración mínima de una hora, horario de atención, granularidad, fecha y conflictos con reservas o sesiones.
4. Para una sesión activa sin fin real, estimar la liberación sumando el máximo del cargador a la hora de inicio: AC = 5 horas, DC = 2 horas. Si la sesión tiene `endedAt`, liberar desde esa hora real.
5. Cobrar tarifa plana por reserva según el cargador: AC = COP 20.000; DC = COP 22.000.
6. Guardar las reservas creadas en `data/reservations.json`.
7. Mostrar confirmación o errores entendibles en la interfaz.

### Extras

- Implementar `GET /api/reservations?userId=...` para listar las reservas de un usuario.
- Indicar en la interfaz por qué un slot está bloqueado.
- Simular el fin de una sesión y recalcular la disponibilidad.

### Fuera de alcance

No implementes autenticación, procesamiento de pagos, integración con SAP ni OCPP. El no-show no se implementa: el candidato debe explicar en `NOTES.md` cómo modelaría la ventana de gracia, el cambio de estado y la liberación o no del resto del slot.

### Supuestos y valores por defecto

- La fecha es fija: `2030-03-12`. No agregues selector de fecha.
- Los intervalos son `[inicio, fin)`: una reserva puede empezar justo cuando termina otra o cuando se libera el cargador.
- Por simplicidad, inicio y fin ocurren el mismo día; no hace falta resolver reservas que cruzan medianoche.
- Si no se define otra granularidad, usa bloques de 30 minutos con inicio y fin alineados.
- Si no se define otro máximo de reserva, usa el máximo de sesión del tipo: AC 5 horas, DC 2 horas.
- `data/reservations.json` ya tiene una reserva ficticia para comprobar conflictos. No borres los fixtures existentes; agrega reservas nuevas.
- El almacenamiento JSON es solo para este ejercicio local de un usuario. No ofrece garantías de concurrencia, seguridad ni persistencia aptas para producción. Evita exponer el servidor a Internet.
- Se permite utilizar herramientas de IA. El candidato debe revisar y probar el código generado.

### Entregable adicional

El candidato debe crear un `NOTES.md` con:

- Los supuestos que tomó y por qué.
- Al menos dos prompts que usó con la IA y cómo verificó el resultado.
- Un bug que encontró en el código generado por la IA y cómo lo detectó.
- Una prueba que añadiría con más tiempo.
- Cómo se relaciona lo que implementó con lo que argumentó en la fase 1.

## Archivos de datos y persistencia

- `data/stations.json`: localidades, horarios, zonas, cargadores, tarifas, sesiones activas y una sesión ya finalizada.
- `data/reservations.json`: reservas ficticias y destino local de nuevas reservas.
- `candidate-results/`: respuestas guardadas por la pantalla de análisis; se genera al guardar.
- `RUBRIC.md`: criterios de evaluación y respuestas esperadas de referencia.

Los datos de este proyecto son ficticios y solo deben usarse en el entorno local.
