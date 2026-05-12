export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { videoId } = req.query;
  if (!videoId) return res.status(400).json({ error: 'No videoId provided' });

  const langs = ['ja', 'jpn', 'ja-JP'];

  for (const lang of langs) {
    try {
      const url = `https://www.youtube.com/api/timedtext?lang=${lang}&v=${videoId}&fmt=json3`;
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept-Language': 'ja,en;q=0.9',
        }
      });

      if (!response.ok) continue;
      const text = await response.text();
      if (!text || text.trim() === '') continue;

      let json;
      try { json = JSON.parse(text); } catch(e) { continue; }

      if (!json.events || json.events.length === 0) continue;

      const captions = [];
      for (const event of json.events) {
        if (!event.segs) continue;
        const jp = event.segs.map(s => s.utf8 || '').join('').replace(/\n/g, '').trim();
        if (!jp) continue;
        if (!/[\u3040-\u30ff\u4e00-\u9fff]/.test(jp)) continue;

        captions.push({
          start: event.tStartMs / 1000,
          duration: (event.dDurationMs || 3000) / 1000,
          jp,
          en: ''
        });
      }

      if (captions.length > 0) {
        return res.status(200).json({ captions, lang, count: captions.length });
      }

    } catch(e) {
      continue;
    }
  }

  // Try auto-generated captions
  try {
    const autoUrl = `https://www.youtube.com/api/timedtext?lang=ja&v=${videoId}&fmt=json3&kind=asr`;
    const response = await fetch(autoUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    });

    if (response.ok) {
      const text = await response.text();
      if (text && text.trim() !== '') {
        const json = JSON.parse(text);
        if (json.events && json.events.length > 0) {
          const captions = json.events
            .filter(e => e.segs)
            .map(e => ({
              start: e.tStartMs / 1000,
              duration: (e.dDurationMs || 3000) / 1000,
              jp: e.segs.map(s => s.utf8 || '').join('').replace(/\n/g, '').trim(),
              en: ''
            }))
            .filter(c => c.jp && /[\u3040-\u30ff\u4e00-\u9fff]/.test(c.jp));

          if (captions.length > 0) {
            return res.status(200).json({ captions, lang: 'ja-auto', count: captions.length });
          }
        }
      }
    }
  } catch(e) {}

  return res.status(404).json({ error: 'No Japanese captions found', videoId });
}
