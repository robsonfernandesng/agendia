import https from 'https';
https.get('https://api.ipify.org', (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => console.log('Current IP:', data));
});
