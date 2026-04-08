import fetch from 'node-fetch';

async function test() {
  const res = await fetch('http://localhost:3000/api/auth/google/url?redirectUri=http://localhost:3000/auth/callback');
  const data = await res.json();
  console.log(data);
}
test();
