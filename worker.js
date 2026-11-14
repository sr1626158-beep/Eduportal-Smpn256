// Cloudflare Worker — Asisten AI EduPortal (Workers AI, tanpa API key)
const MODEL = '@cf/meta/llama-3.1-8b-instruct'; // cek katalog Workers AI kalau model diganti/dihapus
const FIREBASE_API_KEY = 'AIzaSyBJB-r9oW5xvEDr8m6AL8vSk7bItCbK-aA'; // apiKey web Firebase (memang publik)
const ALLOWED_ORIGINS = [
  'https://eduportal-server.web.app',   // GANTI ke alamat portal kamu
  'https://eduportal-server.firebaseapp.com',
  'http://localhost:5500'
];
const SYSTEM = `Kamu adalah asisten belajar EduPortal untuk siswa SMP/SMA di Indonesia.
Jawab dalam bahasa Indonesia yang santai, jelas, dan singkat (maksimal 5 kalimat kecuali diminta rinci).
Bantu menjelaskan konsep pelajaran dan cara memakai portal (ujian, nilai, peringkat, profil).
Jangan memberikan jawaban langsung untuk soal ujian yang sedang berlangsung; arahkan siswa memahami konsepnya.
Jika tidak yakin, bilang tidak yakin.`;

export default {
  async fetch(req, env) {
    const origin = req.headers.get('Origin') || '';
    const cors = {
      'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Vary': 'Origin'
    };
    const json = (o, status = 200) =>
      new Response(JSON.stringify(o), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

    if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
    if (req.method !== 'POST') return json({ error: 'not_found' }, 404);
    if (!ALLOWED_ORIGINS.includes(origin)) return json({ error: 'forbidden' }, 403);

    // Hanya user yang sudah login Firebase yang boleh pakai
    const token = (req.headers.get('Authorization') || '').replace('Bearer ', '');
    if (!token) return json({ error: 'unauthorized' }, 401);
    const v = await fetch('https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=' + FIREBASE_API_KEY, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: token })
    });
    if (!v.ok) return json({ error: 'unauthorized' }, 401);

    let body;
    try { body = await req.json(); } catch { return json({ error: 'bad_request' }, 400); }
    const messages = (Array.isArray(body.messages) ? body.messages : []).slice(-10).map(m => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: String(m.content || '').slice(0, 800)
    }));
    if (!messages.length) return json({ error: 'bad_request' }, 400);

    try {
      const out = await env.AI.run(MODEL, {
        messages: [{ role: 'system', content: SYSTEM }, ...messages],
        max_tokens: 350
      });
      return json({ reply: out.response || '' });
    } catch (e) {
      return json({ error: 'ai_failed' }, 502);
    }
  }
};
