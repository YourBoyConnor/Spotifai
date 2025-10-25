// Hybrid Database - Works locally with files and on Vercel with Upstash Redis
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Check if we're running on Vercel
const isVercel = process.env.VERCEL === '1';

let redis = null;

// Initialize Upstash Redis if on Vercel
if (isVercel) {
    try {
        console.log('Initializing Redis...');
        
        // Check for Upstash Redis credentials first
        if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
            console.log('Using Upstash Redis REST API');
            const { Redis } = await import('@upstash/redis');
            redis = new Redis({
                url: process.env.UPSTASH_REDIS_REST_URL,
                token: process.env.UPSTASH_REDIS_REST_TOKEN,
            });
        } else if (process.env.REDIS_URL) {
            console.log('Using Redis URL:', process.env.REDIS_URL);
            // Use standard Redis client for Redis Cloud
            const { createClient } = await import('redis');
            redis = createClient({
                url: process.env.REDIS_URL,
            });
            await redis.connect();
            console.log('Connected to Redis Cloud');
        } else {
            console.log('No Redis credentials found, falling back to memory storage');
            redis = null;
        }
        
        if (redis) {
            console.log('Redis initialized successfully');
        } else {
            console.log('Redis not available, using memory storage');
        }
    } catch (error) {
        console.error('Failed to import Redis:', error);
        console.log('Falling back to memory storage');
        redis = null;
    }
} else {
    console.log('Running locally, using file-based storage');
}

// File-based storage for local development
const DB_FILE = path.join(__dirname, '..', 'data', 'artworks.json');

// Ensure data directory exists (local only)
if (!isVercel) {
    const dataDir = path.join(__dirname, '..', 'data');
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }
}

let db = {};

// Load database (local only)
function readDatabase() {
    if (isVercel) return;
    
    try {
        if (fs.existsSync(DB_FILE)) {
            const data = fs.readFileSync(DB_FILE, 'utf8');
            db = JSON.parse(data);
        } else {
            db = {};
        }
    } catch (error) {
        console.error('Error reading database file:', error);
        db = {};
    }
}

// Write database (local only)
function writeDatabase() {
    if (isVercel) return;
    
    try {
        fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf8');
    } catch (error) {
        console.error('Error writing database file:', error);
    }
}

// Load database on startup (local only)
if (!isVercel) {
    readDatabase();
}

export async function addArtwork(userId, artworkData) {
    console.log('Adding artwork for user:', userId, 'isVercel:', isVercel, 'redis available:', !!redis);
    
    const newArtwork = {
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        ...artworkData
    };

    if (isVercel && redis) {
        // Use Redis (Upstash or standard)
        try {
            // Check if Redis credentials are available
            if (!process.env.UPSTASH_REDIS_REST_URL && !process.env.REDIS_URL) {
                console.log('Redis credentials missing, falling back to memory storage');
                throw new Error('Redis credentials not configured');
            }
            
            const existingArtworks = await getUserArtworks(userId);
            const updatedArtworks = [newArtwork, ...existingArtworks];
            const limitedArtworks = updatedArtworks.slice(0, 50);
            await redis.set(`artworks:${userId}`, JSON.stringify(limitedArtworks));
            return newArtwork;
        } catch (error) {
            console.error('Error adding artwork to Redis:', error);
            console.log('Falling back to memory storage for this session');
            // Fall back to a simple in-memory storage for this session
            if (!global.sessionArtworks) {
                global.sessionArtworks = {};
            }
            if (!global.sessionArtworks[userId]) {
                global.sessionArtworks[userId] = [];
            }
            global.sessionArtworks[userId].unshift(newArtwork);
            if (global.sessionArtworks[userId].length > 50) {
                global.sessionArtworks[userId] = global.sessionArtworks[userId].slice(0, 50);
            }
            return newArtwork;
        }
    } else {
        // Use file-based storage
        if (!db[userId]) {
            db[userId] = [];
        }
        db[userId].unshift(newArtwork);
        if (db[userId].length > 50) {
            db[userId] = db[userId].slice(0, 50);
        }
        writeDatabase();
        return newArtwork;
    }
}

export async function getUserArtworks(userId) {
    console.log('Getting artworks for user:', userId, 'isVercel:', isVercel, 'redis available:', !!redis);
    
    if (isVercel && redis) {
        // Use Redis (Upstash or standard)
        try {
            // Check if Redis credentials are available
            if (!process.env.UPSTASH_REDIS_REST_URL && !process.env.REDIS_URL) {
                console.log('Redis credentials missing, falling back to memory storage');
                throw new Error('Redis credentials not configured');
            }
            
            const artworksJson = await redis.get(`artworks:${userId}`);
            console.log('Redis artworks for user', userId, ':', artworksJson, 'type:', typeof artworksJson);
            
            if (artworksJson) {
                const artworks = JSON.parse(artworksJson);
                return Array.isArray(artworks) ? artworks : [];
            }
            return [];
        } catch (error) {
            console.error('Error getting artworks from Redis:', error);
            console.log('Falling back to memory storage for this session');
            // Fall back to session memory storage
            if (global.sessionArtworks && global.sessionArtworks[userId]) {
                return global.sessionArtworks[userId];
            }
            return [];
        }
    } else {
        // Use file-based storage
        const artworks = db[userId];
        return Array.isArray(artworks) ? artworks : [];
    }
}

export async function getUserStats(userId) {
    const artworks = await getUserArtworks(userId);
    const totalArtworks = artworks.length;
    const uniqueSongs = new Set();
    
    artworks.forEach(artwork => {
        artwork.songs.forEach(song => uniqueSongs.add(song));
    });
    
    const lastCreated = artworks.length > 0 ? artworks[0].timestamp : null;

    return {
        totalArtworks,
        uniqueSongs: uniqueSongs.size,
        lastCreated
    };
}

export async function deleteArtwork(userId, artworkId) {
    if (isVercel && kv) {
        // Use Vercel KV
        try {
            const artworks = await getUserArtworks(userId);
            const initialLength = artworks.length;
            const filteredArtworks = artworks.filter(artwork => artwork.id !== artworkId);
            
            if (filteredArtworks.length < initialLength) {
                await kv.set(`artworks:${userId}`, filteredArtworks);
                return true;
            }
            return false;
        } catch (error) {
            console.error('Error deleting artwork from KV:', error);
            return false;
        }
    } else {
        // Use file-based storage
        if (!db[userId]) {
            return false;
        }
        const initialLength = db[userId].length;
        db[userId] = db[userId].filter(artwork => artwork.id !== artworkId);
        if (db[userId].length < initialLength) {
            writeDatabase();
            return true;
        }
        return false;
    }
}
