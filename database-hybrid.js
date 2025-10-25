// Hybrid Database - Works locally with files and on Vercel with KV
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Check if we're running on Vercel
const isVercel = process.env.VERCEL === '1';

let kv = null;

// Initialize Vercel KV if on Vercel
if (isVercel) {
    try {
        const { kv: vercelKv } = await import('@vercel/kv');
        kv = vercelKv;
    } catch (error) {
        console.error('Failed to import Vercel KV:', error);
    }
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
    console.log('Adding artwork for user:', userId, 'isVercel:', isVercel, 'kv available:', !!kv);
    
    const newArtwork = {
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        ...artworkData
    };

    if (isVercel && kv) {
        // Use Vercel KV
        try {
            const existingArtworks = await getUserArtworks(userId);
            const updatedArtworks = [newArtwork, ...existingArtworks];
            const limitedArtworks = updatedArtworks.slice(0, 50);
            await kv.set(`artworks:${userId}`, limitedArtworks);
            return newArtwork;
        } catch (error) {
            console.error('Error adding artwork to KV:', error);
            throw error;
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
    console.log('Getting artworks for user:', userId, 'isVercel:', isVercel, 'kv available:', !!kv);
    
    if (isVercel && kv) {
        // Use Vercel KV
        try {
            const artworks = await kv.get(`artworks:${userId}`);
            console.log('KV artworks for user', userId, ':', artworks, 'type:', typeof artworks);
            
            // Ensure we always return an array
            if (Array.isArray(artworks)) {
                return artworks;
            } else if (artworks && typeof artworks === 'object' && Object.keys(artworks).length > 0) {
                // If it's a non-empty object, convert to array
                return Object.values(artworks);
            } else {
                // Empty object, null, undefined, or other - return empty array
                return [];
            }
        } catch (error) {
            console.error('Error getting artworks from KV:', error);
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
