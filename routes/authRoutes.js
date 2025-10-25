import express from 'express';
import fetch from 'node-fetch';
import OpenAI from 'openai';
import querystring from 'querystring';
import { addArtwork, getUserArtworks, getUserStats, deleteArtwork } from '../database-hybrid.js';

const router = express.Router();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Rate limiting and protection mechanisms
const rateLimitMap = new Map(); // Store user request data
const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes
const MAX_REQUESTS_PER_SESSION = 10; // Max 10 requests per session
const COOLDOWN_PERIOD = 30 * 1000; // 30 seconds between requests
const MAX_REQUESTS_PER_MINUTE = 3; // Max 3 requests per minute

// Clean up old sessions
setInterval(() => {
    const now = Date.now();
    for (const [sessionId, data] of rateLimitMap.entries()) {
        if (now - data.lastRequest > SESSION_TIMEOUT) {
            rateLimitMap.delete(sessionId);
        }
    }
}, 5 * 60 * 1000); // Clean every 5 minutes

function checkRateLimit(sessionId) {
    const now = Date.now();
    const userData = rateLimitMap.get(sessionId) || {
        requests: [],
        totalRequests: 0,
        lastRequest: 0
    };

    // Check session limit
    if (userData.totalRequests >= MAX_REQUESTS_PER_SESSION) {
        return {
            allowed: false,
            reason: 'session_limit',
            message: `You've reached the maximum of ${MAX_REQUESTS_PER_SESSION} requests per session. Please refresh the page to start a new session.`,
            retryAfter: SESSION_TIMEOUT
        };
    }

    // Check cooldown period
    if (now - userData.lastRequest < COOLDOWN_PERIOD) {
        const remainingTime = Math.ceil((COOLDOWN_PERIOD - (now - userData.lastRequest)) / 1000);
        return {
            allowed: false,
            reason: 'cooldown',
            message: `Please wait ${remainingTime} seconds before making another request.`,
            retryAfter: COOLDOWN_PERIOD - (now - userData.lastRequest)
        };
    }

    // Check requests per minute
    const recentRequests = userData.requests.filter(time => now - time < 60 * 1000);
    if (recentRequests.length >= MAX_REQUESTS_PER_MINUTE) {
        const oldestRequest = Math.min(...recentRequests);
        const retryAfter = 60 * 1000 - (now - oldestRequest);
        return {
            allowed: false,
            reason: 'rate_limit',
            message: `Too many requests. Please wait ${Math.ceil(retryAfter / 1000)} seconds.`,
            retryAfter: retryAfter
        };
    }

    // Update user data
    userData.requests.push(now);
    userData.totalRequests++;
    userData.lastRequest = now;
    
    // Keep only recent requests (last 2 minutes)
    userData.requests = userData.requests.filter(time => now - time < 2 * 60 * 1000);
    
    rateLimitMap.set(sessionId, userData);

    return { allowed: true };
}

function generateSessionId(req) {
    // Use IP + User-Agent as session identifier
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    const userAgent = req.get('User-Agent') || 'unknown';
    return `${ip}-${userAgent}`.replace(/[^a-zA-Z0-9-]/g, '');
}

// Function to get Spotify user profile
async function getSpotifyUserProfile(accessToken) {
    try {
        const response = await fetch('https://api.spotify.com/v1/me', {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to fetch user profile');
        }
        
        return await response.json();
    } catch (error) {
        console.error('Error fetching user profile:', error);
        return null;
    }
}

// this can be used as a seperate module
const encodeFormData = (data) => {
  return Object.keys(data)
    .map(key => encodeURIComponent(key) + '=' + encodeURIComponent(data[key]))
    .join('&');
}

router.get('/login', async (req, res) => {
  const scope = `user-library-read`;

  res.redirect('https://accounts.spotify.com/authorize?' +
    querystring.stringify({
      response_type: 'code',
      client_id: process.env.CLIENT_ID,
      scope: scope,
      redirect_uri: process.env.REDIRECTURI
    })
  );
});

router.get('/logout', (req, res) => {
  res.redirect('/');
});

router.get('/logged', async (req, res) => {
  const body = {
    grant_type: 'authorization_code',
    code: req.query.code,
    redirect_uri: process.env.REDIRECTURI,
    client_id: process.env.CLIENT_ID,
    client_secret: process.env.CLIENT_SECRET,
  }

  await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Accept": "application/json"
    },
    body: encodeFormData(body)
  })
    .then(response => response.json())
    .then(data => {
      const query = querystring.stringify(data);
      res.redirect(`${process.env.CLIENT_REDIRECTURI}?${query}`);
    });
});

// Function to create meaningful prompts based on actual song content and meaning
function createSafePrompt(songs) {
    if (!songs || songs.length === 0) {
        return {
            prompt: "Abstract digital artwork inspired by music",
            details: {
                artStyle: "abstract digital art",
                colorPalette: "vibrant colors",
                visualElements: "musical inspiration"
            }
        };
    }

    // Function to extract meaningful content from song titles
    function extractSongContent(songTitle) {
        const cleanTitle = songTitle.replace(/\s*\([^)]*\)/g, '').trim();
        
        // Analyze the song title for meaningful content and themes
        const titleWords = cleanTitle.toLowerCase().split(/\s+/);
        
        // Look for specific meaningful elements in the title
        const meaningfulElements = [];
        
        // Check for specific themes and concepts
        if (cleanTitle.toLowerCase().includes('heaven')) {
            meaningfulElements.push('a celestial stairway ascending through clouds');
        }
        if (cleanTitle.toLowerCase().includes('hell')) {
            meaningfulElements.push('flames and shadows in a dark underworld');
        }
        if (cleanTitle.toLowerCase().includes('fire')) {
            meaningfulElements.push('dancing flames and embers');
        }
        if (cleanTitle.toLowerCase().includes('water') || cleanTitle.toLowerCase().includes('ocean') || cleanTitle.toLowerCase().includes('sea')) {
            meaningfulElements.push('waves and flowing water');
        }
        if (cleanTitle.toLowerCase().includes('moon')) {
            meaningfulElements.push('a glowing moon in the night sky');
        }
        if (cleanTitle.toLowerCase().includes('sun')) {
            meaningfulElements.push('radiant sunlight and golden rays');
        }
        if (cleanTitle.toLowerCase().includes('star')) {
            meaningfulElements.push('twinkling stars in the darkness');
        }
        if (cleanTitle.toLowerCase().includes('rain')) {
            meaningfulElements.push('falling raindrops and storm clouds');
        }
        if (cleanTitle.toLowerCase().includes('wind')) {
            meaningfulElements.push('swirling air currents and movement');
        }
        if (cleanTitle.toLowerCase().includes('mountain')) {
            meaningfulElements.push('towering peaks and rocky landscapes');
        }
        if (cleanTitle.toLowerCase().includes('forest')) {
            meaningfulElements.push('towering trees and woodland paths');
        }
        if (cleanTitle.toLowerCase().includes('city')) {
            meaningfulElements.push('urban skylines and city lights');
        }
        if (cleanTitle.toLowerCase().includes('road') || cleanTitle.toLowerCase().includes('highway')) {
            meaningfulElements.push('a winding road stretching into the distance');
        }
        if (cleanTitle.toLowerCase().includes('home')) {
            meaningfulElements.push('a welcoming house and hearth');
        }
        if (cleanTitle.toLowerCase().includes('love')) {
            meaningfulElements.push('hearts and romantic imagery');
        }
        if (cleanTitle.toLowerCase().includes('dream')) {
            meaningfulElements.push('surreal dreamlike landscapes');
        }
        if (cleanTitle.toLowerCase().includes('night')) {
            meaningfulElements.push('darkness and nocturnal scenes');
        }
        if (cleanTitle.toLowerCase().includes('day')) {
            meaningfulElements.push('bright daylight and sunshine');
        }
        if (cleanTitle.toLowerCase().includes('time')) {
            meaningfulElements.push('clocks and temporal imagery');
        }
        if (cleanTitle.toLowerCase().includes('space')) {
            meaningfulElements.push('cosmic galaxies and star fields');
        }
        if (cleanTitle.toLowerCase().includes('dance')) {
            meaningfulElements.push('figures in motion and dance poses');
        }
        if (cleanTitle.toLowerCase().includes('music')) {
            meaningfulElements.push('musical instruments and sound waves');
        }
        if (cleanTitle.toLowerCase().includes('angel')) {
            meaningfulElements.push('winged celestial beings');
        }
        if (cleanTitle.toLowerCase().includes('devil')) {
            meaningfulElements.push('dark supernatural figures');
        }
        if (cleanTitle.toLowerCase().includes('war')) {
            meaningfulElements.push('battle scenes and conflict');
        }
        if (cleanTitle.toLowerCase().includes('peace')) {
            meaningfulElements.push('serene landscapes and harmony');
        }
        if (cleanTitle.toLowerCase().includes('hope')) {
            meaningfulElements.push('uplifting scenes and optimism');
        }
        if (cleanTitle.toLowerCase().includes('fear')) {
            meaningfulElements.push('dark shadows and ominous imagery');
        }
        if (cleanTitle.toLowerCase().includes('joy')) {
            meaningfulElements.push('celebration and happiness');
        }
        if (cleanTitle.toLowerCase().includes('sad')) {
            meaningfulElements.push('melancholic scenes and sorrow');
        }
        if (cleanTitle.toLowerCase().includes('angry')) {
            meaningfulElements.push('intense emotions and conflict');
        }
        if (cleanTitle.toLowerCase().includes('happy')) {
            meaningfulElements.push('bright cheerful scenes');
        }
        if (cleanTitle.toLowerCase().includes('lonely')) {
            meaningfulElements.push('isolated figures and solitude');
        }
        if (cleanTitle.toLowerCase().includes('together')) {
            meaningfulElements.push('united figures and togetherness');
        }
        if (cleanTitle.toLowerCase().includes('alone')) {
            meaningfulElements.push('solitary figures and isolation');
        }
        if (cleanTitle.toLowerCase().includes('free')) {
            meaningfulElements.push('open spaces and liberation');
        }
        if (cleanTitle.toLowerCase().includes('trapped')) {
            meaningfulElements.push('confined spaces and imprisonment');
        }
        if (cleanTitle.toLowerCase().includes('wild')) {
            meaningfulElements.push('untamed nature and freedom');
        }
        if (cleanTitle.toLowerCase().includes('calm')) {
            meaningfulElements.push('peaceful serene scenes');
        }
        if (cleanTitle.toLowerCase().includes('crazy')) {
            meaningfulElements.push('chaotic energetic scenes');
        }
        if (cleanTitle.toLowerCase().includes('hot')) {
            meaningfulElements.push('heat waves and fire');
        }
        if (cleanTitle.toLowerCase().includes('cold')) {
            meaningfulElements.push('ice crystals and winter scenes');
        }
        if (cleanTitle.toLowerCase().includes('fast')) {
            meaningfulElements.push('motion blur and speed');
        }
        if (cleanTitle.toLowerCase().includes('slow')) {
            meaningfulElements.push('gentle movement and tranquility');
        }
        if (cleanTitle.toLowerCase().includes('high')) {
            meaningfulElements.push('elevated perspectives and heights');
        }
        if (cleanTitle.toLowerCase().includes('low')) {
            meaningfulElements.push('ground level and depth');
        }
        if (cleanTitle.toLowerCase().includes('big')) {
            meaningfulElements.push('large scale and grandeur');
        }
        if (cleanTitle.toLowerCase().includes('small')) {
            meaningfulElements.push('intimate details and close-ups');
        }
        if (cleanTitle.toLowerCase().includes('new')) {
            meaningfulElements.push('fresh beginnings and renewal');
        }
        if (cleanTitle.toLowerCase().includes('old')) {
            meaningfulElements.push('aged textures and vintage elements');
        }
        if (cleanTitle.toLowerCase().includes('young')) {
            meaningfulElements.push('youthful energy and vitality');
        }
        if (cleanTitle.toLowerCase().includes('ancient')) {
            meaningfulElements.push('historical ruins and timeless elements');
        }
        if (cleanTitle.toLowerCase().includes('modern')) {
            meaningfulElements.push('contemporary design and technology');
        }
        if (cleanTitle.toLowerCase().includes('classic')) {
            meaningfulElements.push('timeless elegance and tradition');
        }
        if (cleanTitle.toLowerCase().includes('future')) {
            meaningfulElements.push('futuristic technology and innovation');
        }
        if (cleanTitle.toLowerCase().includes('past')) {
            meaningfulElements.push('historical scenes and nostalgia');
        }
        if (cleanTitle.toLowerCase().includes('present')) {
            meaningfulElements.push('current moment and immediacy');
        }
        if (cleanTitle.toLowerCase().includes('eternal')) {
            meaningfulElements.push('infinite timeless elements');
        }
        if (cleanTitle.toLowerCase().includes('moment')) {
            meaningfulElements.push('fleeting instant and transience');
        }
        if (cleanTitle.toLowerCase().includes('forever')) {
            meaningfulElements.push('endless duration and permanence');
        }
        if (cleanTitle.toLowerCase().includes('never')) {
            meaningfulElements.push('absence and void');
        }
        if (cleanTitle.toLowerCase().includes('always')) {
            meaningfulElements.push('constant presence and reliability');
        }
        if (cleanTitle.toLowerCase().includes('sometimes')) {
            meaningfulElements.push('occasional presence and variability');
        }
        if (cleanTitle.toLowerCase().includes('often')) {
            meaningfulElements.push('frequent occurrence and regularity');
        }
        if (cleanTitle.toLowerCase().includes('rare')) {
            meaningfulElements.push('uncommon beauty and uniqueness');
        }
        if (cleanTitle.toLowerCase().includes('common')) {
            meaningfulElements.push('everyday familiarity and comfort');
        }
        if (cleanTitle.toLowerCase().includes('strange')) {
            meaningfulElements.push('unusual mystery and intrigue');
        }
        if (cleanTitle.toLowerCase().includes('normal')) {
            meaningfulElements.push('standard familiarity and routine');
        }
        if (cleanTitle.toLowerCase().includes('special')) {
            meaningfulElements.push('unique significance and importance');
        }
        if (cleanTitle.toLowerCase().includes('ordinary')) {
            meaningfulElements.push('everyday simplicity and commonness');
        }
        if (cleanTitle.toLowerCase().includes('extraordinary')) {
            meaningfulElements.push('exceptional wonder and amazement');
        }
        if (cleanTitle.toLowerCase().includes('beautiful')) {
            meaningfulElements.push('aesthetic beauty and elegance');
        }
        if (cleanTitle.toLowerCase().includes('ugly')) {
            meaningfulElements.push('distorted forms and harshness');
        }
        if (cleanTitle.toLowerCase().includes('perfect')) {
            meaningfulElements.push('flawless ideal and completeness');
        }
        if (cleanTitle.toLowerCase().includes('broken')) {
            meaningfulElements.push('fragmented pieces and damage');
        }
        if (cleanTitle.toLowerCase().includes('whole')) {
            meaningfulElements.push('complete unity and integrity');
        }
        if (cleanTitle.toLowerCase().includes('part')) {
            meaningfulElements.push('fragmentary pieces and incompleteness');
        }
        if (cleanTitle.toLowerCase().includes('all')) {
            meaningfulElements.push('comprehensive totality and completeness');
        }
        if (cleanTitle.toLowerCase().includes('some')) {
            meaningfulElements.push('selective elements and partiality');
        }
        if (cleanTitle.toLowerCase().includes('none')) {
            meaningfulElements.push('empty space and absence');
        }
        if (cleanTitle.toLowerCase().includes('many')) {
            meaningfulElements.push('multiple elements and abundance');
        }
        if (cleanTitle.toLowerCase().includes('few')) {
            meaningfulElements.push('limited elements and scarcity');
        }
        if (cleanTitle.toLowerCase().includes('one')) {
            meaningfulElements.push('singular focus and unity');
        }
        if (cleanTitle.toLowerCase().includes('two')) {
            meaningfulElements.push('paired elements and duality');
        }
        if (cleanTitle.toLowerCase().includes('three')) {
            meaningfulElements.push('triadic elements and harmony');
        }
        if (cleanTitle.toLowerCase().includes('four')) {
            meaningfulElements.push('quadratic elements and stability');
        }
        if (cleanTitle.toLowerCase().includes('five')) {
            meaningfulElements.push('pentagonal elements and dynamism');
        }
        if (cleanTitle.toLowerCase().includes('ten')) {
            meaningfulElements.push('decimal elements and completeness');
        }
        if (cleanTitle.toLowerCase().includes('hundred')) {
            meaningfulElements.push('numerous elements and abundance');
        }
        if (cleanTitle.toLowerCase().includes('thousand')) {
            meaningfulElements.push('countless elements and vastness');
        }
        if (cleanTitle.toLowerCase().includes('million')) {
            meaningfulElements.push('limitless elements and infinity');
        }
        if (cleanTitle.toLowerCase().includes('billion')) {
            meaningfulElements.push('incomprehensible elements and cosmic scale');
        }
        if (cleanTitle.toLowerCase().includes('trillion')) {
            meaningfulElements.push('unimaginable elements and universal scale');
        }
        
        // If no specific themes found, analyze the title more deeply
        if (meaningfulElements.length === 0) {
            // Try to extract meaningful concepts from the title
            const words = cleanTitle.split(/\s+/);
            
            // Look for compound concepts
            if (words.length > 1) {
                // Check for common song title patterns
                if (words.includes('way') && words.includes('to')) {
                    meaningfulElements.push('a path or journey leading to a destination');
                } else if (words.includes('in') && words.includes('the')) {
                    meaningfulElements.push('a scene or setting within a specific environment');
                } else if (words.includes('of') && words.includes('the')) {
                    meaningfulElements.push('a representation or embodiment of a concept');
                } else if (words.includes('for') && words.includes('you')) {
                    meaningfulElements.push('a personal dedication or message');
                } else if (words.includes('with') && words.includes('me')) {
                    meaningfulElements.push('a shared experience or connection');
                } else if (words.includes('like') && words.includes('a')) {
                    meaningfulElements.push('a metaphorical comparison or simile');
                } else if (words.includes('when') && words.includes('i')) {
                    meaningfulElements.push('a personal moment or experience');
                } else if (words.includes('where') && words.includes('are')) {
                    meaningfulElements.push('a search or quest for something');
                } else if (words.includes('what') && words.includes('is')) {
                    meaningfulElements.push('a question or exploration of meaning');
                } else if (words.includes('how') && words.includes('to')) {
                    meaningfulElements.push('a guide or instruction for action');
                } else if (words.includes('why') && words.includes('do')) {
                    meaningfulElements.push('a questioning of motives or reasons');
                } else if (words.includes('who') && words.includes('are')) {
                    meaningfulElements.push('an exploration of identity or character');
                } else if (words.includes('when') && words.includes('will')) {
                    meaningfulElements.push('a moment of anticipation or waiting');
                } else if (words.includes('if') && words.includes('you')) {
                    meaningfulElements.push('a conditional scenario or possibility');
                } else if (words.includes('all') && words.includes('the')) {
                    meaningfulElements.push('a comprehensive view or totality');
                } else if (words.includes('some') && words.includes('of')) {
                    meaningfulElements.push('a partial selection or sampling');
                } else if (words.includes('one') && words.includes('of')) {
                    meaningfulElements.push('a singular example or instance');
                } else if (words.includes('two') && words.includes('of')) {
                    meaningfulElements.push('a pair or duo of elements');
                } else if (words.includes('three') && words.includes('of')) {
                    meaningfulElements.push('a trio or group of three');
                } else if (words.includes('four') && words.includes('of')) {
                    meaningfulElements.push('a quartet or group of four');
                } else if (words.includes('five') && words.includes('of')) {
                    meaningfulElements.push('a group of five elements');
                } else if (words.includes('ten') && words.includes('of')) {
                    meaningfulElements.push('a group of ten elements');
                } else if (words.includes('hundred') && words.includes('of')) {
                    meaningfulElements.push('a large group or multitude');
                } else if (words.includes('thousand') && words.includes('of')) {
                    meaningfulElements.push('an enormous group or vast number');
                } else if (words.includes('million') && words.includes('of')) {
                    meaningfulElements.push('an immense group or infinite number');
                } else if (words.includes('billion') && words.includes('of')) {
                    meaningfulElements.push('an incomprehensible group or cosmic number');
                } else if (words.includes('trillion') && words.includes('of')) {
                    meaningfulElements.push('an unimaginable group or universal number');
                } else {
                    // Use the first and last words to create a meaningful description
                    const firstWord = words[0];
                    const lastWord = words[words.length - 1];
                    
                    if (firstWord !== lastWord) {
                        meaningfulElements.push(`a scene combining ${firstWord} and ${lastWord}`);
                    } else {
                        meaningfulElements.push(`a scene centered around ${firstWord}`);
                    }
                }
            } else {
                // Single word titles
                meaningfulElements.push(`a scene focused on ${cleanTitle}`);
            }
        }
        
        return meaningfulElements;
    }

    // Process each song to extract meaningful content
    const selectedSongs = songs.slice(0, 5);
    const songContent = selectedSongs.map(song => {
        const content = extractSongContent(song);
        return {
            title: song.replace(/\s*\([^)]*\)/g, '').trim(),
            content: content
        };
    });

    // Create a prompt based on the actual song content
    let prompt = `Create a digital artwork that visually represents these musical themes: `;
    
    // Add specific content for each song
    songContent.forEach((song, index) => {
        prompt += `"${song.title}" featuring ${song.content.join(' and ')}`;
        if (index < songContent.length - 1) {
            prompt += ', ';
        }
    });
    
    prompt += `. Compose these elements into a cohesive artwork that captures the essence of each song. Focus on pure visual art - no text, no words, no letters.`;

    // Generate details for the modal
    const artStyle = "digital composition";
    const colorPalette = "varied based on song themes";
    const visualElements = songContent.map(song => `"${song.title}" (${song.content[0]})`).join(', ');

    return {
        prompt: prompt,
        details: {
            artStyle: artStyle,
            colorPalette: colorPalette,
            visualElements: visualElements,
        }
    };
}

// Function to get Spotify audio features for songs
async function getSpotifyAudioFeatures(songTitles, accessToken) {
    try {
        const features = [];
        
        for (const title of songTitles) {
            // Search for the song on Spotify
            const searchResponse = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(title)}&type=track&limit=1`, {
                headers: { Authorization: 'Bearer ' + accessToken }
            });
            
            if (searchResponse.ok) {
                const searchData = await searchResponse.json();
                if (searchData.tracks.items.length > 0) {
                    const trackId = searchData.tracks.items[0].id;
                    
                    // Get audio features
                    const featuresResponse = await fetch(`https://api.spotify.com/v1/audio-features/${trackId}`, {
                        headers: { Authorization: 'Bearer ' + accessToken }
                    });
                    
                    if (featuresResponse.ok) {
                        const audioFeatures = await featuresResponse.json();
                        features.push({
                            title: title,
                            features: audioFeatures
                        });
                    }
                }
            }
        }
        
        return features;
    } catch (error) {
        console.error('Error fetching Spotify audio features:', error);
        return [];
    }
}

// Function to get lyrics from Spotify (if available)
async function getSongLyrics(songTitles, accessToken) {
    try {
        const lyricsData = [];
        
        for (const title of songTitles) {
            // Search for the song on Spotify
            const searchResponse = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(title)}&type=track&limit=1`, {
                headers: { Authorization: 'Bearer ' + accessToken }
            });
            
            if (searchResponse.ok) {
                const searchData = await searchResponse.json();
                if (searchData.tracks.items.length > 0) {
                    const trackId = searchData.tracks.items[0].id;
                    
                    // Try to get lyrics (Spotify doesn't have public lyrics API, but we can try)
                    // For now, we'll use the track info to infer lyrical themes
                    const trackInfo = searchData.tracks.items[0];
                    lyricsData.push({
                        title: title,
                        artist: trackInfo.artists[0]?.name || 'Unknown',
                        trackInfo: trackInfo
                    });
                }
            }
        }
        
        return lyricsData;
    } catch (error) {
        console.error('Error fetching song info:', error);
        return [];
    }
}

// Function to analyze song titles using AI
async function analyzeSongTitles(songs, audioFeatures = [], lyricsData = []) {
    try {
        // Create a comprehensive prompt for AI analysis
        let analysisPrompt = `Analyze these song titles and extract their themes, imagery, mood, and concepts for creating visual artwork. For each song, provide:
        
1. Themes (2-3 main themes/subjects)
2. Imagery (3-4 specific visual elements)
3. Mood (2-3 emotional qualities)
4. Concepts (2-3 deeper meanings)

Song titles: ${songs.map(s => `"${s.replace(/\s*\([^)]*\)/g, '').trim()}"`).join(', ')}

`;

        // Add audio features context if available
        if (audioFeatures.length > 0) {
            analysisPrompt += `\nAudio characteristics:\n`;
            audioFeatures.forEach(feature => {
                if (feature.features) {
                    const f = feature.features;
                    analysisPrompt += `- "${feature.title}": Energy: ${f.energy.toFixed(2)}, Valence: ${f.valence.toFixed(2)}, Danceability: ${f.danceability.toFixed(2)}, Acousticness: ${f.acousticness.toFixed(2)}\n`;
                }
            });
        }

        // Add lyrics context if available
        if (lyricsData.length > 0) {
            analysisPrompt += `\nSong context:\n`;
            lyricsData.forEach(song => {
                analysisPrompt += `- "${song.title}" by ${song.artist}\n`;
            });
        }

        analysisPrompt += `\nRespond with a JSON object where each song title is a key with this structure:
{
  "song_title": {
    "themes": ["theme1", "theme2", "theme3"],
    "imagery": ["image1", "image2", "image3", "image4"],
    "mood": ["mood1", "mood2", "mood3"],
    "concepts": ["concept1", "concept2", "concept3"]
  }
}

Focus on creating rich, specific visual descriptions that would work well for AI image generation.`;

        const response = await openai.chat.completions.create({
            model: 'gpt-4',
            messages: [
                {
                    role: 'system',
                    content: 'You are an expert music analyst who understands song meanings, cultural context, and visual representation. You excel at extracting themes, imagery, and emotional content from song titles and musical characteristics.'
                },
                {
                    role: 'user',
                    content: analysisPrompt
                }
            ],
            temperature: 0.7,
            max_tokens: 2000
        });

        const analysisText = response.choices[0].message.content;
        
        // Parse the JSON response
        try {
            const analysisData = JSON.parse(analysisText);
            
            // Convert to our expected format
            const songAnalyses = songs.map(song => {
                const cleanTitle = song.replace(/\s*\([^)]*\)/g, '').trim();
                const songData = analysisData[cleanTitle] || analysisData[song] || {};
                
                return {
                    title: cleanTitle,
                    themes: songData.themes || [],
                    imagery: songData.imagery || [],
                    mood: songData.mood || [],
                    concepts: songData.concepts || []
                };
            });
            
            return songAnalyses;
        } catch (parseError) {
            console.error('Error parsing AI analysis:', parseError);
            console.log('Raw AI response:', analysisText);
            
            // Fallback to basic analysis
            return songs.map(song => ({
                title: song.replace(/\s*\([^)]*\)/g, '').trim(),
                themes: ['musical expression'],
                imagery: ['musical elements'],
                mood: ['artistic'],
                concepts: ['creative expression']
            }));
        }
    } catch (error) {
        console.error('Error in AI song analysis:', error);
        
        // Fallback to basic analysis
        return songs.map(song => ({
            title: song.replace(/\s*\([^)]*\)/g, '').trim(),
            themes: ['musical expression'],
            imagery: ['musical elements'],
            mood: ['artistic'],
            concepts: ['creative expression']
        }));
    }
}

// Function to create unified artwork prompt based on AI song analysis
async function createUnifiedPrompt(songs, audioFeatures = [], lyricsData = []) {
    if (!songs || songs.length === 0) {
        return {
            prompt: "Abstract digital artwork inspired by music",
            details: {
                artStyle: "abstract digital art",
                colorPalette: "vibrant colors",
                visualElements: "musical inspiration"
            }
        };
    }

    const songAnalyses = await analyzeSongTitles(songs, audioFeatures, lyricsData);
    
    // Collect all themes, imagery, moods, and concepts from the songs
    const allThemes = [];
    const allImagery = [];
    const allMoods = [];
    const allConcepts = [];
    
    songAnalyses.forEach(analysis => {
        allThemes.push(...analysis.themes);
        allImagery.push(...analysis.imagery);
        allMoods.push(...analysis.mood);
        allConcepts.push(...analysis.concepts);
    });
    
    // Remove duplicates and create unique lists
    const uniqueThemes = [...new Set(allThemes)];
    const uniqueImagery = [...new Set(allImagery)];
    const uniqueMoods = [...new Set(allMoods)];
    const uniqueConcepts = [...new Set(allConcepts)];
    
    // Create a prompt that actually describes what the songs are about
    let prompt = `Create a unified digital artwork that visually represents the themes and imagery from these songs: `;
    
    // List ALL songs and their key themes - ensure every song is represented
    songAnalyses.forEach((analysis, index) => {
        if (analysis.themes.length > 0) {
            prompt += `"${analysis.title}" (${analysis.themes.slice(0, 2).join(', ')})`;
        } else if (analysis.imagery.length > 0) {
            prompt += `"${analysis.title}" (${analysis.imagery.slice(0, 2).join(', ')})`;
        } else if (analysis.mood.length > 0) {
            prompt += `"${analysis.title}" (${analysis.mood.slice(0, 2).join(', ')})`;
        } else {
            // If no specific analysis, use the title itself as a theme
            prompt += `"${analysis.title}" (musical essence)`;
        }
        
        if (index < songAnalyses.length - 1) {
            prompt += ', ';
        }
    });
    
    prompt += `. `;
    
    // Add comprehensive imagery from all songs
    if (uniqueImagery.length > 0) {
        prompt += `Incorporate these specific visual elements: ${uniqueImagery.join(', ')}. `;
    }
    
    // Add detailed themes from all songs
    if (uniqueThemes.length > 0) {
        prompt += `Express these themes throughout the composition: ${uniqueThemes.join(', ')}. `;
    }
    
    // Add mood and atmosphere
    if (uniqueMoods.length > 0) {
        prompt += `Convey a ${uniqueMoods.join(' and ')} mood and atmosphere. `;
    }
    
    // Add conceptual depth
    if (uniqueConcepts.length > 0) {
        prompt += `Explore these deeper concepts: ${uniqueConcepts.join(', ')}. `;
    }
    
    // Add specific song imagery details
    const specificImagery = songAnalyses.map(analysis => {
        if (analysis.imagery.length > 0) {
            return `from "${analysis.title}": ${analysis.imagery.join(', ')}`;
        }
        return null;
    }).filter(Boolean);
    
    if (specificImagery.length > 0) {
        prompt += `Include these specific elements ${specificImagery.join('; ')}. `;
    }
    
    // Add audio feature influences if available
    if (audioFeatures.length > 0) {
        const avgEnergy = audioFeatures.reduce((sum, f) => sum + f.features.energy, 0) / audioFeatures.length;
        const avgValence = audioFeatures.reduce((sum, f) => sum + f.features.valence, 0) / audioFeatures.length;
        
        if (avgEnergy > 0.7) {
            prompt += `Use dynamic, energetic visual composition. `;
        } else if (avgEnergy < 0.3) {
            prompt += `Use gentle, calm visual composition. `;
        }
        
        if (avgValence > 0.7) {
            prompt += `Use bright, uplifting colors. `;
        } else if (avgValence < 0.3) {
            prompt += `Use darker, moodier colors. `;
        }
    }
    
    prompt += `Create a single, cohesive artwork where all these musical elements blend together naturally. Focus on pure visual art - no text, no words, no letters.`;

    // Generate detailed information for the modal
    const artStyle = "unified digital composition";
    
    // Create a more sophisticated color palette based on moods and themes
    let colorPalette = "harmonious blend";
    if (uniqueMoods.some(mood => ['bright', 'uplifting', 'optimistic', 'joyful'].includes(mood.toLowerCase()))) {
        colorPalette = "bright and uplifting tones";
    } else if (uniqueMoods.some(mood => ['dark', 'moody', 'melancholic', 'mysterious'].includes(mood.toLowerCase()))) {
        colorPalette = "dark and moody tones";
    } else if (uniqueMoods.some(mood => ['romantic', 'intimate', 'warm'].includes(mood.toLowerCase()))) {
        colorPalette = "warm and romantic tones";
    } else if (uniqueMoods.some(mood => ['nostalgic', 'retro', 'vintage'].includes(mood.toLowerCase()))) {
        colorPalette = "nostalgic and vintage tones";
    }
    
    // Create concise visual elements description (limit to most important)
    const visualElements = uniqueImagery.length > 0 ? 
        uniqueImagery.slice(0, 6).join(', ') : 
        "musical essence and artistic interpretation";
    
    // Create concise song-specific details with better formatting
    const songDetails = songAnalyses.map(analysis => {
        const elements = [];
        if (analysis.imagery.length > 0) {
            elements.push(`${analysis.imagery.slice(0, 2).join(', ')}`);
        }
        if (analysis.themes.length > 0) {
            elements.push(`Themes: ${analysis.themes.slice(0, 2).join(', ')}`);
        }
        if (analysis.mood.length > 0) {
            elements.push(`Mood: ${analysis.mood.slice(0, 2).join(', ')}`);
        }
        return `"${analysis.title}": ${elements.join(' • ')}`;
    }).join('\n');

    return {
        prompt: prompt,
        details: {
            artStyle: artStyle,
            colorPalette: colorPalette,
            visualElements: visualElements,
            songBreakdown: songDetails,
            mood: uniqueMoods.slice(0, 4).join(', '),
            themes: uniqueThemes.slice(0, 5).join(', ')
        }
    };
}

// Add this new route
router.post('/generate-image', async (req, res) => {
    const { prompt, accessToken } = req.body;

    // Rate limiting check
    const sessionId = generateSessionId(req);
    const rateLimitCheck = checkRateLimit(sessionId);
    
    if (!rateLimitCheck.allowed) {
        return res.status(429).json({
            error: rateLimitCheck.message,
            reason: rateLimitCheck.reason,
            retryAfter: rateLimitCheck.retryAfter
        });
    }

    // Modified check: ensure prompt is a non-empty string
    if (!prompt || typeof prompt !== 'string' || prompt.trim() === '') {
        return res.status(400).json({ error: 'Prompt is required and cannot be empty.' });
    }

    try {
        // Parse the prompt as song titles and create a unified artistic prompt
        const songs = prompt.split(',').map(s => s.trim()).filter(s => s.length > 0);
        
        // Get audio features and lyrics data if access token is provided
        let audioFeatures = [];
        let lyricsData = [];
        if (accessToken) {
            audioFeatures = await getSpotifyAudioFeatures(songs, accessToken);
            lyricsData = await getSongLyrics(songs, accessToken);
        }
        
        const promptData = await createUnifiedPrompt(songs, audioFeatures, lyricsData);
        
        console.log('Original songs:', songs);
        console.log('Audio features found:', audioFeatures.length);
        console.log('Lyrics data found:', lyricsData.length);
        console.log('Generated unified prompt:', promptData.prompt);
        
        const response = await openai.images.generate({
            model: 'dall-e-3',
            prompt: promptData.prompt,
            n: 1,
            size: '1024x1024',
        });
        
        // Get user profile to store artwork with user ID
        const userProfile = await getSpotifyUserProfile(accessToken);
        const userId = userProfile ? userProfile.id : 'anonymous';
        
        // Store artwork in database
        const artworkData = {
            url: response.data[0].url,
            songs: songs,
            details: promptData.details,
            prompt: promptData.prompt
        };
        
        const savedArtwork = await addArtwork(userId, artworkData);
        
        console.log('Artwork saved successfully:', savedArtwork);
        
        res.json({ 
            url: response.data[0].url,
            details: promptData.details,
            artworkId: savedArtwork.id,
            userId: userId
        });
    } catch (error) {
        console.error('Error calling OpenAI:', error);
        res.status(500).json({ error: 'Failed to generate image' });
    }
});

// Get user's artwork history
router.get('/history', async (req, res) => {
    try {
        console.log('History API endpoint called');
        console.log('Request query:', req.query);
        
        const { accessToken } = req.query;
        
        if (!accessToken) {
            console.log('No access token provided');
            return res.status(400).json({ error: 'Access token required' });
        }
        
        const userProfile = await getSpotifyUserProfile(accessToken);
        const userId = userProfile ? userProfile.id : 'anonymous';
        
        const artworks = await getUserArtworks(userId);
        const stats = await getUserStats(userId);
        
        console.log('History API - User ID:', userId);
        console.log('History API - Artworks:', artworks);
        console.log('History API - Stats:', stats);
        
        res.json({
            artworks: artworks,
            stats: stats,
            user: userProfile ? {
                id: userProfile.id,
                display_name: userProfile.display_name,
                images: userProfile.images
            } : null
        });
    } catch (error) {
        console.error('Error fetching history:', error);
        res.status(500).json({ error: 'Failed to fetch history' });
    }
});

// Delete artwork
router.delete('/artwork/:artworkId', async (req, res) => {
    try {
        const { artworkId } = req.params;
        const { accessToken } = req.body;
        
        if (!accessToken) {
            return res.status(400).json({ error: 'Access token required' });
        }
        
        const userProfile = await getSpotifyUserProfile(accessToken);
        const userId = userProfile ? userProfile.id : 'anonymous';
        
        const success = deleteArtwork(userId, artworkId);
        
        if (success) {
            res.json({ success: true });
        } else {
            res.status(404).json({ error: 'Artwork not found' });
        }
    } catch (error) {
        console.error('Error deleting artwork:', error);
        res.status(500).json({ error: 'Failed to delete artwork' });
    }
});

export default router;