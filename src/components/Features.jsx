import { useLang } from '../i18n'

const DATA = {
  en: [
    {
      section: 'Plan',
      icon: '📋',
      accent: '#3b82f6',
      items: [
        { icon: '💪', name: 'Workout builder', desc: 'Create plans with exercises, sets, and target reps or time per set.' },
        { icon: '⏱', name: 'Per-exercise rest time', desc: 'Set a custom rest period on each exercise — the timer starts automatically when you tick a set.' },
        { icon: '🏋', name: 'Plate calculator', desc: 'Enter a target weight and see exactly which plates to load on each side of the bar. Tap "Plates" in the Plan toolbar.' },
        { icon: '🔍', name: 'Exercise autocomplete', desc: 'Start typing an exercise name and get suggestions from the wger database with muscle category pre-filled.' },
      ],
    },
    {
      section: 'Log',
      icon: '🏃',
      accent: '#22c55e',
      items: [
        { icon: '⏱', name: 'Live session timer', desc: 'Tracks elapsed time from the moment you start.' },
        { icon: '🔔', name: 'Auto rest timer + notification', desc: 'Countdown begins when you tick a set done. Beeps on completion and sends a phone notification even with the screen off.' },
        { icon: '🏆', name: 'Personal record detector', desc: 'Flags a PR in real time when the weight you log beats your all-time best for that exercise.' },
        { icon: '≈', name: '1RM estimator', desc: 'Shows an estimated one-rep max (Epley formula) next to every completed set.' },
        { icon: '↩', name: '"Last time" hints', desc: 'Displays your best sets from the previous session for each exercise so you know what to beat.' },
        { icon: '💡', name: 'Progressive overload', desc: 'Last-session data is shown for every exercise so you can aim to add weight or reps each time.' },
        { icon: '🔆', name: 'Screen wake lock', desc: 'Keeps your phone screen on during the session so the timer keeps running.' },
        { icon: '↗', name: 'Background session', desc: 'Switch to any other tab freely — the timer and rest countdown keep running in the background.' },
      ],
    },
    {
      section: 'History',
      icon: '📅',
      accent: '#f59e0b',
      items: [
        { icon: '📊', name: 'Session log', desc: 'All past workouts with total sets, volume (kg), and duration. Tap a card to expand the full set-by-set breakdown.' },
        { icon: '📥', name: 'CSV export', desc: 'Download your full workout history as a spreadsheet — one row per set, ready for Excel or Google Sheets.' },
      ],
    },
    {
      section: 'Exercises',
      icon: '📚',
      accent: '#8b5cf6',
      items: [
        { icon: '🔎', name: '800+ exercise library', desc: 'Browse the wger database with descriptions, images, and muscle category filters.' },
        { icon: '➕', name: 'Add to plan', desc: 'Tap "Add to plan" on any exercise to insert it directly into your current workout.' },
      ],
    },
    {
      section: 'Nutrition',
      icon: '🥗',
      accent: '#10b981',
      items: [
        { icon: '🍽', name: 'Daily food log', desc: 'Log breakfast, lunch, dinner, and snacks. Macro totals update in real time against your daily goal.' },
        { icon: '🧮', name: 'TDEE calculator', desc: 'Enter your stats to compute maintenance calories, then pick a goal: bulk, light deficit, or aggressive cut.' },
        { icon: '📷', name: 'AI label scanner', desc: 'Point your camera at a nutrition label and macros auto-fill using Google Gemini. Works from gallery too.' },
        { icon: '★', name: 'Saved ingredients', desc: 'Star any ingredient to save its macros per 100 g. Reload it in one tap on any future meal.' },
        { icon: '📄', name: 'Diet plans', desc: 'Save full-day meal templates (e.g. "Bulk day", "Rest day") and reuse them anytime.' },
        { icon: 'ℹ', name: 'Per-100 g macros', desc: 'Enter macros per 100 g once — actual amounts auto-calculate from the grams you specify per ingredient.' },
      ],
    },
    {
      section: 'Progress',
      icon: '📈',
      accent: '#f43f5e',
      items: [
        { icon: '📉', name: 'Exercise progress chart', desc: 'Select any exercise and see a line graph of your best weight per session over time.' },
        { icon: '⚖', name: 'Body weight log', desc: 'Log your weight daily (kg or lbs) and track the trend with a chart.' },
        { icon: '💪', name: 'Weekly muscle volume', desc: 'Bar chart showing total working sets per muscle group in the last 7 days.' },
        { icon: '≈', name: 'Estimated 1RM history', desc: 'The exercise chart uses Epley\'s formula so you can track strength gains even across different rep ranges.' },
      ],
    },
  ],
  es: [
    {
      section: 'Plan',
      icon: '📋',
      accent: '#3b82f6',
      items: [
        { icon: '💪', name: 'Constructor de entrenamientos', desc: 'Crea planes con ejercicios, series y reps o tiempo objetivo por serie.' },
        { icon: '⏱', name: 'Tiempo de descanso por ejercicio', desc: 'Define un descanso personalizado en cada ejercicio — el temporizador arranca solo al marcar una serie.' },
        { icon: '🏋', name: 'Calculadora de discos', desc: 'Introduce un peso objetivo y ve exactamente qué discos cargar en cada lado de la barra. Pulsa "Discos" en la barra de herramientas.' },
        { icon: '🔍', name: 'Autocompletado de ejercicios', desc: 'Empieza a escribir y obtén sugerencias de la base de datos wger con la categoría muscular ya rellena.' },
      ],
    },
    {
      section: 'Registro',
      icon: '🏃',
      accent: '#22c55e',
      items: [
        { icon: '⏱', name: 'Temporizador de sesión en vivo', desc: 'Registra el tiempo transcurrido desde el momento en que empiezas.' },
        { icon: '🔔', name: 'Temporizador de descanso + notificación', desc: 'La cuenta atrás empieza al marcar una serie. Suena al terminar y envía una notificación al móvil aunque la pantalla esté apagada.' },
        { icon: '🏆', name: 'Detector de récords personales', desc: 'Marca un RP en tiempo real cuando el peso que registras supera tu máximo histórico.' },
        { icon: '≈', name: 'Estimador de 1RM', desc: 'Muestra el máximo estimado de una repetición (fórmula de Epley) junto a cada serie completada.' },
        { icon: '↩', name: 'Pistas de "última vez"', desc: 'Muestra tus mejores series de la sesión anterior para saber qué superar.' },
        { icon: '💡', name: 'Sobrecarga progresiva', desc: 'Los datos de la última sesión aparecen en cada ejercicio para ayudarte a añadir peso o repeticiones.' },
        { icon: '🔆', name: 'Wake lock de pantalla', desc: 'Mantiene la pantalla del móvil encendida para que el temporizador no se interrumpa.' },
        { icon: '↗', name: 'Sesión en segundo plano', desc: 'Cambia de pestaña libremente — el temporizador y el descanso siguen corriendo.' },
      ],
    },
    {
      section: 'Historial',
      icon: '📅',
      accent: '#f59e0b',
      items: [
        { icon: '📊', name: 'Registro de sesiones', desc: 'Todos los entrenamientos pasados con series totales, volumen (kg) y duración. Toca una tarjeta para ver el desglose completo.' },
        { icon: '📥', name: 'Exportar a CSV', desc: 'Descarga todo tu historial como hoja de cálculo — una fila por serie, lista para Excel o Google Sheets.' },
      ],
    },
    {
      section: 'Ejercicios',
      icon: '📚',
      accent: '#8b5cf6',
      items: [
        { icon: '🔎', name: 'Biblioteca de 800+ ejercicios', desc: 'Navega la base de datos wger con descripciones, imágenes y filtros por categoría muscular.' },
        { icon: '➕', name: 'Añadir al plan', desc: 'Toca "Añadir al plan" en cualquier ejercicio para insertarlo directamente en tu entrenamiento.' },
      ],
    },
    {
      section: 'Nutrición',
      icon: '🥗',
      accent: '#10b981',
      items: [
        { icon: '🍽', name: 'Registro diario de alimentos', desc: 'Registra desayuno, almuerzo, cena y otros. Los totales de macros se actualizan en tiempo real frente a tu objetivo.' },
        { icon: '🧮', name: 'Calculadora TDEE', desc: 'Introduce tus datos para calcular las calorías de mantenimiento y elige un objetivo: volumen, déficit ligero o agresivo.' },
        { icon: '📷', name: 'Escáner de etiquetas con IA', desc: 'Apunta la cámara a una etiqueta nutricional y los macros se rellenan solos con Google Gemini.' },
        { icon: '★', name: 'Ingredientes guardados', desc: 'Marca cualquier ingrediente para guardar sus macros por 100 g. Recárgalo con un toque en cualquier comida.' },
        { icon: '📄', name: 'Planes de dieta', desc: 'Guarda plantillas de días completos ("Día de volumen", "Día de descanso") y reutilízalas cuando quieras.' },
        { icon: 'ℹ', name: 'Macros por 100 g', desc: 'Introduce los macros por 100 g una sola vez — las cantidades reales se calculan según los gramos que especifiques.' },
      ],
    },
    {
      section: 'Progreso',
      icon: '📈',
      accent: '#f43f5e',
      items: [
        { icon: '📉', name: 'Gráfico de progreso por ejercicio', desc: 'Selecciona cualquier ejercicio y ve un gráfico lineal del mejor peso por sesión a lo largo del tiempo.' },
        { icon: '⚖', name: 'Registro de peso corporal', desc: 'Registra tu peso diariamente (kg o lbs) y sigue la tendencia con un gráfico.' },
        { icon: '💪', name: 'Volumen muscular semanal', desc: 'Gráfico de barras con las series totales por grupo muscular en los últimos 7 días.' },
        { icon: '≈', name: 'Historial de 1RM estimado', desc: 'El gráfico usa la fórmula de Epley para seguir las ganancias de fuerza aunque cambies el rango de repeticiones.' },
      ],
    },
  ],
}

export default function Features() {
  const { lang } = useLang()
  const sections = DATA[lang] || DATA.en

  return (
    <div className="features-page">
      {sections.map(sec => (
        <div key={sec.section} className="features-section">
          <div className="features-section-header" style={{ borderLeftColor: sec.accent }}>
            <span className="features-section-icon">{sec.icon}</span>
            <span className="features-section-title">{sec.section}</span>
          </div>
          <div className="features-grid">
            {sec.items.map(item => (
              <div key={item.name} className="feature-card">
                <span className="feature-card-icon">{item.icon}</span>
                <div>
                  <div className="feature-card-name">{item.name}</div>
                  <div className="feature-card-desc">{item.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
