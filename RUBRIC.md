# Rúbrica de evaluación

Esta rúbrica es para el evaluador, no para el candidato. La idea es calificar **razonamiento y coherencia**, no la elección de una política única. Las decisiones abiertas admiten varias respuestas válidas si están justificadas.

## Cómo usarla

1. Lee las respuestas guardadas en `candidate-results/<carpeta>/answers.json`.
2. Revisa `hintsUsed` y `assumptions`: no penalizan por sí solos, pero explican el proceso.
3. Puntúa las seis dimensiones de abajo con 0–3.
4. Contrasta lo que el candidato argumentó en la fase 1 con lo que implementó en la fase 2.
5. Usa la defensa oral para aclarar dudas, no para cambiar la evidencia.

## Dimensiones (0–3)

| Dimensión | 0 | 1 | 2 | 3 |
|---|---|---|---|---|
| **Descomposición y modelo de datos** | No identifica entidades ni la unidad reservable. | Nombra entidades, pero confunde cargador, EVSE y conector. | Identifica la unidad reservable y los datos necesarios. | Además distingue reserva, ventana OCPP y sesión, y detecta cómo vincularlas. |
| **Precisión lógica** | Errores de cálculo o de intervalos. | Calcula bien un caso, pero falla bordes o fin anticipado. | Resuelve cálculo, bordes y solapes correctamente. | Además maneja fin anticipado, granularidad y redondeo de slots sin ayuda. |
| **Manejo de ambigüedad** | No detecta reglas faltantes. | Detecta una, sin proponer nada. | Propone supuestos razonables para varias reglas abiertas. | Prioriza por impacto, distingue regla de negocio de restricción técnica y define cómo validarla. |
| **Verificación** | No propone casos de prueba. | Lista casos genéricos sin resultado esperado. | Propone casos concretos con entrada y resultado esperado. | Cubre bordes, datos inválidos, fin anticipado, no-show y explica qué probaría primero. |
| **Uso y supervisión de IA** | Copia sin revisar; no puede explicar el código. | Usa IA, pero no muestra verificación. | Revisa, prueba y detecta algún problema. | Encuentra un bug sutil, lo demuestra con un caso y explica cómo lo corrigió. |
| **Comunicación y coherencia** | Respuestas vagas o contradictorias. | Explica ideas sueltas. | Explica decisiones con supuestos claros. | Lo que argumentó en fase 1 coincide con lo que implementó o justifica el cambio. |

**Lectura orientativa del total (0–18):** 15–18 muy sólido; 11–14 sólido con brechas; 7–10 junior o necesita acompañamiento; 0–6 no recomendado. No uses el número sin la evidencia.

## Pregunta por pregunta

### P1. Unidad reservable

**Qué mide:** modelo de datos y comprensión de la jerarquía.

**Respuesta esperada:** en este ejercicio se reserva el cargador porque es la simplificación del JSON. En un sistema real hay que confirmar si la unidad es el EVSE o el conector; dos conectores de un mismo EVSE no necesariamente pueden cargar dos vehículos a la vez. Hay que preguntar al proveedor qué identificador representa la sesión.

**Señales de alerta:** reservar la localidad o la zona; asumir que cada conector es independiente sin verificar; no distinguir sesión de reserva.

### P2. Liberación y fin anticipado

**Qué mide:** cálculo, intervalos y uso del fin real de la sesión.

**Respuesta esperada:**

- AC-001, sesión 8:00, máximo 5 h → liberación estimada 13:00.
- Pedido 12:30–13:30 → se cruza con la sesión → rechazar.
- Pedido 13:00–14:00 → empieza justo en la liberación → aceptar, si no hay otra reserva.
- Si la sesión terminó a las 10:30 → el cargador está libre desde las 10:30; el pedido 12:30–13:30 debería aceptarse si no hay otros conflictos.
- El dato necesario es una hora de fin real (`endedAt`) o un evento de fin de sesión; si no existe, se usa la estimación.

**Variantes válidas:** decir que sin un evento de OCPP no se puede saber que terminó antes, pero que si el dato existe debe mandar sobre la estimación. También es válido preguntar si el negocio quiere liberar el cargador apenas termina la sesión o mantener el bloqueo hasta el final de la reserva.

**Señales de alerta:** comparar solo la hora de inicio; ignorar el fin real; usar strings ISO con offsets distintos sin parsear; confundir máximo de sesión con duración de la reserva.

### P3. Granularidad y máximo

**Qué mide:** detección de reglas faltantes y razonamiento de negocio.

**Respuesta esperada:**

- El mínimo de 1 h no implica granularidad. 10:15–11:15 cumple el mínimo; si se rechaza, es por una regla de granularidad, no por el mínimo.
- Una política razonable es grilla de 30 min, con inicio y fin alineados, porque simplifica la disponibilidad y la comunicación.
- Si una sesión termina a las 10:45 y la grilla es de 30 min, el siguiente slot es 11:00, no 10:45.
- Sobre el máximo: reservar 6 h en AC o 3 h en DC bloquea el cargador más allá de la sesión máxima, generando tiempo muerto y afectando la rotación. Una política defendible es máximo de reserva = máximo de sesión (AC 5 h, DC 2 h); otra es un tope menor por negocio. También es defendible no poner máximo, pero solo con cancelación, no-show y límites por usuario.

**Variantes válidas:** cualquier granularidad y cualquier máximo si están justificados y son coherentes con la implementación. No exijas 30 min ni 5 h/2 h como única respuesta.

**Señales de alerta:** decir "como el mínimo es 1 h, solo se puede a las :00"; no distinguir máximo de sesión de máximo de reserva; permitir 6 h sin analizar el tiempo muerto; no definir qué pasa con el fin no alineado.

### P4. Reserva OCPP vs. slot y no-show

**Qué mide:** comprensión del dominio y de los estados.

**Respuesta esperada:**

- El slot es el bloque que ve el usuario (1 h o más); la ventana OCPP es la instrucción de 10–15 min al cargador; la sesión es el uso real.
- Si el usuario no llega dentro de la ventana, se marca no-show y se retiene la tarifa como penalidad.
- Qué pasa con el resto del slot es una decisión de negocio: se puede liberar desde el fin de la ventana o mantener bloqueado hasta el final del slot. Cualquiera es válida si se justifica.
- Si llega a los 20 min, hay que definir si se acepta como excepción o se trata como no-show. No puede quedar implícito.
- Los estados relevantes son: reservada, esperando inicio, en sesión, no-show, finalizada, cancelada.

**Señales de alerta:** tratar la ventana OCPP como si fuera todo el slot; cobrar la tarifa por la energía; no distinguir no-show de fin anticipado; no definir qué pasa con el resto del slot.

### P5. Casos de prueba y supuestos

**Qué mide:** verificación, cobertura y priorización.

**Respuesta esperada:** seis casos con entrada, resultado esperado y regla. Deben cubrir al menos:

- 59 min rechazado; 60 min aceptado.
- Inicio antes de apertura; fin después del cierre; fin exactamente en el cierre.
- Solape parcial, contención, reservas consecutivas.
- Cargador inexistente.
- Sesión activa y sesión terminada antes.
- No-show.

Y tres reglas faltantes ordenadas por impacto, con el supuesto por defecto y cómo lo validarían.

**Señales de alerta:** listas genéricas sin resultado esperado; no cubrir bordes; no priorizar; no escribir el supuesto.

### P6. Code review (extra)

**Qué mide:** lectura de código, bordes y supervisión de IA.

**Bug:** la condición solo mira si el inicio de la reserva cae dentro de la sesión. Falla cuando la reserva empieza antes de la sesión y termina dentro o después. Ejemplo: reserva 7:00–9:00 contra sesión 8:00–13:00; el código devuelve `false`, pero hay solape.

**Corrección:** `reservationStart < sessionEnd && reservationEnd > sessionStart`.

**Señales de alerta:** probar solo el caso feliz; no considerar el fin de la reserva; usar `<=` sin justificar el tratamiento del borde.

## Checklist de la fase 2

- [ ] El formulario crea reservas y muestra errores claros.
- [ ] La disponibilidad se calcula con reservas confirmadas y sesiones.
- [ ] Una sesión activa bloquea hasta su liberación estimada.
- [ ] Una sesión con `endedAt` libera desde esa hora real.
- [ ] Se respeta la granularidad elegida y el mínimo de 60 min.
- [ ] Se respeta el máximo de reserva elegido.
- [ ] Los bordes de apertura y cierre son correctos.
- [ ] Los intervalos consecutivos no se consideran solape.
- [ ] La tarifa se toma del cargador y no está hardcodeada.
- [ ] La reserva se persiste en `data/reservations.json`.
- [ ] Hay al menos una prueba ejecutada o documentada.
- [ ] `NOTES.md` explica supuestos, prompts, bug encontrado y prueba pendiente.
- [ ] Lo implementado es coherente con lo argumentado en fase 1.

## Sobre las pistas

- 0 pistas y buen razonamiento: señal fuerte.
- 1–2 pistas y buen razonamiento: señal sólida.
- Todas las pistas y razonamiento incompleto: señal de dificultad, no de descalificación automática.
- No penalices el uso de pistas por sí solo; úsalo como contexto.
