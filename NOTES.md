# Notas de implementación — Fase 2

## 1. Alcance implementado

- Pantalla `/reservas` con selector de localidad, zona y cargador; grilla de slots de 30 minutos; selección de inicio y duración; resumen de fin, duración y precio; y listado de reservas del usuario.
- `POST /api/reservations` para crear una reserva.
- `GET /api/reservations?userId=...` para consultar las reservas de un usuario.
- Extra: `GET /api/availability?chargerId=...` para que la UI muestre disponibilidad y el motivo de cada bloqueo.
- Persistencia en `data/reservations.json`, preservando el fixture `res-demo-001`.

No se implementaron autenticación, pagos, SAP, OCPP, flujo de no-show ni selector de fecha. El alcance es el de la fase 2 del README.

## 2. Cómo ejecutar

```bash
npm install
npm run dev
```

Abrir `http://localhost:3000/reservas`.

Verificación de calidad:

```bash
npm run lint
npm run build
```

## 3. Reglas y supuestos

| Tema | Decisión | Por qué |
| --- | --- | --- |
| Fecha de la demo | `2030-03-12` (viene de `data/stations.json`). | El README fija la fecha y pide no agregar selector. |
| Zona horaria | `America/Bogota` (UTC-5, sin horario de verano). Las fechas se construyen con el offset explícito `-05:00`. | Todas las localidades del fixture son de Colombia; el offset explícito evita depender de la zona del servidor. |
| Grilla | Slots de 30 minutos. Inicio y fin deben estar alineados a la grilla. | Es el valor por defecto del README y simplifica la comparación de intervalos. |
| Duración mínima | 60 minutos. | El README lo da como regla fija. |
| Duración máxima | La máxima sesión del cargador: AC 5 h, DC 2 h (`maxSessionHours`). | Evita reservar más tiempo del que una sesión real puede ocupar el cargador. |
| Intervalos | Semiabiertos `[start, end)`. Dos intervalos se cruzan solo si `startA < endB && endA > startB`. | El README define intervalos semiabiertos; permite reservas consecutivas sin conflicto. |
| Reserva existente | Bloquea `[startAt, endAt)`. | Una reserva confirmada ocupa el cargador durante toda su ventana. |
| Sesión activa sin `endedAt` | Bloquea `[startedAt, startedAt + maxSessionHours)`. El fin es estimado. | El README pide estimar la liberación con el máximo del cargador. |
| Sesión activa con `endedAt` | Bloquea `[startedAt, endedAt)`. | Si la sesión terminó antes, la hora real es la fuente de verdad. |
| Sesión terminada | Bloquea `[startedAt, endedAt)`; si no hay `endedAt`, se usa el fin estimado como respaldo. | El intervalo histórico sigue ocupado; después de `endedAt` el cargador queda libre. |
| Horario | Se toma `openingTime` y `closingTime` de la localidad. Se permite terminar exactamente a la hora de cierre. | Evita reservas fuera de atención; el cierre exacto es un borde válido. |
| Precio | Siempre `charger.flatRateCop`. No hay precios hardcodeados. | La tarifa vive en el fixture y puede cambiar por cargador. |
| Persistencia | Lectura/escritura de JSON con escritura atómica (`tmp` + `rename`) y una cola en memoria para serializar escrituras dentro del proceso. | El README pide guardar en `data/reservations.json`; la escritura atómica evita lecturas parciales y la cola evita perder reservas dentro de una instancia. |

## 4. Contrato de API

### `POST /api/reservations`

Acepta `startAt` + `durationMinutes`:

```json
{
  "userId": "usuario-demo",
  "chargerId": "ac-002",
  "startAt": "2030-03-12T15:00:00-05:00",
  "durationMinutes": 60
}
```

O `startAt` + `endAt`:

```json
{
  "userId": "usuario-demo",
  "chargerId": "ac-002",
  "startAt": "2030-03-12T19:00:00-05:00",
  "endAt": "2030-03-12T20:00:00-05:00"
}
```

Si se envían ambos, deben coincidir. Respuesta exitosa (`201`):

```json
{
  "reservation": {
    "id": "res-...",
    "userId": "usuario-demo",
    "chargerId": "ac-002",
    "startAt": "2030-03-12T15:00:00-05:00",
    "endAt": "2030-03-12T16:00:00-05:00",
    "priceCop": 20000,
    "status": "confirmed",
    "createdAt": "2026-11-10T20:44:05.920Z"
  }
}
```

Errores:

| HTTP | Código | Cuándo |
| --- | --- | --- |
| 400 | `INVALID_BODY` | Cuerpo que no es un objeto JSON o falta `chargerId`. |
| 400 | `INVALID_USER` | Falta `userId` o es demasiado largo. |
| 400 | `INVALID_DATE` | `startAt`/`endAt` inválido, ausente o de otra fecha. |
| 400 | `INVALID_DURATION` | Duración menor a 60 min, mayor al máximo, no múltiplo de 30, `durationMinutes` y `endAt` no coinciden, o hay segundos. |
| 400 | `OUTSIDE_HOURS` | Inicio antes de abrir, fin después de cerrar o reserva que cruza medianoche. |
| 404 | `CHARGER_NOT_FOUND` | `chargerId` inexistente. |
| 409 | `RESERVATION_CONFLICT` | Se cruza con una reserva o una sesión. Incluye `conflicts` con el detalle. |
| 500 | `WRITE_ERROR` / `READ_ERROR` | Falla de lectura o escritura del JSON. |

Ejemplo de conflicto:

```json
{
  "error": "El horario se cruza con Reserva confirmada 14:00–15:00 · Reserva confirmada 15:00–16:00.",
  "code": "RESERVATION_CONFLICT",
  "field": "startAt",
  "conflicts": [
    {
      "type": "reservation",
      "id": "res-demo-001",
      "startAt": "2030-03-12T14:00:00-05:00",
      "endAt": "2030-03-12T15:00:00-05:00",
      "label": "Reserva confirmada 14:00–15:00"
    }
  ]
}
```

### `GET /api/reservations?userId=...`

Devuelve las reservas del usuario, ordenadas por `startAt`:

```json
{ "reservations": [ /* ... */ ] }
```

Sin `userId` devuelve todas las reservas. Es un comportamiento de depuración, documentado aquí; la UI siempre envía `userId`.

### `GET /api/availability?chargerId=...`

Devuelve los slots del día de demo con disponibilidad y motivo:

```json
{
  "chargerId": "ac-002",
  "date": "2030-03-12",
  "granularityMinutes": 30,
  "slots": [
    {
      "startAt": "2030-03-12T14:00:00-05:00",
      "endAt": "2030-03-12T14:30:00-05:00",
      "available": false,
      "reason": "Reserva confirmada 14:00–15:00",
      "conflicts": [
        {
          "type": "reservation",
          "id": "res-demo-001",
          "startAt": "2030-03-12T14:00:00-05:00",
          "endAt": "2030-03-12T15:00:00-05:00",
          "label": "Reserva confirmada 14:00–15:00"
        }
      ]
    }
  ]
}
```

`reason` es `null` cuando el slot está libre. Si hay más de un bloqueo, los motivos se unen con ` · `.

## 5. Pruebas manuales ejecutadas

Entorno: Next.js 16.4.5, Node.js 24.22.1, Windows, servidor de desarrollo en `http://localhost:3000`.

### 5.1 Disponibilidad por cargador

| Cargador | Slots | Bloqueados | Detalle observado |
| --- | ---: | ---: | --- |
| `ac-001` | 32 | 10 | Sesión activa desde 08:00, fin estimado 13:00. |
| `ac-002` | 32 | 2 | Reserva fixture 14:00–15:00. |
| `dc-003` | 32 | 4 | Sesión activa desde 11:30, fin estimado 13:30. |
| `ac-004` | 32 | 3 | Sesión terminada 09:00–10:30. |
| `dc-101` | 26 | 0 | Localidad Medellín, 07:00–20:00. |
| `ac-102` | 26 | 0 | Localidad Medellín, 07:00–20:00. |

Los 32 slots de Bogotá corresponden a 06:00–22:00; los 26 de Medellín, a 07:00–20:00. Los motivos se mostraron correctamente en la respuesta y en la lista “Por qué hay slots bloqueados” de la UI.

### 5.2 Matriz de `POST /api/reservations`

| # | Caso | Esperado | Observado |
| --- | --- | ---: | ---: |
| A | AC-002 15:00–16:00, 60 min | 201 | 201 |
| B | AC-002 14:30–15:30, después de A | 409 | 409 |
| C | AC-002 13:30–15:30, 120 min, después de A | 409 | 409 |
| D | AC-002 16:00–17:00, consecutiva a A | 201 | 201 |
| E | AC-002 18:00–18:59, 59 min | 400 | 400 |
| F | AC-002 18:00–19:00, 60 min | 201 | 201 |
| G | AC-002 10:15–11:15, inicio desalineado | 400 | 400 |
| H | AC-002 05:30–06:30, antes de abrir | 400 | 400 |
| I | AC-002 21:30–22:30, después de cerrar | 400 | 400 |
| J | AC-002 21:00–22:00, termina exactamente al cerrar | 201 | 201 |
| K | AC-001 12:30–13:30, sesión activa hasta 13:00 | 409 | 409 |
| L | AC-001 13:00–14:00, comienza cuando termina la estimación | 201 | 201 |
| M | AC-004 10:00–11:00, sesión terminada 09:00–10:30 | 409 | 409 |
| N | AC-004 10:30–11:30, comienza cuando terminó la sesión | 201 | 201 |
| O | Cargador `xx-999` | 404 | 404 |
| P | AC-002 06:00, 360 min (6 h) | 400 | 400 |
| Q | DC-101 07:00, 180 min (3 h) | 400 | 400 |
| R | DC-101 07:00–09:00, 120 min | 201 | 201 |
| S | AC-002 19:00–20:00, solo `endAt` | 201 | 201 |
| T | AC-002 20:00–21:00, `durationMinutes` y `endAt` coincidentes | 201 | 201 |
| U | AC-002 10:00–11:30 con `durationMinutes: 60` | 400 | 400 |
| V | AC-002 10:00–11:15, fin desalineado | 400 | 400 |
| W | Sin `userId` | 400 | 400 |
| X | Sin `startAt` | 400 | 400 |
| Y | Fecha 2030-03-13 | 400 | 400 |

Los casos B y C incluyen el conflicto con el fixture `res-demo-001` y con la reserva creada en A; la respuesta 409 incluyó ambos motivos. El caso D confirma que una reserva que empieza exactamente cuando termina otra no se considera conflicto (intervalos semiabiertos). La reserva A devolvió `priceCop: 20000`; el código toma siempre `charger.flatRateCop`, así que la ruta DC usa los 22000 del fixture.

### 5.3 Consultas y persistencia

| Caso | Observado |
| --- | --- |
| `GET /api/reservations?userId=usuario-demo` después de la matriz | 10 reservas (fixture + 9 creadas), ordenadas por inicio. |
| `GET /api/reservations?userId=usuario-inexistente` | 0 reservas. |
| `GET /api/reservations` sin `userId` | 11 reservas (incluye el usuario de concurrencia). |
| `data/reservations.json` después de la matriz | 11 registros; `res-demo-001` seguía presente. |
| `GET /reservas` | HTTP 200; el HTML contiene “Reserva tu cargador” y “Nueva reserva”. |

Después de las pruebas restauré `data/reservations.json` al estado inicial, dejando únicamente el fixture `res-demo-001`. La comprobación posterior dio 1 reserva y 2 slots bloqueados en `ac-002` (14:00 y 14:30).

### 5.4 Concurrencia dentro del proceso

Dos `POST` simultáneos al mismo slot libre (`ac-102`, 07:00–08:00) dieron:

- Una respuesta `201` con la reserva creada.
- Una respuesta `409` con el conflicto contra la reserva recién creada.

Esto confirma que la cola en memoria serializa las escrituras dentro de una instancia del servidor. No cubre dos procesos distintos; ver sección 8.

## 6. Bug encontrado en código generado por IA

En la revisión del snippet de la fase 1 (P6) que había generado con IA, la condición de solapamiento solo miraba el inicio de la reserva contra la ventana de la sesión:

```ts
// Versión incompleta
reservation.startAt >= session.startedAt && reservation.startAt < sessionEnd;
```

Caso concreto: reserva `07:00–09:00` contra una sesión activa `08:00–13:00`. La condición devuelve `false` porque `07:00 < 08:00`, así que la reserva se aceptaría aunque se cruza de `08:00` a `09:00`. Lo detecté al revisar los bordes de `ac-001` y lo confirmé con la matriz: `12:30–13:30` debe dar 409 y `13:00–14:00` debe dar 201.

La implementación usa intervalos semiabiertos y la condición correcta:

```ts
startA.getTime() < endB.getTime() && endA.getTime() > startB.getTime();
```

Verificación observada:

- AC-001 `12:30–13:30` → 409 (se cruza con la sesión 08:00–13:00).
- AC-001 `13:00–14:00` → 201 (empieza exactamente cuando termina la estimación).
- AC-002 `14:00–15:00` (fixture) y `15:00–16:00` (nueva) → 201 para la segunda, sin conflicto.

Hallazgo adicional: el primer borrador del cliente llamaba `setState` directamente dentro del cuerpo de un `useEffect`. `npm run lint` lo marcó con `react-hooks/set-state-in-effect` (renders en cascada). Moví los resets a los manejadores de eventos y dejé el efecto solo para disparar el fetch y actualizar estado en callbacks asíncronos. Después de eso, lint y build quedaron limpios.

## 7. Prompts usados y verificación

### Prompt 1 — lógica de dominio

> “Implementa la disponibilidad y la validación de reservas para los cargadores. Usa intervalos `[inicio, fin)`, sesiones activas con fin estimado según `maxSessionHours`, fecha fija `2030-03-12` en `America/Bogota`, grilla de 30 minutos y duración máxima igual al máximo de sesión. Devuelve el motivo de cada bloqueo.”

Verificación:

- Revisé el resultado contra `data/stations.json` y `data/reservations.json`.
- Ejecuté la matriz de 25 casos de la sección 5.2.
- Comparé los conteos de slots y los motivos de bloqueo con los fixtures.
- Encontré y corregí el bug de solapamiento descrito en la sección 6.
- Confirmé que el precio sale de `flatRateCop` y que el fixture no se modificó.

### Prompt 2 — interfaz

> “Genera la pantalla `/reservas` con selector de localidad, zona y cargador, grilla de slots de 30 minutos, selección de inicio y duración, resumen de fin y precio, y una lista de reservas del usuario. Los slots bloqueados deben mostrar por qué lo están.”

Verificación:

- `npm run build` y `npm run lint` sin errores.
- `GET /reservas` responde 200 y contiene el planner.
- Las llamadas del cliente usan `POST /api/reservations` y `GET /api/availability`, ya probados con la matriz anterior.
- Revisé que un slot bloqueado muestra el motivo en la lista de bloqueos y en el `title`/`aria-label`.
- No hice una prueba E2E con navegador; queda como prueba pendiente.

## 8. Prueba que añadiría con más tiempo

**Concurrencia entre procesos.** La cola actual es un módulo en memoria: protege dos requests dentro de la misma instancia de Next, pero no dos instancias distintas contra el mismo `data/reservations.json`. La prueba sería:

1. Levantar dos instancias de Next (`next start` en dos puertos) apuntando al mismo archivo.
2. Enviar dos `POST` simultáneos al mismo slot libre.
3. Esperar `201` + `409`.

Con el diseño actual es probable obtener `201` + `201` (lost update). La solución sería una base de datos con transacción y restricción de unicidad por rango, o un lock de archivo a nivel de sistema operativo. También añadiría una prueba E2E del no-show con reloj simulado para verificar la tolerancia de 15 minutos y la retención de la tarifa.

## 9. No-show y simulación de fin de sesión (propuestas)

No implementé el no-show porque el README lo deja fuera de alcance, y no implementé la simulación de fin de sesión porque mutaría los fixtures (el README la plantea como extra). Estas son las decisiones que tomaría.

### 9.1 No-show

**Ventana de gracia.** `reservationGraceMinutes` ya viene en `data/stations.json` con valor 15. La reserva se considera no-show si a `startAt + 15 min` no hay una sesión vinculada.

**Vínculo sesión–reserva.** En la fase 2 la disponibilidad se calcula por intervalos y no hay vínculo explícito. Para el no-show agregaría `reservationId` a la sesión (o `sessionId` a la reserva) y haría el vínculo cuando una sesión empieza en el mismo cargador, para el mismo usuario, dentro de la ventana de la reserva. Un walk-in no tiene reserva. La relación sería uno a uno: una reserva tiene como máximo una sesión.

**Estados.** Extendería `ReservationStatus` a:

- `confirmed`: reserva creada, todavía no empieza.
- `active`: hay una sesión vinculada en curso.
- `completed`: la sesión terminó con `endedAt`.
- `no-show`: pasaron 15 minutos sin sesión.
- `cancelled`: cancelación explícita (fuera de alcance).

Transiciones:

- `confirmed → active` cuando se vincula una sesión.
- `active → completed` cuando la sesión tiene `endedAt`.
- `confirmed → no-show` a `startAt + 15 min` si no hay sesión.
- `no-show` es terminal; no se reactiva si el usuario llega tarde.

**Liberación del resto del slot.** Mantendría bloqueado el slot que contiene el inicio (por la grilla de 30 minutos, el bloque `startAt`–`startAt + 30 min`) y liberaría los bloques siguientes hasta `endAt`. La tarifa plana se retiene: la reserva queda `no-show` con su `priceCop`, sin reembolso. Si el usuario llega después de la gracia, su reserva ya es no-show y tendría que crear una reserva nueva si aún hay disponibilidad.

Ejemplo con la grilla de 30 minutos y una localidad abierta hasta las 22:00: reserva 15:00–16:00. A las 15:15 no hay sesión → `no-show`. El bloque 15:00–15:30 sigue bloqueado por la gracia; el bloque 15:30–16:00 se libera. Una sesión que llegue a las 15:14 se vincula y evita el no-show; una que llegue a las 15:16 es walk-in y solo puede usar el bloque si está libre.

**Disponibilidad por estado.** `confirmed` bloquea `[startAt, endAt)`; `active` bloquea el intervalo de la sesión; `no-show` bloquea solo `[startAt, startAt + grace)`; `completed` bloquea el intervalo histórico de la sesión (no afecta slots futuros); `cancelled` no bloquea nada.

**Concurrencia.** La transición a no-show y el vínculo de la sesión deben ocurrir en una sola transacción o bajo el mismo lock, con una actualización condicional (`WHERE status = 'confirmed'`) para que dos requests no transicionen la misma reserva dos veces. En este ejercicio se podría evaluar de forma perezosa en cada lectura de disponibilidad, sin depender de un cron.

**Pruebas que haría.** Reloj simulado; reserva 15:00–16:00; a las 15:14 crear una sesión y verificar que no hay no-show; en otra reserva, a las 15:15 sin sesión verificar `no-show`, tarifa retenida y bloque 15:30–16:00 libre; intentar reservar 15:30–16:30 y verificar 201; intentar reservar 15:00–16:00 de nuevo y verificar 409 por el bloque de gracia.

### 9.2 Simulación de fin de sesión

No tocaría `data/stations.json`. Propongo una capa de sesiones en tiempo de ejecución:

1. Un archivo `data/sessions.runtime.json` (o un `Map` en memoria para una demo corta) con el `chargerId`, `startedAt`, `endedAt` y `status` simulados.
2. Un endpoint de desarrollo `POST /api/dev/sessions/[chargerId]/end`, protegido para que no exista en producción, que escribe el fin simulado en esa capa.
3. `GET /api/availability` y la validación de conflictos leen la capa runtime y la superponen a las sesiones del fixture; el fixture queda intacto.
4. Un botón “Simular fin de sesión” en un panel de desarrollo de `/reservas` que llama al endpoint y vuelve a pedir la disponibilidad.

Prueba concreta: `ac-001` está activo desde 08:00 con fin estimado 13:00. Simular fin a las 10:00 debe liberar 10:00–13:00; una reserva 10:30–11:30 debe pasar de 409 a 201. La ventaja de la capa runtime es que la prueba es repetible y no corrompe el fixture; la desventaja es que agrega un archivo mutable y un endpoint que hay que bloquear fuera de desarrollo.

## 10. Coherencia con la fase 1

| Fase 1 | Implementación en fase 2 |
| --- | --- |
| P1: modelo de dominio | `lib/types.ts`: `Location → Zone → Charger → ChargerSession`, más `Reservation`, `Slot` y `Conflict`. |
| P2: diseño de API | `app/api/reservations/route.ts` (`POST` y `GET`) y `app/api/availability/route.ts` (extra). |
| P3: reglas de validación | `validateReservationRequest` en `lib/reservations.ts`: fecha, grilla, mínimo, máximo, horario y conflictos. |
| P4: persistencia y concurrencia | `lib/reservation-store.ts`: lectura/escritura JSON, escritura atómica y cola en memoria. |
| P5: interfaz | `components/reservation-planner.tsx` y estilos en `app/globals.css`. |
| P6: solapamiento | `overlaps` y `getBlockingIntervals` en `lib/reservations.ts`, con intervalos semiabiertos. |

Los valores por defecto están centralizados en `data/stations.json` (fecha, mínimo, gracia, horarios, tarifas y máximos) y en las constantes de `lib/reservations.ts` (grilla y offset de Bogotá). Si alguna respuesta de la fase 1 difiere, el cambio se hace en esos puntos sin tocar la UI ni las rutas.

## 11. Limitaciones y siguientes pasos

- No hay autenticación: `userId` es texto libre. En producción vendría de la sesión.
- No hay pagos, SAP, OCPP ni flujo de no-show. La retención de tarifa por no-show está documentada como propuesta, no implementada.
- No hay selector de fecha: la demo usa `2030-03-12`.
- El almacenamiento en JSON no es seguro entre procesos. La escritura atómica evita lecturas parciales, pero no lost updates entre instancias.
- Todas las localidades son `America/Bogota`. `buildDemoDate` usa `-05:00` explícito; si se agrega una localidad con otra zona, habría que generalizar la construcción de fechas.
- No hay framework de tests instalado. Las pruebas de este documento se ejecutaron manualmente; no se añadieron dependencias.
- El precio es plano por reserva (`flatRateCop`), no por kWh.
