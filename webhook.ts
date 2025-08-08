import express from 'express';
import { MetaProvider } from '@builderbot/provider-meta';

interface ChatwootWebhookPayload {
    event: string;
    conversation?: {
        id: number;
        inbox_id: number;
        contact_inbox: {
            source_id: string;
        };
    };
    message?: {
        content: string;
        message_type: 0 | 1; // 0 = incoming, 1 = outgoing
        sender: {
            type: 'agent_bot' | 'user';
        };
    };
    // Nueva estructura para el formato real de Chatwoot
    content?: string;
    message_type?: 'incoming' | 'outgoing';
    sender?: {
        id: number;
        name: string;
        email?: string;
        type: 'user' | 'contact';
    };
    // Para acceder a conversation directamente
    id?: number;
    inbox_id?: number;
    contact_inbox?: {
        source_id: string;
    };
}

export function setupChatwootWebhook(app: express.Application, provider: MetaProvider) {
    // Middleware para parsear JSON
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    
    // Cache para evitar procesar el mismo mensaje múltiples veces
    const processedMessages = new Set<string>();
    
    // Limpiar cache cada 10 minutos para evitar memory leaks
    setInterval(() => {
        processedMessages.clear();
        console.log('🧹 Cache de mensajes procesados limpiado');
    }, 10 * 60 * 1000);
    
    // Ruta de prueba para verificar que el servidor funciona
    app.get('/', (req, res) => {
        res.json({ 
            status: 'Webhook server running', 
            timestamp: new Date().toISOString(),
            port: process.env.PORT ? parseInt(process.env.PORT) + 1 : 3009
        });
    });
    
    // Ruta de health check
    app.get('/health', (req, res) => {
        res.json({ status: 'OK', service: 'Chatwoot Webhook' });
    });

    // Endpoint para recibir webhooks de Chatwoot (POST)
    app.post('/chatwoot/webhook', async (req, res) => {
        try {
            console.log('🔔 Webhook POST recibido');
            
            const payload: ChatwootWebhookPayload = req.body;
            
            // Crear ID único para este mensaje
            const messageId = `${payload.event}-${payload.id || 'no-id'}-${payload.content || 'no-content'}`;
            
            console.log('🔔 Procesando evento:', {
                event: payload.event,
                messageId: payload.id,
                messageType: payload.message_type,
                senderType: payload.sender?.type,
                content: payload.content,
                uniqueId: messageId
            });
            
            // Verificar si ya procesamos este mensaje
            if (processedMessages.has(messageId)) {
                console.log('⚠️ Mensaje ya procesado, ignorando duplicado:', messageId);
                res.status(200).json({ 
                    status: 'duplicate',
                    message: 'Mensaje ya procesado'
                });
                return;
            }
            
            // Marcar mensaje como procesado
            processedMessages.add(messageId);
            
            // Manejar SOLO mensajes salientes del agente (respuestas de agentes humanos)
            if (payload.event === 'message_created' && 
                payload.message_type === 'outgoing' &&
                payload.sender?.type === 'user') { // 'user' significa agente humano
                
                // Obtener el número de teléfono del contact_inbox
                const phoneNumber = payload.conversation?.contact_inbox?.source_id;
                const message = payload.content;
                
                if (phoneNumber && message) {
                    console.log(`📤 Enviando mensaje de agente humano a ${phoneNumber}: ${message}`);
                    
                    try {
                        // Enviar mensaje a través del proveedor de WhatsApp
                        await provider.sendMessage(phoneNumber, message, {});
                        console.log('✅ Mensaje enviado exitosamente a WhatsApp');
                    } catch (sendError) {
                        console.error('❌ Error enviando mensaje a WhatsApp:', sendError);
                    }
                } else {
                    console.log('❌ Falta phoneNumber o message:', { phoneNumber, message });
                }
            } else {
                console.log('ℹ️ Evento ignorado:', {
                    event: payload.event,
                    messageType: payload.message_type,
                    senderType: payload.sender?.type,
                    reason: payload.event !== 'message_created' ? 'not message_created' :
                           payload.message_type !== 'outgoing' ? 'not outgoing' :
                           payload.sender?.type !== 'user' ? 'sender not user' : 'unknown'
                });
            }
            
            // IMPORTANTE: Siempre responder con 200 OK
            res.status(200).json({ 
                status: 'success',
                message: 'Webhook procesado correctamente',
                timestamp: new Date().toISOString()
            });
            
        } catch (error) {
            console.error('❌ Error procesando webhook de Chatwoot:', error);
            
            // Responder con error pero no fallar
            res.status(200).json({ 
                status: 'error',
                message: 'Error procesando webhook',
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    });

    // Endpoint de verificación para Chatwoot (GET)
    app.get('/chatwoot/webhook', (req, res) => {
        console.log('🔍 Verificación de webhook - Query params:', req.query);
        console.log('🔍 Verificación de webhook - Headers:', req.headers);
        
        // Chatwoot Cloud simplemente hace un GET request para verificar que el endpoint existe
        // No usa el sistema hub_verify_token como Facebook
        console.log('✅ Endpoint de verificación accedido - respondiendo OK');
        
        res.status(200).json({
            status: 'webhook_verified',
            message: 'Chatwoot webhook endpoint is ready',
            timestamp: new Date().toISOString()
        });
    });

    // Endpoint para probar el webhook manualmente
    app.get('/chatwoot/webhook/test', (req, res) => {
        res.json({
            message: 'Webhook endpoint is working',
            config: {
                webhookUrl: req.protocol + '://' + req.get('host') + '/chatwoot/webhook',
                verifyToken: process.env.CHATWOOT_WEBHOOK_VERIFY_TOKEN || 'not_set'
            }
        });
    });

    console.log('🔗 Webhook de Chatwoot configurado:');
    console.log('  - POST /chatwoot/webhook - Recibir webhooks');
    console.log('  - GET  /chatwoot/webhook - Verificación');
    console.log('  - GET  /chatwoot/webhook/test - Prueba');
    console.log('  - GET  /health - Health check');
}