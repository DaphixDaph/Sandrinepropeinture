// Vercel Serverless Function : reçoit le formulaire et envoie un courriel à Sandrine via Resend.
// Variables d'environnement à créer dans Vercel (Settings → Environment Variables) :
//   RESEND_API_KEY  = clé API Resend (resend.com)
//   QUOTE_TO_EMAIL  = sandrine_454@hotmail.com
//   QUOTE_FROM      = Soumissions <soumission@sandrinepropeinture.com>  (domaine vérifié dans Resend)

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const money = n => Number(n).toLocaleString('fr-CA') + ' $';

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const d = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});

  if (d.website) return res.status(200).json({ ok: true }); // anti-spam (champ piège)
  if (!d.nom || !d.telephone || !/^\S+@\S+\.\S+$/.test(d.courriel || '')) {
    return res.status(400).json({ error: 'Champs requis manquants' });
  }

  const e = d.estimation || {};
  const rows = [
    ['Nom', d.nom], ['Téléphone', d.telephone], ['Courriel', d.courriel], ['Adresse / quartier', d.adresse],
    ['Type de projet', d.type], ['Nombre de pièces', d.pieces],
    ['Estimation', `${e.heures_min}–${e.heures_max} h × ${e.taux} $/h = ${money(e.prix_min)} – ${money(e.prix_max)} (avant taxes, peinture non incluse)`],
    ['Couleurs choisies', (d.couleurs || []).join(', ') || '—'], ['Autre couleur / code', d.codes || '—'],
    ['Veut des conseils de couleurs', d.conseil ? 'Oui' : 'Non'],
    ['Début souhaité', d.date_debut || '—'], ['Date limite', d.date_fin || '—'], ['Dates flexibles', d.flexible ? 'Oui' : 'Non'],
    ['Description', d.description || '—']
  ];
  const html = `<div style="font-family:Arial,sans-serif;max-width:640px"><h2>Nouvelle demande de soumission</h2><table cellpadding="8" style="border-collapse:collapse;width:100%">${
    rows.map(([k, v]) => `<tr><td style="border-bottom:1px solid #eee;font-weight:bold;width:210px;vertical-align:top">${esc(k)}</td><td style="border-bottom:1px solid #eee;white-space:pre-wrap">${esc(v)}</td></tr>`).join('')
  }</table></div>`;

  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: process.env.QUOTE_FROM || 'Soumissions <onboarding@resend.dev>',
      to: [process.env.QUOTE_TO_EMAIL || 'sandrine_454@hotmail.com'],
      reply_to: d.courriel,
      subject: `Soumission – ${d.nom} – ${d.pieces} pièce(s) – ${money(e.prix_min)} à ${money(e.prix_max)}`,
      html
    })
  });
  if (!r.ok) {
    const t = await r.text();
    console.error('Resend error', r.status, t);
    return res.status(502).json({ error: 'Échec de l’envoi', status: r.status, detail: t });
  }
  return res.status(200).json({ ok: true });
}
