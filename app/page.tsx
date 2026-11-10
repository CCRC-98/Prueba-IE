import Link from "next/link";
import stations from "@/data/stations.json";
import InterviewAnswers from "@/components/interview-answers";

type HintedQuestion = {
  id: string;
  title: string;
  prompt: string;
  hints: string[];
  code?: string;
};

const questions: HintedQuestion[] = [
  {
    id: "q1",
    title: "¿Qué unidad reservarías: la localidad, la zona, el cargador, el EVSE o el conector?",
    prompt:
      "Justifica con el diagrama de jerarquía. ¿Qué pasa si un EVSE tiene dos conectores y llegan dos vehículos al mismo tiempo?",
    hints: [
      "Piensa en qué recurso cambia de estado cuando alguien empieza a cargar.",
      "¿Dos conectores del mismo EVSE pueden suministrar energía a dos vehículos a la vez? ¿Qué identificador usa el proveedor para la sesión?",
    ],
  },
  {
    id: "q2",
    title: "El AC-001 tiene una sesión iniciada a las 8:00 a. m. Un usuario pide reservar de 12:30 a 1:30 p. m. ¿Aceptas la reserva?",
    prompt:
      "Explica la liberación estimada, si el pedido se cruza y qué supuesto usaste. Luego responde: si la sesión hubiera terminado a las 10:30 a. m., ¿cambia la disponibilidad? ¿Qué dato necesitas para saberlo?",
    hints: [
      "La liberación estimada se calcula sumando el máximo del tipo de cargador a la hora de inicio de la sesión. AC = 5 h, DC = 2 h.",
      "Dibuja una línea de tiempo con tres marcas: inicio de la sesión, liberación estimada e intervalo solicitado. Compara los extremos.",
      "Ejemplo análogo: DC-999 (máximo 2 h) tiene una sesión a las 10:00, así que se libera a las 12:00. Un pedido de 11:30–12:30 se rechaza; uno de 12:00–13:00 se acepta. Aplica la misma lógica a AC-001.",
      "Si una sesión tiene una hora de fin real, esa hora manda sobre la estimación. Si no la tiene, se usa el máximo.",
    ],
  },
  {
    id: "q3",
    title: "La reserva mínima es de una hora. ¿Permitirías una reserva de 10:15 a 11:15? ¿Y de 10:17 a 11:17?",
    prompt:
      "Define qué granularidad usarías para los horarios, si aplica solo al inicio o también al fin, y qué pasa si una sesión termina a las 10:45. Aprovecha para proponer un máximo de reserva: ¿permitirías 6 horas en un AC (máximo de sesión 5 h) o 3 horas en un DC (máximo 2 h)? Justifica el impacto en rotación y uso real.",
    hints: [
      "El mínimo de una hora no implica granularidad. Son dos reglas distintas.",
      "Una granularidad de 30 minutos significa que inicio y fin caen en :00 o :30. ¿Qué pasa con un pedido que empieza a las 10:15?",
      "Distingue máximo de sesión (cuánto puede durar el uso real) de máximo de reserva (cuánto tiempo puedes bloquear el cargador). Si la reserva dura más que la sesión máxima, la última parte no se puede usar para cargar.",
      "No hay una única respuesta: elige una regla, justifícala y mantenla coherente en la implementación.",
    ],
  },
  {
    id: "q4",
    title: "La reserva que se envía al cargador por OCPP dura 10–15 minutos, pero el slot que ve el usuario dura una hora o más. ¿Son lo mismo?",
    prompt:
      "Explica la diferencia entre slot de reserva, reserva OCPP y sesión de carga. Si el usuario no llega dentro de esos 10–15 minutos, ¿qué pasa con el resto del slot? ¿Cuándo se cobra la penalidad? ¿Qué pasa si llega a los 20 minutos?",
    hints: [
      "Separa tres conceptos: el slot que ve el usuario, la ventana OCPP que se envía al cargador y la sesión real de carga.",
      "La tarifa plana no paga la energía: paga la reserva del cargador. Si el conductor no llega dentro de la ventana, se retiene como penalidad.",
      "Piensa en los estados: reservada, esperando inicio, en sesión, no-show, finalizada. ¿Cuáles afectan la disponibilidad?",
    ],
  },
  {
    id: "q5",
    title: "Escribe 6 casos de prueba y 3 supuestos que tomarías.",
    prompt:
      "Para cada caso indica entrada, resultado esperado y regla que cubre. Cubre al menos: un borde de horario, la duración mínima, un fin de sesión anticipado, un conflicto con una reserva, un cargador inexistente y un no-show. Luego enumera 3 reglas que faltan en el enunciado, ordénalas por impacto y escribe qué asumirías por defecto si el negocio no responde hoy.",
    hints: [
      "Cubre 4 categorías: bordes de horario, duración mínima, datos inválidos y conflictos.",
      "Para cada caso, escribe: datos de entrada, resultado esperado y regla que cubre.",
      "Para los supuestos, ordena por impacto: ¿cuál, si queda mal, afecta más al negocio? Escribe también cómo lo validarías.",
    ],
  },
  {
    id: "q6",
    title: "Extra: revisa este fragmento antes de confiar en la IA",
    prompt:
      "El siguiente código pretende detectar si una reserva se cruza con una sesión. ¿Qué casos falla? Escribe uno que lo demuestre y corrige la condición. No hace falta implementarlo; explica el razonamiento.",
    code: `function conflictsWithSession(
  reservationStart: Date,
  reservationEnd: Date,
  sessionStart: Date,
  sessionEnd: Date,
) {
  return reservationStart >= sessionStart && reservationStart < sessionEnd;
}`,
    hints: [
      "Prueba tres casos: una reserva antes de la sesión, una que empieza justo al terminar y una que contiene a la sesión.",
      "Revisa si la condición cubre el inicio y el fin del intervalo, no solo el inicio de la reserva.",
    ],
  },
];

function formatCop(value: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatTime(value: string, timeZone: string) {
  return new Date(value).toLocaleTimeString("es-CO", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  });
}

export default function Home() {
  return (
    <>
      <header className="topbar">
        <div className="shell topbar-inner">
          <div className="brand"><span className="brand-mark">↯</span> Electromovilidad · Aplicativos</div>
          <span className="top-note">Entorno local de evaluación · Datos ficticios</span>
        </div>
      </header>
      <main className="shell main">
        <section className="hero">
          <div>
            <p className="eyebrow">Prueba técnica · Full-stack</p>
            <h1>Reservas para estaciones de carga</h1>
            <p>Evalúa el problema, explica tus decisiones y construye una solución pequeña con apoyo de IA.</p>
          </div>
          <span className="phase-badge">30 min conversación · 60 min desarrollo</span>
        </section>

        <section className="section" id="preguntas">
          <div className="section-heading">
            <div><h2>Fase 1 · Análisis del caso</h2><p>Lee el caso y responde por tu cuenta. Dispones de 30 minutos; puedes volver a consultar el contexto mientras contestas.</p></div>
          </div>
          <div className="phase-one-stack">
            <details className="card scenario-disclosure" open>
              <summary>
                <span><strong>Contexto y descripción del caso</strong><small>Lee esta información antes de responder. Puedes contraerla cuando quieras.</small></span>
                <span className="disclosure-icon" aria-hidden="true">⌄</span>
              </summary>
              <div className="scenario-content">
                <div className="scenario-intro">
                  <p className="eyebrow" style={{ color: "var(--green)" }}>Situación</p>
                  <p>La empresa utiliza SAP Business One para sus procesos y el equipo de Aplicativos desarrolla herramientas propias e integraciones. Una de ellas es una aplicación de electrolineras que consulta a un proveedor externo para conocer el estado de las estaciones y sus sesiones de carga.</p>
                  <p>Se quiere permitir que los conductores reserven un cargador desde la web. Tu tarea en esta fase es analizar el problema, explicar cómo lo abordarías y señalar las decisiones que habría que aclarar antes de construirlo.</p>
                </div>
                <div className="scenario-grid">
                  <div className="scenario-rule">
                    <h3>Reglas dadas</h3>
                    <ul>
                      <li>Cada localidad tiene su propio horario, zonas y cargadores. La fecha de demostración es fija: {stations.demoDate}.</li>
                      <li>La reserva mínima es de una hora. Los intervalos son <code className="code">[inicio, fin)</code>: dos reservas consecutivas no se cruzan.</li>
                      <li>Una sesión activa tiene una duración máxima estimada de 5 horas en AC y 2 horas en DC. La sesión real puede terminar antes y no necesariamente dura el máximo.</li>
                      <li>La tarifa plana es COP 20.000 para AC y COP 22.000 para DC. Se devuelve si el conductor asiste; si no, se retiene como penalidad.</li>
                      <li>La ventana de reserva que se envía al cargador por OCPP es de 10–15 minutos. En este ejercicio se usan {stations.reservationGraceMinutes} minutos y no se implementa OCPP.</li>
                    </ul>
                  </div>
                  <div className="scenario-rule example-rule">
                    <h3>Datos de ejemplo</h3>
                    <ul>
                      <li>AC-001 tiene una sesión iniciada el 12 de marzo de 2030 a las 8:00 a. m.</li>
                      <li>DC-003 tiene una sesión iniciada a las 11:30 a. m.</li>
                      <li>AC-004 tuvo una sesión de 9:00 a 10:30 a. m.; ya terminó.</li>
                      <li>AC-002 ya tiene una reserva de 2:00 p. m. a 3:00 p. m.</li>
                    </ul>
                  </div>
                </div>
                <div className="scenario-grid">
                  <div className="scenario-rule">
                    <h3>Conceptos que debes distinguir</h3>
                    <ul>
                      <li><strong>Reserva (slot):</strong> bloque futuro que aparta el usuario. Dura una hora o más.</li>
                      <li><strong>Ventana OCPP:</strong> instrucción de 10–15 minutos al cargador para iniciar. No es el slot completo.</li>
                      <li><strong>Sesión:</strong> uso real del cargador. Puede durar menos que el máximo y terminar antes de la reserva.</li>
                    </ul>
                  </div>
                  <div className="scenario-rule">
                    <h3>Qué esperamos de la fase 1</h3>
                    <ul>
                      <li>Que expliques el razonamiento, no solo el resultado.</li>
                      <li>Que detectes reglas que no están definidas y propongas un supuesto.</li>
                      <li>Que distingas reserva, ventana OCPP y sesión.</li>
                      <li>Que priorices lo que preguntarías al negocio.</li>
                    </ul>
                  </div>
                </div>
                <details className="hierarchy-disclosure">
                  <summary>
                    <span><strong>Referencia: jerarquía de los equipos de carga</strong><small>Abre para entender la relación entre las entidades.</small></span>
                    <span className="disclosure-icon" aria-hidden="true">⌄</span>
                  </summary>
                  <div className="hierarchy-content">
                    <div className="hierarchy-flow" aria-label="Localidad contiene zonas, las zonas contienen puntos de carga, los puntos contienen EVSE y los EVSE contienen conectores">
                      <div className="hierarchy-node"><strong>Localidad</strong><span>Sitio que aparece en el mapa</span></div>
                      <span className="hierarchy-arrow" aria-hidden="true">→</span>
                      <div className="hierarchy-node"><strong>Zona</strong><span>Ej. sótano o nivel</span></div>
                      <span className="hierarchy-arrow" aria-hidden="true">→</span>
                      <div className="hierarchy-node"><strong>Punto de carga</strong><span>Ubicación dentro de la zona</span></div>
                      <span className="hierarchy-arrow" aria-hidden="true">→</span>
                      <div className="hierarchy-node"><strong>EVSE</strong><span>Equipo que suministra energía</span></div>
                      <span className="hierarchy-arrow" aria-hidden="true">→</span>
                      <div className="hierarchy-node"><strong>Conector</strong><span>Enchufe o cable para el vehículo</span></div>
                    </div>
                    <p className="hierarchy-note"><strong>Para conversar:</strong> en un sistema real, la unidad reservable depende de cómo esté construido el equipo: varios conectores de un mismo EVSE no necesariamente pueden cargar vehículos distintos al mismo tiempo. Conviene confirmar con el proveedor qué identificador representa la sesión y qué recurso debe bloquearse.</p>
                    <p className="hierarchy-scope"><strong>Alcance de esta prueba:</strong> el JSON simplifica la jerarquía a localidad → zona → cargador. Cada cargador del ejercicio se trata como la unidad reservable y puede tener una sesión asociada; no necesitas implementar puntos de carga, EVSE ni conectores.</p>
                  </div>
                </details>
                <details className="reference-disclosure">
                  <summary>
                    <span><strong>Glosario del dominio</strong><small>Abre si necesitas precisión sobre los términos.</small></span>
                    <span className="disclosure-icon" aria-hidden="true">⌄</span>
                  </summary>
                  <div className="reference-content">
                    <div className="table-scroll">
                      <table className="glossary-table">
                        <tbody>
                          <tr><th>Localidad</th><td>Sitio físico con horario propio (ej. Electroplaza Norte).</td></tr>
                          <tr><th>Zona</th><td>Nivel o área dentro de la localidad (ej. Sótano 1).</td></tr>
                          <tr><th>Cargador</th><td>En este ejercicio, la unidad que se reserva. Simplifica la jerarquía real Localidad → Zona → Punto de carga → EVSE → Conector.</td></tr>
                          <tr><th>Reserva (slot)</th><td>Bloque de tiempo futuro que un usuario aparta para usar un cargador. Tiene inicio, fin y tarifa. Puede convertirse o no en una sesión.</td></tr>
                          <tr><th>Sesión de carga</th><td>Uso real de un cargador por un vehículo. Tiene hora de inicio y puede tener hora de fin real. Es lo que está pasando ahora, no una reserva futura.</td></tr>
                          <tr><th>Liberación estimada</th><td>Hora en la que se espera que termine la sesión activa: inicio + máximo del tipo (AC 5 h, DC 2 h). Es una estimación; la sesión real puede terminar antes.</td></tr>
                          <tr><th>Máximo de sesión</th><td>Tope de duración de una sesión de carga. AC 5 h, DC 2 h. No es una duración garantizada.</td></tr>
                          <tr><th>Máximo de reserva</th><td>Tope de duración de una reserva. No está definido en el enunciado; es una decisión que debes proponer.</td></tr>
                          <tr><th>Granularidad</th><td>Tamaño del paso de la grilla horaria. No está definida; es una decisión que debes proponer. El mínimo de una hora no implica granularidad.</td></tr>
                          <tr><th>Ventana de gracia (OCPP)</th><td>Los 10–15 minutos desde el inicio del slot para que el usuario inicie la sesión. Si no llega, se marca no-show y se retiene la tarifa.</td></tr>
                          <tr><th>No-show</th><td>Reserva que el conductor no usa dentro de la ventana de gracia. En este ejercicio no se implementa el flujo, pero es una decisión de negocio.</td></tr>
                          <tr><th>Conflicto / solape</th><td>Dos intervalos comparten algún instante. Se usa <code className="code">[inicio, fin)</code>: si uno termina justo cuando empieza el otro, no hay conflicto.</td></tr>
                          <tr><th>Tarifa plana</th><td>Monto fijo por reserva (AC COP 20.000, DC COP 22.000). No paga la energía: paga la reserva del cargador.</td></tr>
                          <tr><th>Fecha de demostración</th><td>{stations.demoDate}. Es la fecha fija de los datos; no hace falta un selector de fecha.</td></tr>
                          <tr><th>Unidad reservable</th><td>En este ejercicio, el cargador. En el sistema real hay que confirmar si es el EVSE o el conector.</td></tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </details>
                <details className="reference-disclosure" open>
                  <summary>
                    <span><strong>Qué está definido y qué debes decidir</strong><small>No todas las reglas están cerradas. Detectarlas y proponer un supuesto también es parte del ejercicio.</small></span>
                    <span className="disclosure-icon" aria-hidden="true">⌄</span>
                  </summary>
                  <div className="reference-content">
                    <div className="table-scroll">
                      <table className="decisions-table">
                        <thead>
                          <tr><th>Tema</th><th>Estado</th><th>Qué se espera</th></tr>
                        </thead>
                        <tbody>
                          <tr><td>Horarios por localidad</td><td><span className="tag tag-given">Dado</span></td><td>Aplicarlos.</td></tr>
                          <tr><td>Máximo de sesión AC/DC</td><td><span className="tag tag-given">Dado</span></td><td>Usarlo para estimar la liberación o para liberar antes si hay fin real.</td></tr>
                          <tr><td>Duración mínima de 1 h</td><td><span className="tag tag-given">Dado</span></td><td>Validarla.</td></tr>
                          <tr><td>Tarifa plana</td><td><span className="tag tag-given">Dado</span></td><td>Registrarla.</td></tr>
                          <tr><td>Intervalos <code className="code">[inicio, fin)</code></td><td><span className="tag tag-given">Dado</span></td><td>Usarlos.</td></tr>
                          <tr><td>Fecha de demostración</td><td><span className="tag tag-given">Dado</span></td><td>No agregar selector de fecha.</td></tr>
                          <tr><td>Máximo de reserva</td><td><span className="tag tag-open">Abierto</span></td><td>Detectarlo y proponer una regla justificada.</td></tr>
                          <tr><td>Granularidad de horarios</td><td><span className="tag tag-open">Abierto</span></td><td>Definir si se permite :15, :17 o solo :00/:30; si aplica al inicio, al fin o a ambos.</td></tr>
                          <tr><td>Sesión que termina antes</td><td><span className="tag tag-open">Abierto</span></td><td>Proponer si libera el cargador en la hora real de fin y cómo se entera el sistema.</td></tr>
                          <tr><td>No-show / ventana OCPP</td><td><span className="tag tag-open">Abierto</span></td><td>Proponer qué pasa con el resto del slot y cuándo se cobra la penalidad.</td></tr>
                          <tr><td>Sesión sin reserva / reserva sin sesión</td><td><span className="tag tag-open">Abierto</span></td><td>Detectarlo y proponer cómo se vinculan.</td></tr>
                          <tr><td>Concurrencia</td><td><span className="tag tag-open">Abierto</span></td><td>Mencionarla; no es requisito implementarla.</td></tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </details>
                <div className="scenario-tip"><strong>Qué esperamos:</strong> responde con tu razonamiento, indica los supuestos que hagas y menciona qué información o reglas confirmarías con el negocio. No necesitas programar durante esta fase y no hay una única respuesta correcta. Las pistas son opcionales y se registran para entender tu proceso.</div>
              </div>
            </details>
            <InterviewAnswers questions={questions} />
          </div>
        </section>

        <section className="section" id="datos">
          <div className="section-heading">
            <div><h2>Datos ficticios del ejercicio</h2><p>Fecha de demostración: {stations.demoDate} · Mínimo {stations.minReservationMinutes} min · Ventana de gracia {stations.reservationGraceMinutes} min · Zona horaria local de Colombia</p></div>
          </div>
          <div className="locations-grid">
            {stations.locations.map((location) => (
              <article className="card location-card" key={location.id}>
                <div className="location-title">
                  <div><h3>{location.name}</h3><p>{location.city} · {location.timeZone}</p></div>
                  <span className="hours">{location.openingTime}–{location.closingTime}</span>
                </div>
                {location.zones.map((zone) => (
                  <div className="zone" key={zone.id}>
                    <p className="zone-name">{zone.name}</p>
                    {zone.chargers.map((charger) => {
                      const session = charger.session;
                      const isActive = session?.status === "active";
                      const isEnded = session?.status === "ended";
                      const startedAt = session ? formatTime(session.startedAt, location.timeZone) : null;
                      const endedAt = session?.endedAt ? formatTime(session.endedAt, location.timeZone) : null;
                      const statusLabel = isActive ? "Sesión activa" : isEnded ? "Sesión finalizada" : "Disponible";
                      const statusClass = isActive ? " busy" : isEnded ? " ended" : "";
                      return (
                        <div className="charger-row" key={charger.id}>
                          <div><span className="charger-name">{charger.name}</span><span className="charger-meta"> · {charger.type} · {formatCop(charger.flatRateCop)}</span></div>
                          <span className={`status${statusClass}`}>{statusLabel}</span>
                          {isActive && startedAt && (
                            <div className="session-note">Inicio {startedAt} · máximo {charger.maxSessionHours} h</div>
                          )}
                          {isEnded && startedAt && endedAt && (
                            <div className="session-note ended-note">Sesión {startedAt}–{endedAt} · libre desde {endedAt}</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
                {location.id === "loc-bogota-norte" && (
                  <div className="reservation-row"><strong>Reserva existente:</strong> AC-002 · 14:00–15:00 · 12 mar 2030</div>
                )}
              </article>
            ))}
          </div>
        </section>

        <section className="section" id="desarrollo">
          <div className="section-heading">
            <div><h2>Fase 2 · Desarrollo con IA</h2><p>El repo ya está configurado y los datos de prueba están en archivos JSON.</p></div>
          </div>
          <div className="task-grid">
            <article className="card task-card">
              <h3>Tu objetivo</h3>
              <p>Construye una pantalla para crear una reserva y el endpoint <code className="code">POST /api/reservations</code>.</p>
              <ul>
                <li>Muestra los slots del cargador según la granularidad que definas (por defecto, 30 minutos) y deshabilita los que se cruzan con reservas confirmadas o sesiones activas.</li>
                <li>La reserva debe durar al menos una hora, estar dentro del horario local y no cruzarse con otra reserva ni con una sesión activa.</li>
                <li>Para una sesión activa sin fin real, bloquea hasta su liberación estimada (AC 5 h, DC 2 h). Si la sesión ya terminó, libera desde su hora de fin.</li>
                <li>El cobro es plano: AC {formatCop(20000)} y DC {formatCop(22000)}.</li>
                <li>El endpoint opcional <code className="code">GET /api/reservations?userId=...</code> es un extra.</li>
              </ul>
              <p>No implementes autenticación, pasarela de pago, OCPP ni integración con SAP. Puedes usar IA; revisa y prueba lo que genere.</p>
              <Link className="button" href="/reservas">Abrir espacio de desarrollo →</Link>
            </article>
            <article className="card task-card">
              <h3>Alcance y supuestos</h3>
              <ul>
                <li>Usa la fecha de demostración del JSON. La fecha es fija; no agregues selector.</li>
                <li>Trata los intervalos como <code className="code">[inicio, fin)</code>: dos reservas consecutivas no se cruzan y una reserva puede empezar justo cuando termina una sesión.</li>
                <li>Si no defines otra granularidad, usa bloques de 30 minutos, con inicio y fin alineados.</li>
                <li>Si no defines otro máximo, usa el máximo de sesión del tipo como máximo de reserva (AC 5 h, DC 2 h).</li>
                <li>Las reservas creadas se guardan en <code className="code">data/reservations.json</code>.</li>
                <li>El no-show y la ventana OCPP no se implementan; explica en <code className="code">NOTES.md</code> cómo los modelarías.</li>
              </ul>
              <p>Al final, documenta en <code className="code">NOTES.md</code> un supuesto que tomaste, un bug que encontraste en el código generado y una prueba que añadirías con más tiempo.</p>
            </article>
          </div>
        </section>
        <p className="footer-note">Los datos de este proyecto son ficticios y solo deben usarse en el entorno local.</p>
      </main>
    </>
  );
}
