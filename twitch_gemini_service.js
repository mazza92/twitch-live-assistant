const { GoogleGenerativeAI } = require('@google/generative-ai');
const TWITCH_GEMINI_CONFIG = require('./twitch_gemini_config');

class TwitchGeminiService {
    constructor() {
        this.genAI = new GoogleGenerativeAI(TWITCH_GEMINI_CONFIG.apiKey);
        this.model = this.genAI.getGenerativeModel({
            model: TWITCH_GEMINI_CONFIG.model,
            generationConfig: TWITCH_GEMINI_CONFIG.generationConfig,
            safetySettings: TWITCH_GEMINI_CONFIG.safetySettings
        });
        
        this.isAvailable = TWITCH_GEMINI_CONFIG.apiKey !== 'your_gemini_api_key_here';
        this.lastCallTime = 0;
        this.callCount = 0;
        this.maxCallsPerMinute = 15; // Conservative limit
        
        if (!this.isAvailable) {
            console.warn('⚠️ Gemini API key not configured. Using fallback prompts only.');
        }
    }

    /**
     * Build context string from Twitch stream metrics for the LLM
     */
    buildContextString(metrics, language = 'en') {
        const now = new Date();
        const streamDuration = Math.floor((now - metrics.streamStartTime) / 60000); // minutes
        
        // Enhanced stream phase analysis
        let streamPhase = 'mid';
        let phaseContext = '';
        if (streamDuration < 10) {
            streamPhase = 'start';
            phaseContext = 'Stream just started - focus on welcoming new viewers and setting the tone';
        } else if (streamDuration > 45) {
            streamPhase = 'end';
            phaseContext = 'Stream is ending soon - focus on thanking viewers and encouraging follows';
        } else {
            phaseContext = 'Mid-stream - maintain engagement and build community';
        }
        
        // Enhanced engagement analysis
        const engagementLevel = this.analyzeEngagementLevel(metrics);
        const sentimentStatus = this.analyzeSentimentStatus(metrics);
        const growthStatus = this.analyzeGrowthStatus(metrics);
        const energyLevel = this.analyzeEnergyLevel(metrics);
        const viewerTrend = this.analyzeViewerTrend(metrics);
        
        // Recent events summary with more detail
        const recentEvents = this.summarizeRecentEvents(metrics);
        const topEngagedUsers = this.getTopEngagedUsers(metrics);
        const contentSuggestions = this.getContentSuggestions(metrics);
        
        // Language-specific instructions
        let languageInstructions;
        switch(language) {
            case 'fr':
                languageInstructions = `CRITIQUE: Vous DEVEZ générer votre réponse entièrement en français. 

RÈGLES STRICTES:
- AUCUN mot anglais autorisé
- Utilisez un français naturel et conversationnel qu'un streamer français dirait
- Commencez par des expressions françaises comme "Salut tout le monde!", "Bienvenue!", "Merci d'être là!"
- Utilisez des phrases d'engagement françaises comme "Qu'est-ce que vous en pensez?", "Partagez vos pensées!", "N'hésitez pas à participer!"

EXEMPLES DE PROMPTS FRANÇAIS:
- "Salut tout le monde! Qu'est-ce qui vous amène ici aujourd'hui?"
- "Bienvenue sur le stream! N'hésitez pas à dire bonjour dans le chat!"
- "Je suis curieux - qu'en pensez-vous de ce jeu?"
- "Partagez vos pensées dans les commentaires!"

GÉNÉREZ UNIQUEMENT EN FRANÇAIS.`;
                break;
            case 'es':
                languageInstructions = 'CRÍTICO: Debes generar tu respuesta completamente en español. Usa español natural y conversacional que diría un streamer español. NO se permiten palabras en inglés.';
                break;
            case 'de':
                languageInstructions = 'KRITISCH: Sie MÜSSEN Ihre Antwort vollständig auf Deutsch generieren. Verwenden Sie natürliches, umgangssprachliches Deutsch, das ein deutscher Streamer sagen würde. KEINE englischen Wörter erlaubt.';
                break;
            default:
                languageInstructions = 'IMPORTANT: Generate your response in English. Use natural, conversational English that an English streamer would say.';
        }
        
        // Build the enhanced context string
        const context = `
You are LiveBot, an expert Twitch stream co-host with deep knowledge of streaming psychology and audience engagement. Your task is to generate a specific, actionable prompt that will genuinely help the streamer improve their Twitch stream.

${languageInstructions}

STREAM CONTEXT:
- Stream Duration: ${streamDuration} minutes (${streamPhase} phase)
- Phase Context: ${phaseContext}
- Current Viewers: ${metrics.currentViewerCount || 0}
- Viewer Trend: ${viewerTrend}
- Engagement Level: ${engagementLevel}
- Energy Level: ${energyLevel}
- Sentiment: ${sentimentStatus}
- Growth: ${growthStatus}
- Game/Category: ${metrics.gameCategory || 'Unknown'}

DETAILED METRICS:
- Messages per minute: ${metrics.messagesPerMinute || 0}
- Follows gained this session: ${metrics.sessionFollowersGained || 0}
- Subs gained this session: ${metrics.sessionSubsGained || 0}
- Bits earned this session: ${metrics.sessionBitsEarned || 0}
- Raids received: ${metrics.sessionRaidsReceived || 0}
- Unique chatters: ${metrics.uniqueChatters || 0}
- Average watch time: ${metrics.averageWatchTime || 0} minutes
- Viewer retention: ${metrics.viewerRetention || 0}%

RECENT ACTIVITY:
${recentEvents}

TOP ENGAGED USERS:
${topEngagedUsers}

CONTENT SUGGESTIONS:
${contentSuggestions}

TASK: Generate a specific, actionable prompt (1-2 sentences) that:
1. Addresses the current stream situation with precision
2. Provides a clear, specific action for the streamer
3. Feels natural and matches the stream's energy
4. Helps build genuine community connection
5. Avoids generic phrases like "hit that follow button"
6. Considers Twitch-specific features (bits, subs, raids, etc.)

EXAMPLES OF GOOD PROMPTS:
- "I see we have some new faces! Drop a message and tell me what brought you here today"
- "The chat is buzzing! Let's do a quick poll - what's your favorite part of this stream so far?"
- "I love the energy right now! Who wants to share their biggest win this week?"
- "Thanks for all the bits! You all are amazing supporters!"
- "Welcome to the raiders! Thanks for bringing the energy!"

FORMAT: Just the prompt text, no explanations or formatting.

${language === 'fr' ? 'IMPORTANT: GÉNÉREZ UNIQUEMENT EN FRANÇAIS. AUCUN MOT ANGLAIS AUTORISÉ.' : ''}
        `.trim();

        return context;
    }

    /**
     * Analyze engagement level based on Twitch metrics
     */
    analyzeEngagementLevel(metrics) {
        const messageRate = metrics.messagesPerMinute || 0;
        const viewerCount = metrics.currentViewerCount || 0;
        const uniqueChatters = metrics.uniqueChatters || 0;
        
        // Calculate engagement ratio
        const engagementRatio = viewerCount > 0 ? (uniqueChatters / viewerCount) : 0;
        
        if (messageRate > 20 && engagementRatio > 0.3) return '🔥 EXPLOSIVE - Very high engagement!';
        if (messageRate > 10 && engagementRatio > 0.2) return '📈 HIGH - Good engagement';
        if (messageRate > 5 && engagementRatio > 0.1) return '✅ MODERATE - Decent engagement';
        if (messageRate > 2 && engagementRatio > 0.05) return '📉 LOW - Needs attention';
        return '😴 QUIET - Very low engagement, needs activation';
    }

    /**
     * Analyze sentiment status
     */
    analyzeSentimentStatus(metrics) {
        const sentiment = metrics.rollingSentimentScore || 0;
        if (sentiment > 0.3) return '😊 POSITIVE - Happy audience';
        if (sentiment > -0.1) return '😐 NEUTRAL - Mixed feelings';
        return '😔 NEGATIVE - Audience seems down';
    }

    /**
     * Analyze growth status based on Twitch metrics
     */
    analyzeGrowthStatus(metrics) {
        const followerGains = metrics.sessionFollowersGained || 0;
        const subGains = metrics.sessionSubsGained || 0;
        const bitsEarned = metrics.sessionBitsEarned || 0;
        const raidsReceived = metrics.sessionRaidsReceived || 0;
        
        const totalGrowth = followerGains + (subGains * 3) + (bitsEarned / 100) + (raidsReceived * 2);
        
        if (totalGrowth > 20) return '🚀 BOOMING - Excellent growth across all metrics!';
        if (totalGrowth > 10) return '📈 GROWING - Good growth in multiple areas';
        if (totalGrowth > 5) return '✅ POSITIVE - Some growth activity';
        return '📊 STABLE - Steady but could use more growth';
    }

    /**
     * Summarize recent events for context
     */
    summarizeRecentEvents(metrics) {
        const events = [];
        
        // Recent messages
        if (metrics.recentMessages && metrics.recentMessages.length > 0) {
            const recentMessage = metrics.recentMessages[0];
            events.push(`- Latest message from ${recentMessage.username}: "${recentMessage.message.substring(0, 50)}..."`);
        }
        
        // Recent bits
        if (metrics.recentBits && metrics.recentBits.length > 0) {
            const recentBits = metrics.recentBits[0];
            events.push(`- Recent bits from ${recentBits.username}: ${recentBits.bits} bits`);
        }
        
        // New followers
        if (metrics.newFollowers && metrics.newFollowers.length > 0) {
            const newFollower = metrics.newFollowers[0];
            events.push(`- New follower: ${newFollower.username}`);
        }
        
        // New subs
        if (metrics.newSubs && metrics.newSubs.length > 0) {
            const newSub = metrics.newSubs[0];
            events.push(`- New subscriber: ${newSub.username} (${newSub.plan})`);
        }
        
        // Recent raids
        if (metrics.recentRaids && metrics.recentRaids.length > 0) {
            const recentRaid = metrics.recentRaids[0];
            events.push(`- Recent raid from ${recentRaid.username}: ${recentRaid.viewers} viewers`);
        }
        
        if (events.length === 0) {
            events.push('- No recent notable events');
        }
        
        return events.join('\n');
    }

    /**
     * Generate a prompt using Gemini AI
     */
    async generatePrompt(metrics, language = 'en') {
        // Check if API is available and rate limits
        if (!this.isAvailable) {
            console.log('🤖 [GEMINI] API not available, using fallback');
            return this.getFallbackPrompt(metrics, language);
        }
        
        // Rate limiting check
        const now = Date.now();
        if (now - this.lastCallTime < 60000) { // Within 1 minute
            if (this.callCount >= this.maxCallsPerMinute) {
                console.log('🤖 [GEMINI] Rate limit reached, using fallback');
                return this.getFallbackPrompt(metrics, language);
            }
        } else {
            this.callCount = 0;
        }
        
        try {
            // Build context and create timeout promise
            const context = this.buildContextString(metrics, language);
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('API timeout')), TWITCH_GEMINI_CONFIG.timeout);
            });
            
            // Make API call with timeout
            const apiCall = this.model.generateContent(context);
            const result = await Promise.race([apiCall, timeoutPromise]);
            
            // Extract and process response
            const response = await result.response;
            const generatedText = response.text().trim();
            
            // Validate response
            if (!generatedText || generatedText.length > 200) {
                throw new Error('Invalid response from API');
            }
            
            // Update rate limiting
            this.lastCallTime = now;
            this.callCount++;
            
            console.log('🤖 [GEMINI] Successfully generated prompt:', generatedText.substring(0, 50) + '...');
            
            // Return structured prompt object
            return {
                type: 'ai_generated',
                priority: this.determinePriority(metrics),
                message: generatedText,
                trigger: 'ai_analysis',
                action: 'ai_suggestion',
                source: 'gemini',
                context: {
                    engagementLevel: this.analyzeEngagementLevel(metrics),
                    sentiment: this.analyzeSentimentStatus(metrics),
                    streamPhase: this.getStreamPhase(metrics)
                }
            };
            
        } catch (error) {
            console.error('🤖 [GEMINI] Error generating prompt:', error.message);
            return this.getFallbackPrompt(metrics);
        }
    }

    /**
     * Determine prompt priority based on metrics
     */
    determinePriority(metrics) {
        const sentiment = metrics.rollingSentimentScore || 0;
        const engagement = metrics.messagesPerMinute || 0;
        const viewers = metrics.currentViewerCount || 0;
        
        // High priority for critical situations
        if (sentiment < -0.3 || engagement < 2 || viewers < 100) {
            return 'high';
        }
        
        // Medium priority for moderate situations
        if (sentiment < 0 || engagement < 5 || viewers < 500) {
            return 'medium';
        }
        
        return 'low';
    }

    /**
     * Get stream phase
     */
    getStreamPhase(metrics) {
        const now = new Date();
        const streamDuration = Math.floor((now - metrics.streamStartTime) / 60000);
        
        if (streamDuration < 10) return 'start';
        if (streamDuration > 45) return 'end';
        return 'mid';
    }

    /**
     * Analyze energy level based on activity patterns
     */
    analyzeEnergyLevel(metrics) {
        const messageRate = metrics.messagesPerMinute || 0;
        const bitsRate = metrics.bitsPerMinute || 0;
        const subRate = metrics.subsGainsPerMinute || 0;
        const viewerCount = metrics.currentViewerCount || 0;
        
        const totalActivity = messageRate + (bitsRate / 10) + (subRate * 5);
        const activityPerViewer = viewerCount > 0 ? totalActivity / viewerCount : 0;
        
        if (activityPerViewer > 2) return '🔥 HIGH - Very active chat and engagement';
        if (activityPerViewer > 1) return '⚡ MEDIUM - Good energy, room to grow';
        if (activityPerViewer > 0.5) return '💤 LOW - Chat is quiet, needs activation';
        return '😴 VERY LOW - Minimal engagement, needs immediate attention';
    }

    /**
     * Analyze viewer trend (growing, stable, declining)
     */
    analyzeViewerTrend(metrics) {
        const currentViewers = metrics.currentViewerCount || 0;
        const peakViewers = metrics.peakViewerCount || 0;
        const avgViewers = metrics.averageViewerCount || 0;
        
        if (currentViewers > peakViewers * 0.9) return '📈 GROWING - Near peak viewers';
        if (currentViewers > avgViewers * 1.1) return '📊 STABLE - Above average';
        if (currentViewers < avgViewers * 0.8) return '📉 DECLINING - Below average';
        return '📊 STABLE - Normal fluctuation';
    }

    /**
     * Get top engaged users summary
     */
    getTopEngagedUsers(metrics) {
        if (!metrics.topEngagedUsers || metrics.topEngagedUsers.length === 0) {
            return 'No specific user data available';
        }
        
        const topUsers = metrics.topEngagedUsers.slice(0, 3);
        return topUsers.map(user => 
            `${user.username}: ${user.messages} messages, ${user.bits} bits, ${user.follows} follows, ${user.subs} subs`
        ).join('\n');
    }

    /**
     * Get content suggestions based on current metrics
     */
    getContentSuggestions(metrics) {
        const messageRate = metrics.messagesPerMinute || 0;
        const viewerCount = metrics.currentViewerCount || 0;
        const streamDuration = Math.floor((Date.now() - metrics.streamStartTime) / 60000);
        const bitsEarned = metrics.sessionBitsEarned || 0;
        const subsGained = metrics.sessionSubsGained || 0;
        
        const suggestions = [];
        
        if (messageRate < 3 && viewerCount > 10) {
            suggestions.push('Ask direct questions to activate chat');
        }
        if (viewerCount > 50 && messageRate > 5) {
            suggestions.push('Perfect time for interactive content or polls');
        }
        if (streamDuration > 30 && messageRate > 8) {
            suggestions.push('High engagement - consider extending stream or doing special content');
        }
        if (bitsEarned > 1000) {
            suggestions.push('High bits activity - acknowledge supporters and encourage more');
        }
        if (subsGained > 5) {
            suggestions.push('Good sub growth - welcome new subscribers and build community');
        }
        if (metrics.sessionRaidsReceived > 0) {
            suggestions.push('Raids received - thank raiders and encourage more raids');
        }
        
        return suggestions.length > 0 ? suggestions.join('\n') : 'Continue current content strategy';
    }

    /**
     * Get a context-aware fallback prompt
     */
    getFallbackPrompt(metrics = {}, language = 'en') {
        // If we have metrics, generate a context-aware fallback
        if (metrics && Object.keys(metrics).length > 0) {
            return this.generateContextAwareFallback(metrics, language);
        }
        
        // Otherwise, use random selection
        const randomIndex = Math.floor(Math.random() * TWITCH_GEMINI_CONFIG.fallbackPrompts.length);
        const fallback = TWITCH_GEMINI_CONFIG.fallbackPrompts[randomIndex];
        
        return {
            ...fallback,
            source: 'fallback',
            context: {
                engagementLevel: 'unknown',
                sentiment: 'neutral',
                streamPhase: 'mid'
            }
        };
    }

    /**
     * Generate a context-aware fallback prompt based on current metrics
     */
    generateContextAwareFallback(metrics, language = 'en') {
        const viewerCount = metrics.currentViewerCount || 0;
        const messageRate = metrics.messagesPerMinute || 0;
        const bitsEarned = metrics.sessionBitsEarned || 0;
        const subsGained = metrics.sessionSubsGained || 0;
        const raidsReceived = metrics.sessionRaidsReceived || 0;
        const sentiment = metrics.rollingSentimentScore || 0;
        const streamDuration = Math.floor((Date.now() - metrics.streamStartTime) / 60000);
        
        // Get recent prompt history to avoid repetition
        const recentPrompts = metrics.promptHistory || [];
        const lastPrompt = recentPrompts[recentPrompts.length - 1];
        
        // Enhanced selection logic with more variety
        let candidatePrompts = [];
        
        // Engagement-based selection
        if (messageRate < 2 && viewerCount > 5) {
            // Very low engagement - need immediate activation
            candidatePrompts = TWITCH_GEMINI_CONFIG.fallbackPrompts.filter(p => 
                p.type === 'engagement' && p.priority === 'high'
            );
        } else if (messageRate < 5 && viewerCount > 10) {
            // Low engagement - variety of engagement prompts
            candidatePrompts = TWITCH_GEMINI_CONFIG.fallbackPrompts.filter(p => 
                p.type === 'engagement'
            );
        } else if (viewerCount > 50 && messageRate > 5) {
            // Good engagement - focus on growth and community
            candidatePrompts = TWITCH_GEMINI_CONFIG.fallbackPrompts.filter(p => 
                p.type === 'growth' || p.type === 'interaction'
            );
        } else if (messageRate > 10) {
            // High engagement - maintain momentum
            candidatePrompts = TWITCH_GEMINI_CONFIG.fallbackPrompts.filter(p => 
                p.type === 'momentum' || p.type === 'interaction'
            );
        } else if (viewerCount < 20) {
            // Small audience - focus on retention and connection
            candidatePrompts = TWITCH_GEMINI_CONFIG.fallbackPrompts.filter(p => 
                p.type === 'retention'
            );
        } else {
            // Default - mix of all types
            candidatePrompts = TWITCH_GEMINI_CONFIG.fallbackPrompts;
        }
        
        // Twitch-specific adjustments
        if (bitsEarned > 500) {
            // High bits activity - focus on appreciation
            candidatePrompts = candidatePrompts.filter(p => 
                p.action === 'appreciate_support' || p.type === 'momentum'
            );
        }
        
        if (subsGained > 3) {
            // Good sub growth - focus on community building
            candidatePrompts = candidatePrompts.filter(p => 
                p.action === 'build_community' || p.type === 'growth'
            );
        }
        
        if (raidsReceived > 0) {
            // Raids received - focus on welcoming
            candidatePrompts = candidatePrompts.filter(p => 
                p.action === 'welcome_raiders' || p.type === 'growth'
            );
        }
        
        // Stream phase adjustments
        if (streamDuration < 10) {
            // Early stream - prioritize welcome and engagement
            candidatePrompts = candidatePrompts.filter(p => 
                p.action === 'welcome_new_viewers' || p.type === 'engagement'
            );
        } else if (streamDuration > 45) {
            // Late stream - focus on retention and next content
            candidatePrompts = candidatePrompts.filter(p => 
                p.action === 'tease_next_content' || p.type === 'retention'
            );
        }
        
        // Avoid repeating the last prompt type
        if (lastPrompt && candidatePrompts.length > 1) {
            candidatePrompts = candidatePrompts.filter(p => p.trigger !== lastPrompt);
        }
        
        // If no candidates, use all prompts
        if (candidatePrompts.length === 0) {
            candidatePrompts = TWITCH_GEMINI_CONFIG.fallbackPrompts;
        }
        
        // Select random prompt from candidates
        const randomIndex = Math.floor(Math.random() * candidatePrompts.length);
        const selectedPrompt = candidatePrompts[randomIndex];
        
        // Return the prompt with enhanced context
        return {
            ...selectedPrompt,
            message: selectedPrompt.message,
            source: 'context_aware_fallback',
            context: {
                engagementLevel: this.analyzeEngagementLevel(metrics),
                sentiment: this.analyzeSentimentStatus(metrics),
                streamPhase: this.getStreamPhase(metrics),
                energyLevel: this.analyzeEnergyLevel(metrics),
                viewerTrend: this.analyzeViewerTrend(metrics),
                viewerCount: viewerCount,
                messageRate: messageRate,
                bitsEarned: bitsEarned,
                subsGained: subsGained,
                raidsReceived: raidsReceived,
                streamDuration: streamDuration
            }
        };
    }

    /**
     * Check if the service is healthy
     */
    getHealthStatus() {
        return {
            isAvailable: this.isAvailable,
            lastCallTime: this.lastCallTime,
            callCount: this.callCount,
            maxCallsPerMinute: this.maxCallsPerMinute,
            apiKeyConfigured: TWITCH_GEMINI_CONFIG.apiKey !== 'your_gemini_api_key_here'
        };
    }
}

module.exports = TwitchGeminiService;
