import './config.js'; // Load environment variables first
import path from 'path';
import url from 'url';
import express from 'express';
import cors from 'cors';

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 8888;
const app = express();

// Defining Middleware

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

import AuthRoutes from './routes/authRoutes.js';
app.use('/api', cors(), AuthRoutes);

// Static Files
app.use(express.static('public'));
app.use('/css', express.static(__dirname + 'public/css'));
app.use('/js', express.static(__dirname + 'public/js'));
app.use('/img', express.static(__dirname + 'public/img'));

// Set Views
app.set('views', './views');
app.set('view engine', 'ejs');

app.get('/', (req, res) => {
    res.render('index');
})

app.get('/results', (req, res) => {
    res.render('results', {
        api_key: process.env.OPENAI_API_KEY,
    });
})

app.get('/history', (req, res) => {
    res.render('history');
})

app.listen(PORT, () => {
    console.log(`Server started on port ${PORT}`);
});
