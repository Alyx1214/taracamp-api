import { Status } from '../constants.js';

// Configuration for automated responses
const AUTO_RESPONSE_CONFIG = {
    enabled: true,
    responseDelay: 1000,
    maxResponseLength: 500,
    confidenceThreshold: 0.4,
};

const KNOWLEDGE_BASE = {
    accommodation: {
        keywords: ['room', 'accommodation', 'lodging', 'stay', 'sleep', 'bed', 'dormitory', 'cottage', 'hall'],
        responses: [
            "Teachers' Camp offers a variety of accommodations including dormitory-style rooms, private cottages, and traditional hall rooms. Each option is designed to suit different group sizes and preferences, from individual travelers to large seminars.",
            "We have dormitory-style rooms, private cottages, and traditional hall rooms available. Each accommodation type is designed for different group sizes and preferences."
        ]
    },
    
    boardLodging: {
        keywords: ['board', 'lodging', 'meals', 'food', 'dining', 'eat', 'breakfast', 'lunch', 'dinner'],
        responses: [
            "Board and Lodging at Teachers' Camp include accommodation and meals. Additional amenities such as housekeeping, utilities, and conference facilities may also be available depending on the package or room type selected.",
            "Yes, meals are provided as part of the board and lodging package. We serve a range of Filipino and international dishes, prepared fresh daily. Specific dietary requests can often be accommodated with advance notice."
        ]
    },
    
    checkInOut: {
        keywords: ['check-in', 'check-in', 'checkout', 'check-out', 'arrival', 'departure', 'time', 'when'],
        responses: [
            "Standard check-in time is 2:00 PM, and check-out time is 12:00 PM (noon). Early check-in or late check-out requests are subject to availability and may incur additional charges.",
            "Check-in is at 2:00 PM and check-out is at 12:00 PM (noon). Please coordinate with the front desk for early check-in or late check-out requests."
        ]
    },
    
    reservations: {
        keywords: ['reserve', 'reservation', 'book', 'booking', 'how to', 'make', 'create', 'schedule'],
        responses: [
            "Reservations can be made through our official website's 'Reserve Now' section, or by contacting our reservations office directly via phone or email. We recommend booking in advance, especially during peak seasons.",
            "You can make reservations through our website or by contacting our reservations office. We recommend booking in advance for better availability."
        ]
    },
    
    pets: {
        keywords: ['pet', 'pets', 'dog', 'cat', 'animal', 'bring'],
        responses: [
            "Unfortunately, for the comfort and safety of all guests, pets are generally not allowed within the camp premises. Please inquire directly if you have special needs.",
            "Pets are generally not allowed for the comfort and safety of all guests. Please contact us directly if you have special requirements."
        ]
    },
    
    pricing: {
        keywords: ['price', 'cost', 'rate', 'rates', 'fee', 'fees', 'how much', 'expensive', 'cheap'],
        responses: [
            "Please click this link to check the price and rate: [Pricing Information Link]",
            "For current rates and pricing information, please click this link: [Pricing Information Link]",
            "Pricing varies depending on the accommodation type, duration of stay, and season. Please click this link to check the price and rate: [Pricing Information Link]"
        ]
    },
    
    facilities: {
        keywords: ['facility', 'facilities', 'amenity', 'amenities', 'wifi', 'internet', 'parking', 'conference', 'meeting'],
        responses: [
            "Teachers' Camp offers various facilities including conference rooms, dining areas, recreational spaces, and basic amenities. Specific facilities may vary by accommodation type.",
            "We provide conference facilities, dining services, recreational areas, and other amenities. Please check with our staff for specific facility availability."
        ]
    },
    
    location: {
        keywords: ['where', 'location', 'address', 'directions', 'how to get', 'near', 'close to'],
        responses: [
            "Teachers' Camp is located in Baguio City. For specific directions and location details, please contact our front desk or check our website for detailed location information.",
            "We're located in Baguio City. Contact our front desk for specific directions and location details."
        ]
    },
    
    greeting: {
        keywords: ['hello', 'hi', 'hey', 'help', 'assistance', 'support', 'question'],
        responses: [
            "Hello! I'm here to help with your questions about Teachers' Camp. Feel free to ask about accommodations, reservations, facilities, or any other inquiries.",
            "Hi! How can I assist you today? I can help with information about our accommodations, reservations, facilities, and more."
        ]
    },
    
    contact: {
        keywords: ['contact', 'phone', 'email', 'call', 'reach', 'get in touch'],
        responses: [
            "You can contact us through our website, by phone, or email. Our reservations office is available to assist with your inquiries and bookings.",
            "For contact information and to reach our staff, please visit our website or contact our reservations office directly."
        ]
    }
};

const RESPONSE_TEMPLATES = {
    noMatch: "I understand you're looking for information. While I couldn't find a specific answer to your question, our staff is available to help. Please contact our reservations office for personalized assistance.",
    multipleMatches: "I found several topics that might help with your question. Could you please be more specific about what you'd like to know?",
    lowConfidence: "I'm not entirely sure about the specific information you're looking for. Our staff would be happy to provide detailed assistance. Please contact our reservations office.",
};

/**
 * Analyzes user message and determines appropriate automated response
 * @param {string} messageText - The user's message text
 * @param {Object} userContext - User context information
 * @returns {Object} Response analysis with confidence score and suggested response
 */
function analyzeMessage(messageText, userContext = {}) {
    if (!messageText || typeof messageText !== 'string') {
        return { confidence: 0, response: null, category: null };
    }

    const normalizedText = messageText.toLowerCase().trim();
    const words = normalizedText.split(/\s+/);
    
    let bestMatch = { category: null, confidence: 0, response: null };
    const matches = [];

    // Analyze against knowledge base
    for (const [category, data] of Object.entries(KNOWLEDGE_BASE)) {
        const keywordMatches = data.keywords.filter(keyword => 
            normalizedText.includes(keyword.toLowerCase())
        );
        
        if (keywordMatches.length > 0) {
            const keywordRatio = keywordMatches.length / data.keywords.length;
            const messageLength = words.length;
            const matchDensity = keywordMatches.length / Math.max(messageLength, 1);
            
            const confidence = Math.min(keywordRatio * 0.6 + matchDensity * 0.4 + 0.2, 1.0);
            const response = data.responses[Math.floor(Math.random() * data.responses.length)];
            
            matches.push({ category, confidence, response, keywordMatches });
            
            if (confidence > bestMatch.confidence) {
                bestMatch = { category, confidence, response };
            }
        }
    }

    if (matches.length > 1) {
        const highConfidenceMatches = matches.filter(m => m.confidence >= AUTO_RESPONSE_CONFIG.confidenceThreshold);
        if (highConfidenceMatches.length > 1) {
            return {
                confidence: 0.6,
                response: RESPONSE_TEMPLATES.multipleMatches,
                category: 'multiple',
                matches: highConfidenceMatches
            };
        }
    }

    if (bestMatch.confidence >= AUTO_RESPONSE_CONFIG.confidenceThreshold) {
        return {
            confidence: bestMatch.confidence,
            response: bestMatch.response,
            category: bestMatch.category,
            matches: [bestMatch]
        };
    }

    if (matches.length > 0) {
        return {
            confidence: matches[0].confidence,
            response: RESPONSE_TEMPLATES.lowConfidence,
            category: 'low_confidence',
            matches
        };
    }

    return {
        confidence: 0,
        response: RESPONSE_TEMPLATES.noMatch,
        category: 'no_match',
        matches: []
    };
}

/**
 * Generates contextual response based on user's recent message history
 * @param {Array} recentMessages - Array of recent messages from the conversation
 * @param {string} currentMessage - Current user message
 * @returns {Object} Enhanced response analysis
 */
function generateContextualResponse(recentMessages = [], currentMessage) {
    const analysis = analyzeMessage(currentMessage);
    
    if (recentMessages.length > 0) {
        const recentText = recentMessages
            .slice(-3)
            .map(msg => msg.text || '')
            .join(' ')
            .toLowerCase();
        
        const followUpKeywords = ['more', 'also', 'and', 'what about', 'how about', 'tell me more'];
        const isFollowUp = followUpKeywords.some(keyword => 
            currentMessage.toLowerCase().includes(keyword)
        );
        
        if (isFollowUp && analysis.confidence < AUTO_RESPONSE_CONFIG.confidenceThreshold) {
            const contextualAnalysis = analyzeMessage(recentText + ' ' + currentMessage);
            if (contextualAnalysis.confidence > analysis.confidence) {
                return {
                    ...contextualAnalysis,
                    isContextual: true,
                    originalConfidence: analysis.confidence
                };
            }
        }
    }
    
    return analysis;
}

/**
 * Main automated response engine
 */
const autoResponseEngine = {
    /**
     * Processes a user message and determines if an automated response should be sent
     * @param {Object} dbHelper - Database helper instance
     * @param {string} userId - User ID
     * @param {string} messageText - User's message text
     * @param {Object} userContext - Additional user context
     * @returns {Promise<Object>} Response data with automated message if applicable
     */
    processMessage: async (dbHelper, userId, messageText, userContext = {}) => {
        const responseData = {
            status: Status.INTERNAL_SERVER_ERROR,
            error: 'Error processing automated response',
            shouldSendAutoResponse: false,
            autoResponse: null
        };

        try {
            if (!AUTO_RESPONSE_CONFIG.enabled) {
                responseData.status = Status.OK;
                responseData.error = null;
                responseData.shouldSendAutoResponse = false;
                return responseData;
            }

            // Check for recent admin replies - if admin has replied, don't send auto-response
            // Get all recent messages to check for admin replies
            const recentAllMessages = await dbHelper.findMany('message', 
                { userId }, 
                { sort: { createdAt: -1 }, limit: 20 }
            );

            // The first message in the list is the current user message that was just saved
            // Skip it and check the rest for admin replies
            const messagesToCheck = recentAllMessages.slice(1);

            // Check if the most recent non-user message is an admin reply
            // If admin has replied, we should not send an auto-response
            const mostRecentNonUserMessage = messagesToCheck.find(msg => {
                // Get raw document (handle both Mongoose documents and plain objects)
                const raw = msg?.toObject ? msg.toObject() : msg;
                return raw && raw.isUser === false;
            });
            
            if (mostRecentNonUserMessage) {
                // Get raw document to access metadata
                const raw = mostRecentNonUserMessage?.toObject ? mostRecentNonUserMessage.toObject() : mostRecentNonUserMessage;
                const isAdminReply = raw?.metadata?.isAdminReply === true;
                // Fallback: check if role is not 'system' (auto-responses have role 'system', admin replies have admin roles)
                const isLikelyAdminReply = raw?.role && raw.role !== 'system' && !raw?.metadata?.isAutoResponse;

                if (isAdminReply || isLikelyAdminReply) {
                    responseData.status = Status.OK;
                    responseData.error = null;
                    responseData.shouldSendAutoResponse = false;
                    responseData.analysis = {
                        confidence: 0,
                        category: 'admin_replied',
                        reason: 'Most recent non-user message is admin reply, skipping auto-response'
                    };
                    return responseData;
                }
            }

            const recentMessages = await dbHelper.findMany('message', 
                { userId, isUser: true }, 
                { sort: { createdAt: -1 }, limit: 5 }
            );

            const analysis = generateContextualResponse(recentMessages, messageText            );

            const shouldSend = analysis.confidence >= AUTO_RESPONSE_CONFIG.confidenceThreshold ||
                             analysis.category === 'low_confidence' ||
                             analysis.category === 'no_match';

            if (shouldSend) {
                const autoResponseData = {
                    userId,
                    text: analysis.response,
                    sender: 'Teachers\' Camp',
                    role: 'system',
                    isUser: false,
                    isRead: false,
                    metadata: {
                        isAutoResponse: true,
                        confidence: analysis.confidence,
                        category: analysis.category,
                        originalMessage: messageText,
                        timestamp: new Date()
                    }
                };

                responseData.shouldSendAutoResponse = true;
                responseData.autoResponse = autoResponseData;
            }

            responseData.status = Status.OK;
            responseData.error = null;
            responseData.analysis = {
                confidence: analysis.confidence,
                category: analysis.category,
                isContextual: analysis.isContextual || false
            };

        } catch (error) {
            console.error('Error in automated response engine:', error);
            responseData.status = Status.INTERNAL_SERVER_ERROR;
            responseData.error = 'Error processing automated response';
        }

        return responseData;
    },

    updateConfig: (newConfig) => {
        Object.assign(AUTO_RESPONSE_CONFIG, newConfig);
    },

    getConfig: () => ({ ...AUTO_RESPONSE_CONFIG }),

    updateKnowledgeBase: (category, data) => {
        KNOWLEDGE_BASE[category] = data;
    },

    getKnowledgeBase: () => ({ ...KNOWLEDGE_BASE }),

    testMessage: (messageText) => {
        return analyzeMessage(messageText);
    }
};

export default autoResponseEngine;
