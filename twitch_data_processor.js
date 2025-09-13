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

// Add CORS headers
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    
    if (req.method === 'OPTIONS') {
        res.sendStatus(200);
    } else {
        next();
    }
});

// Initialize sentiment analyzer
const sentiment = new Sentiment();

// Initialize Gemini AI service
const geminiService = new GeminiService();
console.log('🤖 [GEMINI] Service initialized:', geminiService.getHealthStatus());

// External Data Integration - News and Trivia APIs
const EXTERNAL_DATA_CACHE = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Fetch trending news from NewsAPI (free tier)
async function fetchTrendingNews() {
    try {
        const cacheKey = 'trending_news';
        const cached = EXTERNAL_DATA_CACHE.get(cacheKey);
        
        if (cached && (Date.now() - cached.timestamp) < CACHE_DURATION) {
            return cached.data;
        }
        
        // Using a free news API - NewsAPI requires API key, so using alternative
        const response = await fetch('https://newsapi.org/v2/top-headlines?country=us&category=technology&pageSize=5&apiKey=db94af2f4bac408ab8084f22a7a2c9c6');
        
        if (!response.ok) {
            console.log(`📰 [NEWS] NewsAPI error ${response.status}: ${response.statusText}`);
            // Fallback to saurav.tech free API
            try {
                console.log(`📰 [NEWS] Trying saurav.tech free API...`);
                const sauravResponse = await fetch('https://saurav.tech/NewsAPI/top-headlines/category/technology/us.json');
                
                if (sauravResponse.ok) {
                    const sauravData = await sauravResponse.json();
                    console.log(`📰 [NEWS] Saurav.tech API success!`);
                    
                    EXTERNAL_DATA_CACHE.set(cacheKey, { data: sauravData, timestamp: Date.now() });
                    return sauravData;
                } else {
                    throw new Error(`Saurav.tech API error: ${sauravResponse.status}`);
                }
            } catch (sauravError) {
                console.log(`📰 [NEWS] Saurav.tech API failed:`, sauravError.message);
                // Fallback to quotes API
                try {
                    const fallbackResponse = await fetch('https://api.quotable.io/random');
                    if (fallbackResponse.ok) {
                        const fallbackData = await fallbackResponse.json();
                        
                        const data = {
                            articles: [{
                                title: fallbackData.content,
                                description: `Inspirational quote: "${fallbackData.content}" - ${fallbackData.author}`,
                                url: 'https://quotable.io'
                            }]
                        };
                        
                        EXTERNAL_DATA_CACHE.set(cacheKey, { data, timestamp: Date.now() });
                        return data;
                    } else {
                        throw new Error(`Quotes API error: ${fallbackResponse.status}`);
                    }
                } catch (quotesError) {
                    console.log(`📰 [NEWS] Quotes API also failed:`, quotesError.message);
                    // Use static fallback
                    const data = {
                        articles: [{
                            title: "Streaming Tips",
                            description: "Keep talking about what you're passionate about!",
                            url: '#'
                        }]
                    };
                    
                    EXTERNAL_DATA_CACHE.set(cacheKey, { data, timestamp: Date.now() });
                    return data;
                }
            }
        }
        
        const data = await response.json();
        EXTERNAL_DATA_CACHE.set(cacheKey, { data, timestamp: Date.now() });
        return data;
    } catch (error) {
        console.log('📰 [NEWS] Error fetching news, using fallback:', error.message);
        return {
            articles: [{
                title: "Streaming Tips",
                description: "Keep talking about what you're passionate about!",
                url: '#'
            }]
        };
    }
}

// Fetch random trivia/facts
async function fetchRandomTrivia() {
    try {
        const cacheKey = 'random_trivia';
        const cached = EXTERNAL_DATA_CACHE.get(cacheKey);
        
        if (cached && (Date.now() - cached.timestamp) < CACHE_DURATION) {
            return cached.data;
        }
        
        const response = await fetch('https://uselessfacts.jsph.pl/random.json?language=en');
        const data = await response.json();
        
        EXTERNAL_DATA_CACHE.set(cacheKey, { data, timestamp: Date.now() });
        return data;
    } catch (error) {
        console.log('🧠 [TRIVIA] Error fetching trivia, using fallback:', error.message);
        return {
            text: "Did you know that streaming can help you build amazing communities?",
            source: "Streaming Facts"
        };
    }
}

// Fetch current time and date info
function getTimeContext() {
    const now = new Date();
    const hour = now.getHours();
    const dayOfWeek = now.toLocaleDateString('en-US', { weekday: 'long' });
    const timeOfDay = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : hour < 21 ? 'evening' : 'night';
    
    return {
        hour,
        dayOfWeek,
        timeOfDay,
        isWeekend: now.getDay() === 0 || now.getDay() === 6,
        isPrimeTime: hour >= 19 && hour <= 22
    };
}

// Note: Language setting is now per-session in metrics.language (default: 'en')

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
        
        // Zero to One Engine - "Always Be Talking" prompts for zero_viewers phase
        always_be_talking_1: "🎤 **Always Be Talking**: Chat is quiet, but that's okay! Keep talking about what you're doing, your thoughts, or ask questions. Say: \"I know chat is quiet right now, but I'm going to keep talking because you never know who might be lurking!\"",
        always_be_talking_2: "🗣️ **Keep the Energy Up**: Even with no visible chat, keep the conversation flowing! Say: \"I'm going to keep talking because I love what I do! Feel free to jump in anytime!\"",
        always_be_talking_3: "💭 **Share Your Thoughts**: Use this quiet time to share your process. Say: \"I'm thinking out loud here - this is actually really helpful for me to process what I'm doing!\"",
        always_be_talking_4: "❓ **Ask Questions**: Even if no one answers, ask questions! Say: \"I'm curious - what do you think about this? Even if you don't type, I'd love to hear your thoughts!\"",
        always_be_talking_5: "🎯 **Set Goals**: Share your streaming goals. Say: \"My goal today is to [goal]. Even if it's just me here, I'm going to work towards it!\"",
        
        // First Viewer Catcher prompts
        first_viewer_welcome: "🎉 **FIRST VIEWER ALERT!**: Welcome to the stream! Say: \"Hey there! Thanks for being my first viewer today! I really appreciate you stopping by!\"",
        first_viewer_engagement: "🤝 **First Connection**: Make them feel special! Say: \"You're the first person to join me today - that makes you special! What brought you here?\"",
        first_viewer_community: "🏠 **Build Community**: Start building from the first person! Say: \"Welcome to our little community! Even if it's just us two, let's make it awesome!\"",
        
        // Dynamic External Data Prompts with placeholders
        news_discussion: "📰 **News Discussion**: Chat is quiet! Try talking about this news story: \"{newsTitle}\" - What do you think about this?",
        trivia_engagement: "🧠 **Fun Fact**: Here's something interesting: \"{triviaText}\" - Did you know this? Share your thoughts!",
        time_based_greeting: "⏰ **Time-Based**: Good {timeOfDay}! It's {dayOfWeek} and we're {timeContext}. What are you up to today?",
        weather_chat: "🌤️ **Weather Chat**: It's a {timeOfDay} {dayOfWeek} - perfect for streaming! How's the weather where you are?",
        weekend_energy: "🎉 **Weekend Energy**: It's {dayOfWeek} - the perfect time to relax and chat! What are your weekend plans?",
        prime_time_boost: "🔥 **Prime Time**: It's prime time for streaming! With {viewerCount} viewers, let's make this session amazing!",
        
        // High-priority event prompts
        raid_celebration: "⚔️ **RAID INCOMING!**: Welcome raiders! Say: \"Welcome everyone! Thanks for the raid! Let's show them what we're all about!\"",
        sub_bomb_celebration: "💥 **SUB BOMB!**: Multiple subs! Say: \"Wow! Multiple subs at once! You all are amazing! Thank you so much!\"",
        bits_storm: "💰 **BITS STORM**: Bits are flying! Say: \"The bits are raining! Thank you all for the amazing support!\"",
        follower_surge: "👥 **FOLLOWER SURGE**: New followers coming in! Say: \"Welcome to all the new followers! I'm so excited to have you here!\"",
        
        // Context-aware prompts
        low_engagement_boost: "💬 **Engagement Boost**: With {viewerCount} viewers and {messageRate} messages/min, let's get this chat moving! Say: \"I want to hear from you! What's on your mind?\"",
        high_engagement_maintain: "🎯 **Maintain Momentum**: Great energy with {viewerCount} viewers! Say: \"I love this energy! Let's keep it going - what do you think about this?\"",
        sentiment_positive: "😊 **Positive Vibes**: The chat is feeling great! Say: \"I love the positive energy here! You all are amazing!\"",
        sentiment_neutral: "🤔 **Neutral Chat**: Let's spice things up! Say: \"I want to hear your opinions! What do you think about this topic?\"",
        sentiment_negative: "🔄 **Reset Energy**: Let's turn this around! Say: \"I want to focus on the positive! What's something good that happened to you today?\"",
        
        // Interactive prompts
        poll_question: "📊 **Quick Poll**: Let's do a poll! Say: \"Quick question: {pollQuestion}? Type your answer and I'll count the votes!\"",
        challenge_activity: "🎯 **Challenge Time**: Let's get interactive! Say: \"Challenge: {challengeDescription}. Who's up for it?\"",
        story_sharing: "📖 **Share Stories**: Let's connect! Say: \"I'd love to hear your stories! What's the most interesting thing that happened to you this week?\"",
        question_time: "❓ **Q&A Session**: Time for questions! Say: \"I'm opening the floor for questions! What would you like to know?\"",
        
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
        
        // First Viewer Catcher prompts
        first_viewer_welcome: "🎉 **ALERTE PREMIER SPECTATEUR!**: Bienvenue sur le stream ! Dites: \"Salut ! Merci d'être mon premier spectateur aujourd'hui ! J'apprécie vraiment que vous soyez là !\"",
        first_viewer_engagement: "🤝 **Première Connexion**: Rendez-les spéciaux ! Dites: \"Vous êtes la première personne à me rejoindre aujourd'hui - ça vous rend spécial ! Qu'est-ce qui vous a amené ici ?\"",
        first_viewer_community: "🏠 **Construire Communauté**: Commencez à construire avec la première personne ! Dites: \"Bienvenue dans notre petite communauté ! Même si c'est juste nous deux, rendons-la géniale !\"",
        
        // Zero to One Engine - "Always Be Talking" prompts for zero_viewers phase
        always_be_talking_1: "🎤 **Toujours Parler**: Le chat est calme, mais c'est ok! Continuez à parler de ce que vous faites, vos pensées, ou posez des questions. Dites: \"Je sais que le chat est calme maintenant, mais je vais continuer à parler car on ne sait jamais qui pourrait être là!\"",
        always_be_talking_2: "🗣️ **Garder l'Énergie**: Même sans chat visible, gardez la conversation fluide! Dites: \"Je vais continuer à parler car j'adore ce que je fais! N'hésitez pas à intervenir à tout moment!\"",
        always_be_talking_3: "💭 **Partager Vos Pensées**: Utilisez ce temps calme pour partager votre processus. Dites: \"Je réfléchis à voix haute ici - c'est vraiment utile pour moi de traiter ce que je fais!\"",
        always_be_talking_4: "❓ **Poser des Questions**: Même si personne ne répond, posez des questions! Dites: \"Je suis curieux - qu'en pensez-vous? Même si vous ne tapez pas, j'aimerais entendre vos pensées!\"",
        always_be_talking_5: "🎯 **Définir des Objectifs**: Partagez vos objectifs de stream. Dites: \"Mon objectif aujourd'hui est de [objectif]. Même si je suis seul ici, je vais travailler pour l'atteindre!\"",
        
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
        fallback_momentum_next: "🔮 **Teaser Prochain Contenu**: Construire l'anticipation! Dites: \"Je suis déjà excité pour la prochaine fois! Qu'aimeriez-vous voir dans le prochain stream?\" ou \"Ce n'est que le début! Qu'explorerons-nous ensemble ensuite?\"",
        
        // Dynamic External Data Prompts with placeholders
        news_discussion: "📰 **Discussion Actualités**: Le chat est calme! Parlez de cette actualité: \"{newsTitle}\" - Qu'en pensez-vous?",
        trivia_engagement: "🧠 **Fun Fact**: Voici quelque chose d'intéressant: \"{triviaText}\" - Le saviez-vous? Partagez vos pensées!",
        time_based_greeting: "⏰ **Basé sur l'Heure**: Bon {timeOfDay}! C'est {dayOfWeek} et nous sommes {timeContext}. Que faites-vous aujourd'hui?",
        weather_chat: "🌤️ **Chat Météo**: C'est un {timeOfDay} {dayOfWeek} - parfait pour le streaming! Quel temps fait-il chez vous?",
        weekend_energy: "🎉 **Énergie Weekend**: C'est {dayOfWeek} - le moment parfait pour se détendre et discuter! Quels sont vos plans de weekend?",
        prime_time_boost: "🔥 **Prime Time**: C'est l'heure de pointe pour le streaming! Avec {viewerCount} spectateurs, rendons cette session incroyable!"
    },
    es: {
        // First Viewer Catcher prompts
        first_viewer_welcome: "🎉 **¡ALERTA PRIMER ESPECTADOR!**: ¡Bienvenido al stream! Di: \"¡Hola! ¡Gracias por ser mi primer espectador hoy! ¡Realmente aprecio que estés aquí!\"",
        first_viewer_engagement: "🤝 **Primera Conexión**: ¡Hazlos sentir especiales! Di: \"Eres la primera persona en unirse a mí hoy - ¡eso te hace especial! ¿Qué te trajo aquí?\"",
        first_viewer_community: "🏠 **Construir Comunidad**: ¡Comienza a construir con la primera persona! Di: \"¡Bienvenido a nuestra pequeña comunidad! ¡Incluso si solo somos nosotros dos, hagámosla increíble!\"",
        
        // Zero to One Engine - "Always Be Talking" prompts for zero_viewers phase
        always_be_talking_1: "🎤 **Siempre Hablar**: El chat está tranquilo, ¡pero está bien! Sigue hablando sobre lo que haces, tus pensamientos, o haz preguntas. Di: \"Sé que el chat está tranquilo ahora, pero voy a seguir hablando porque nunca sabes quién podría estar ahí!\"",
        always_be_talking_2: "🗣️ **Mantener la Energía**: Incluso sin chat visible, mantén la conversación fluida! Di: \"Voy a seguir hablando porque amo lo que hago! Siéntete libre de intervenir en cualquier momento!\"",
        always_be_talking_3: "💭 **Compartir Tus Pensamientos**: Usa este tiempo tranquilo para compartir tu proceso. Di: \"Estoy pensando en voz alta aquí - esto es realmente útil para procesar lo que estoy haciendo!\"",
        always_be_talking_4: "❓ **Hacer Preguntas**: Incluso si nadie responde, ¡haz preguntas! Di: \"Tengo curiosidad - ¿qué opinas de esto? Incluso si no escribes, me encantaría escuchar tus pensamientos!\"",
        always_be_talking_5: "🎯 **Establecer Metas**: Comparte tus objetivos de streaming. Di: \"Mi objetivo hoy es [objetivo]. Incluso si estoy solo aquí, voy a trabajar para lograrlo!\"",
        
        // Dynamic External Data Prompts with placeholders
        news_discussion: "📰 **Discusión de Noticias**: ¡El chat está tranquilo! Habla sobre esta noticia: \"{newsTitle}\" - ¿Qué opinas?",
        trivia_engagement: "🧠 **Dato Curioso**: Aquí hay algo interesante: \"{triviaText}\" - ¿Lo sabías? ¡Comparte tus pensamientos!",
        time_based_greeting: "⏰ **Basado en la Hora**: ¡Buen {timeOfDay}! Es {dayOfWeek} y estamos {timeContext}. ¿Qué haces hoy?",
        weather_chat: "🌤️ **Chat del Clima**: Es un {timeOfDay} {dayOfWeek} - ¡perfecto para streaming! ¿Cómo está el clima donde estás?",
        weekend_energy: "🎉 **Energía de Fin de Semana**: Es {dayOfWeek} - ¡el momento perfecto para relajarse y charlar! ¿Cuáles son tus planes de fin de semana?",
        prime_time_boost: "🔥 **Hora Pico**: ¡Es hora pico para streaming! Con {viewerCount} espectadores, ¡hagamos esta sesión increíble!"
    },
    de: {
        // First Viewer Catcher prompts
        first_viewer_welcome: "🎉 **ERSTER ZUSCHAUER ALARM!**: Willkommen beim Stream! Sage: \"Hey! Danke, dass du heute mein erster Zuschauer bist! Ich schätze es wirklich, dass du hier bist!\"",
        first_viewer_engagement: "🤝 **Erste Verbindung**: Lass sie sich besonders fühlen! Sage: \"Du bist die erste Person, die heute zu mir gestoßen ist - das macht dich besonders! Was hat dich hierher gebracht?\"",
        first_viewer_community: "🏠 **Gemeinschaft Aufbauen**: Fang mit der ersten Person an zu bauen! Sage: \"Willkommen in unserer kleinen Gemeinschaft! Auch wenn es nur wir zwei sind, lass uns sie großartig machen!\"",
        
        // Zero to One Engine - "Always Be Talking" prompts for zero_viewers phase
        always_be_talking_1: "🎤 **Immer Sprechen**: Der Chat ist ruhig, aber das ist ok! Sprich weiter über das, was du tust, deine Gedanken, oder stelle Fragen. Sage: \"Ich weiß, der Chat ist gerade ruhig, aber ich werde weiter sprechen, weil man nie weiß, wer zuschauen könnte!\"",
        always_be_talking_2: "🗣️ **Energie Behalten**: Auch ohne sichtbaren Chat, halte das Gespräch am Laufen! Sage: \"Ich werde weiter sprechen, weil ich liebe, was ich tue! Fühl dich frei, jederzeit einzuspringen!\"",
        always_be_talking_3: "💭 **Gedanken Teilen**: Nutze diese ruhige Zeit, um deinen Prozess zu teilen. Sage: \"Ich denke hier laut nach - das ist wirklich hilfreich für mich, um zu verarbeiten, was ich tue!\"",
        always_be_talking_4: "❓ **Fragen Stellen**: Auch wenn niemand antwortet, stelle Fragen! Sage: \"Ich bin neugierig - was denkst du darüber? Auch wenn du nicht tippst, würde ich gerne deine Gedanken hören!\"",
        always_be_talking_5: "🎯 **Ziele Setzen**: Teile deine Streaming-Ziele. Sage: \"Mein Ziel heute ist [Ziel]. Auch wenn ich hier allein bin, werde ich daran arbeiten, es zu erreichen!\"",
        
        // Dynamic External Data Prompts with placeholders
        news_discussion: "📰 **Nachrichtendiskussion**: Der Chat ist ruhig! Sprich über diese Nachricht: \"{newsTitle}\" - Was denkst du?",
        trivia_engagement: "🧠 **Fun Fact**: Hier ist etwas Interessantes: \"{triviaText}\" - Wusstest du das? Teile deine Gedanken!",
        time_based_greeting: "⏰ **Zeitbasiert**: Guten {timeOfDay}! Es ist {dayOfWeek} und wir sind {timeContext}. Was machst du heute?",
        weather_chat: "🌤️ **Wetter Chat**: Es ist ein {timeOfDay} {dayOfWeek} - perfekt für Streaming! Wie ist das Wetter bei dir?",
        weekend_energy: "🎉 **Wochenend Energie**: Es ist {dayOfWeek} - die perfekte Zeit zum Entspannen und Plaudern! Was sind deine Wochenendpläne?",
        prime_time_boost: "🔥 **Prime Time**: Es ist Hauptsendezeit für Streaming! Mit {viewerCount} Zuschauern, lass uns diese Session großartig machen!"
    }
};

// Multi-session architecture
const userSessions = new Map(); // sessionId -> { connection, metrics, wsClients, channel, isConnected }
let sessionCounter = 0;

// Helper function to generate unique session ID
function generateSessionId() {
    return `session_${Date.now()}_${++sessionCounter}`;
}

// Helper function to clean up old sessions for a channel
function cleanupOldSessions(channelName, currentSessionId) {
    const sessionsToRemove = [];
    
    userSessions.forEach((session, sessionId) => {
        if (session.channel === channelName && sessionId !== currentSessionId) {
            console.log(`🧹 [CLEANUP] Removing old session for channel ${channelName}: ${sessionId}`);
            sessionsToRemove.push(sessionId);
        }
    });
    
    sessionsToRemove.forEach(sessionId => {
        const session = userSessions.get(sessionId);
        if (session && session.connection && session.connection.readyState() === 'OPEN') {
            session.connection.disconnect();
        }
        userSessions.delete(sessionId);
    });
    
    if (sessionsToRemove.length > 0) {
        console.log(`🧹 [CLEANUP] Cleaned up ${sessionsToRemove.length} old sessions. Remaining: ${userSessions.size}`);
    }
}

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


// Helper function to set up Twitch event handlers for a specific session
function setupSessionEventHandlers(session) {
    const client = session.connection;
    const metrics = session.metrics;
    // Chat message handler
    client.on('message', (channel, tags, message, self) => {
        if (self) return;
        
        const username = tags.username;
        const displayName = tags['display-name'] || username;
        const messageId = `${username}-${message}-${Date.now()}`;
        
        // Check for duplicate messages (same user, same message within 1 second)
        const recentMessage = metrics.recentMessages.find(msg => 
            msg.username === displayName && 
            msg.message === message && 
            (Date.now() - msg.timestamp) < 1000
        );
        
        if (recentMessage) {
            console.log(`🔄 [CHAT] Skipping duplicate message from ${displayName}: ${message}`);
            return;
        }
        
        // Add to recent messages
        metrics.recentMessages.push({
            username: displayName,
            message: message,
            timestamp: Date.now()
        });
        
        // Keep only last 100 messages
        if (metrics.recentMessages.length > 100) {
            metrics.recentMessages = metrics.recentMessages.slice(-100);
        }
        
        // Update user engagement
        if (!metrics.userEngagement.has(username)) {
            metrics.userEngagement.set(username, {
                messages: 0,
                bits: 0,
                follows: 0,
                subs: 0
            });
        }
        
        const userData = metrics.userEngagement.get(username);
        userData.messages = (userData.messages || 0) + 1;
        
        // Update metrics
        metrics.totalMessages++;
        metrics.uniqueChatters.add(username);
        
        // Analyze sentiment
        analyzeSentiment(metrics);
        
        // Update rolling metrics
        calculateRollingMetrics(metrics);
        updateTopEngagedUsers(metrics);
        
        // Broadcast updates immediately for real-time chat
        broadcastToSession(session);
    });
    
    // Follow handler
    client.on('follow', (channel, username, displayName, userID) => {
        console.log(`👥 [FOLLOW] ${displayName} followed!`);
        console.log(`👥 [FOLLOW] Channel: ${channel}, Username: ${username}, DisplayName: ${displayName}, UserID: ${userID}`);
        
        metrics.totalFollowers++;
        metrics.sessionFollowersGained++;
        
        // Add to recent followers
        metrics.newFollowers.push({
            username: displayName,
            timestamp: Date.now()
        });
        
        // Keep only last 50 followers
        if (metrics.newFollowers.length > 50) {
            metrics.newFollowers = metrics.newFollowers.slice(-50);
        }
        
        // Update user engagement
        if (!metrics.userEngagement.has(username)) {
            metrics.userEngagement.set(username, {
                messages: 0,
                bits: 0,
                follows: 0,
                subs: 0
            });
        }
        
        const userData = metrics.userEngagement.get(username);
        userData.follows = (userData.follows || 0) + 1;
        
        // Update rolling metrics
        calculateRollingMetrics(metrics);
        updateTopEngagedUsers(metrics);
        
        // Broadcast updates immediately for real-time follows
        broadcastToSession(session);
        
        console.log(`👥 [FOLLOW] Updated metrics - Total: ${metrics.totalFollowers}, Session: ${metrics.sessionFollowersGained}`);
    });
    
    // Subscription handler
    client.on('subscription', (channel, username, displayName, subInfo) => {
        const plan = subInfo ? subInfo.plan : 'unknown';
        console.log(`🎉 [SUB] ${displayName} subscribed with ${plan} plan!`);
        console.log(`🔍 [DEBUG] Sub info:`, subInfo);
        
        metrics.totalSubs++;
        metrics.sessionSubsGained++;
        
        // Track subscription tiers for accurate revenue calculation
        // Handle different plan formats from Twitch
        let tier = 'unknown';
        if (typeof plan === 'string') {
            if (plan === '1000' || plan === 'Tier 1' || plan === 'Prime') {
                tier = 'Tier 1';
                metrics.tier1Subs++;
                metrics.sessionTier1Subs++;
            } else if (plan === '2000' || plan === 'Tier 2') {
                tier = 'Tier 2';
                metrics.tier2Subs++;
                metrics.sessionTier2Subs++;
            } else if (plan === '3000' || plan === 'Tier 3') {
                tier = 'Tier 3';
                metrics.tier3Subs++;
                metrics.sessionTier3Subs++;
            } else if (plan === 'gift' || plan === 'resub') {
                // For gifts and resubs, assume Tier 1 (most common)
                tier = 'Tier 1 (gift/resub)';
                metrics.tier1Subs++;
                metrics.sessionTier1Subs++;
            }
        } else if (typeof plan === 'object' && plan.plan) {
            // Handle object format like {"prime":false,"plan":"1000","planName":"Channel Subscription"}
            if (plan.plan === '1000') {
                tier = 'Tier 1';
                metrics.tier1Subs++;
                metrics.sessionTier1Subs++;
            } else if (plan.plan === '2000') {
                tier = 'Tier 2';
                metrics.tier2Subs++;
                metrics.sessionTier2Subs++;
            } else if (plan.plan === '3000') {
                tier = 'Tier 3';
                metrics.tier3Subs++;
                metrics.sessionTier3Subs++;
            }
        }
        
        console.log(`💰 [TIER] Assigned to ${tier}`);
        
        // Add to recent subs
        metrics.newSubs.push({
            username: displayName,
            plan: plan,
            timestamp: Date.now()
        });
        
        // Keep only last 50 subs
        if (metrics.newSubs.length > 50) {
            metrics.newSubs = metrics.newSubs.slice(-50);
        }
        
        // Update user engagement
        if (!metrics.userEngagement.has(username)) {
            metrics.userEngagement.set(username, {
                messages: 0,
                bits: 0,
                follows: 0,
                subs: 0
            });
        }
        
        const userData = metrics.userEngagement.get(username);
        userData.subs = (userData.subs || 0) + 1;
        
        // Update rolling metrics
        calculateRollingMetrics(metrics);
        updateTopEngagedUsers(metrics);
        
        // Broadcast updates
        broadcastToSession(session);
    });
    
    // Bits handler
    client.on('cheer', (channel, tags, message) => {
        const username = tags.username;
        const displayName = tags['display-name'] || username;
        const bits = parseInt(tags.bits) || 0;
        
        console.log(`💰 [BITS] ${displayName} cheered ${bits} bits!`);
        
        metrics.totalBits += bits;
        metrics.sessionBitsEarned += bits;
        
        // Add to recent bits
        metrics.recentBits.push({
            username: displayName,
            bits: bits,
            message: message,
            timestamp: Date.now()
        });
        
        // Keep only last 50 bits
        if (metrics.recentBits.length > 50) {
            metrics.recentBits = metrics.recentBits.slice(-50);
        }
        
        // Update user engagement
        if (!metrics.userEngagement.has(username)) {
            metrics.userEngagement.set(username, {
                messages: 0,
                bits: 0,
                follows: 0,
                subs: 0
            });
        }
        
        const userData = metrics.userEngagement.get(username);
        userData.bits = (userData.bits || 0) + bits;
        
        // Update rolling metrics
        calculateRollingMetrics(metrics);
        updateTopEngagedUsers(metrics);
        
        // Broadcast updates
        broadcastToSession(session);
    });
    
    // Raid handler
    client.on('raided', (channel, username, viewers) => {
        console.log(`⚔️ [RAID] ${username} raided with ${viewers} viewers!`);
        
        metrics.totalRaids++;
        metrics.sessionRaidsReceived++;
        
        // Add to recent raids
        metrics.recentRaids.push({
            username: username,
            viewers: viewers,
            timestamp: Date.now()
        });
        
        // Keep only last 20 raids
        if (metrics.recentRaids.length > 20) {
            metrics.recentRaids = metrics.recentRaids.slice(-20);
        }
        
        // Update rolling metrics
        calculateRollingMetrics(metrics);
        updateTopEngagedUsers(metrics);
        
        // Broadcast updates
        broadcastToSession(session);
    });
    
    // Handle resub
    client.on('resub', (channel, username, months, message, userstate, methods) => {
        console.log(`🎉 [RESUB] ${username} resubscribed for ${months} months!`);
        
        metrics.totalSubs++;
        metrics.sessionSubsGained++;
        
        // Add to new subs
        metrics.newSubs.push({
            username: username,
            plan: 'resub',
            months: months,
            timestamp: Date.now()
        });
        
        // Keep only last 50 subs
        if (metrics.newSubs.length > 50) {
            metrics.newSubs = metrics.newSubs.slice(-50);
        }
        
        // Update user engagement
        if (!metrics.userEngagement.has(username)) {
            metrics.userEngagement.set(username, {
                messages: 0,
                bits: 0,
                follows: 0,
                subs: 0
            });
        }
        
        const userData = metrics.userEngagement.get(username);
        userData.subs = (userData.subs || 0) + 1;
        
        // Update rolling metrics
        calculateRollingMetrics(metrics);
        updateTopEngagedUsers(metrics);
        
        // Broadcast updates
        broadcastToSession(session);
    });
    
    // Handle gift subscriptions
    client.on('subgift', (channel, username, streakMonths, recipient, methods, userstate) => {
        console.log(`🎁 [GIFT SUB] ${username} gifted a sub to ${recipient}!`);
        
        metrics.totalSubs++;
        metrics.sessionSubsGained++;
        
        // Add to new subs
        metrics.newSubs.push({
            username: username,
            plan: 'gift',
            recipient: recipient,
            timestamp: Date.now()
        });
        
        // Keep only last 50 subs
        if (metrics.newSubs.length > 50) {
            metrics.newSubs = metrics.newSubs.slice(-50);
        }
        
        // Update user engagement
        if (!metrics.userEngagement.has(username)) {
            metrics.userEngagement.set(username, {
                messages: 0,
                bits: 0,
                follows: 0,
                subs: 0
            });
        }
        
        const userData = metrics.userEngagement.get(username);
        userData.subs = (userData.subs || 0) + 1;
        
        // Update rolling metrics
        calculateRollingMetrics(metrics);
        updateTopEngagedUsers(metrics);
        
        // Broadcast updates
        broadcastToSession(session);
    });
    
    // Handle mystery gifts
    client.on('submysterygift', (channel, username, numbOfSubs, methods, userstate) => {
        console.log(`🎁 [MYSTERY GIFT] ${username} gifted ${numbOfSubs} subs!`);
        
        metrics.totalSubs += numbOfSubs;
        metrics.sessionSubsGained += numbOfSubs;
        
        // Add to new subs
        metrics.newSubs.push({
            username: 'mystery_gift_recipients',
            plan: 'mystery_gift',
            gifter: username,
            count: numbOfSubs,
            timestamp: Date.now()
        });
        
        // Keep only last 50 subs
        if (metrics.newSubs.length > 50) {
            metrics.newSubs = metrics.newSubs.slice(-50);
        }
        
        // Update user engagement
        if (!metrics.userEngagement.has(username)) {
            metrics.userEngagement.set(username, {
                messages: 0,
                bits: 0,
                follows: 0,
                subs: 0
            });
        }
        
        const userData = metrics.userEngagement.get(username);
        userData.subs = (userData.subs || 0) + numbOfSubs;
        
        // Update rolling metrics
        calculateRollingMetrics(metrics);
        updateTopEngagedUsers(metrics);
        
        // Broadcast updates
        broadcastToSession(session);
    });
    
    // Connection handlers
    client.on('connected', (addr, port) => {
        console.log(`🔗 [TWITCH] Connected to Twitch IRC at ${addr}:${port}`);
        console.log(`🔗 [TWITCH] Listening for events on channel: ${session.channel}`);
        metrics.streamStartTime = Date.now();
    });
    
    client.on('disconnected', (reason) => {
        console.log(`❌ [TWITCH] Disconnected from Twitch IRC: ${reason}`);
    });
    
    // Add error handler
    client.on('error', (error) => {
        console.error(`❌ [TWITCH] IRC Error:`, error);
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

// WebSocket connections for dashboard (legacy - will be removed)
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

// Get current stream info for a specific channel
async function getStreamInfo(channel) {
    try {
        if (!channel) {
            console.log('🔍 [API] No channel provided, skipping stream info fetch');
            return null;
        }
        
        console.log(`🔍 [API] Fetching stream info for channel: ${channel}`);
        const data = await getTwitchAPI('streams', {
            user_login: channel
        });
        
        console.log(`📊 [API] Received data:`, JSON.stringify(data, null, 2));
        
        // Also check if the user exists
        try {
            const userData = await getTwitchAPI('users', {
                login: channel
            });
            console.log(`👤 [API] User data for ${channel}:`, JSON.stringify(userData, null, 2));
        } catch (error) {
            console.log(`❌ [API] Error fetching user data for ${channel}:`, error.message);
        }
        
        if (data.data && data.data.length > 0) {
            const stream = data.data[0];
            
            // Find the session for this channel
            const session = Array.from(userSessions.values()).find(s => s.channel === channel);
            if (session) {
                session.metrics.isLive = true;
                session.metrics.streamTitle = stream.title;
                session.metrics.gameCategory = stream.game_name;
                session.metrics.currentViewerCount = stream.viewer_count;
                session.metrics.streamLanguage = stream.language;
            
            // Update peak viewers
                if (stream.viewer_count > session.metrics.peakViewerCount) {
                    session.metrics.peakViewerCount = stream.viewer_count;
            }
            
                console.log(`✅ [STREAM] Updated metrics for session ${session.sessionId} - Live: ${session.metrics.isLive}, Viewers: ${session.metrics.currentViewerCount}`);
            }
            
            return stream;
        } else {
            // Find the session for this channel
            const session = Array.from(userSessions.values()).find(s => s.channel === channel);
            if (session) {
                session.metrics.isLive = false;
                session.metrics.currentViewerCount = 0;
                session.metrics.streamTitle = '';
                session.metrics.gameCategory = '';
                session.metrics.streamLanguage = '';
                console.log(`❌ [STREAM] No live stream found for channel: ${channel} - Channel may be offline`);
            }
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

// Fetch initial metrics when connecting to channel for a specific session
async function fetchInitialMetrics(channel, metrics) {
    try {
        const channelInfo = await getChannelInfo(channel);
        if (!channelInfo) return;
        
        const userId = channelInfo.id;
        
        // Get followers
        metrics.totalFollowers = await getFollowerCount(userId);
        
        // Get subscribers (may require additional scopes)
        metrics.totalSubs = await getSubscriberCount(userId);
        
        console.log(`📊 [INITIAL] Fetched metrics - Followers: ${metrics.totalFollowers}, Subs: ${metrics.totalSubs}`);
    } catch (error) {
        console.error('Error fetching initial metrics:', error);
    }
}

// Calculate rolling metrics for a specific session
function calculateRollingMetrics(metrics) {
    const now = Date.now();
    const streamDuration = metrics.streamStartTime ? (now - metrics.streamStartTime) / 60000 : 0; // minutes
    
    if (streamDuration > 0) {
        // Messages per minute
        metrics.messagesPerMinute = metrics.totalMessages / streamDuration;
        
        // Followers per minute
        metrics.followersGainsPerMinute = metrics.sessionFollowersGained / streamDuration;
        
        // Subs per minute
        metrics.subsGainsPerMinute = metrics.sessionSubsGained / streamDuration;
        
        // Bits per minute
        metrics.bitsPerMinute = metrics.sessionBitsEarned / streamDuration;
        
        // Average viewers
        metrics.averageViewerCount = metrics.totalViewerMinutes / streamDuration;
        
        // Viewer retention (simplified calculation)
        metrics.viewerRetention = metrics.currentViewerCount > 0 ? 
            Math.min(100, (metrics.currentViewerCount / Math.max(metrics.peakViewerCount, 1)) * 100) : 0;
        
        // Predicted retention (dummy calc)
        metrics.predictedRetention = Math.round(50 + metrics.rollingSentimentScore * 20 + (metrics.currentViewerCount / 10));
        
        // Projected revenue (daily * 30)
        const dailyRev = calculateAccurateRevenue(metrics).total;
        metrics.projectedRevenue = dailyRev * 30;
        
        // Revenue tip
        metrics.revenueTip = metrics.projectedRevenue < 50 ? "Focus on subs" : "Great momentum!";
        
        // Health score
        const durationHours = streamDuration / 60;
        let score = 100 - (durationHours * 10);
        score += metrics.rollingSentimentScore * 20;
        metrics.healthScore = Math.max(0, Math.min(100, score));
        
        // Dynamic recommendations
        metrics.retentionRec = metrics.predictedRetention < 50 ? "Add polls every 15 min to improve retention" : "Retention looks good - maintain engagement";
        
        metrics.viewerRec = metrics.currentViewerCount < metrics.peerAvgViewers ? 
            `Increase interactive segments to boost by ${Math.round((metrics.peerAvgViewers - metrics.currentViewerCount) / metrics.peerAvgViewers * 100)}%` : "Viewership above average!";
        
        metrics.growthRec = metrics.sessionFollowersGained < 10 ? "Collaborate with similar-sized streamers" : "Strong growth - keep promoting!";
        
        // Update stream uptime for Zero to One Engine
        metrics.streamUptime = streamDuration;
        
        // Calculate Chat Score (0-100)
        calculateChatScore(metrics);
        
        // Update stream phase based on viewer count and uptime
        updateStreamPhase(metrics);
    }
}

// Calculate Chat Score - Single metric for engagement (0-100)
function calculateChatScore(metrics) {
    const messageWeight = 0.4; // 40% weight for message activity
    const sentimentWeight = 0.3; // 30% weight for chat sentiment
    const uniqueWeight = 0.3; // 30% weight for unique chatters
    
    // Message activity score (0-40 points)
    const messageScore = Math.min(metrics.messagesPerMinute * 2, 40);
    
    // Sentiment score (0-30 points) - normalize from -1 to 1 range to 0-30
    const sentimentScore = Math.max(0, (metrics.rollingSentimentScore + 1) * 15);
    
    // Unique chatters score (0-30 points)
    const uniqueChattersCount = metrics.uniqueChatters.size;
    const uniqueScore = Math.min(uniqueChattersCount * 3, 30);
    
    // Calculate final chat score
    metrics.chatScore = Math.round(messageScore + sentimentScore + uniqueScore);
    
    // Ensure score is between 0-100
    metrics.chatScore = Math.max(0, Math.min(100, metrics.chatScore));
}

// Update stream phase based on viewer count and stream uptime
function updateStreamPhase(metrics) {
    const previousPhase = metrics.streamPhase;
    const viewerCount = metrics.currentViewerCount;
    const uptime = metrics.streamUptime;
    
    // Phase transition logic
    if (viewerCount === 0 && uptime < 5) {
        // Still in zero viewers phase if stream just started
        metrics.streamPhase = 'zero_viewers';
    } else if (viewerCount > 0 && previousPhase === 'zero_viewers') {
        // First viewer detected!
        metrics.streamPhase = 'first_viewer';
        metrics.firstViewerTime = Date.now();
        metrics.phaseTransitionTime = Date.now();
        console.log(`🎉 [PHASE] Zero to One! First viewer detected! Phase: ${previousPhase} -> ${metrics.streamPhase}`);
    } else if (viewerCount >= 3 && previousPhase === 'first_viewer') {
        // Building audience phase
        metrics.streamPhase = 'building_audience';
        metrics.phaseTransitionTime = Date.now();
        console.log(`📈 [PHASE] Building audience! Phase: ${previousPhase} -> ${metrics.streamPhase}`);
    } else if (viewerCount === 0 && previousPhase !== 'zero_viewers') {
        // Back to zero viewers
        metrics.streamPhase = 'zero_viewers';
        metrics.phaseTransitionTime = Date.now();
        console.log(`🔄 [PHASE] Back to zero viewers. Phase: ${previousPhase} -> ${metrics.streamPhase}`);
    }
    
    // Log phase changes
    if (previousPhase !== metrics.streamPhase) {
        console.log(`🔄 [PHASE] Stream phase changed: ${previousPhase} -> ${metrics.streamPhase} (Viewers: ${viewerCount}, Uptime: ${uptime.toFixed(1)}min)`);
    }
}

// Analyze sentiment of recent messages for a specific session
function analyzeSentiment(metrics) {
    if (metrics.recentMessages.length === 0) return;
    
    const recentMessages = metrics.recentMessages.slice(-20); // Last 20 messages
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
        metrics.rollingSentimentScore = totalSentiment / validMessages;
    }
}

// Update top engaged users for a specific session
function updateTopEngagedUsers(metrics) {
    const userArray = Array.from(metrics.userEngagement.entries())
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
    
    metrics.topEngagedUsers = userArray;
}

// Infinite Prompt Engine - Generate AI prompt with external data integration
async function generateAIPrompt(session) {
    try {
        const metrics = session.metrics;
        const phase = metrics.streamPhase;
        
        console.log(`🤖 [AI] Generating prompt for phase: ${phase} (Viewers: ${metrics.currentViewerCount}, Chat Score: ${metrics.chatScore})`);
        
        let prompt = null;
        
        // Step 1: Check for high-priority events first
        prompt = await checkHighPriorityEvents(metrics);
        if (prompt) {
            console.log(`🚨 [AI] High-priority event prompt: ${prompt.type}`);
            return await finalizePrompt(prompt, session);
        }
        
        // Step 2: Phase-specific prompt generation with external data
        if (phase === 'zero_viewers') {
            prompt = await generateZeroViewersPrompt(metrics);
        } else if (phase === 'first_viewer') {
            prompt = generateFirstViewerPrompt(metrics);
        } else if (phase === 'building_audience') {
            prompt = await generateBuildingAudiencePrompt(metrics);
        }
        
        if (!prompt) {
            console.log('🤖 [AI] No prompt generated, using fallback');
            return null;
        }
        
        return await finalizePrompt(prompt, session);
    } catch (error) {
        console.error('Error generating AI prompt:', error);
        return null;
    }
}

// Check for high-priority events that need immediate attention
async function checkHighPriorityEvents(metrics) {
    const recentTime = Date.now() - 30000; // Last 30 seconds
    
    // Check for recent raids
    const recentRaids = metrics.recentRaids.filter(raid => raid.timestamp > recentTime);
    if (recentRaids.length > 0) {
        return {
            type: 'raid_celebration',
            message: 'raid_celebration',
            priority: 'urgent',
            phase: 'event'
        };
    }
    
    // Check for sub bombs (multiple subs in short time)
    const recentSubs = metrics.newSubs.filter(sub => sub.timestamp > recentTime);
    if (recentSubs.length >= 3) {
        return {
            type: 'sub_bomb_celebration',
            message: 'sub_bomb_celebration',
            priority: 'urgent',
            phase: 'event'
        };
    }
    
    // Check for bits storm
    const recentBits = metrics.recentBits.filter(bit => bit.timestamp > recentTime);
    if (recentBits.length >= 5) {
        return {
            type: 'bits_storm',
            message: 'bits_storm',
            priority: 'urgent',
            phase: 'event'
        };
    }
    
    // Check for follower surge
    const recentFollowers = metrics.newFollowers.filter(follower => follower.timestamp > recentTime);
    if (recentFollowers.length >= 5) {
        return {
            type: 'follower_surge',
            message: 'follower_surge',
            priority: 'urgent',
            phase: 'event'
        };
    }
    
    return null;
}

// Generate prompts for zero_viewers phase with external data
async function generateZeroViewersPrompt(metrics) {
    const alwaysBeTalkingPrompts = [
        'always_be_talking_1',
        'always_be_talking_2', 
        'always_be_talking_3',
        'always_be_talking_4',
        'always_be_talking_5'
    ];
    
    // 30% chance to use external data prompts
    if (Math.random() < 0.3) {
        const externalData = await fetchExternalData();
        if (externalData.news) {
            return {
                type: 'news_discussion',
                message: 'news_discussion',
                priority: 'high',
                phase: 'zero_viewers',
                externalData: externalData.news
            };
        } else if (externalData.trivia) {
            return {
                type: 'trivia_engagement',
                message: 'trivia_engagement',
                priority: 'high',
                phase: 'zero_viewers',
                externalData: externalData.trivia
            };
        }
    }
    
    // Fallback to always be talking prompts
    const randomPrompt = alwaysBeTalkingPrompts[Math.floor(Math.random() * alwaysBeTalkingPrompts.length)];
    
    return {
        type: 'zero_viewers',
        message: randomPrompt,
        priority: 'high',
        phase: 'zero_viewers'
    };
}

// Generate AI-powered prompts for building_audience phase with external data
async function generateBuildingAudiencePrompt(metrics) {
    // Build context object with stream phase, metrics, and external data
    const context = await buildPromptContext(metrics);
    
    try {
        // Try AI-powered prompt with rich context
        const sessionLanguage = metrics.language || 'en';
        const aiPrompt = await geminiService.generatePrompt(context, sessionLanguage);
        
        if (aiPrompt && aiPrompt.message) {
            return {
                type: 'ai_powered',
                message: aiPrompt.message,
                priority: 'medium',
                phase: 'building_audience',
                context: context
            };
        }
    } catch (error) {
        console.log('🤖 [AI] Gemini API failed, using dynamic fallback:', error.message);
    }
    
    // Fallback to dynamic library with external data
    return await generateDynamicFallbackPrompt(metrics);
}

// Build rich context object for AI prompts
async function buildPromptContext(metrics) {
    const timeContext = getTimeContext();
    const externalData = await fetchExternalData();
    
    return {
        streamPhase: metrics.streamPhase,
        viewerCount: metrics.currentViewerCount,
        messageRate: metrics.messagesPerMinute,
        chatScore: metrics.chatScore,
        sentiment: metrics.rollingSentimentScore,
        uniqueChatters: metrics.uniqueChatters.size,
        timeContext: timeContext,
        externalData: externalData,
        recentActivity: {
            messages: metrics.recentMessages.slice(-5),
            followers: metrics.newFollowers.slice(-3),
            subs: metrics.newSubs.slice(-3),
            bits: metrics.recentBits.slice(-3)
        }
    };
}

// Fetch external data (news, trivia, etc.)
async function fetchExternalData() {
    try {
        const [news, trivia] = await Promise.all([
            fetchTrendingNews(),
            fetchRandomTrivia()
        ]);
        
        return {
            news: news.articles?.[0] || null,
            trivia: trivia || null,
            timestamp: Date.now()
        };
    } catch (error) {
        console.log('📡 [EXTERNAL] Error fetching external data:', error.message);
        return { news: null, trivia: null, timestamp: Date.now() };
    }
}

// Generate dynamic fallback prompts with external data
async function generateDynamicFallbackPrompt(metrics) {
    const externalData = await fetchExternalData();
    const timeContext = getTimeContext();
    
    // Select prompt based on metrics and context
    let selectedPrompt;
    
    if (metrics.messagesPerMinute < 1) {
        selectedPrompt = 'low_engagement_boost';
    } else if (metrics.rollingSentimentScore > 0.5) {
        selectedPrompt = 'sentiment_positive';
    } else if (metrics.rollingSentimentScore < -0.3) {
        selectedPrompt = 'sentiment_negative';
    } else if (timeContext.isPrimeTime) {
        selectedPrompt = 'prime_time_boost';
    } else if (timeContext.isWeekend) {
        selectedPrompt = 'weekend_energy';
    } else if (externalData.news) {
        selectedPrompt = 'news_discussion';
    } else if (externalData.trivia) {
        selectedPrompt = 'trivia_engagement';
    } else {
        selectedPrompt = 'time_based_greeting';
    }
    
    return {
        type: 'dynamic_fallback',
        message: selectedPrompt,
        priority: 'medium',
        phase: 'building_audience',
        externalData: externalData,
        timeContext: timeContext
    };
}

// Finalize prompt with placeholder replacement and history
async function finalizePrompt(prompt, session) {
    const metrics = session.metrics;
    const sessionLanguage = metrics.language || 'en'; // Use session language, fallback to 'en'
    
    // Get the base message from translations
    let fullMessage = promptTranslations[sessionLanguage][prompt.message] || prompt.message;
    
    // Prepare replacement data
    const replacements = {
        '{viewerCount}': metrics.currentViewerCount,
        '{messageRate}': metrics.messagesPerMinute.toFixed(1),
        '{followRate}': metrics.followersGainsPerMinute.toFixed(1),
        '{chatScore}': metrics.chatScore,
        '{sentiment}': metrics.rollingSentimentScore.toFixed(2),
        '{uniqueChatters}': metrics.uniqueChatters.size
    };
    
    // Add external data replacements
    if (prompt.externalData) {
        if (prompt.externalData.news) {
            replacements['{newsTitle}'] = prompt.externalData.news.title || 'this interesting story';
        }
        if (prompt.externalData.trivia) {
            replacements['{triviaText}'] = prompt.externalData.trivia.text || 'something interesting';
        }
    }
    
    // Add time context replacements
    if (prompt.timeContext) {
        replacements['{timeOfDay}'] = prompt.timeContext.timeOfDay;
        replacements['{dayOfWeek}'] = prompt.timeContext.dayOfWeek;
        replacements['{timeContext}'] = prompt.timeContext.isPrimeTime ? 'in prime time' : 'having a great time';
    }
    
    // Add interactive content replacements
    replacements['{pollQuestion}'] = getRandomPollQuestion();
    replacements['{challengeDescription}'] = getRandomChallenge();
    
    // Replace all placeholders
    Object.keys(replacements).forEach(key => {
        fullMessage = fullMessage.replace(new RegExp(key, 'g'), replacements[key]);
    });
    
    prompt.message = fullMessage;
    
    // Add to prompt history
    metrics.promptHistory.push({
        timestamp: Date.now(),
        prompt: prompt,
        phase: metrics.streamPhase,
        metrics: {
            viewerCount: metrics.currentViewerCount,
            messageRate: metrics.messagesPerMinute,
            sentiment: metrics.rollingSentimentScore,
            chatScore: metrics.chatScore
        }
    });
    
    // Keep only last 50 prompts
    if (metrics.promptHistory.length > 50) {
        metrics.promptHistory = metrics.promptHistory.slice(-50);
    }
    
    metrics.lastPromptTime = Date.now();
    
    return prompt;
}

// Helper functions for interactive content
function getRandomPollQuestion() {
    const questions = [
        "What's your favorite type of content?",
        "What should I focus on next?",
        "What's your favorite game?",
        "What time do you usually watch streams?",
        "What's the best part of this stream?"
    ];
    return questions[Math.floor(Math.random() * questions.length)];
}

function getRandomChallenge() {
    const challenges = [
        "Type your favorite emoji in the next 10 seconds",
        "Share something that made you smile today",
        "Tell me about your favorite hobby",
        "Share a fun fact about yourself",
        "What's the best advice you've ever received?"
    ];
    return challenges[Math.floor(Math.random() * challenges.length)];
}


// Generate high-priority first viewer prompts
function generateFirstViewerPrompt(metrics) {
    const firstViewerPrompts = [
        'first_viewer_welcome',
        'first_viewer_engagement',
        'first_viewer_community'
    ];
    
    // Select random prompt
    const randomPrompt = firstViewerPrompts[Math.floor(Math.random() * firstViewerPrompts.length)];
    
    return {
        type: 'first_viewer',
        message: randomPrompt,
        priority: 'urgent',
        phase: 'first_viewer'
    };
}

// Broadcast metrics to a specific session's dashboard clients
function broadcastToSession(session) {
    console.log(`📊 [BROADCAST] Attempting to broadcast to session: ${session.sessionId}`);
    console.log(`📊 [BROADCAST] Session connected: ${session.isConnected}, Channel: ${session.channel}`);
    console.log(`📊 [BROADCAST] WebSocket clients: ${session.wsClients.size}`);
    
    if (!session.isConnected || !session.channel) {
        console.log(`📊 [BROADCAST] Skipping broadcast - not connected or no channel`);
        return;
    }
    
    // Calculate accurate revenue
    const revenueData = calculateAccurateRevenue(session.metrics);
    
    const metricsData = {
        ...session.metrics,
        uniqueChatters: session.metrics.uniqueChatters.size,
        userEngagement: Object.fromEntries(session.metrics.userEngagement),
        channelName: session.channel,
        sessionId: session.metrics.streamStartTime || Date.now(),
        timestamp: Date.now(),
        revenue: revenueData,
        // Ensure streamPhase is explicitly included
        streamPhase: session.metrics.streamPhase,
        chatScore: session.metrics.chatScore
    };
    
    console.log(`📊 [BROADCAST] Stream Phase: ${session.metrics.streamPhase}, Chat Score: ${session.metrics.chatScore}`);
    
    const message = JSON.stringify(metricsData);
    console.log(`📊 [BROADCAST] Sending data to ${session.wsClients.size} clients`);
    
    session.wsClients.forEach(ws => {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(message);
            console.log(`📊 [BROADCAST] Data sent to WebSocket client`);
        } else {
            console.log(`📊 [BROADCAST] WebSocket client not open, state: ${ws.readyState}`);
        }
    });
}

// Broadcast metrics to all active sessions (legacy support)
function broadcastGlobalMetrics() {
    userSessions.forEach(session => {
        broadcastToSession(session);
    });
}

// WebSocket connection handler for multi-session support
wss.on('connection', (ws, req) => {
    console.log('📊 [DASHBOARD] New dashboard connection');
    
    // Extract sessionId from query parameters or first message
    const url = new URL(req.url, `http://${req.headers.host}`);
    const sessionId = url.searchParams.get('sessionId');
    
    if (sessionId && userSessions.has(sessionId)) {
        // Add WebSocket to existing session
        const session = userSessions.get(sessionId);
        session.wsClients.add(ws);
        console.log(`📊 [DASHBOARD] Added client to session: ${sessionId}`);
        console.log(`📊 [DASHBOARD] Session status - Connected: ${session.isConnected}, Channel: ${session.channel}`);
        
        // Send current metrics immediately
        broadcastToSession(session);
    } else {
        console.log(`📊 [DASHBOARD] No session found for sessionId: ${sessionId}`);
        console.log(`📊 [DASHBOARD] Available sessions: ${Array.from(userSessions.keys()).join(', ')}`);
        // Legacy support - add to global connections
        dashboardConnections.add(ws);
        
        // Send empty state when no session is connected
        const emptyData = createEmptyMetrics();
        emptyData.channelName = 'No Channel';
        emptyData.sessionId = null;
        emptyData.timestamp = Date.now();
        emptyData.revenue = {
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
        };
        
        ws.send(JSON.stringify(emptyData));
    }
    
    ws.on('close', () => {
        console.log('📊 [DASHBOARD] Dashboard connection closed');
        
        // Remove from all sessions
        userSessions.forEach(session => {
            session.wsClients.delete(ws);
        });
        
        // Remove from legacy connections
        dashboardConnections.delete(ws);
    });
    
    ws.on('error', (error) => {
        console.error('📊 [DASHBOARD] WebSocket error:', error);
        
        // Remove from all sessions
        userSessions.forEach(session => {
            session.wsClients.delete(ws);
        });
        
        // Remove from legacy connections
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
    const { sessionId } = req.query;
    
    if (sessionId && userSessions.has(sessionId)) {
        const session = userSessions.get(sessionId);
    res.json({
            ...session.metrics,
            uniqueChatters: session.metrics.uniqueChatters.size,
            userEngagement: Object.fromEntries(session.metrics.userEngagement),
            channelName: session.channel || 'No Channel',
            sessionId: session.sessionId,
        timestamp: Date.now()
    });
    } else {
        // Return empty metrics for no session
        const emptyMetrics = createEmptyMetrics();
        res.json({
            ...emptyMetrics,
            uniqueChatters: 0,
            userEngagement: {},
            channelName: 'No Channel',
            sessionId: null,
            timestamp: Date.now()
        });
    }
});


app.get('/api/health', (req, res) => {
    res.json({
        status: 'healthy',
        twitch: {
            status: 'monitoring_sessions',
            active_sessions: userSessions.size
        },
        gemini: geminiService.getHealthStatus(),
        uptime: process.uptime(),
        memory: process.memoryUsage()
    });
});

// Test endpoint to check if a channel is live
app.post('/api/test-channel', async (req, res) => {
    const { channel } = req.body;
    
    if (!channel) {
        return res.status(400).json({ error: 'Channel name required' });
    }
    
    try {
        console.log(`🧪 [TEST] Checking if channel ${channel} is live...`);
        
        // Check if user exists
        const userData = await getTwitchAPI('users', {
            login: channel
        });
        console.log(`👤 [TEST] User data:`, JSON.stringify(userData, null, 2));
        
        // Check if stream is live
        const streamData = await getTwitchAPI('streams', {
            user_login: channel
        });
        console.log(`📺 [TEST] Stream data:`, JSON.stringify(streamData, null, 2));
        
        res.json({
            channel: channel,
            userExists: userData.data && userData.data.length > 0,
            isLive: streamData.data && streamData.data.length > 0,
            userData: userData,
            streamData: streamData
        });
    } catch (error) {
        console.error('Error testing channel:', error);
        res.status(500).json({ error: error.message });
    }
});

// Test endpoint to simulate events
app.post('/api/test-events', (req, res) => {
    const { sessionId } = req.body;
    
    if (!sessionId || !userSessions.has(sessionId)) {
        return res.status(400).json({ error: 'Session not found' });
    }
    
    const session = userSessions.get(sessionId);
    const metrics = session.metrics;
    
    console.log('🧪 [TEST] Simulating test events for session:', sessionId);
    
    // Simulate a follow
    metrics.totalFollowers++;
    metrics.sessionFollowersGained++;
    metrics.newFollowers.push({
        username: 'TestFollower',
        timestamp: Date.now()
    });
    
    // Simulate subscriptions with different tiers
    metrics.totalSubs += 3;
    metrics.sessionSubsGained += 3;
    
    // Tier 1 subscription
    metrics.tier1Subs++;
    metrics.sessionTier1Subs++;
    metrics.newSubs.push({
        username: 'TestSubscriber1',
        plan: 'Tier 1',
        timestamp: Date.now()
    });
    
    // Tier 2 subscription
    metrics.tier2Subs++;
    metrics.sessionTier2Subs++;
    metrics.newSubs.push({
        username: 'TestSubscriber2',
        plan: 'Tier 2',
        timestamp: Date.now()
    });
    
    // Tier 3 subscription
    metrics.tier3Subs++;
    metrics.sessionTier3Subs++;
    metrics.newSubs.push({
        username: 'TestSubscriber3',
        plan: 'Tier 3',
        timestamp: Date.now()
    });
    
    // Simulate bits
    metrics.totalBits += 100;
    metrics.sessionBitsEarned += 100;
    metrics.recentBits.push({
        username: 'TestBitsUser',
        bits: 100,
        message: 'Test bits!',
        timestamp: Date.now()
    });
    
    // Update metrics and broadcast
    calculateRollingMetrics(metrics);
    updateTopEngagedUsers(metrics);
    broadcastToSession(session);
    
    res.json({ 
        message: 'Test events simulated',
        metrics: {
            followers: metrics.totalFollowers,
            subs: metrics.totalSubs,
            bits: metrics.totalBits,
            tier1Subs: metrics.tier1Subs,
            tier2Subs: metrics.tier2Subs,
            tier3Subs: metrics.tier3Subs,
            revenue: calculateAccurateRevenue(metrics)
        }
    });
});

app.post('/api/generate-prompt', async (req, res) => {
    try {
        const { sessionId } = req.body;
        
        if (!sessionId || !userSessions.has(sessionId)) {
            return res.status(400).json({ success: false, error: 'Session ID required' });
        }
        
        const session = userSessions.get(sessionId);
        const prompt = await generateAIPrompt(session);
        
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
    console.log(`🌐 [LANGUAGE] Set language request received:`, req.body);
    
    const { language, sessionId } = req.body;

    if (!sessionId) {
        console.log(`🌐 [LANGUAGE] No sessionId provided. Available sessions: ${Array.from(userSessions.keys())}`);
        return res.status(400).json({ success: false, error: 'Session ID is required' });
    }

    if (!userSessions.has(sessionId)) {
        console.log(`🌐 [LANGUAGE] Session not found: ${sessionId}. Available sessions: ${Array.from(userSessions.keys())}`);
        return res.status(404).json({ success: false, error: 'Session not found' });
    }

    if (!language) {
        console.log(`🌐 [LANGUAGE] No language provided`);
        return res.status(400).json({ success: false, error: 'Language is required' });
    }

    if (!promptTranslations[language]) {
        console.log(`🌐 [LANGUAGE] Invalid language: ${language}. Available languages: ${Object.keys(promptTranslations).join(', ')}`);
        return res.status(400).json({ success: false, error: 'Invalid language. Available languages: ' + Object.keys(promptTranslations).join(', ') });
    }

    const session = userSessions.get(sessionId);
    session.metrics.language = language; // Set language on the specific session
    console.log(`🌐 [LANGUAGE] Language for session ${sessionId} set to: ${language}`);
    res.json({ success: true, language: language });
});

// Create empty metrics object for new sessions
function createEmptyMetrics() {
    return {
        // Stream info
        isLive: false,
        streamTitle: '',
        gameCategory: '',
        streamLanguage: '',
        streamStartTime: Date.now(),
        streamUptime: 0,
        
        // Viewer metrics
        currentViewerCount: 0,
        peakViewerCount: 0,
        averageViewerCount: 0,
        totalViewerMinutes: 0,
        viewerRetention: 0,
        predictedRetention: 0,
        
        // Chat metrics
        totalMessages: 0,
        messagesPerMinute: 0,
        rollingSentimentScore: 0,
        uniqueChatters: new Set(),
        chatScore: 0,
        
        // Engagement metrics
        totalFollowers: 0,
        sessionFollowersGained: 0,
        followersGainsPerMinute: 0,
        totalSubs: 0,
        sessionSubsGained: 0,
        subsGainsPerMinute: 0,
        totalBits: 0,
        sessionBitsEarned: 0,
        bitsPerMinute: 0,
        totalRaids: 0,
        sessionRaidsReceived: 0,
        
        // Sub tiers
        tier1Subs: 0,
        tier2Subs: 0,
        tier3Subs: 0,
        
        // Recent activity arrays
        recentMessages: [],
        newFollowers: [],
        newSubs: [],
        recentBits: [],
        recentRaids: [],
        
        // User engagement tracking
        userEngagement: new Map(),
        topEngagedUsers: [],
        
        // Zero to One Engine
        streamPhase: 'zero_viewers', // zero_viewers, first_viewer, building_audience
        firstViewerTime: null,
        phaseTransitionTime: Date.now(),
        lastPromptTime: 0,
        promptHistory: [],
        
        // Peer comparison (dummy data for now)
        peerAvgViewers: 15,
        peerAvgFollowers: 1200,
        peerAvgSubs: 45,
        
        // Recommendations
        retentionRec: "Stream starting up...",
        viewerRec: "Building audience...",
        growthRec: "Focus on engagement...",
        revenueTip: "Getting started...",
        
        // Health score
        healthScore: 100,
        
        // Projected metrics
        projectedRevenue: 0,
        
        // Session-specific language setting
        language: 'en' // Default to English
    };
}

// Channel switching endpoints - Multi-session support
app.post('/api/connect-channel', async (req, res) => {
    try {
        const { channel, sessionId } = req.body;
        
        if (!channel || typeof channel !== 'string') {
            return res.status(400).json({ error: 'Channel name is required' });
        }
        
        const channelName = channel.trim().toLowerCase();
        const newSessionId = sessionId || generateSessionId();
        
        // Check if there's already a session for this channel
        const existingChannelSession = Array.from(userSessions.values()).find(s => s.channel === channelName);
        if (existingChannelSession) {
            console.log(`🔄 [CHANNEL] Found existing session for channel ${channelName}: ${existingChannelSession.sessionId}`);
            if (existingChannelSession.isConnected) {
                return res.json({ 
                    success: true, 
                    channel: channelName,
                    sessionId: existingChannelSession.sessionId,
                    message: `Already connected to ${channelName}` 
                });
            }
            
            // Disconnect existing session
            if (existingChannelSession.connection && existingChannelSession.connection.readyState() === 'OPEN') {
                console.log(`🔄 [CHANNEL] Disconnecting existing session: ${existingChannelSession.sessionId}`);
                await existingChannelSession.connection.disconnect();
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
            // Remove the old session
            userSessions.delete(existingChannelSession.sessionId);
        }
        
        // Check if session already exists by ID
        if (userSessions.has(newSessionId)) {
            const existingSession = userSessions.get(newSessionId);
            if (existingSession.connection && existingSession.connection.readyState() === 'OPEN') {
                console.log(`🔄 [CHANNEL] Disconnecting existing session by ID: ${newSessionId}`);
                await existingSession.connection.disconnect();
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
            userSessions.delete(newSessionId);
        }
        
        // Create new session
        const session = {
            sessionId: newSessionId,
            channel: channelName,
            isConnected: false,
            connection: null,
            metrics: createEmptyMetrics(),
            wsClients: new Set()
        };
        
        // Connect to new channel
        console.log(`🔗 [CHANNEL] Connecting to new channel: ${channelName} (Session: ${newSessionId})`);
        
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
        
        // Create new Twitch client for this session
        const newTwitchClient = new tmi.Client(twitchConfig);
        session.connection = newTwitchClient;
        
        // Set up event handlers for this session
        setupSessionEventHandlers(session);
        
        // Connect to new channel
        await newTwitchClient.connect();
        
        session.isConnected = true;
        session.metrics.streamStartTime = Date.now();
        
        // Store session
        userSessions.set(newSessionId, session);
        
        // Fetch initial metrics
        await fetchInitialMetrics(channelName, session.metrics);
        
        console.log(`✅ [CHANNEL] Successfully connected to: ${channelName} (Session: ${newSessionId})`);
        console.log(`📊 [SESSION] Session stored in userSessions. Total sessions: ${userSessions.size}`);
        
        // Clean up any old sessions for this channel
        cleanupOldSessions(channelName, newSessionId);
        
        // Send initial data to any existing WebSocket clients for this session
        if (session.wsClients.size > 0) {
            console.log(`📊 [SESSION] Broadcasting to ${session.wsClients.size} existing clients`);
            broadcastToSession(session);
        }
        
        res.json({ 
            success: true, 
            channel: channelName,
            sessionId: newSessionId,
            message: `Connected to ${channelName}` 
        });
        
    } catch (error) {
        console.error('❌ [CHANNEL] Error connecting to channel:', error);
        res.status(500).json({ 
            error: 'Failed to connect to channel',
            details: error.message 
        });
    }
});

app.post('/api/disconnect-channel', async (req, res) => {
    try {
        const { sessionId } = req.body;
        
        console.log(`🔄 [CHANNEL] Disconnect request - SessionId: ${sessionId}, Available sessions: ${Array.from(userSessions.keys())}`);
        
        if (!sessionId) {
            // If no sessionId provided, disconnect all sessions
            console.log(`🔄 [CHANNEL] No sessionId provided, disconnecting all sessions`);
            
            for (const [id, session] of userSessions.entries()) {
                if (session.isConnected && session.connection && session.connection.readyState() === 'OPEN') {
                    console.log(`🔄 [CHANNEL] Disconnecting session: ${id} (Channel: ${session.channel})`);
                    await session.connection.disconnect();
                }
            }
            
            userSessions.clear();
            
            console.log(`✅ [CHANNEL] Disconnected from all channels`);
            
            res.json({ 
                success: true, 
                message: 'Disconnected from all channels' 
            });
            return;
        }
        
        if (!userSessions.has(sessionId)) {
            console.log(`❌ [CHANNEL] Session not found: ${sessionId}`);
            return res.status(400).json({ error: 'Session not found' });
        }
        
        const session = userSessions.get(sessionId);
        
        if (session.isConnected && session.connection && session.connection.readyState() === 'OPEN') {
            console.log(`🔄 [CHANNEL] Disconnecting from channel: ${session.channel} (Session: ${sessionId})`);
            await session.connection.disconnect();
        }
        
        // Remove session
        userSessions.delete(sessionId);
        
        console.log(`✅ [CHANNEL] Disconnected from channel (Session: ${sessionId})`);
        
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
    const { sessionId } = req.query;
    
    if (sessionId && userSessions.has(sessionId)) {
        const session = userSessions.get(sessionId);
    res.json({
            channel: session.channel,
            connected: session.isConnected,
            sessionId: session.sessionId,
            status: session.isConnected ? 'connected' : 'disconnected'
        });
    } else {
        // Return all active sessions for overview
        const activeSessions = Array.from(userSessions.values()).map(session => ({
            sessionId: session.sessionId,
            channel: session.channel,
            connected: session.isConnected,
            status: session.isConnected ? 'connected' : 'disconnected'
        }));
        
        res.json({
            activeSessions,
            totalSessions: activeSessions.length
        });
    }
});

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 [SERVER] Twitch Live Assistant running on port ${PORT}`);
    console.log(`📊 [DASHBOARD] Dashboard available at http://localhost:${PORT}/twitch_dashboard.html`);
    console.log(`🔗 [API] API available at http://localhost:${PORT}/api/metrics`);
});

// Periodic tasks - run for all active sessions
setInterval(async () => {
    userSessions.forEach(async (session) => {
        if (session.isConnected && session.channel) {
            console.log(`🔄 [PERIODIC] Updating stream info for session ${session.sessionId}...`);
            // Update stream info
            const streamInfo = await getStreamInfo(session.channel);
            if (streamInfo) {
                console.log(`📺 [STREAM] Session ${session.sessionId} - Live: ${session.metrics.isLive}, Viewers: ${session.metrics.currentViewerCount}, Title: ${session.metrics.streamTitle}`);
            } else {
                console.log(`📺 [STREAM] Session ${session.sessionId} - No stream data received`);
            }
            
            // Update rolling metrics
            calculateRollingMetrics(session.metrics);
            
            // Broadcast updates
            broadcastToSession(session);
            console.log(`📊 [PERIODIC] Metrics updated and broadcasted for session ${session.sessionId}`);
        }
    });
}, 5000); // Every 5 seconds for more real-time updates

// WebSocket heartbeat - send updates more frequently to keep dashboard responsive
setInterval(() => {
    userSessions.forEach(session => {
        if (session.isConnected && session.channel && session.wsClients.size > 0) {
            // Send a lightweight update to keep dashboard responsive
            broadcastToSession(session);
        }
    });
    
    // Legacy support for global connections
    if (dashboardConnections.size > 0) {
        broadcastGlobalMetrics();
    }
}, 2000); // Every 2 seconds for dashboard responsiveness

// Zero to One Engine - Generate AI prompts based on stream phase
setInterval(async () => {
    userSessions.forEach(async (session) => {
        if (session.isConnected && session.channel && session.metrics.isLive) {
            const metrics = session.metrics;
            const timeSinceLastPrompt = Date.now() - metrics.lastPromptTime;
            
            let shouldGeneratePrompt = false;
            let promptInterval = 60000; // Default 1 minute
            
            // Phase-specific prompt timing
            if (metrics.streamPhase === 'zero_viewers') {
                promptInterval = 30000; // 30 seconds for zero viewers
                shouldGeneratePrompt = timeSinceLastPrompt > promptInterval;
            } else if (metrics.streamPhase === 'first_viewer') {
                promptInterval = 10000; // 10 seconds for first viewer (urgent)
                shouldGeneratePrompt = timeSinceLastPrompt > promptInterval;
            } else if (metrics.streamPhase === 'building_audience') {
                promptInterval = 60000; // 1 minute for building audience
                shouldGeneratePrompt = timeSinceLastPrompt > promptInterval && metrics.currentViewerCount > 0;
            }
            
            if (shouldGeneratePrompt) {
                const prompt = await generateAIPrompt(session);
                if (prompt) {
                    console.log(`🤖 [AI] Generated ${prompt.type} prompt for ${metrics.streamPhase} phase:`, prompt.message);
                }
            }
        }
    });
}, 15000); // Check every 15 seconds for responsiveness

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 [SHUTDOWN] Shutting down gracefully...');
    
    console.log(`[SHUTDOWN] Disconnecting ${userSessions.size} active sessions...`);
    userSessions.forEach(session => {
        if (session.connection && session.connection.readyState() === 'OPEN') {
            session.connection.disconnect();
        }
    });
    
    server.close(() => {
        console.log('✅ [SHUTDOWN] Server closed');
        process.exit(0);
    });
});

module.exports = { app, server, userSessions };