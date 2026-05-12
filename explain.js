export default async function handler(req, res) {
  // Allow requests from your website
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { line } = req.body;
  if (!line) return res.status(400).json({ error: 'No line provided' });

  try {
    const response = await fetch(
      'https://models.inference.ai.azure.com/chat/completions',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.GITHUB_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          max_tokens: 1000,
          messages: [
            {
              role: 'system',
              content: `You are a Japanese language tutor specializing in anime dialogue.
When given a Japanese subtitle line, respond ONLY with valid JSON in exactly this format — no markdown, no backticks, no extra text:
{
  "translation": "natural English translation",
  "reading": "full romaji reading of the line",
  "words": [
    { "jp": "Japanese word", "reading": "romaji", "meaning": "English meaning" }
  ],
  "grammar": "clear grammar explanation. Highlight the key pattern by wrapping it like **pattern** so it can be styled.",
  "nuance": "cultural or emotional context specific to this anime moment — what makes this phrase feel the way it does",
  "alts": ["alternative Japanese phrase 1", "alternative phrase 2", "alternative phrase 3"]
}`
            },
            {
              role: 'user',
              content: `Explain this Japanese anime subtitle line: "${line}"`
            }
          ]
        })
      }
    );

    if (!response.ok) {
      const err = await response.text();
      console.error('GitHub Models error:', err);
      return res.status(500).json({ error: 'AI service error', detail: err });
    }

    const data = await response.json();
    const raw = data.choices?.[0]?.message?.content || '';

    // Clean and parse JSON
    const clean = raw.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);

    // Format grammar to highlight **patterns** as HTML
    if (parsed.grammar) {
      parsed.grammar = parsed.grammar.replace(/\*\*(.+?)\*\*/g, '<span style="background:rgba(74,58,255,0.12);color:#4a3aff;padding:1px 5px;border-radius:3px;font-weight:500;">$1</span>');
    }

    return res.status(200).json(parsed);

  } catch (err) {
    console.error('Handler error:', err);
    return res.status(500).json({ error: err.message });
  }
}
