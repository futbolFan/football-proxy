const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const app = express();

const port = process.env.PORT || 3000;

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET');
  next();
});

app.get('/api/matches', async (req, res) => {
  const urls = req.query.urls ? req.query.urls.split(',') : [];

  if (urls.length === 0) {
    return res.status(400).json({ error: 'Debes enviar al menos una URL' });
  }

  try {
    const matchesData = await Promise.all(
      urls.map(async (matchUrl) => {
        try {
          const { data } = await axios.get(matchUrl.trim(), {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
          });

          const $ = cheerio.load(data);
          const score = $('.live-score').text().trim() || '0-0';
          const gameTime = $('.match-time').text().trim() || 'No disponible';

          return {
            url: matchUrl,
            score,
            gameTime
          };
        } catch (error) {
          return {
            url: matchUrl,
            score: 'Error',
            gameTime: 'Error'
          };
        }
      })
    );

    res.json(matchesData);
  } catch (error) {
    console.error('Error general:', error.message);
    res.status(500).json({ error: 'Error al procesar los partidos' });
  }
});

app.listen(port, () => {
  console.log(`Servidor corriendo en puerto ${port}`);
});