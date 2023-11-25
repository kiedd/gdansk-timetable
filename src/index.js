import { Router } from 'itty-router';
import { getAssetFromKV } from '@cloudflare/kv-asset-handler';
import { parse, serialize } from 'cookie';
import manifestJSON from '__STATIC_CONTENT_MANIFEST';
const assetManifest = JSON.parse(manifestJSON);

const cookieName = 'observed_stops';

function getDeparturesJsonUrl(stopId) {
  return `https://ckan2.multimediagdansk.pl/departures?stopId=${stopId}`;
}

function createJsonResponse(data) {
  return new Response(JSON.stringify(data), {
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

async function getOrCreateCachedTimetable(env, stopId) {
  let data = JSON.parse(await env.TIMETABLE.get(stopId.toString()));
  if (!data || Date.now() - data.createdOn > 10_000) {
    const departures = [];
    const response = await (await fetch(getDeparturesJsonUrl(stopId))).json();
    for (const d of response.departures) {
      departures.push(
        `${d.routeId} ${d.headsign} ${new Date(d.estimatedTime).toLocaleTimeString('pl-pl', { timeZone: 'Europe/Warsaw' })}`
      );
    }

    data = {
      createdOn: Date.now(),
      departures: departures,
    };

    await env.TIMETABLE.put(stopId, JSON.stringify(data));
  }

  return data.departures;
}

// Create a new router
const router = Router();

// Timetable routes
router.get('/stops/:query', async ({ params }, env) => {
  let query = decodeURIComponent(params.query).toLowerCase();
  if (query.length < 3) {
    return createJsonResponse([]);
  }

  const listJson = await env.STOPS.get(query.substring(0, 3));
  if (!listJson) {
    return createJsonResponse([]);
  }

  const list = JSON.parse(listJson);
  if (!list) {
    return createJsonResponse([]);
  }

  const response = list
    .filter(x => x.nameLowerCase.startsWith(query))
    .map(x => {
      return {
        id: x.id,
        name: x.name,
      };
    });

  return createJsonResponse(response);
});

router.get('/observing', async ({ headers }, env) => {
  const cookie = parse(headers.get('Cookie') || '');
  if (!cookie || !cookie[cookieName]) {
    return createJsonResponse([]);
  }

  const observedStops = cookie[cookieName].split(',');
  console.log('observed stops: ', observedStops);
  const stops = [];

  for (const stopId of observedStops) {
    if (isNaN(Number(stopId))) {
      continue;
    }
    const stopName = await env.STOP_NAMES.get(stopId.toString());
    const departures = await getOrCreateCachedTimetable(env, stopId);
    stops.push({ name: stopName ?? stopId.toString(), departures: departures });
  }

  return createJsonResponse(stops);
});

router.put('/observing/:id', async ({ params, headers }) => {
  const cookie = parse(headers.get('Cookie') || '');
  let observedStops = [];
  if (cookie && cookie[cookieName]) {
    observedStops = cookie[cookieName].split(',');
  }

  const id = Number(params.id);
  if (isNaN(id)) {
    return new Response('', {
      status: 400,
      statusText: 'Bad request',
    });
  }

  if (!observedStops.includes(id)) {
    observedStops.push(id);
  }

  var response = new Response('');
  response.headers.set('Set-Cookie', serialize(cookieName, observedStops.join(',')));
  return response;
});

router.all('*', () => new Response('404, not found!', { status: 404 }));

export default {
  async fetch(request, env, ctx) {
    const requestUrl = new URL(request.url);
    if (requestUrl.pathname === '/' || requestUrl.pathname.includes('static')) {
      try {
        // Add logic to decide whether to serve an asset or run your original Worker code
        return await getAssetFromKV(
          {
            request,
            waitUntil: ctx.waitUntil.bind(ctx),
          },
          {
            ASSET_NAMESPACE: env.__STATIC_CONTENT,
            ASSET_MANIFEST: assetManifest,
          }
        );
      } catch (e) {
        let pathname = new URL(requestUrl).pathname;
        return new Response(`"${pathname}" not found`, {
          status: 404,
          statusText: 'not found',
        });
      }
    } else {
      return await router.handle(request, env, ctx);
    }
  },
};
