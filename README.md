# Spotifai - AI Art Generator for Spotify Music

Transform your Spotify music taste into stunning AI-generated artwork using DALL-E 3.

## Features

- 🎵 **Spotify Integration** - Connect your Spotify account to analyze your music taste
- 🎨 **AI Art Generation** - Create unique artwork based on your favorite songs
- 🧠 **Smart Analysis** - AI analyzes song titles, themes, and moods to create meaningful prompts
- 📚 **Artwork History** - Save and view all your generated artworks
- 🛡️ **Rate Limiting** - Built-in protection against API abuse
- 📱 **Responsive Design** - Works perfectly on desktop and mobile

## Tech Stack

- **Backend**: Node.js, Express.js
- **Frontend**: EJS templating, vanilla JavaScript
- **APIs**: Spotify Web API, OpenAI DALL-E 3
- **Storage**: Vercel KV (Redis) for production, file-based JSON for local development
- **Deployment**: Vercel

## Environment Variables

### Required Variables
```bash
# Spotify API Configuration
CLIENT_ID=your_spotify_client_id
CLIENT_SECRET=your_spotify_client_secret
REDIRECTURI=https://your-domain.com/api/callback
CLIENT_REDIRECTURI=https://your-domain.com/results

# OpenAI API Configuration
OPENAI_API_KEY=your_openai_api_key

# Vercel KV Database (Production only)
KV_REST_API_URL=your_vercel_kv_connection_string
KV_REST_API_TOKEN=your_vercel_kv_token
```

## Local Development

1. Clone the repository
2. Install dependencies: `npm install`
3. Create a `.env` file with your environment variables
4. Run the development server: `npm run dev`
5. Open `http://localhost:8888`

## Deployment to Vercel

### 1. Deploy the Application
1. Push your code to GitHub
2. Connect your repository to Vercel
3. Deploy the application

### 2. Set Up Vercel KV Database
1. Go to your Vercel dashboard
2. Navigate to **Storage** → **KV**
3. Create a new KV database
4. Copy the connection details

### 3. Configure Environment Variables
In your Vercel dashboard, go to **Settings** → **Environment Variables** and add:

```bash
# Spotify API Configuration
CLIENT_ID=your_spotify_client_id
CLIENT_SECRET=your_spotify_client_secret
REDIRECTURI=https://your-app-name.vercel.app/api/callback
CLIENT_REDIRECTURI=https://your-app-name.vercel.app/results

# OpenAI API Configuration
OPENAI_API_KEY=your_openai_api_key

# Vercel KV Database
KV_REST_API_URL=your_vercel_kv_connection_string
KV_REST_API_TOKEN=your_vercel_kv_token
```

### 4. Update Spotify App Settings
1. Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Edit your app settings
3. Add your production redirect URI: `https://your-app-name.vercel.app/api/callback`

### 5. Redeploy
After setting up all environment variables, redeploy your application.

## Fallback Storage

If Vercel KV is not configured or fails, the application will automatically fall back to in-memory storage for the current session. This means:
- ✅ **Artwork generation will work**
- ✅ **Images will be displayed**
- ❌ **History will not persist between sessions**

To enable persistent history, ensure Vercel KV is properly configured.

## API Endpoints

- `GET /` - Landing page
- `GET /results` - Artwork generation page
- `GET /history` - Artwork history page
- `POST /api/generate-image` - Generate AI artwork
- `GET /api/history` - Get user's artwork history
- `DELETE /api/artwork/:id` - Delete specific artwork

## Rate Limiting

The application includes both client-side and server-side rate limiting:
- **Client-side**: Prevents rapid button clicking
- **Server-side**: IP-based session tracking with cooldown periods
- **OpenAI**: Respects DALL-E 3 rate limits

## License

MIT License - see LICENSE file for details
