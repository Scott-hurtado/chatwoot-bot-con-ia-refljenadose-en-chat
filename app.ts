import { createBot, createProvider, createFlow, addKeyword, EVENTS } from '@builderbot/bot'
import { MemoryDB as Database } from '@builderbot/bot'
import { MetaProvider as Provider } from '@builderbot/provider-meta'
import { chat, getCareerAdvice, getMotivationalMessage } from './gemini'
import vacantesDB from './database'
import chatwootService from './chatwoot'
import { setupChatwootWebhook } from './webhook'
import express from 'express'
import type { VacanteFilters, Modalidad, TipoVacante } from './types'

const PORT = process.env.PORT ?? 3008

// Estado de conversación
interface ConversationState {
    currentFlow?: 'search' | 'none'
    searchType?: TipoVacante
    carrera?: string
    lugar?: string
    modalidad?: Modalidad
    step?: 'carrera' | 'lugar' | 'modalidad'
    chatwootConversationId?: number
}

// Función para detectar intención
const detectIntent = (text: string): string | null => {
    const lowerText = text.toLowerCase()
    
    if (['buscar práctica', 'busco práctica', 'quiero práctica', 'buscar servicio', 'busco servicio'].some(p => lowerText.includes(p))) {
        return 'search_flow'
    }
    
    if (lowerText.includes('vacantes de') || lowerText.includes('prácticas de')) {
        return 'direct_career'
    }
    
    if (lowerText.includes('vacantes remota') || lowerText.includes('práctica remota')) {
        return 'remote_search'
    }
    
    if (lowerText.includes('todas las vacantes') || lowerText.includes('ver vacantes')) {
        return 'list_all'
    }
    
    if (['ayuda', 'help', 'comandos'].some(h => lowerText.includes(h))) {
        return 'help'
    }
    
    return null
}

// Función helper para enviar a Chatwoot
const sendToChatwoot = async (phoneNumber: string, message: string, userName?: string) => {
    try {
        await chatwootService.processMessage(phoneNumber, message, userName)
        console.log(`📨 Mensaje enviado a Chatwoot: ${phoneNumber}`)
    } catch (error) {
        console.error('❌ Error enviando a Chatwoot:', error)
    }
}

// Flujo principal único con integración Chatwoot
const mainFlow = addKeyword<Provider, Database>(EVENTS.WELCOME)
    .addAction(async (ctx, { flowDynamic, state }) => {
        const userInput = ctx.body
        const phoneNumber = ctx.from
        const userName = ctx.pushName || ctx.from
        
        console.log(`📱 Mensaje recibido de ${userName} (${phoneNumber}): ${userInput}`)
        
        // Enviar mensaje entrante a Chatwoot
        await sendToChatwoot(phoneNumber, userInput, userName)
        
        const conversationState: ConversationState = state.getMyState() || {}
        
        // Si estamos en flujo de búsqueda, manejarlo
        if (conversationState.currentFlow === 'search') {
            await handleSearchFlow(userInput, conversationState, state, flowDynamic, phoneNumber)
            return
        }
        
        // Detectar nueva intención
        const intent = detectIntent(userInput)
        
        if (intent === 'search_flow') {
            const tipo = userInput.toLowerCase().includes('servicio') ? 'servicio_social' : 'practicas_profesionales'
            
            const newState: ConversationState = {
                currentFlow: 'search',
                searchType: tipo as TipoVacante,
                step: 'carrera'
            }
            
            await state.update(newState)
            const response = '🎓 ¿Qué carrera estudias?'
            await flowDynamic(response)
            return
        }
        
        if (intent === 'direct_career') {
            const carrera = userInput.toLowerCase()
                .replace(/vacantes de/g, '')
                .replace(/prácticas de/g, '')
                .trim()
                
            if (carrera.length > 2) {
                await searchByCareer(carrera, flowDynamic, phoneNumber)
            } else {
                const response = 'Por favor especifica la carrera. Ejemplo: "vacantes de ingeniería"'
                await flowDynamic(response)
            }
            return
        }
        
        if (intent === 'remote_search') {
            await searchByModality('remoto', flowDynamic, phoneNumber)
            return
        }
        
        if (intent === 'list_all') {
            await showAllVacancies(flowDynamic, phoneNumber)
            return
        }
        
        if (intent === 'help') {
            await showHelp(flowDynamic, phoneNumber)
            return
        }
        
        // Si no hay intención específica, usar IA o fallback
        let response: string
        try {
            response = await chat(
                'Eres un asistente para estudiantes buscando prácticas. Si preguntan sobre vacantes, sugiere "buscar prácticas".',
                userInput
            )
        } catch (error) {
            response = getFallbackResponse(userInput)
        }
        
        await flowDynamic(response)
    })

// Resto de las funciones (mantienen la misma lógica)
async function handleSearchFlow(
    input: string,
    state: ConversationState,
    stateManager: any,
    flowDynamic: any,
    phoneNumber: string
) {
    let response: string
    
    switch(state.step) {
        case 'carrera': {
            state.carrera = input
            state.step = 'lugar'
            await stateManager.update(state)
            response = '📍 ¿En qué ciudad prefieres? (o escribe "cualquiera" para ver todas)'
            await flowDynamic(response)
            break
        }
            
        case 'lugar': {
            state.lugar = input.toLowerCase() === 'cualquiera' ? undefined : input
            state.step = 'modalidad'
            await stateManager.update(state)
            response = '💼 ¿Qué modalidad prefieres?\n\n1️⃣ Presencial\n2️⃣ Remoto\n3️⃣ Híbrido\n4️⃣ Cualquiera'
            await flowDynamic(response)
            break
        }
            
        case 'modalidad': {
            let modalidad: Modalidad | undefined
            
            if (input === '1' || input.includes('presencial')) modalidad = 'presencial'
            else if (input === '2' || input.includes('remot')) modalidad = 'remoto'
            else if (input === '3' || input.includes('híbrid') || input.includes('hibrid')) modalidad = 'hibrido'
            
            const filters: VacanteFilters = {
                carrera: state.carrera,
                lugar: state.lugar,
                modalidad,
                tipo_vacante: state.searchType
            }
            
            await performSearch(filters, state.carrera || '', flowDynamic, phoneNumber)
            await stateManager.update({ currentFlow: 'none' })
            break
        }
    }
}

async function performSearch(filters: VacanteFilters, carrera: string, flowDynamic: any, phoneNumber: string) {
    try {
        let response = '🔍 Buscando oportunidades perfectas para ti...'
        await flowDynamic(response)
        
        const vacantes = await vacantesDB.getVacantesWithFilters(filters)
        
        if (vacantes.length === 0) {
            response = '❌ No encontré vacantes con esos criterios.\n\nIntenta con otros filtros o escribe "todas las vacantes".'
            await flowDynamic(response)
        } else {
            response = `✅ ¡Encontré ${vacantes.length} oportunidades para ti!\n`
            await flowDynamic(response)
            
            for (const vacante of vacantes.slice(0, 5)) {
                const vacanteInfo = vacantesDB.formatVacanteInfo(vacante)
                await flowDynamic(vacanteInfo)
                await flowDynamic('---')
            }
            
            if (vacantes.length > 5) {
                response = `\n📌 Hay ${vacantes.length - 5} vacantes más que cumplen tus criterios.`
                await flowDynamic(response)
            }
            
            response = '\n' + getMotivationalMessage()
            await flowDynamic(response)
        }
    } catch (error) {
        console.error('Error en búsqueda:', error)
        const response = '❌ Hubo un error al buscar. Por favor intenta de nuevo.'
        await flowDynamic(response)
    }
}

async function searchByCareer(carrera: string, flowDynamic: any, phoneNumber: string) {
    try {
        const vacantes = await vacantesDB.getVacantesByCarrera(carrera)
        
        if (vacantes.length === 0) {
            const response = `❌ No encontré vacantes para "${carrera}".\n\nPuedes intentar con otro término o escribir "buscar prácticas".`
            await flowDynamic(response)
        } else {
            let response = `✅ Encontré ${vacantes.length} oportunidades para ${carrera}:\n`
            await flowDynamic(response)
            
            for (const vacante of vacantes.slice(0, 5)) {
                const vacanteInfo = vacantesDB.formatVacanteInfo(vacante)
                await flowDynamic(vacanteInfo)
                await flowDynamic('---')
            }
            
            if (vacantes.length > 5) {
                response = `📌 Hay ${vacantes.length - 5} vacantes más.`
                await flowDynamic(response)
            }
            
            response = '\n' + getMotivationalMessage()
            await flowDynamic(response)
        }
    } catch (error) {
        console.error('Error:', error)
        const response = '❌ Hubo un error al buscar.'
        await flowDynamic(response)
    }
}

async function searchByModality(modalidad: Modalidad, flowDynamic: any, phoneNumber: string) {
    try {
        const vacantes = await vacantesDB.getVacantesWithFilters({ modalidad })
        
        if (vacantes.length === 0) {
            const response = '❌ No encontré vacantes remotas.'
            await flowDynamic(response)
        } else {
            let response = `✅ Vacantes remotas (${vacantes.length}):\n`
            await flowDynamic(response)
            
            for (const vacante of vacantes.slice(0, 5)) {
                const vacanteResumen = vacantesDB.formatVacanteResumen(vacante)
                await flowDynamic(vacanteResumen)
            }
            
            if (vacantes.length > 5) {
                response = `\n... y ${vacantes.length - 5} más.`
                await flowDynamic(response)
            }
            
            response = '\n💡 Tip: Puedes filtrar por carrera escribiendo "vacantes de [carrera]"'
            await flowDynamic(response)
        }
    } catch (error) {
        const response = '❌ Error al buscar vacantes.'
        await flowDynamic(response)
    }
}

async function showAllVacancies(flowDynamic: any, phoneNumber: string) {
    try {
        const vacantes = await vacantesDB.getAllVacantes()
        const stats = await vacantesDB.getEstadisticas()
        
        if (vacantes.length === 0) {
            const response = '❌ No hay vacantes disponibles en este momento.'
            await flowDynamic(response)
        } else {
            let response = `📊 **Estadísticas actuales:**\n` +
                            `Total de vacantes: ${stats.total}\n` +
                            `Ciudades principales: ${stats.porLugar.slice(0, 3).map(l => l.lugar).join(', ')}\n`
            await flowDynamic(response)
            
            response = '\n📌 **Últimas vacantes publicadas:**\n'
            await flowDynamic(response)
            
            for (const vacante of vacantes.slice(0, 10)) {
                const vacanteResumen = vacantesDB.formatVacanteResumen(vacante)
                await flowDynamic(vacanteResumen)
            }
            
            response = '\n💡 Para ver detalles, escribe "vacantes de [tu carrera]"'
            await flowDynamic(response)
        }
    } catch (error) {
        console.error('Error:', error)
        const response = '❌ Error al obtener vacantes.'
        await flowDynamic(response)
    }
}

async function showHelp(flowDynamic: any, phoneNumber: string) {
    const response = '📚 **Comandos disponibles:**\n\n' +
                     '🔍 *buscar prácticas* - Búsqueda personalizada\n' +
                     '🎓 *vacantes de [carrera]* - Por carrera\n' +
                     '📍 *vacantes en [ciudad]* - Por ubicación\n' +
                     '🏠 *vacantes remotas* - Solo remotas\n' +
                     '📋 *todas las vacantes* - Ver lista general\n\n' +
                     '💡 Ejemplo: "vacantes de ingeniería en sistemas"'
    await flowDynamic(response)
}

function getFallbackResponse(text: string): string {
    const lowerText = text.toLowerCase()
    
    if (['hola', 'hi', 'hello', 'buenas', 'qué tal'].some(g => lowerText.includes(g))) {
        return '👋 ¡Hola! Soy tu asistente para encontrar prácticas profesionales y servicio social.\n\n' +
               'Puedes escribir:\n' +
               '• "buscar prácticas" para comenzar\n' +
               '• "vacantes de [tu carrera]" para búsqueda directa\n' +
               '• "ayuda" para ver todas las opciones'
    }
    
    if (['gracias', 'thanks'].some(t => lowerText.includes(t))) {
        return '😊 ¡De nada! Espero que encuentres la oportunidad perfecta. ¡Mucho éxito!'
    }
    
    return '🤖 ¡Hola! Puedo ayudarte a encontrar prácticas y servicio social.\n\n' +
           'Prueba escribiendo:\n' +
           '• "buscar prácticas"\n' +
           '• "vacantes de [tu carrera]"\n' +
           '• "ayuda" para más opciones'
}

const main = async () => {
    try {
        // Conectar a la base de datos
        await vacantesDB.connect()
        console.log('✅ Base de datos conectada')
        
        // Probar conexión con Chatwoot
        const chatwootConnected = await chatwootService.testConnection()
        if (chatwootConnected) {
            console.log('✅ Chatwoot conectado correctamente')
        } else {
            console.log('⚠️ Chatwoot no disponible, pero el bot funcionará normalmente')
        }
        
        // Configurar flujo único
        const adapterFlow = createFlow([mainFlow])
        
        // Configurar proveedor
        const adapterProvider = createProvider(Provider, {
            jwtToken: process.env.META_JWT_TOKEN || 'jwtToken',
            numberId: process.env.META_NUMBER_ID || 'numberId',
            verifyToken: process.env.META_VERIFY_TOKEN || 'verifyToken',
            version: process.env.META_VERSION || 'v18.0'
        })
        
        const adapterDB = new Database()

        const { httpServer } = await createBot({
            flow: adapterFlow,
            provider: adapterProvider,
            database: adapterDB,
        })

        // Crear servidor Express separado para webhooks
        const app = express()
        
        // Configurar webhook de Chatwoot
        setupChatwootWebhook(app, adapterProvider)
        
        // Iniciar el servidor del bot
        httpServer(+PORT)
        
        // Iniciar servidor Express para webhooks en un puerto diferente
        const webhookPort = parseInt(PORT as string) + 1
        app.listen(webhookPort, () => {
            console.log(`🔗 Servidor de webhooks corriendo en puerto ${webhookPort}`)
        })

        console.log('🤖 Bot de Vacantes iniciado correctamente')
        console.log('🎓 Ayudando a estudiantes a encontrar oportunidades')
        console.log('🔗 Integración con Chatwoot activa')
        console.log(`📡 Webhook disponible en puerto ${webhookPort}/chatwoot/webhook`)
        console.log(`🚀 Bot corriendo en puerto ${PORT}`)
        console.log(`🌐 URL del webhook: http://tu-servidor:${webhookPort}/chatwoot/webhook`)
        
    } catch (error) {
        console.error('❌ Error al iniciar:', error)
        process.exit(1)
    }
}

// Manejar cierre graceful
process.on('SIGINT', async () => {
    console.log('\n🔄 Cerrando aplicación...')
    await vacantesDB.close()
    process.exit(0)
})

process.on('SIGTERM', async () => {
    console.log('\n🔄 Cerrando aplicación...')
    await vacantesDB.close()
    process.exit(0)
})

main().catch(console.error)    