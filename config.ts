// Configuración del bot de vacantes

export const BOT_CONFIG = {
    // Configuración de Gemini
    gemini: {
        model: "gemini-1.5-flash",
        temperature: 0.3,
        maxOutputTokens: 1024,
        maxRetries: 3,
        retryDelayBase: 1000,
    },
    
    // Límites de visualización
    display: {
        maxVacantesDetalle: 3,      // Máximo de vacantes a mostrar con detalle completo
        maxVacantesResumen: 10,     // Máximo de vacantes a mostrar en resumen
        maxEstadisticasTop: 3,      // Top N en estadísticas
    },
    
    // Configuración de base de datos
    database: {
        queryTimeout: 5000,
        maxResults: 20,
    }
}

// Mensajes del bot organizados por categoría
export const MESSAGES = {
    welcome: {
        greeting: '👋 ¡Hola! Soy tu asistente para encontrar prácticas profesionales y servicio social. ¿En qué puedo ayudarte hoy?',
        options: 'Puedes escribir:\n• "buscar prácticas" para comenzar\n• Tu carrera para ver vacantes disponibles\n• "ayuda" para ver todas las opciones'
    },
    
    search: {
        askCareer: '🎓 ¿Qué carrera estudias?',
        askLocation: '📍 ¿En qué ciudad prefieres? (o escribe "cualquiera" para ver todas)',
        askModality: '💼 ¿Qué modalidad prefieres?\n\n1️ Presencial\n2️⃣ Remoto\n3️⃣ Híbrido\n4️⃣ Cualquiera',
        searching: '🔍 Buscando oportunidades perfectas para ti...',
        noResults: '❌ No encontré vacantes con esos criterios.\n\nIntenta con otros filtros o escribe "todas las vacantes" para ver opciones disponibles.',
        foundVacancies: (count: number) => `✅ ¡Encontré ${count} oportunidades para ti!`,
        moreVacancies: (count: number) => `📌 Hay ${count} vacantes más que cumplen tus criterios.`,
    },
    
    errors: {
        database: '❌ Error al acceder a la base de datos. Intenta de nuevo.',
        general: '❌ Ocurrió un error. Por favor intenta de nuevo.',
        invalidInput: '❓ No entendí tu respuesta. Por favor intenta de nuevo.',
        geminiDown: 'El asistente de IA está temporalmente ocupado. ¡Pero aún puedo ayudarte!',
    },
    
    tips: {
        filterByCareer: '💡 Tip: Puedes filtrar por carrera agregándola a tu búsqueda.',
        trySearch: '💡 Para ver detalles de vacantes de tu carrera, escribe "vacantes de [tu carrera]"',
        refineSearch: '💡 Puedes refinar tu búsqueda agregando ubicación o modalidad.',
    },
    
    motivational: [
        "¡Ánimo! Cada aplicación es un paso más cerca de tu oportunidad ideal 🌟",
        "Recuerda: las prácticas son el puente entre la universidad y tu carrera profesional 🌉",
        "¡Tú puedes! El servicio social es una gran oportunidad para aprender y crecer 💪",
        "No te desanimes, la vacante perfecta para ti está esperándote 🎯",
        "Cada experiencia cuenta. ¡Sigue adelante! 🚀",
        "El éxito está en persistir. ¡Tu oportunidad llegará! ⭐",
        "Las mejores oportunidades llegan a quienes las buscan activamente 🔍",
    ]
}

// Palabras clave para detección de intenciones
export const INTENT_PATTERNS = {
    searchInteractive: [
        'buscar prácticas', 'busco prácticas', 'quiero prácticas',
        'buscar servicio social', 'busco servicio social', 'quiero servicio social',
        'necesito prácticas', 'necesito servicio', 'buscar vacantes',
        'quiero hacer prácticas', 'quiero hacer servicio'
    ],
    
    searchByCareer: [
        'vacantes de', 'prácticas de', 'servicio social de',
        'oportunidades de', 'vacantes para', 'prácticas en'
    ],
    
    searchByModality: [
        'vacantes remotas', 'prácticas remotas', 'trabajo remoto',
        'vacantes presenciales', 'medio tiempo', 'tiempo completo',
        'modalidad híbrida', 'modalidad hibrida'
    ],
    
    searchByLocation: [
        'vacantes en', 'prácticas en', 'oportunidades en',
        'servicio social en'
    ],
    
    listAll: [
        'todas las vacantes', 'ver vacantes', 'mostrar vacantes',
        'listar vacantes', 'qué vacantes hay'
    ],
    
    help: [
        'ayuda', 'help', 'comandos', 'qué puedo hacer',
        'opciones', 'cómo funciona', 'qué puedes hacer'
    ]
}

// Carreras comunes para autocompletado/sugerencias
export const COMMON_CAREERS = [
    'Ingeniería en Sistemas',
    'Ingeniería en Software', 
    'Ingeniería Industrial',
    'Administración de Empresas',
    'Contaduría Pública',
    'Derecho',
    'Psicología',
    'Diseño Gráfico',
    'Mercadotecnia',
    'Ciencias de la Comunicación',
    'Medicina',
    'Arquitectura',
    'Ingeniería Civil',
    'Recursos Humanos',
    'Comercio Internacional'
]

// Ciudades principales
export const MAIN_CITIES = [
    'Hermosillo',
    'CDMX',
    'Guadalajara',
    'Monterrey',
    'Puebla',
    'Querétaro',
    'Tijuana',
    'León',
    'Mérida',
    'Remoto'
]

// Mapeos para mostrar al usuario
export const DISPLAY_MAPPINGS = {
    modalidad: {
        'tiempo_completo': 'Tiempo Completo ⏰',
        'medio_tiempo': 'Medio Tiempo ⏱️',
        'remoto': 'Remoto 🏠',
        'hibrido': 'Híbrido 🔄',
        'presencial': 'Presencial 🏢'
    },
    
    tipoVacante: {
        'servicio_social': 'Servicio Social 📚',
        'practicas_profesionales': 'Prácticas Profesionales 💼',
        'ambos': 'Servicio Social y Prácticas 📚💼'
    }
}

// Emojis para diferentes carreras (opcional, para hacer más visual)
export const CAREER_EMOJIS: Record<string, string> = {
    'ingeniería': '⚙️',
    'sistemas': '💻',
    'software': '👨‍💻',
    'administración': '📊',
    'contaduría': '📈',
    'derecho': '⚖️',
    'psicología': '🧠',
    'diseño': '🎨',
    'medicina': '⚕️',
    'comunicación': '📡',
    'marketing': '📱',
    'arquitectura': '🏗️',
    'default': '🎓'
}

// Función helper para obtener emoji de carrera
export function getCareerEmoji(carrera: string): string {
    const carreraLower = carrera.toLowerCase()
    for (const [key, emoji] of Object.entries(CAREER_EMOJIS)) {
        if (carreraLower.includes(key)) {
            return emoji
        }
    }
    return CAREER_EMOJIS.default
}