const tmi = require('tmi.js');
const express = require('express');
const WebSocket = require('ws');
const http = require('http');
const path = require('path');
const Sentiment = require('sentiment');
const GeminiService = require('./twitch_gemini_service');

// Initialize Express app and HTTP server
const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Configure Express middleware
app.use(express.json()); // Parse JSON bodies
app.use(express.static('.')); // Serve static files from current directory

// Initialize sentiment analyzer
const sentiment = new Sentiment();

// Initialize Gemini AI service
const geminiService = new GeminiService();
console.log('🤖 [GEMINI] Service initialized:', geminiService.getHealthStatus());

// Global language setting for AI prompts (default: English)
let currentLanguage = 'en';

// AI Prompt Translations for Twitch
const promptTranslations = {
    en: {
        // Chat Activation prompts
        chatActivation: "💬 **Chat Activation**: With {viewerCount} viewers, chat is quiet ({messageRate} messages/min). Say: \"I want to hear from you! What's on your mind today?\" or \"Type your favorite emoji if you're enjoying this stream!\"",
        followBoost: "❤️ **Follow Boost**: Current follow rate is {followRate}/min with {viewerCount} viewers. Say: \"If you're enjoying this, hit that follow button! It really helps the stream!\" or \"Show some love with a follow if you agree with this!\"",
        communityGrowth: "📈 **Community Growth**: Great energy with {viewerCount} viewers! Say: \"If you're new here, hit that follow button and let's build this community together!\" or \"I love seeing new faces! Drop a message and let me know where you're from!\"",
        aiEngagementBoost: "💬 **AI Engagement Boost**: Engagement is low with {viewerCount} viewers. Say: \"I want to hear your thoughts! What's your take on this?\" or \"Let's get this chat moving! Share something that made you laugh today!\"",
        aiInteraction: "🎯 **AI Interaction**: Moderate engagement detected. Say: \"I love hearing from you! What's your experience with this?\" or \"Keep the conversation going! What do you think about this topic?\"",
        aiMomentum: "🎯 **AI Momentum**: Good engagement! Say: \"The energy is amazing! Let's keep it going - what's your opinion on this?\" or \"I love this energy! Share something that excites you about this topic!\"",
        
        // Twitch-specific prompts
        bitsBoost: "💰 **Bits Boost**: Great bits activity! Say: \"Thanks for the bits! You all are amazing supporters!\" or \"I love seeing the support! Keep those bits coming if you're enjoying this!\"",
        subBoost: "🎉 **Sub Boost**: New subscriber! Say: \"Welcome to the family! Thanks for subscribing!\" or \"Another amazing person joined the community! Welcome!\"",
        raidBoost: "⚔️ **Raid Boost**: Incoming raid! Say: \"Welcome raiders! Thanks for bringing the energy!\" or \"Let's show our raiders some love! Welcome everyone!\"",
        
        // Enhanced fallback prompts with more variety
        fallback_engagement_question: "💬 **Direct Question**: Chat needs activation! Say: \"I want to hear from you! What's the most interesting thing that happened to you this week?\" or \"Drop a message and tell me what you think about this topic!\"",
        fallback_engagement_poll: "📊 **Quick Poll**: Perfect for engagement! Say: \"Let's do a quick poll! Type your favorite [topic] and I'll count the votes!\" or \"I'm curious - what's your opinion on this? Share your thoughts!\"",
        fallback_engagement_challenge: "🎯 **Interactive Challenge**: Let's get creative! Say: \"Challenge time! Type the most creative [topic] and I'll pick the best ones!\" or \"Who can come up with the funniest [topic]? Let's see what you've got!\"",
        
        fallback_growth_welcome: "👋 **Welcome New Viewers**: Great to see new faces! Say: \"Welcome to all the new faces! Drop a message and tell me where you're from!\" or \"I love seeing new people join! What brought you here today?\"",
        fallback_growth_community: "🤝 **Build Community**: Perfect time to connect! Say: \"I love this community we're building! Share something about yourself in the chat!\" or \"Let's get to know each other better - what's your favorite thing about this stream?\"",
        fallback_growth_share: "📢 **Encourage Sharing**: Great momentum! Say: \"If you're enjoying this, share it with your friends! Tag someone who would love this!\" or \"Help me grow this community - share this stream with someone who needs to see it!\"",
        
        fallback_interaction_game: "🎮 **Interactive Game**: Let's play! Say: \"Game time! Type your favorite [topic] and I'll pick the most creative ones!\" or \"Let's do something fun! Who can guess what I'm thinking about?\"",
        fallback_interaction_story: "📖 **Share a Story**: Perfect for connection! Say: \"I want to hear your stories! What's the most interesting thing that happened to you recently?\" or \"Let's share some stories! What's something that made you laugh today?\"",
        fallback_interaction_react: "🎭 **React to Content**: Great energy! Say: \"I love your reactions! What do you think about this? Share your thoughts!\" or \"The chat is buzzing! Let's keep this energy going - what's your take on this?\"",
        
        fallback_retention_connection: "💝 **Build Connection**: Let's connect deeper! Say: \"I want to know you better! What's something that always makes you smile?\" or \"Let's build a real connection - what's your biggest dream right now?\"",
        fallback_retention_value: "💎 **Provide Value**: Adding value to your stream! Say: \"I want to make sure you're getting value from this! What would you like to learn more about?\" or \"Let me know what you'd like to see more of in future streams!\"",
        fallback_retention_energy: "⚡ **Boost Energy**: Let's energize the chat! Say: \"I need your energy! What's something that always gets you hyped up?\" or \"Let's turn up the energy! What's your go-to pump-up song?\"",
        
        fallback_momentum_maintain: "🔥 **Maintain Momentum**: Keep the energy flowing! Say: \"I love this energy! Let's keep it going - what should we do next?\" or \"The vibe is perfect right now! How can we make it even better?\"",
        fallback_momentum_celebrate: "🎉 **Celebrate Achievements**: Time to celebrate! Say: \"You all are amazing! What's something you're proud of accomplishing recently?\" or \"Let's celebrate together! What's your biggest win this week?\"",
        fallback_momentum_next: "🔮 **Tease Next Content**: Building anticipation! Say: \"I'm already excited for next time! What would you like to see in the next stream?\" or \"This is just the beginning! What should we explore together next?\""
    },
    fr: {
        // Chat Activation prompts
        chatActivation: "💬 **Activation du Chat**: Avec {viewerCount} spectateurs, le chat est calme ({messageRate} messages/min). Dites: \"Je veux entendre votre avis ! Qu'est-ce qui vous préoccupe aujourd'hui ?\" ou \"Tapez votre emoji préféré si vous aimez ce stream !\"",
        followBoost: "❤️ **Boost des Follows**: Le taux de follows actuel est de {followRate}/min avec {viewerCount} spectateurs. Dites: \"Si vous aimez ça, appuyez sur le bouton follow ! Ça aide vraiment le stream !\" ou \"Montrez votre amour avec un follow si vous êtes d'accord !\"",
        communityGrowth: "📈 **Croissance de la Communauté**: Excellente énergie avec {viewerCount} spectateurs ! Dites: \"Si vous êtes nouveau ici, appuyez sur le bouton follow et construisons cette communauté ensemble !\" ou \"J'adore voir de nouveaux visages ! Laissez un message et dites-moi d'où vous venez !\"",
        aiEngagementBoost: "💬 **Boost d'Engagement IA**: L'engagement est faible avec {viewerCount} spectateurs. Dites: \"Je veux entendre vos pensées ! Qu'est-ce que vous en pensez ?\" ou \"Faisons bouger ce chat ! Partagez quelque chose qui vous a fait rire aujourd'hui !\"",
        aiInteraction: "🎯 **Interaction IA**: Engagement modéré détecté. Dites: \"J'adore vous entendre ! Quelle est votre expérience avec ça ?\" ou \"Continuez la conversation ! Que pensez-vous de ce sujet ?\"",
        aiMomentum: "🎯 **Élan IA**: Bon engagement ! Dites: \"L'énergie est incroyable ! Continuons - quelle est votre opinion sur ça ?\" ou \"J'adore cette énergie ! Partagez quelque chose qui vous excite sur ce sujet !\"",
        
        // Twitch-specific prompts
        bitsBoost: "💰 **Boost Bits**: Excellente activité bits ! Dites: \"Merci pour les bits ! Vous êtes tous des supporters incroyables !\" ou \"J'adore voir le support ! Continuez les bits si vous aimez ça !\"",
        subBoost: "🎉 **Boost Sub**: Nouvel abonné ! Dites: \"Bienvenue dans la famille ! Merci de vous être abonné !\" ou \"Une autre personne incroyable a rejoint la communauté ! Bienvenue !\"",
        raidBoost: "⚔️ **Boost Raid**: Raid entrant ! Dites: \"Bienvenue les raiders ! Merci d'apporter l'énergie !\" ou \"Montrons notre amour aux raiders ! Bienvenue à tous !\"",
        
        // Enhanced fallback prompts with more variety
        fallback_engagement_question: "💬 **Question Directe**: Le chat a besoin d'activation! Dites: \"Je veux vous entendre! Quelle est la chose la plus intéressante qui vous est arrivée cette semaine?\" ou \"Laissez un message et dites-moi ce que vous pensez de ce sujet!\"",
        fallback_engagement_poll: "📊 **Sondage Rapide**: Parfait pour l'engagement! Dites: \"Faisons un sondage rapide! Tapez votre [sujet] préféré et je compterai les votes!\" ou \"Je suis curieux - quel est votre avis là-dessus? Partagez vos pensées!\"",
        fallback_engagement_challenge: "🎯 **Défi Interactif**: Soyons créatifs! Dites: \"C'est l'heure du défi! Tapez le [sujet] le plus créatif et je choisirai les meilleurs!\" ou \"Qui peut trouver le [sujet] le plus drôle? Montrez-moi ce que vous avez!\"",
        
        fallback_growth_welcome: "👋 **Accueillir Nouveaux Spectateurs**: Super de voir de nouveaux visages! Dites: \"Bienvenue à tous les nouveaux visages! Laissez un message et dites-moi d'où vous venez!\" ou \"J'adore voir de nouvelles personnes rejoindre! Qu'est-ce qui vous a amené ici aujourd'hui?\"",
        fallback_growth_community: "🤝 **Construire Communauté**: Moment parfait pour se connecter! Dites: \"J'adore cette communauté que nous construisons! Partagez quelque chose sur vous dans le chat!\" ou \"Apprenons à nous connaître mieux - quelle est votre chose préférée dans ce stream?\"",
        fallback_growth_share: "📢 **Encourager Partage**: Excellent momentum! Dites: \"Si vous aimez ça, partagez-le avec vos amis! Taggez quelqu'un qui adorerait ça!\" ou \"Aidez-moi à faire grandir cette communauté - partagez ce stream avec quelqu'un qui doit le voir!\"",
        
        fallback_interaction_game: "🎮 **Jeu Interactif**: Jouons! Dites: \"C'est l'heure du jeu! Tapez votre [sujet] préféré et je choisirai les plus créatifs!\" ou \"Faisons quelque chose d'amusant! Qui peut deviner à quoi je pense?\"",
        fallback_interaction_story: "📖 **Partager Histoire**: Parfait pour la connexion! Dites: \"Je veux entendre vos histoires! Quelle est la chose la plus intéressante qui vous est arrivée récemment?\" ou \"Partageons des histoires! Qu'est-ce qui vous a fait rire aujourd'hui?\"",
        fallback_interaction_react: "🎭 **Réagir au Contenu**: Excellente énergie! Dites: \"J'adore vos réactions! Qu'est-ce que vous pensez de ça? Partagez vos pensées!\" ou \"Le chat bourdonne! Continuons cette énergie - quel est votre avis là-dessus?\"",
        
        fallback_retention_connection: "💝 **Construire Connexion**: Connectons-nous plus profondément! Dites: \"Je veux mieux vous connaître! Qu'est-ce qui vous fait toujours sourire?\" ou \"Construisons une vraie connexion - quel est votre plus grand rêve en ce moment?\"",
        fallback_retention_value: "💎 **Fournir Valeur**: Ajoutant de la valeur à votre stream! Dites: \"Je veux m'assurer que vous tirez de la valeur de ça! Sur quoi aimeriez-vous en apprendre plus?\" ou \"Dites-moi ce que vous aimeriez voir plus dans les futurs streams!\"",
        fallback_retention_energy: "⚡ **Booster Énergie**: Énergisons le chat! Dites: \"J'ai besoin de votre énergie! Qu'est-ce qui vous met toujours en forme?\" ou \"Montons l'énergie! Quelle est votre chanson de motivation préférée?\"",
        
        fallback_momentum_maintain: "🔥 **Maintenir Momentum**: Gardons l'énergie qui coule! Dites: \"J'adore cette énergie! Continuons - que devrions-nous faire ensuite?\" ou \"L'ambiance est parfaite maintenant! Comment pouvons-nous l'améliorer encore?\"",
        fallback_momentum_celebrate: "🎉 **Célébrer Réussites**: C'est l'heure de célébrer! Dites: \"Vous êtes tous incroyables! Qu'est-ce dont vous êtes fier d'avoir accompli récemment?\" ou \"Célébrons ensemble! Quelle est votre plus grande victoire cette semaine?\"",
        fallback_momentum_next: "🔮 **Teaser Prochain Contenu**: Construire l'anticipation! Dites: \"Je suis déjà excité pour la prochaine fois! Qu'aimeriez-vous voir dans le prochain stream?\" ou \"Ce n'est que le début! Qu'explorerons-nous ensemble ensuite?\""
    }
};

// Current channel tracking
let currentChannel = process.env.TWITCH_CHANNEL || '';
let isConnected = false;

// Helper function to calculate accurate revenue based on Twitch monetization rates
function calculateAccurateRevenue(metrics) {
    // Twitch Bits: 1 bit = $0.01 USD (streamer receives full value)
    const bitsRevenue = (metrics.sessionBitsEarned || 0) * 0.01;
    
    // Twitch Subscriptions: Revenue split varies by tier and partnership level
    // Standard rates (50% split): Tier 1: $2.50, Tier 2: $5.00, Tier 3: $12.50
    // For simplicity, we'll use average rates, but could be enhanced with actual tier tracking
    const tier1Revenue = (metrics.sessionTier1Subs || 0) * 2.50;  // $4.99 * 50%
    const tier2Revenue = (metrics.sessionTier2Subs || 0) * 5.00;  // $9.99 * 50%
    const tier3Revenue = (metrics.sessionTier3Subs || 0) * 12.50; // $24.99 * 50%
    
    // If we don't have tier breakdown, use average of $2.50 per sub
    const averageSubRevenue = (metrics.sessionSubsGained || 0) * 2.50;
    const subsRevenue = (metrics.sessionTier1Subs || metrics.sessionTier2Subs || metrics.sessionTier3Subs) ? 
        (tier1Revenue + tier2Revenue + tier3Revenue) : averageSubRevenue;
    
    return {
        bits: bitsRevenue,
        subs: subsRevenue,
        total: bitsRevenue + subsRevenue,
        breakdown: {
            bits: bitsRevenue,
            tier1: tier1Revenue,
            tier2: tier2Revenue,
            tier3: tier3Revenue,
            totalSubs: subsRevenue
        }
    };
}

// Helper function to reset stream metrics
function resetStreamMetrics() {
    streamMetrics = {
        // Basic stream info
        streamStartTime: null,
        currentViewerCount: 0,
        peakViewerCount: 0,
        averageViewerCount: 0,
        totalViewerMinutes: 0,
        
        // Chat metrics
        totalMessages: 0,
        messagesPerMinute: 0,
        uniqueChatters: new Set(),
        recentMessages: [],
        rollingSentimentScore: 0,
        
        // Engagement metrics
        totalFollowers: 0,
        sessionFollowersGained: 0,
        followersGainsPerMinute: 0,
        newFollowers: [],
        
        totalSubs: 0,
        sessionSubsGained: 0,
        subsGainsPerMinute: 0,
        newSubs: [],
        
        // Subscription tier breakdown
        tier1Subs: 0,
        tier2Subs: 0,
        tier3Subs: 0,
        sessionTier1Subs: 0,
        sessionTier2Subs: 0,
        sessionTier3Subs: 0,
        
        totalBits: 0,
        sessionBitsEarned: 0,
        bitsPerMinute: 0,
        recentBits: [],
        
        totalRaids: 0,
        sessionRaidsReceived: 0,
        raidsPerMinute: 0,
        recentRaids: [],
        
        // Stream status
        isLive: false,
        streamTitle: '',
        gameCategory: '',
        streamLanguage: '',
        
        // User engagement tracking
        userEngagement: new Map(),
        topEngagedUsers: [],
        
        // AI and prompts
        promptHistory: [],
        lastPromptTime: null,
        
        // Viewer retention
        viewerRetention: 0,
        
        // New growth metrics
        peerAvgViewers: 75,
        viewerRec: "Increase interactive segments to boost by 20%",
        peerRetention: 60,
        retentionRec: "Add polls every 15 min",
        peerGrowth: 12,
        growthRec: "Collaborate with similar-sized streamers",
        predictedRetention: 50,
        scheduleSuggestion: "Tue 8PM",
        scheduleReason: "+25% views expected",
        projectedRevenue: 0,
        revenueTip: "Focus on Tier 2 subs",
        healthScore: 0
    };
    console.log('🔄 [METRICS] Stream metrics reset for new channel');
}

// Helper function to set up Twitch event handlers
function setupTwitchEventHandlers(client) {
    // Chat message handler
    client.on('message', (channel, tags, message, self) => {
        if (self) return;
        
        const username = tags.username;
        const displayName = tags['display-name'] || username;
        const messageId = `${username}-${message}-${Date.now()}`;
        
        // Check for duplicate messages (same user, same message within 1 second)
        const recentMessage = streamMetrics.recentMessages.find(msg => 
            msg.username === displayName && 
            msg.message === message && 
            (Date.now() - msg.timestamp) < 1000
        );
        
        if (recentMessage) {
            console.log(`🔄 [CHAT] Skipping duplicate message from ${displayName}: ${message}`);
            return;
        }
        
        // Add to recent messages
        streamMetrics.recentMessages.push({
            username: displayName,
            message: message,
            timestamp: Date.now()
        });
        
        // Keep only last 100 messages
        if (streamMetrics.recentMessages.length > 100) {
            streamMetrics.recentMessages = streamMetrics.recentMessages.slice(-100);
        }
        
        // Update user engagement
        if (!streamMetrics.userEngagement.has(username)) {
            streamMetrics.userEngagement.set(username, {
                messages: 0,
                bits: 0,
                follows: 0,
                subs: 0
            });
        }
        
        const userData = streamMetrics.userEngagement.get(username);
        userData.messages = (userData.messages || 0) + 1;
        
        // Update metrics
        streamMetrics.totalMessages++;
        streamMetrics.uniqueChatters.add(username);
        
        // Analyze sentiment
        analyzeSentiment();
        
        // Update rolling metrics
        calculateRollingMetrics();
        updateTopEngagedUsers();
        
        // Broadcast updates immediately for real-time chat
        broadcastMetrics();
    });
    
    // Follow handler
    client.on('follow', (channel, username, displayName, userID) => {
        console.log(`👥 [FOLLOW] ${displayName} followed!`);
        
        streamMetrics.totalFollowers++;
        streamMetrics.sessionFollowersGained++;
        
        // Add to recent followers
        streamMetrics.newFollowers.push({
            username: displayName,
            timestamp: Date.now()
        });
        
        // Keep only last 50 followers
        if (streamMetrics.newFollowers.length > 50) {
            streamMetrics.newFollowers = streamMetrics.newFollowers.slice(-50);
        }
        
        // Update user engagement
        if (!streamMetrics.userEngagement.has(username)) {
            streamMetrics.userEngagement.set(username, {
                messages: 0,
                bits: 0,
                follows: 0,
                subs: 0
            });
        }
        
        const userData = streamMetrics.userEngagement.get(username);
        userData.follows = (userData.follows || 0) + 1;
        
        // Update rolling metrics
        calculateRollingMetrics();
        updateTopEngagedUsers();
        
        // Broadcast updates immediately for real-time follows
        broadcastMetrics();
    });
    
    // Subscription handler
    client.on('subscription', (channel, username, displayName, subInfo) => {
        const plan = subInfo ? subInfo.plan : 'unknown';
        console.log(`🎉 [SUB] ${displayName} subscribed with ${plan} plan!`);
        console.log(`🔍 [DEBUG] Sub info:`, subInfo);
        
        streamMetrics.totalSubs++;
        streamMetrics.sessionSubsGained++;
        
        // Track subscription tiers for accurate revenue calculation
        // Handle different plan formats from Twitch
        let tier = 'unknown';
        if (typeof plan === 'string') {
            if (plan === '1000' || plan === 'Tier 1' || plan === 'Prime') {
                tier = 'Tier 1';
                streamMetrics.tier1Subs++;
                streamMetrics.sessionTier1Subs++;
            } else if (plan === '2000' || plan === 'Tier 2') {
                tier = 'Tier 2';
                streamMetrics.tier2Subs++;
                streamMetrics.sessionTier2Subs++;
            } else if (plan === '3000' || plan === 'Tier 3') {
                tier = 'Tier 3';
                streamMetrics.tier3Subs++;
                streamMetrics.sessionTier3Subs++;
            } else if (plan === 'gift' || plan === 'resub') {
                // For gifts and resubs, assume Tier 1 (most common)
                tier = 'Tier 1 (gift/resub)';
                streamMetrics.tier1Subs++;
                streamMetrics.sessionTier1Subs++;
            }
        } else if (typeof plan === 'object' && plan.plan) {
            // Handle object format like {"prime":false,"plan":"1000","planName":"Channel Subscription"}
            if (plan.plan === '1000') {
                tier = 'Tier 1';
                streamMetrics.tier1Subs++;
                streamMetrics.sessionTier1Subs++;
            } else if (plan.plan === '2000') {
                tier = 'Tier 2';
                streamMetrics.tier2Subs++;
                streamMetrics.sessionTier2Subs++;
            } else if (plan.plan === '3000') {
                tier = 'Tier 3';
                streamMetrics.tier3Subs++;
                streamMetrics.sessionTier3Subs++;
            }
        }
        
        console.log(`💰 [TIER] Assigned to ${tier}`);
        
        // Add to recent subs
        streamMetrics.newSubs.push({
            username: displayName,
            plan: plan,
            timestamp: Date.now()
        });
        
        // Keep only last 50 subs
        if (streamMetrics.newSubs.length > 50) {
            streamMetrics.newSubs = streamMetrics.newSubs.slice(-50);
        }
        
        // Update user engagement
        if (!streamMetrics.userEngagement.has(username)) {
            streamMetrics.userEngagement.set(username, {
                messages: 0,
                bits: 0,
                follows: 0,
                subs: 0
            });
        }
        
        const userData = streamMetrics.userEngagement.get(username);
        userData.subs = (userData.subs || 0) + 1;
        
        // Update rolling metrics
        calculateRollingMetrics();
        updateTopEngagedUsers();
        
        // Broadcast updates
        broadcastMetrics();
    });
    
    // Bits handler
    client.on('cheer', (channel, tags, message) => {
        const username = tags.username;
        const displayName = tags['display-name'] || username;
        const bits = parseInt(tags.bits) || 0;
        
        console.log(`💰 [BITS] ${displayName} cheered ${bits} bits!`);
        
        streamMetrics.totalBits += bits;
        streamMetrics.sessionBitsEarned += bits;
        
        // Add to recent bits
        streamMetrics.recentBits.push({
            username: displayName,
            bits: bits,
            message: message,
            timestamp: Date.now()
        });
        
        // Keep only last 50 bits
        if (streamMetrics.recentBits.length > 50) {
            streamMetrics.recentBits = streamMetrics.recentBits.slice(-50);
        }
        
        // Update user engagement
        if (!streamMetrics.userEngagement.has(username)) {
            streamMetrics.userEngagement.set(username, {
                messages: 0,
                bits: 0,
                follows: 0,
                subs: 0
            });
        }
        
        const userData = streamMetrics.userEngagement.get(username);
        userData.bits = (userData.bits || 0) + bits;
        
        // Update rolling metrics
        calculateRollingMetrics();
        updateTopEngagedUsers();
        
        // Broadcast updates
        broadcastMetrics();
    });
    
    // Raid handler
    client.on('raided', (channel, username, viewers) => {
        console.log(`⚔️ [RAID] ${username} raided with ${viewers} viewers!`);
        
        streamMetrics.totalRaids++;
        streamMetrics.sessionRaidsReceived++;
        
        // Add to recent raids
        streamMetrics.recentRaids.push({
            username: username,
            viewers: viewers,
            timestamp: Date.now()
        });
        
        // Keep only last 20 raids
        if (streamMetrics.recentRaids.length > 20) {
            streamMetrics.recentRaids = streamMetrics.recentRaids.slice(-20);
        }
        
        // Update rolling metrics
        calculateRollingMetrics();
        updateTopEngagedUsers();
        
        // Broadcast updates
        broadcastMetrics();
    });
    
    // Handle resub
    client.on('resub', (channel, username, months, message, userstate, methods) => {
        console.log(`🎉 [RESUB] ${username} resubscribed for ${months} months!`);
        
        streamMetrics.totalSubs++;
        streamMetrics.sessionSubsGained++;
        
        // Add to new subs
        streamMetrics.newSubs.push({
            username: username,
            plan: 'resub',
            months: months,
            timestamp: Date.now()
        });
        
        // Keep only last 50 subs
        if (streamMetrics.newSubs.length > 50) {
            streamMetrics.newSubs = streamMetrics.newSubs.slice(-50);
        }
        
        // Update user engagement
        if (!streamMetrics.userEngagement.has(username)) {
            streamMetrics.userEngagement.set(username, {
                messages: 0,
                bits: 0,
                follows: 0,
                subs: 0
            });
        }
        
        const userData = streamMetrics.userEngagement.get(username);
        userData.subs = (userData.subs || 0) + 1;
        
        // Update rolling metrics
        calculateRollingMetrics();
        updateTopEngagedUsers();
        
        // Broadcast updates
        broadcastMetrics();
    });
    
    // Handle gift subscriptions
    client.on('subgift', (channel, username, streakMonths, recipient, methods, userstate) => {
        console.log(`🎁 [GIFT SUB] ${username} gifted a sub to ${recipient}!`);
        
        streamMetrics.totalSubs++;
        streamMetrics.sessionSubsGained++;
        
        // Add to new subs
        streamMetrics.newSubs.push({
            username: username,
            plan: 'gift',
            recipient: recipient,
            timestamp: Date.now()
        });
        
        // Keep only last 50 subs
        if (streamMetrics.newSubs.length > 50) {
            streamMetrics.newSubs = streamMetrics.newSubs.slice(-50);
        }
        
        // Update user engagement
        if (!streamMetrics.userEngagement.has(username)) {
            streamMetrics.userEngagement.set(username, {
                messages: 0,
                bits: 0,
                follows: 0,
                subs: 0
            });
        }
        
        const userData = streamMetrics.userEngagement.get(username);
        userData.subs = (userData.subs || 0) + 1;
        
        // Update rolling metrics
        calculateRollingMetrics();
        updateTopEngagedUsers();
        
        // Broadcast updates
        broadcastMetrics();
    });
    
    // Handle mystery gifts
    client.on('submysterygift', (channel, username, numbOfSubs, methods, userstate) => {
        console.log(`🎁 [MYSTERY GIFT] ${username} gifted ${numbOfSubs} subs!`);
        
        streamMetrics.totalSubs += numbOfSubs;
        streamMetrics.sessionSubsGained += numbOfSubs;
        
        // Add to new subs
        streamMetrics.newSubs.push({
            username: 'mystery_gift_recipients',
            plan: 'mystery_gift',
            gifter: username,
            count: numbOfSubs,
            timestamp: Date.now()
        });
        
        // Keep only last 50 subs
        if (streamMetrics.newSubs.length > 50) {
            streamMetrics.newSubs = streamMetrics.newSubs.slice(-50);
        }
        
        // Update user engagement
        if (!streamMetrics.userEngagement.has(username)) {
            streamMetrics.userEngagement.set(username, {
                messages: 0,
                bits: 0,
                follows: 0,
                subs: 0
            });
        }
        
        const userData = streamMetrics.userEngagement.get(username);
        userData.subs = (userData.subs || 0) + numbOfSubs;
        
        // Update rolling metrics
        calculateRollingMetrics();
        updateTopEngagedUsers();
        
        // Broadcast updates
        broadcastMetrics();
    });
    
    // Connection handlers
    client.on('connected', (addr, port) => {
        console.log(`🔗 [TWITCH] Connected to Twitch IRC at ${addr}:${port}`);
        streamMetrics.streamStartTime = Date.now();
    });
    
    client.on('disconnected', (reason) => {
        console.log(`❌ [TWITCH] Disconnected from Twitch IRC: ${reason}`);
    });
    
    // Add debugging for all events
    client.on('raw_message', (messageCloned, message) => {
        console.log(`🔍 [DEBUG] Raw message:`, {
            raw: message.raw,
            tags: message.tags,
            prefix: message.prefix,
            command: message.command,
            params: message.params
        });
        
        // Check for specific events
        const messageStr = message.raw || '';
        if (messageStr.includes('subscribed') || messageStr.includes('submysterygift') || messageStr.includes('subgift')) {
            console.log('🎉 SUBSCRIPTION EVENT DETECTED!');
        }
        if (messageStr.includes('cheer') || messageStr.includes('bits')) {
            console.log('💰 BITS EVENT DETECTED!');
        }
        if (messageStr.includes('followed')) {
            console.log('👥 FOLLOW EVENT DETECTED!');
        }
    });
}

// Twitch-specific metrics and data structures
let streamMetrics = {};
resetStreamMetrics();

// Twitch client configuration - will be created when user connects to a channel
let twitchClient = null;

// WebSocket connections for dashboard
const dashboardConnections = new Set();

// Twitch API configuration
const TWITCH_API_CONFIG = {
    clientId: process.env.TWITCH_CLIENT_ID || 'your_client_id',
    clientSecret: process.env.TWITCH_CLIENT_SECRET || 'your_client_secret',
    accessToken: process.env.TWITCH_ACCESS_TOKEN || 'your_access_token'
};

// Twitch API helper functions
async function getTwitchAPI(endpoint, params = {}) {
    const url = new URL(`https://api.twitch.tv/helix/${endpoint}`);
    Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));
    
    const response = await fetch(url, {
        headers: {
            'Client-ID': TWITCH_API_CONFIG.clientId,
            'Authorization': `Bearer ${TWITCH_API_CONFIG.accessToken}`
        }
    });
    
    if (!response.ok) {
        throw new Error(`Twitch API error: ${response.status}`);
    }
    
    return response.json();
}

// Get current stream info
async function getStreamInfo() {
    try {
        if (!currentChannel) {
            console.log('🔍 [API] No channel connected, skipping stream info fetch');
            return null;
        }
        
        console.log(`🔍 [API] Fetching stream info for channel: ${currentChannel}`);
        const data = await getTwitchAPI('streams', {
            user_login: currentChannel
        });
        
        console.log(`📊 [API] Received data:`, JSON.stringify(data, null, 2));
        
        if (data.data && data.data.length > 0) {
            const stream = data.data[0];
            streamMetrics.isLive = true;
            streamMetrics.streamTitle = stream.title;
            streamMetrics.gameCategory = stream.game_name;
            streamMetrics.currentViewerCount = stream.viewer_count;
            streamMetrics.streamLanguage = stream.language;
            
            // Update peak viewers
            if (stream.viewer_count > streamMetrics.peakViewerCount) {
                streamMetrics.peakViewerCount = stream.viewer_count;
            }
            
            console.log(`✅ [STREAM] Updated metrics - Live: ${streamMetrics.isLive}, Viewers: ${streamMetrics.currentViewerCount}`);
            return stream;
        } else {
            streamMetrics.isLive = false;
            console.log('❌ [STREAM] No live stream found');
            return null;
        }
    } catch (error) {
        console.error('❌ [API] Error getting stream info:', error);
        return null;
    }
}

// Get channel info
async function getChannelInfo(channel) {
    try {
        const data = await getTwitchAPI('users', {
            login: channel
        });
        
        if (data.data && data.data.length > 0) {
            return data.data[0];
        }
        return null;
    } catch (error) {
        console.error('Error getting channel info:', error);
        return null;
    }
}

// Get total followers
async function getFollowerCount(userId) {
    try {
        const data = await getTwitchAPI('users/follows', {
            to_id: userId,
            first: 1 // We only need the total
        });
        
        return data.total || 0;
    } catch (error) {
        console.error('Error getting follower count:', error);
        return 0;
    }
}

// Get subscriber count (requires broadcaster token with channel:read:subscriptions scope)
async function getSubscriberCount(userId) {
    try {
        const data = await getTwitchAPI('subscriptions', {
            broadcaster_id: userId
        });
        
        return data.total || 0;
    } catch (error) {
        console.error('Error getting subscriber count:', error);
        return 0;
    }
}

// Fetch initial metrics when connecting to channel
async function fetchInitialMetrics(channel) {
    try {
        const channelInfo = await getChannelInfo(channel);
        if (!channelInfo) return;
        
        const userId = channelInfo.id;
        
        // Get followers
        streamMetrics.totalFollowers = await getFollowerCount(userId);
        
        // Get subscribers (may require additional scopes)
        streamMetrics.totalSubs = await getSubscriberCount(userId);
        
        console.log(`📊 [INITIAL] Fetched metrics - Followers: ${streamMetrics.totalFollowers}, Subs: ${streamMetrics.totalSubs}`);
    } catch (error) {
        console.error('Error fetching initial metrics:', error);
    }
}

// Calculate rolling metrics
function calculateRollingMetrics() {
    const now = Date.now();
    const streamDuration = streamMetrics.streamStartTime ? (now - streamMetrics.streamStartTime) / 60000 : 0; // minutes
    
    if (streamDuration > 0) {
        // Messages per minute
        streamMetrics.messagesPerMinute = streamMetrics.totalMessages / streamDuration;
        
        // Followers per minute
        streamMetrics.followersGainsPerMinute = streamMetrics.sessionFollowersGained / streamDuration;
        
        // Subs per minute
        streamMetrics.subsGainsPerMinute = streamMetrics.sessionSubsGained / streamDuration;
        
        // Bits per minute
        streamMetrics.bitsPerMinute = streamMetrics.sessionBitsEarned / streamDuration;
        
        // Average viewers
        streamMetrics.averageViewerCount = streamMetrics.totalViewerMinutes / streamDuration;
        
        // Viewer retention (simplified calculation)
        streamMetrics.viewerRetention = streamMetrics.currentViewerCount > 0 ? 
            Math.min(100, (streamMetrics.currentViewerCount / Math.max(streamMetrics.peakViewerCount, 1)) * 100) : 0;
        
        // Predicted retention (dummy calc)
        streamMetrics.predictedRetention = Math.round(50 + streamMetrics.rollingSentimentScore * 20 + (streamMetrics.currentViewerCount / 10));
        
        // Projected revenue (daily * 30)
        const dailyRev = calculateAccurateRevenue(streamMetrics).total;
        streamMetrics.projectedRevenue = dailyRev * 30;
        
        // Revenue tip
        streamMetrics.revenueTip = streamMetrics.projectedRevenue < 50 ? "Focus on subs" : "Great momentum!";
        
        // Health score
        const durationHours = streamDuration / 60;
        let score = 100 - (durationHours * 10);
        score += streamMetrics.rollingSentimentScore * 20;
        streamMetrics.healthScore = Math.max(0, Math.min(100, score));
    }
}

// Analyze sentiment of recent messages
function analyzeSentiment() {
    if (streamMetrics.recentMessages.length === 0) return;
    
    const recentMessages = streamMetrics.recentMessages.slice(-20); // Last 20 messages
    let totalSentiment = 0;
    let validMessages = 0;
    
    recentMessages.forEach(msg => {
        if (msg.message && msg.message.length > 0) {
            const result = sentiment.analyze(msg.message);
            totalSentiment += result.score;
            validMessages++;
        }
    });
    
    if (validMessages > 0) {
        streamMetrics.rollingSentimentScore = totalSentiment / validMessages;
    }
}

// Update top engaged users
function updateTopEngagedUsers() {
    const userArray = Array.from(streamMetrics.userEngagement.entries())
        .map(([username, data]) => ({
            username,
            messages: data.messages || 0,
            bits: data.bits || 0,
            follows: data.follows || 0,
            subs: data.subs || 0,
            totalEngagement: (data.messages || 0) + (data.bits || 0) + (data.follows || 0) + (data.subs || 0)
        }))
        .sort((a, b) => b.totalEngagement - a.totalEngagement)
        .slice(0, 10);
    
    streamMetrics.topEngagedUsers = userArray;
}

// Generate AI prompt based on current metrics
async function generateAIPrompt() {
    try {
        const prompt = await geminiService.generatePrompt(streamMetrics, currentLanguage);
        
        // Add to prompt history
        streamMetrics.promptHistory.push({
            timestamp: Date.now(),
            prompt: prompt,
            metrics: {
                viewerCount: streamMetrics.currentViewerCount,
                messageRate: streamMetrics.messagesPerMinute,
                sentiment: streamMetrics.rollingSentimentScore
            }
        });
        
        // Keep only last 50 prompts
        if (streamMetrics.promptHistory.length > 50) {
            streamMetrics.promptHistory = streamMetrics.promptHistory.slice(-50);
        }
        
        streamMetrics.lastPromptTime = Date.now();
        
        return prompt;
    } catch (error) {
        console.error('Error generating AI prompt:', error);
        return null;
    }
}

// Broadcast metrics to dashboard
function broadcastMetrics() {
    // Only broadcast if we're connected to a channel
    if (!isConnected || !currentChannel) {
        return;
    }
    
    // Calculate accurate revenue
    const revenueData = calculateAccurateRevenue(streamMetrics);
    
    const metricsData = {
        ...streamMetrics,
        uniqueChatters: streamMetrics.uniqueChatters.size,
        userEngagement: Object.fromEntries(streamMetrics.userEngagement),
        channelName: currentChannel,
        sessionId: streamMetrics.streamStartTime || Date.now(),
        timestamp: Date.now(),
        revenue: revenueData
    };
    
    const message = JSON.stringify(metricsData);
    
    dashboardConnections.forEach(ws => {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(message);
        }
    });
}

// WebSocket connection handler
wss.on('connection', (ws) => {
    console.log('📊 [DASHBOARD] New dashboard connection');
    dashboardConnections.add(ws);
    
    // Send current metrics immediately only if connected to a channel
    if (isConnected && currentChannel) {
        // Calculate accurate revenue
        const revenueData = calculateAccurateRevenue(streamMetrics);
        
        const metricsData = {
            ...streamMetrics,
            uniqueChatters: streamMetrics.uniqueChatters.size,
            userEngagement: Object.fromEntries(streamMetrics.userEngagement),
            channelName: currentChannel,
            sessionId: streamMetrics.streamStartTime || Date.now(),
            timestamp: Date.now(),
            revenue: revenueData
        };
        
        ws.send(JSON.stringify(metricsData));
    } else {
        // Send empty state when no channel is connected
        const emptyData = {
            streamStartTime: null,
            currentViewerCount: 0,
            peakViewerCount: 0,
            averageViewerCount: 0,
            totalViewerMinutes: 0,
            totalMessages: 0,
            messagesPerMinute: 0,
            uniqueChatters: 0,
            recentMessages: [],
            rollingSentimentScore: 0,
            totalFollowers: 0,
            sessionFollowersGained: 0,
            followersGainsPerMinute: 0,
            newFollowers: [],
            totalSubs: 0,
            sessionSubsGained: 0,
            subsGainsPerMinute: 0,
            newSubs: [],
            tier1Subs: 0,
            tier2Subs: 0,
            tier3Subs: 0,
            sessionTier1Subs: 0,
            sessionTier2Subs: 0,
            sessionTier3Subs: 0,
            totalBits: 0,
            sessionBitsEarned: 0,
            bitsPerMinute: 0,
            recentBits: [],
            totalRaids: 0,
            sessionRaidsReceived: 0,
            raidsPerMinute: 0,
            recentRaids: [],
            isLive: false,
            streamTitle: '',
            gameCategory: '',
            streamLanguage: '',
            userEngagement: {},
            topEngagedUsers: [],
            promptHistory: [],
            lastPromptTime: null,
            viewerRetention: 0,
            channelName: 'No Channel',
            sessionId: null,
            timestamp: Date.now(),
            revenue: {
                bits: 0,
                subs: 0,
                total: 0,
                breakdown: {
                    bits: 0,
                    tier1: 0,
                    tier2: 0,
                    tier3: 0,
                    totalSubs: 0
                }
            },
            // New fields default
            peerAvgViewers: 75,
            viewerRec: "Increase interactive segments to boost by 20%",
            peerRetention: 60,
            retentionRec: "Add polls every 15 min",
            peerGrowth: 12,
            growthRec: "Collaborate with similar-sized streamers",
            predictedRetention: 50,
            scheduleSuggestion: "Tue 8PM",
            scheduleReason: "+25% views expected",
            projectedRevenue: 0,
            revenueTip: "Focus on Tier 2 subs",
            healthScore: 0
        };
        
        ws.send(JSON.stringify(emptyData));
    }
    
    ws.on('close', () => {
        console.log('📊 [DASHBOARD] Dashboard connection closed');
        dashboardConnections.delete(ws);
    });
    
    ws.on('error', (error) => {
        console.error('📊 [DASHBOARD] WebSocket error:', error);
        dashboardConnections.delete(ws);
    });
});

// Serve dashboard HTML
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'twitch_dashboard.html'));
});

app.get('/twitch_dashboard.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'twitch_dashboard.html'));
});

// API endpoints
app.get('/api/metrics', (req, res) => {
    res.json({
        ...streamMetrics,
        uniqueChatters: streamMetrics.uniqueChatters.size,
        userEngagement: Object.fromEntries(streamMetrics.userEngagement),
        channelName: currentChannel || 'No Channel',
        sessionId: streamMetrics.streamStartTime || Date.now(),
        timestamp: Date.now()
    });
});

app.post('/api/set-language', (req, res) => {
    const { language } = req.body;
    if (language && ['en', 'fr', 'es', 'de'].includes(language)) {
        // Store language preference (you could save this to a database)
        console.log(`🌐 [LANGUAGE] Language set to: ${language}`);
        res.json({ success: true, language });
    } else {
        res.status(400).json({ error: 'Invalid language' });
    }
});

app.get('/api/health', (req, res) => {
    res.json({
        status: 'healthy',
        twitch: {
            connected: twitchClient ? twitchClient.readyState() === 'OPEN' : false,
            channel: currentChannel || 'No channel connected'
        },
        gemini: geminiService.getHealthStatus(),
        uptime: process.uptime(),
        memory: process.memoryUsage()
    });
});

// Test endpoint to simulate events
app.post('/api/test-events', (req, res) => {
    if (!isConnected || !currentChannel) {
        return res.status(400).json({ error: 'Not connected to a channel' });
    }
    
    console.log('🧪 [TEST] Simulating test events...');
    
    // Simulate a follow
    streamMetrics.totalFollowers++;
    streamMetrics.sessionFollowersGained++;
    streamMetrics.newFollowers.push({
        username: 'TestFollower',
        timestamp: Date.now()
    });
    
    // Simulate subscriptions with different tiers
    streamMetrics.totalSubs += 3;
    streamMetrics.sessionSubsGained += 3;
    
    // Tier 1 subscription
    streamMetrics.tier1Subs++;
    streamMetrics.sessionTier1Subs++;
    streamMetrics.newSubs.push({
        username: 'TestSubscriber1',
        plan: 'Tier 1',
        timestamp: Date.now()
    });
    
    // Tier 2 subscription
    streamMetrics.tier2Subs++;
    streamMetrics.sessionTier2Subs++;
    streamMetrics.newSubs.push({
        username: 'TestSubscriber2',
        plan: 'Tier 2',
        timestamp: Date.now()
    });
    
    // Tier 3 subscription
    streamMetrics.tier3Subs++;
    streamMetrics.sessionTier3Subs++;
    streamMetrics.newSubs.push({
        username: 'TestSubscriber3',
        plan: 'Tier 3',
        timestamp: Date.now()
    });
    
    // Simulate bits
    streamMetrics.totalBits += 100;
    streamMetrics.sessionBitsEarned += 100;
    streamMetrics.recentBits.push({
        username: 'TestBitsUser',
        bits: 100,
        message: 'Test bits!',
        timestamp: Date.now()
    });
    
    // Update metrics and broadcast
    calculateRollingMetrics();
    updateTopEngagedUsers();
    broadcastMetrics();
    
    res.json({ 
        message: 'Test events simulated',
        metrics: {
            followers: streamMetrics.totalFollowers,
            subs: streamMetrics.totalSubs,
            bits: streamMetrics.totalBits,
            tier1Subs: streamMetrics.tier1Subs,
            tier2Subs: streamMetrics.tier2Subs,
            tier3Subs: streamMetrics.tier3Subs,
            revenue: calculateAccurateRevenue(streamMetrics)
        }
    });
});

app.post('/api/generate-prompt', async (req, res) => {
    try {
        const prompt = await generateAIPrompt();
        if (prompt) {
            res.json({ success: true, prompt });
        } else {
            res.json({ success: false, error: 'Failed to generate prompt' });
        }
    } catch (error) {
        res.json({ success: false, error: error.message });
    }
});

app.post('/api/set-language', (req, res) => {
    const { language } = req.body;
    if (language && promptTranslations[language]) {
        currentLanguage = language;
        res.json({ success: true, language: currentLanguage });
    } else {
        res.json({ success: false, error: 'Invalid language' });
    }
});

// Channel switching endpoints
app.post('/api/connect-channel', async (req, res) => {
    try {
        const { channel } = req.body;
        
        if (!channel || typeof channel !== 'string') {
            return res.status(400).json({ error: 'Channel name is required' });
        }
        
        const channelName = channel.trim().toLowerCase();
        
        // Disconnect from current channel if connected
        if (isConnected && twitchClient && twitchClient.readyState() === 'OPEN') {
            console.log(`🔄 [CHANNEL] Disconnecting from current channel: ${currentChannel}`);
            await twitchClient.disconnect();
            // Small delay to ensure clean disconnection
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        // Reset metrics for new channel
        resetStreamMetrics();
        
        // Update current channel
        currentChannel = channelName;
        
        // Connect to new channel
        console.log(`🔗 [CHANNEL] Connecting to new channel: ${channelName}`);
        
        // Update Twitch client configuration
        const twitchConfig = {
            options: { debug: true },
            connection: {
                secure: true,
                reconnect: true,
                maxReconnectAttempts: 5,
                maxReconnectInterval: 30000
            },
            identity: {
                username: process.env.TWITCH_BOT_USERNAME,
                password: process.env.TWITCH_OAUTH_TOKEN
            },
            channels: [channelName]
        };
        
        // Recreate Twitch client with new channel
        const newTwitchClient = new tmi.Client(twitchConfig);
        
        // Set up event handlers for new client
        setupTwitchEventHandlers(newTwitchClient);
        
        // Connect to new channel
        await newTwitchClient.connect();
        
        // Update global reference
        twitchClient = newTwitchClient;
        
        isConnected = true;
        streamMetrics.streamStartTime = Date.now();
        
        // Fetch initial metrics
        await fetchInitialMetrics(channelName);
        
        console.log(`✅ [CHANNEL] Successfully connected to: ${channelName}`);
        
        res.json({ 
            success: true, 
            channel: channelName,
            message: `Connected to ${channelName}` 
        });
        
    } catch (error) {
        console.error('❌ [CHANNEL] Error connecting to channel:', error);
        isConnected = false;
        res.status(500).json({ 
            error: 'Failed to connect to channel',
            details: error.message 
        });
    }
});

app.post('/api/disconnect-channel', async (req, res) => {
    try {
        if (isConnected && twitchClient && twitchClient.readyState() === 'OPEN') {
            console.log(`🔄 [CHANNEL] Disconnecting from channel: ${currentChannel}`);
            await twitchClient.disconnect();
        }
        
        isConnected = false;
        currentChannel = '';
        resetStreamMetrics();
        
        console.log('✅ [CHANNEL] Disconnected from channel');
        
        res.json({ 
            success: true, 
            message: 'Disconnected from channel' 
        });
        
    } catch (error) {
        console.error('❌ [CHANNEL] Error disconnecting from channel:', error);
        res.status(500).json({ 
            error: 'Failed to disconnect from channel',
            details: error.message 
        });
    }
});

app.get('/api/current-channel', (req, res) => {
    res.json({
        channel: currentChannel,
        connected: isConnected,
        status: isConnected ? 'connected' : 'disconnected'
    });
});

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 [SERVER] Twitch Live Assistant running on port ${PORT}`);
    console.log(`📊 [DASHBOARD] Dashboard available at http://localhost:${PORT}/twitch_dashboard.html`);
    console.log(`🔗 [API] API available at http://localhost:${PORT}/api/metrics`);
});

// Periodic tasks - only run when connected to a channel
setInterval(async () => {
    if (isConnected && currentChannel) {
        console.log('🔄 [PERIODIC] Updating stream info...');
        // Update stream info
        const streamInfo = await getStreamInfo();
        if (streamInfo) {
            console.log(`📺 [STREAM] Live: ${streamMetrics.isLive}, Viewers: ${streamMetrics.currentViewerCount}, Title: ${streamMetrics.streamTitle}`);
        } else {
            console.log('📺 [STREAM] No stream data received');
        }
        
        // Update rolling metrics
        calculateRollingMetrics();
        
        // Broadcast updates
        broadcastMetrics();
        console.log('📊 [PERIODIC] Metrics updated and broadcasted');
    }
}, 5000); // Every 5 seconds for more real-time updates

// WebSocket heartbeat - send updates more frequently to keep dashboard responsive
setInterval(() => {
    if (isConnected && currentChannel && dashboardConnections.size > 0) {
        // Send a lightweight update to keep dashboard responsive
        broadcastMetrics();
    }
}, 2000); // Every 2 seconds for dashboard responsiveness

// AI prompt generation interval - only run when connected to a channel
setInterval(async () => {
    if (isConnected && currentChannel && streamMetrics.isLive && streamMetrics.currentViewerCount > 0) {
        const timeSinceLastPrompt = Date.now() - streamMetrics.lastPromptTime;
        const shouldGeneratePrompt = timeSinceLastPrompt > 60000; // 1 minute minimum
        
        if (shouldGeneratePrompt) {
            const prompt = await generateAIPrompt();
            if (prompt) {
                console.log('🤖 [AI] Generated prompt:', prompt.message);
            }
        }
    }
}, 30000); // Check every 30 seconds

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 [SHUTDOWN] Shutting down gracefully...');
    
    if (twitchClient && twitchClient.readyState() === 'OPEN') {
        twitchClient.disconnect();
    }
    
    server.close(() => {
        console.log('✅ [SHUTDOWN] Server closed');
        process.exit(0);
    });
});

module.exports = { app, server, streamMetrics };