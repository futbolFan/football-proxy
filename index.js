const express = require('express');
const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');
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

  let browser;
  try {
    console.log('Lanzando Puppeteer con Chromium...');
    browser = await puppeteer.launch({
      args: [...chromium.args, '--disable-images', '--blink-settings=imagesEnabled=false'],
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless
    });

    const matchesData = await Promise.all(
      urls.map(async (matchUrl) => {
        let page;
        try {
          console.log(`Visitando ${matchUrl}`);
          page = await browser.newPage();

          // Bloquear imágenes para acelerar la carga
          await page.setRequestInterception(true);
          page.on('request', (req) => {
            if (req.resourceType() === 'image' || req.resourceType() === 'media') {
              req.abort();
            } else {
              req.continue();
            }
          });

          await page.goto(matchUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
          await page.waitForSelector('.game-center-header-status_live__Db99m', { timeout: 60000 });

          const data = await page.evaluate(() => {
            const homeScore = document.querySelector('.game-score_competitor_score_container__HZgTq')?.textContent.trim() || '0';
            const awayScore = document.querySelector('.game-score_away_competitor_score_container__zk7s2')?.textContent.trim() || '0';
            const score = `${homeScore}-${awayScore}`;
            const gameTime = document.querySelector('.game-center-header-status_live__Db99m')?.textContent.trim() || 'No disponible';
            return { score, gameTime };
          });

          console.log(`Datos extraídos de ${matchUrl}:`, data);
          return {
            url: matchUrl,
            score: data.score,
            gameTime: data.gameTime
          };
        } catch (error) {
          console.error(`Error en ${matchUrl}:`, error.message);
          return {
            url: matchUrl,
            score: 'Error',
            gameTime: 'Error'
          };
        } finally {
          if (page) await page.close();
        }
      })
    );

    await browser.close();
    res.json(matchesData);
  } catch (error) {
    console.error('Error general:', error.message);
    if (browser) await browser.close();
    res.status(500).json({ error: 'Error al procesar los partidos' });
  }
});

app.listen(port, () => {
  console.log(`Servidor corriendo en puerto ${port}`);
});