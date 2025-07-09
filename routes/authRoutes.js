import express from 'express';
import fetch from 'node-fetch';

const router = express.Router();
import querystring from 'querystring';

// this can be used as a seperate module
const encodeFormData = (data) => {
  return Object.keys(data)
    .map(key => encodeURIComponent(key) + '=' + encodeURIComponent(data[key]))
    .join('&');
}

export default router;

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
  res.redirect('https://accounts.spotify.com/logout');
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