import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

interface ChatwootContact {
    identifier?: string;
    name?: string;
    phone_number?: string;
    avatar_url?: string;
}

interface ChatwootMessage {
    content: string;
    message_type: 'incoming' | 'outgoing';
    private?: boolean;
    content_type?: 'text' | 'input_email' | 'cards' | 'input_select' | 'form' | 'article';
}

interface ChatwootContactResponse {
    payload: {
        contact: {
            id: number;
            name: string;
            phone_number: string;
            email?: string;
            additional_attributes: any;
            custom_attributes: any;
        };
        contact_inbox: {
            source_id: string;
            inbox: {
                id: number;
                name: string;
                channel_type: string;
            };
        };
    };
}

class ChatwootService {
    private baseURL: string;
    private apiToken: string;
    private inboxIdentifier: string;
    private accountId: string;

    constructor() {
        this.baseURL = process.env.CHATWOOT_URL || '';
        this.apiToken = process.env.CHATWOOT_API_ACCESS_TOKEN || '';
        this.inboxIdentifier = process.env.CHATWOOT_INBOX_IDENTIFIER || '';
        this.accountId = '130781'; // Tu account ID
        
        if (!this.baseURL || !this.apiToken || !this.inboxIdentifier) {
            console.error('❌ Variables de Chatwoot no configuradas correctamente');
        }
    }

    /**
     * Formatear número de teléfono al formato E164
     */
    private formatPhoneToE164(phoneNumber: string): string {
        // Limpiar el número de espacios y caracteres especiales
        let cleanNumber = phoneNumber.replace(/[\s\-\(\)]/g, '');
        
        // Si ya tiene +, devolverlo tal como está
        if (cleanNumber.startsWith('+')) {
            return cleanNumber;
        }
        
        // Si el número comienza con 521 (México con código de celular)
        if (cleanNumber.startsWith('521')) {
            return `+${cleanNumber}`;
        }
        
        // Si el número comienza con 52 (México)
        if (cleanNumber.startsWith('52')) {
            return `+${cleanNumber}`;
        }
        
        // Si es un número de 10 dígitos (probablemente México sin código de país)
        if (cleanNumber.length === 10) {
            return `+521${cleanNumber}`;
        }
        
        // Si es un número de 12 dígitos que comienza con 52
        if (cleanNumber.length === 12 && cleanNumber.startsWith('52')) {
            return `+${cleanNumber}`;
        }
        
        // Por defecto, agregar + si no lo tiene
        return `+${cleanNumber}`;
    }

    private getHeaders() {
        return {
            'api_access_token': this.apiToken,
            'Content-Type': 'application/json'
        };
    }

    /**
     * Obtener información de la cuenta para verificar conexión
     */
    async getAccountInfo(): Promise<any> {
        try {
            console.log(`🔍 Verificando conexión con Chatwoot...`);
            
            const response = await axios.get(
                `${this.baseURL}/api/v1/profile`,
                { headers: this.getHeaders() }
            );
            
            console.log(`✅ Conexión exitosa con Chatwoot`);
            
            // Actualizar account_id si está disponible
            if (response.data?.accounts?.length > 0) {
                this.accountId = response.data.accounts[0].id.toString();
                console.log(`✅ Account ID actualizado: ${this.accountId}`);
            }
            
            return response.data;
        } catch (error: any) {
            console.error('❌ Error verificando conexión con Chatwoot:', {
                status: error.response?.status,
                statusText: error.response?.statusText,
                data: error.response?.data,
                message: error.message
            });
            throw error;
        }
    }

    /**
     * Crear contacto con inbox association
     */
    async createContactWithInbox(phoneNumber: string, name?: string): Promise<any> {
        try {
            const formattedPhone = this.formatPhoneToE164(phoneNumber);
            console.log(`🔍 Creando contacto con inbox - Phone: ${formattedPhone}`);
            
            const contactData = {
                inbox_id: this.inboxIdentifier,
                name: name || phoneNumber,
                phone_number: formattedPhone,
                identifier: formattedPhone
            };

            console.log(`📤 Datos del contacto:`, JSON.stringify(contactData, null, 2));

            const response = await axios.post<ChatwootContactResponse>(
                `${this.baseURL}/api/v1/accounts/${this.accountId}/contacts`,
                contactData,
                { headers: this.getHeaders() }
            );

            if (response.data?.payload?.contact) {
                const contact = response.data.payload.contact;
                const contactInbox = response.data.payload.contact_inbox;
                
                console.log(`✅ Contacto creado exitosamente:`, {
                    id: contact.id,
                    phone: contact.phone_number,
                    name: contact.name,
                    source_id: contactInbox?.source_id
                });
                
                return {
                    contact: contact,
                    contact_inbox: contactInbox
                };
            } else {
                console.error('❌ Respuesta inesperada del servidor:', response.data);
                return null;
            }
        } catch (error: any) {
            console.error(`❌ Error creando contacto:`, {
                status: error.response?.status,
                statusText: error.response?.statusText,
                data: error.response?.data,
                message: error.message
            });
            
            // Si el error es 422, el contacto ya existe
            if (error.response?.status === 422) {
                console.log(`🔍 Contacto ya existe, buscando...`);
                const formattedPhone = this.formatPhoneToE164(phoneNumber);
                return await this.findContactByPhone(formattedPhone);
            }
            
            throw error;
        }
    }

    /**
     * Buscar contacto por número de teléfono
     */
    async findContactByPhone(phoneNumber: string): Promise<any> {
        try {
            const formattedPhone = this.formatPhoneToE164(phoneNumber);
            console.log(`🔍 Buscando contacto para: ${formattedPhone}`);
            
            const response = await axios.get(
                `${this.baseURL}/api/v1/accounts/${this.accountId}/contacts/search?q=${encodeURIComponent(formattedPhone)}`,
                { headers: this.getHeaders() }
            );

            const contacts = response.data?.payload || [];
            if (contacts && contacts.length > 0) {
                const contact = contacts[0];
                console.log(`✅ Contacto encontrado: ${contact.id}`);
                
                // Obtener el contact_inbox para este contacto
                const contactInboxes = contact.contact_inboxes || [];
                const relevantInbox = contactInboxes.find((ci: any) => 
                    ci.inbox.id.toString() === this.inboxIdentifier
                );
                
                return {
                    contact: contact,
                    contact_inbox: relevantInbox
                };
            }
            
            console.log(`❌ No se encontró contacto para: ${formattedPhone}`);
            return null;
        } catch (error: any) {
            console.error('❌ Error buscando contacto:', error.response?.data || error.message);
            return null;
        }
    }

    /**
     * Crear una conversación en Chatwoot
     */
    async createConversation(contactId: number, phoneNumber: string, sourceId?: string): Promise<any> {
        try {
            const formattedPhone = this.formatPhoneToE164(phoneNumber);
            console.log(`🔍 Creando conversación para contacto ID: ${contactId}`);
            
            const conversationData = {
                source_id: sourceId || formattedPhone,
                inbox_id: parseInt(this.inboxIdentifier),
                contact_id: contactId
            };

            console.log(`📤 Datos de conversación:`, JSON.stringify(conversationData, null, 2));

            const response = await axios.post(
                `${this.baseURL}/api/v1/accounts/${this.accountId}/conversations`,
                conversationData,
                { headers: this.getHeaders() }
            );

            console.log(`✅ Conversación creada exitosamente: ${response.data.id}`);
            return response.data;
        } catch (error: any) {
            console.error('❌ Error creando conversación:', {
                status: error.response?.status,
                statusText: error.response?.statusText,
                data: error.response?.data,
                message: error.message
            });
            throw error;
        }
    }

    /**
     * Enviar mensaje entrante a Chatwoot
     */
    async sendIncomingMessage(conversationId: number, message: string): Promise<any> {
        try {
            const messageData: ChatwootMessage = {
                content: message,
                message_type: 'incoming'
            };

            const response = await axios.post(
                `${this.baseURL}/api/v1/accounts/${this.accountId}/conversations/${conversationId}/messages`,
                messageData,
                { headers: this.getHeaders() }
            );

            console.log(`✅ Mensaje entrante enviado (Conv: ${conversationId})`);
            return response.data;
        } catch (error: any) {
            console.error('❌ Error enviando mensaje entrante:', error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * Buscar conversación existente por número de teléfono
     */
    async findConversationByPhone(phoneNumber: string): Promise<any> {
        try {
            const formattedPhone = this.formatPhoneToE164(phoneNumber);
            console.log(`🔍 Buscando conversación para: ${formattedPhone}`);
            
            const response = await axios.get(
                `${this.baseURL}/api/v1/accounts/${this.accountId}/conversations?status=open&inbox_id=${this.inboxIdentifier}`,
                { headers: this.getHeaders() }
            );

            const conversations = response.data?.data?.payload || [];
            const conversation = conversations.find((conv: any) => {
                const contactPhone = conv.meta?.sender?.phone_number || conv.contact?.phone_number;
                if (contactPhone) {
                    const formattedContactPhone = this.formatPhoneToE164(contactPhone);
                    return formattedContactPhone === formattedPhone;
                }
                return false;
            });

            if (conversation) {
                console.log(`✅ Conversación encontrada: ${conversation.id}`);
                return conversation;
            } else {
                console.log(`ℹ️ No se encontró conversación abierta para: ${formattedPhone}`);
                return null;
            }
        } catch (error: any) {
            console.error('❌ Error buscando conversación:', error.response?.data || error.message);
            return null;
        }
    }

    /**
     * Procesar mensaje completo con mejor manejo de errores
     */
    async processMessage(phoneNumber: string, message: string, userName?: string): Promise<boolean> {
        try {
            console.log(`📨 Procesando mensaje de ${phoneNumber}: ${message.substring(0, 50)}...`);
            
            // 1. Buscar conversación existente primero
            let conversation = await this.findConversationByPhone(phoneNumber);
            
            if (conversation) {
                // Si ya existe conversación, enviar el mensaje directamente
                await this.sendIncomingMessage(conversation.id, message);
                console.log(`✅ Mensaje enviado a conversación existente: ${conversation.id}`);
                return true;
            }
            
            // 2. Si no hay conversación, crear contacto y conversación
            let contactData = await this.findContactByPhone(phoneNumber);
            
            if (!contactData) {
                contactData = await this.createContactWithInbox(phoneNumber, userName);
            }

            if (!contactData || !contactData.contact) {
                console.error('❌ No se pudo crear/encontrar el contacto');
                return false;
            }

            // 3. Crear nueva conversación
            const sourceId = contactData.contact_inbox?.source_id;
            conversation = await this.createConversation(
                contactData.contact.id, 
                phoneNumber, 
                sourceId
            );

            if (!conversation) {
                console.error('❌ No se pudo crear la conversación');
                return false;
            }

            // 4. Enviar mensaje a la nueva conversación
            await this.sendIncomingMessage(conversation.id, message);

            console.log(`✅ Mensaje procesado exitosamente para ${phoneNumber}`);
            return true;
            
        } catch (error) {
            console.error('❌ Error procesando mensaje en Chatwoot:', error);
            return false;
        }
    }

    /**
     * Verificar la conexión con Chatwoot
     */
    async testConnection(): Promise<boolean> {
        try {
            await this.getAccountInfo();
            console.log('✅ Test de conexión con Chatwoot exitoso');
            return true;
        } catch (error: any) {
            console.error('❌ Fallo test de conexión con Chatwoot:', error.response?.data || error.message);
            return false;
        }
    }
}

export default new ChatwootService();