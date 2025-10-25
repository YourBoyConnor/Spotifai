import fs from 'fs';
import path from 'path';

const DATA_DIR = './data';
const ARTWORKS_FILE = path.join(DATA_DIR, 'artworks.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Initialize artworks file if it doesn't exist
if (!fs.existsSync(ARTWORKS_FILE)) {
    fs.writeFileSync(ARTWORKS_FILE, JSON.stringify({}));
}

// Load artworks data
function loadArtworks() {
    try {
        const data = fs.readFileSync(ARTWORKS_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error loading artworks:', error);
        return {};
    }
}

// Save artworks data
function saveArtworks(artworks) {
    try {
        fs.writeFileSync(ARTWORKS_FILE, JSON.stringify(artworks, null, 2));
        return true;
    } catch (error) {
        console.error('Error saving artworks:', error);
        return false;
    }
}

// Add artwork to user's history
export function addArtwork(userId, artworkData) {
    const artworks = loadArtworks();
    
    if (!artworks[userId]) {
        artworks[userId] = [];
    }
    
    const artwork = {
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        imageUrl: artworkData.url,
        songs: artworkData.songs,
        details: artworkData.details,
        prompt: artworkData.prompt
    };
    
    artworks[userId].unshift(artwork); // Add to beginning of array
    
    // Keep only last 50 artworks per user
    if (artworks[userId].length > 50) {
        artworks[userId] = artworks[userId].slice(0, 50);
    }
    
    saveArtworks(artworks);
    return artwork;
}

// Get user's artwork history
export function getUserArtworks(userId) {
    const artworks = loadArtworks();
    return artworks[userId] || [];
}

// Get specific artwork by ID
export function getArtwork(userId, artworkId) {
    const artworks = getUserArtworks(userId);
    return artworks.find(artwork => artwork.id === artworkId);
}

// Delete artwork
export function deleteArtwork(userId, artworkId) {
    const artworks = loadArtworks();
    
    if (artworks[userId]) {
        artworks[userId] = artworks[userId].filter(artwork => artwork.id !== artworkId);
        saveArtworks(artworks);
        return true;
    }
    
    return false;
}

// Get user stats
export function getUserStats(userId) {
    const userArtworks = getUserArtworks(userId);
    
    return {
        totalArtworks: userArtworks.length,
        firstArtwork: userArtworks.length > 0 ? userArtworks[userArtworks.length - 1].timestamp : null,
        lastArtwork: userArtworks.length > 0 ? userArtworks[0].timestamp : null,
        uniqueSongs: new Set(userArtworks.flatMap(artwork => artwork.songs)).size
    };
}
