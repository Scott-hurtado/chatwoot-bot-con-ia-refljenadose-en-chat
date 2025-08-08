import dotenv from 'dotenv'
import { GoogleGenerativeAI } from '@google/generative-ai'

// Cargar variables de entorno
dotenv.config()

// Inicializar el modelo de inteligencia artificial con la clave API
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

// Función para generar una respuesta basada en el texto del usuario
export async function chat(prompt: string = "", text: string, maxRetries: number = 3): Promise<string> {
    let lastError: Error | null = null
    
    // Intentar múltiples veces con backoff exponencial
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            const model = genAI.getGenerativeModel({ 
                model: "gemini-1.5-flash",
                generationConfig: {
                    temperature: 0.3,
                    maxOutputTokens: 1024,
                }
            })
            
            // Prompt base especializado en vacantes y orientación estudiantil
            const baseContext = `Eres un asistente especializado en ayudar a estudiantes universitarios a encontrar oportunidades de servicio social y prácticas profesionales. Tu objetivo es:

1. Ayudar a estudiantes a encontrar las mejores oportunidades según su carrera y preferencias
2. Orientar sobre el proceso de servicio social y prácticas profesionales
3. Proporcionar consejos para aplicar a vacantes
4. Responder dudas sobre requisitos, modalidades y beneficios
5. Motivar y apoyar a los estudiantes en su búsqueda

CAPACIDADES ESPECIALES:
Tengo acceso a una base de datos actualizada de vacantes. Los estudiantes pueden usar estos comandos:
- "buscar prácticas" o "buscar servicio social" - Para iniciar búsqueda personalizada
- "vacantes de [carrera]" - Ver vacantes de una carrera específica
- "vacantes en [ciudad]" - Ver oportunidades por ubicación
- "vacantes remotas" - Ver solo opciones remotas
- "todas las vacantes" - Ver lista general

INFORMACIÓN IMPORTANTE:
- Servicio Social: Requisito obligatorio, generalmente 480 horas, sin remuneración
- Prácticas Profesionales: Experiencia laboral, puede ser remunerada, duración variable
- Modalidades: Presencial, Remoto, Híbrido, Tiempo Completo, Medio Tiempo

Instrucciones de comportamiento:
- Sé amigable, motivador y empático con los estudiantes
- Entiende que buscar prácticas puede ser estresante
- Ofrece consejos prácticos para destacar en procesos de selección
- Si detectas ansiedad o preocupación, tranquiliza al estudiante
- Sugiere usar los comandos de búsqueda cuando sea relevante
- Comparte tips sobre CV, entrevistas y desarrollo profesional cuando sea apropiado
- Si directo con al responder al usuario, no lo llenes de texto sin sentido y sin qu el usuario lo haya pedido

CONTEXTO ACTUAL: Estamos en ${new Date().toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })}, época importante para buscar oportunidades del siguiente semestre.

`
            
            const formatPrompt = baseContext + (prompt ? '\n\nContexto adicional: ' + prompt + '\n\n' : '\n\n') + 'Usuario: ' + text
            
            const result = await model.generateContent(formatPrompt)
            
            const response = result.response
            
            // Verificar si hay una respuesta válida
            if (response && response.text) {
                const answer = response.text()
                
                // Validar que la respuesta sea apropiada
                if (validateResponse(answer)) {
                    return answer.trim()
                } else {
                    return "Disculpa, no pude generar una respuesta adecuada. ¿Podrías reformular tu pregunta? También puedes escribir 'buscar prácticas' para ver oportunidades disponibles."
                }
            } else {
                return "Lo siento, hubo un problema al procesar tu solicitud. ¿Qué tipo de vacante estás buscando?"
            }
        
        } catch (error) {
            lastError = error as Error
            console.error(`Error en Gemini (intento ${attempt + 1}/${maxRetries}):`, error)
            
            // Si es error de sobrecarga y no es el último intento, reintentar
            if (error instanceof Error && 
                (error.message.includes('503') || error.message.includes('overloaded')) && 
                attempt < maxRetries - 1) {
                const waitTime = Math.pow(2, attempt) * 1000
                console.log(`Esperando ${waitTime}ms antes de reintentar...`)
                await new Promise(resolve => setTimeout(resolve, waitTime))
                continue
            }
            
            break
        }
    }
    
    // Si llegamos aquí, todos los intentos fallaron
    console.error('Error en Gemini después de todos los reintentos:', lastError)
    
    // Respuestas de fallback específicas para el contexto de vacantes
    if (lastError instanceof Error) {
        if (lastError.message.includes('API key')) {
            return "Error de configuración. Por favor verifica la API key de Gemini."
        } else if (lastError.message.includes('quota') || lastError.message.includes('limit')) {
            return "El servicio alcanzó su límite. Mientras tanto, puedo mostrarte las vacantes disponibles:\n\n" +
                   "• Escribe 'buscar prácticas' para comenzar\n" +
                   "• O dime tu carrera para ver opciones específicas"
        } else if (lastError.message.includes('503') || lastError.message.includes('overloaded')) {
            return "El asistente de IA está temporalmente ocupado. ¡Pero aún puedo ayudarte!\n\n" +
                   "🔍 Prueba estos comandos:\n" +
                   "• 'buscar prácticas' - Encontrar oportunidades\n" +
                   "• 'vacantes de [tu carrera]' - Ver por carrera\n" +
                   "• 'vacantes remotas' - Solo opciones remotas\n" +
                   "• 'ayuda' - Ver todas las opciones"
        }
    }
    
    return "Hubo un problema técnico, pero puedo ayudarte a encontrar vacantes. " +
           "Escribe 'buscar prácticas' o dime qué carrera estudias para comenzar."
}

// Función para validar respuestas
function validateResponse(response: string): boolean {
    if (!response || response.trim().length < 5) {
        return false
    }
    
    const errorIndicators = [
        'undefined', 
        'null', 
        'error:', 
        '[object Object]',
        'NaN',
        'TypeError',
        'ReferenceError'
    ]
    
    const lowerResponse = response.toLowerCase()
    return !errorIndicators.some(indicator => 
        lowerResponse.includes(indicator.toLowerCase())
    )
}

// Función para generar consejos personalizados según la carrera
export async function getCareerAdvice(carrera: string): Promise<string> {
    const advicePrompt = `
    Da 3 consejos breves y específicos para un estudiante de ${carrera} que busca prácticas profesionales o servicio social.
    Los consejos deben ser prácticos, motivadores y relevantes para esa carrera específica.
    Formato: Lista numerada, máximo 2 líneas por consejo.
    `
    
    try {
        const response = await chat(advicePrompt, `Consejos para estudiante de ${carrera}`)
        return response
    } catch (error) {
        // Consejos genéricos de fallback
        return `💡 Consejos para tu búsqueda:\n\n` +
               `1. Actualiza tu CV destacando proyectos relevantes de tu carrera\n` +
               `2. Prepara un portafolio con tus mejores trabajos académicos\n` +
               `3. Practica entrevistas y prepara preguntas sobre la empresa`
    }
}

// Función para generar mensaje motivacional
export function getMotivationalMessage(): string {
    const messages = [
        "¡Ánimo! Cada aplicación es un paso más cerca de tu oportunidad ideal 🌟",
        "Recuerda: las prácticas son el puente entre la universidad y tu carrera profesional 🌉",
        "¡Tú puedes! El servicio social es una gran oportunidad para aprender y crecer 💪",
        "No te desanimes, la vacante perfecta para ti está esperándote 🎯",
        "Cada experiencia cuenta. ¡Sigue adelante! 🚀"
    ]
    
    return messages[Math.floor(Math.random() * messages.length)]
}