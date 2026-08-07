import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  // --- Authorization ---
  // Scheduled workflows invoke this function with no user session (per Base44
  // docs, scheduled-task functions have no authenticated user and use
  // asServiceRole). Secrets are read inside the function, never passed as
  // workflow args. Manual UI calls carry a user JWT — allow any authenticated user.
  let isAuthed = false;
  try { isAuthed = await base44.auth.isAuthenticated(); } catch { isAuthed = false; }
  // No 401 gate: workflow path (no session) and manual UI path (authed) both allowed.

  try {
    // Fetch the Gulf News historical fuel rates page
    const response = await fetch('https://gulfnews.com/gold-forex/historical-fuel-rates', {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Base44FuelBot/1.0)' }
    });
    const html = await response.text();

    // The page has a table: Date | Super 98 | Special 95 | EPlus 91 | Diesel
    // Extract the first data row (current month) with 4 numeric price values
    const rowRegex = /<tr[^>]*>[\s\S]*?<td[^>]*>\s*([^<]+?)\s*<\/td>[\s\S]*?<td[^>]*>\s*([\d.]+)\s*<\/td>[\s\S]*?<td[^>]*>\s*([\d.]+)\s*<\/td>[\s\S]*?<td[^>]*>\s*([\d.]+)\s*<\/td>[\s\S]*?<td[^>]*>\s*([\d.]+)\s*<\/td>[\s\S]*?<\/tr>/i;

    const match = rowRegex.exec(html);
    if (!match) {
      return Response.json({ error: 'Could not find fuel price data on the page' }, { status: 500 });
    }

    const monthLabel = match[1].trim().replace(/\s+/g, ' ');
    const super98 = parseFloat(match[2]);
    const special95 = parseFloat(match[3]);
    const eplus91 = parseFloat(match[4]);
    const diesel = parseFloat(match[5]);

    if (isNaN(super98) || isNaN(special95) || isNaN(eplus91) || isNaN(diesel)) {
      return Response.json({ error: 'Parsed values are not valid numbers' }, { status: 500 });
    }

    const prices = {
      super_98: super98,
      special_95: special95,
      eplus_91: eplus91,
      diesel: diesel,
      month: monthLabel,
      currency: 'AED',
      unit: 'per litre',
      updated_at: new Date().toISOString()
    };

    // Upsert into Setting entity so the frontend can read stored prices
    const existing = await base44.asServiceRole.entities.Setting.filter({ key: 'fuel_prices' });
    const valueJson = JSON.stringify(prices);
    if (existing.length > 0) {
      await base44.asServiceRole.entities.Setting.update(existing[0].id, {
        value: valueJson,
        description: `UAE fuel prices - ${monthLabel}`
      });
    } else {
      await base44.asServiceRole.entities.Setting.create({
        key: 'fuel_prices',
        value: valueJson,
        category: 'system',
        description: `UAE fuel prices - ${monthLabel}`
      });
    }

    return Response.json({ success: true, prices });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});