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
        
        // --- Prompt Templates for each language ---
        const templates = {
            en: {
                system_persona: "You are LiveBot, an expert Twitch stream co-host with deep knowledge of streaming psychology and audience engagement. Your task is to generate a specific, actionable prompt that will genuinely help the streamer improve their Twitch stream.",
                context_header: "STREAM CONTEXT:",
                label_stream_duration: "Stream Duration",
                label_viewer_trend: "Viewer Trend",
                label_engagement: "Engagement Level",
                label_energy: "Energy Level",
                label_sentiment: "Sentiment",
                label_growth: "Growth",
                label_category: "Game/Category",
                metrics_header: "DETAILED METRICS:",
                label_msg_per_min: "Messages per minute",
                label_follows: "Follows gained (session)",
                label_subs: "Subs gained (session)",
                label_bits: "Bits earned (session)",
                activity_header: "RECENT ACTIVITY:",
                users_header: "TOP ENGAGED USERS:",
                suggestions_header: "CONTENT SUGGESTIONS:",
                task_header: "TASK: Generate a specific, actionable prompt (1-2 sentences) that:",
                task_points: [
                    "Addresses the current stream situation with precision",
                    "Provides a clear, specific action for the streamer",
                    "Feels natural and matches the stream's energy",
                    "Helps build genuine community connection",
                    "Avoids generic phrases like \"hit that follow button\"",
                    "Considers Twitch-specific features (bits, subs, raids, etc.)"
                ],
                examples_header: "EXAMPLES OF GOOD PROMPTS:",
                examples: [
                    "\"I see we have some new faces! Drop a message and tell me what brought you here today\"",
                    "\"The chat is buzzing! Let's do a quick poll - what's your favorite part of this stream so far?\"",
                    "\"Thanks for all the bits! You all are amazing supporters!\""
                ],
                format_instructions: "FORMAT: Just the prompt text, no explanations or formatting."
            },
            fr: {
                system_persona: "Vous êtes LiveBot, un co-animateur expert de stream Twitch avec une connaissance approfondie de la psychologie du streaming et de l'engagement du public. Votre tâche est de générer une suggestion spécifique et exploitable qui aidera réellement le streamer à améliorer son stream Twitch. Vous ne devez parler QUE français.",
                context_header: "CONTEXTE DU STREAM :",
                label_stream_duration: "Durée du Stream",
                label_viewer_trend: "Tendance des spectateurs",
                label_engagement: "Niveau d'engagement",
                label_energy: "Niveau d'énergie",
                label_sentiment: "Sentiment",
                label_growth: "Croissance",
                label_category: "Jeu/Catégorie",
                metrics_header: "MÉTRIQUES DÉTAILLÉES :",
                label_msg_per_min: "Messages par minute",
                label_follows: "Follows gagnés (session)",
                label_subs: "Abonnements gagnés (session)",
                label_bits: "Bits reçus (session)",
                activity_header: "ACTIVITÉ RÉCENTE :",
                users_header: "UTILISATEURS LES PLUS ENGAGÉS :",
                suggestions_header: "SUGGESTIONS DE CONTENU :",
                task_header: "TÂCHE : Générez une suggestion spécifique et exploitable (1-2 phrases) qui :",
                task_points: [
                    "Répond à la situation actuelle du stream avec précision",
                    "Fournit une action claire et spécifique pour le streamer",
                    "Semble naturelle et correspond à l'énergie du stream",
                    "Aide à créer une véritable connexion avec la communauté",
                    "Évite les phrases génériques comme \"cliquez sur le bouton suivre\"",
                    "Prend en compte les fonctionnalités spécifiques de Twitch (bits, subs, raids, etc.)"
                ],
                examples_header: "EXEMPLES DE BONNES SUGGESTIONS :",
                examples: [
                    "\"Je vois qu'il y a de nouveaux visages ! Laissez un message et dites-moi ce qui vous amène ici aujourd'hui\"",
                    "\"Le chat est en feu ! Faisons un petit sondage : quelle est votre partie préférée du stream jusqu'à présent ?\"",
                    "\"Merci pour tous les bits ! Vous êtes des supporters incroyables !\""
                ],
                format_instructions: "FORMAT : Uniquement le texte de la suggestion, sans explications ni mise en forme. RÉPONDEZ UNIQUEMENT EN FRANÇAIS."
            }
            // You can add 'es', 'de', etc. here in the same way
        };
        
        const analysis_translations = {
            en: {
                engagement_explosive: '🔥 EXPLOSIVE - Very high engagement!',
                engagement_high: '📈 HIGH - Good engagement',
                engagement_moderate: '✅ MODERATE - Decent engagement',
                engagement_low: '📉 LOW - Needs attention',
                engagement_quiet: '😴 QUIET - Very low engagement, needs activation',
                sentiment_positive: '😊 POSITIVE - Great vibes!',
                sentiment_neutral: '😐 NEUTRAL - Mixed feelings',
                sentiment_negative: '😔 NEGATIVE - Needs energy boost',
                growth_excellent: '🚀 EXCELLENT - Strong growth!',
                growth_good: '📈 GOOD - Steady growth',
                growth_slow: '🐌 SLOW - Needs momentum',
                energy_high: '⚡ HIGH - Great energy!',
                energy_medium: '🔋 MEDIUM - Decent energy',
                energy_low: '🔋 LOW - Needs boost',
                trend_up: '📈 RISING - Viewers increasing',
                trend_stable: '➡️ STABLE - Consistent viewership',
                trend_down: '📉 DECLINING - Viewers decreasing'
            },
            fr: {
                engagement_explosive: '🔥 EXPLOSIF - Engagement très élevé !',
                engagement_high: '📈 ÉLEVÉ - Bon engagement',
                engagement_moderate: '✅ MODÉRÉ - Engagement correct',
                engagement_low: '📉 FAIBLE - Nécessite de l\'attention',
                engagement_quiet: '😴 CALME - Engagement très faible, nécessite une activation',
                sentiment_positive: '😊 POSITIF - Excellente ambiance !',
                sentiment_neutral: '😐 NEUTRE - Sentiments mitigés',
                sentiment_negative: '😔 NÉGATIF - Besoin d\'un boost d\'énergie',
                growth_excellent: '🚀 EXCELLENT - Croissance forte !',
                growth_good: '📈 BON - Croissance régulière',
                growth_slow: '🐌 LENT - Besoin d\'élan',
                energy_high: '⚡ ÉLEVÉE - Excellente énergie !',
                energy_medium: '🔋 MOYENNE - Énergie correcte',
                energy_low: '🔋 FAIBLE - Besoin d\'un boost',
                trend_up: '📈 EN HAUSSE - Spectateurs en augmentation',
                trend_stable: '➡️ STABLE - Audience constante',
                trend_down: '📉 EN BAISSE - Spectateurs en diminution'
            }
        };
        
        const t = templates[language] || templates['en']; // Get the correct language template, default to English
        const at = analysis_translations[language] || analysis_translations['en'];

        // --- The rest of your analysis logic is great, keep it! ---
        const streamPhase = this.getStreamPhase(metrics);
        const phaseContext = this.getPhaseContext(metrics, streamPhase);
        const engagementLevelKey = this.analyzeEngagementLevel(metrics);
        const engagementLevel = at[engagementLevelKey];
        const sentimentStatusKey = this.analyzeSentimentStatus(metrics);
        const sentimentStatus = at[sentimentStatusKey];
        const growthStatusKey = this.analyzeGrowthStatus(metrics);
        const growthStatus = at[growthStatusKey];
        const energyLevelKey = this.analyzeEnergyLevel(metrics);
        const energyLevel = at[energyLevelKey];
        const viewerTrendKey = this.analyzeViewerTrend(metrics);
        const viewerTrend = at[viewerTrendKey];
        const recentEvents = this.summarizeRecentEvents(metrics);
        const topEngagedUsers = this.getTopEngagedUsers(metrics);
        const contentSuggestions = this.getContentSuggestions(metrics);
        
        // --- Build the fully localized context string ---
        const context = `
${t.system_persona}

${t.context_header}
- ${t.label_stream_duration}: ${streamDuration} minutes (${streamPhase} phase)
- ${t.label_viewer_trend}: ${viewerTrend}
- ${t.label_engagement}: ${engagementLevel}
- ${t.label_energy}: ${energyLevel}
- ${t.label_sentiment}: ${sentimentStatus}
- ${t.label_growth}: ${growthStatus}
- ${t.label_category}: ${metrics.gameCategory || (language === 'fr' ? 'Inconnu' : 'Unknown')}

${t.metrics_header}
- ${t.label_msg_per_min}: ${metrics.messagesPerMinute || 0}
- ${t.label_follows}: ${metrics.sessionFollowersGained || 0}
- ${t.label_subs}: ${metrics.sessionSubsGained || 0}
- ${t.label_bits}: ${metrics.sessionBitsEarned || 0}

${t.activity_header}
${recentEvents}

${t.users_header}
${topEngagedUsers}

${t.suggestions_header}
${contentSuggestions}

${t.task_header}
${t.task_points.map(p => `1. ${p}`).join('\n')}

${t.examples_header}
${t.examples.map(e => `- ${e}`).join('\n')}

${t.format_instructions}
        `.trim();

        return context;
    }

    /**
     * Get the context for the current stream phase
     */
    getPhaseContext(metrics, streamPhase) {
        if (streamPhase === 'start') {
            return 'Stream just started - focus on welcoming new viewers and setting the tone';
        } else if (streamPhase === 'end') {
            return 'Stream is ending soon - focus on thanking viewers and encouraging follows';
        }
        return 'Mid-stream - maintain engagement and build community';
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
        
        if (messageRate > 20 && engagementRatio > 0.3) return 'engagement_explosive';
        if (messageRate > 10 && engagementRatio > 0.2) return 'engagement_high';
        if (messageRate > 5 && engagementRatio > 0.1) return 'engagement_moderate';
        if (messageRate > 2 && engagementRatio > 0.05) return 'engagement_low';
        return 'engagement_quiet';
    }

    /**
     * Analyze sentiment status
     */
    analyzeSentimentStatus(metrics) {
        const sentiment = metrics.rollingSentimentScore || 0;
        if (sentiment > 0.3) return 'sentiment_positive';
        if (sentiment > -0.1) return 'sentiment_neutral';
        return 'sentiment_negative';
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
        
        if (totalGrowth > 20) return 'growth_excellent';
        if (totalGrowth > 10) return 'growth_good';
        if (totalGrowth > 5) return 'growth_slow';
        return 'growth_slow';
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
     * Analyze energy level based on Twitch metrics
     */
    analyzeEnergyLevel(metrics) {
        const messageRate = metrics.messagesPerMinute || 0;
        const viewerCount = metrics.currentViewerCount || 0;
        const bitsEarned = metrics.sessionBitsEarned || 0;
        const subsGained = metrics.sessionSubsGained || 0;
        
        // Calculate energy score
        const energyScore = (messageRate * 2) + (viewerCount * 0.1) + (bitsEarned * 0.01) + (subsGained * 5);
        
        if (energyScore > 50) return 'energy_high';
        if (energyScore > 20) return 'energy_medium';
        return 'energy_low';
    }

    /**
     * Analyze viewer trend based on Twitch metrics
     */
    analyzeViewerTrend(metrics) {
        const currentViewers = metrics.currentViewerCount || 0;
        const peakViewers = metrics.peakViewerCount || 0;
        const averageViewers = metrics.averageViewerCount || 0;
        
        // Simple trend analysis
        if (currentViewers > averageViewers * 1.2) return 'trend_up';
        if (currentViewers < averageViewers * 0.8) return 'trend_down';
        return 'trend_stable';
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
