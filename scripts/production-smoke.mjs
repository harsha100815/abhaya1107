import { parseArgs } from 'node:util';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

function origin(value, label) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${label} must be a valid HTTPS origin`);
  }
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash
  )
    throw new Error(`${label} must be an HTTPS origin without a path, query, or credentials`);
  return url.origin;
}

export async function verifyProduction({ apiOrigin, webOrigin }, request = fetch) {
  const api = origin(apiOrigin, 'API origin');
  const web = origin(webOrigin, 'Web origin');
  async function get(base, path, label, json = true) {
    let response;
    try {
      response = await request(`${base}${path}`, {
        method: 'GET',
        redirect: 'error',
        cache: 'no-store',
        signal: AbortSignal.timeout(15000),
      });
    } catch {
      throw new Error(`${label}: connection failed, timed out, or redirected`);
    }
    if (!response.ok) throw new Error(`${label}: HTTP ${response.status}`);
    if (!json) {
      if (!response.headers.get('content-type')?.includes('text/html'))
        throw new Error(`${label}: expected an HTML application`);
      return;
    }
    try {
      return await response.json();
    } catch {
      throw new Error(`${label}: expected JSON`);
    }
  }
  function live(config, label) {
    if (config?.success !== true || config.data?.testOnly !== false)
      throw new Error(`${label}: service is not reporting LIVE mode`);
    for (const key of [
      'liveAlertsConfigured',
      'emailVerificationConfigured',
      'pushNotificationsConfigured',
    ])
      if (config.data[key] !== true) throw new Error(`${label}: ${key} is not configured`);
  }
  const [health, apiConfig, , webConfig] = await Promise.all([
    get(api, '/health', 'API health'),
    get(api, '/api/v1/config', 'API configuration'),
    get(web, '/', 'Web application', false),
    get(web, '/api/config', 'Web API proxy'),
  ]);
  if (health?.status !== 'ok' || health.database !== 'up')
    throw new Error('API health: database is not healthy');
  live(apiConfig, 'API configuration');
  live(webConfig, 'Web API proxy');
  return [
    'API database health',
    'API LIVE mode and provider configuration',
    'Web application',
    'Web API proxy LIVE mode',
  ];
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  try {
    const { values } = parseArgs({
      options: { 'api-origin': { type: 'string' }, 'web-origin': { type: 'string' } },
      strict: true,
    });
    const checks = await verifyProduction({
      apiOrigin: values['api-origin'],
      webOrigin: values['web-origin'],
    });
    for (const check of checks) console.log(`PASS ${check}`);
    console.log(
      'Read-only checks passed. Worker health, actual delivery and device behavior still require verification.',
    );
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
