// content of index.js
const express = require('express');
const app = express();
const port = 3000;

const wrap =
  (fn) =>
  (...args) =>
    fn(...args).catch(args[2]);

const fs = require('fs/promises');

const stopsJsonUrl =
  'https://ckan.multimediagdansk.pl/dataset/c24aa637-3619-4dc2-a171-a23eec8f2172/resource/4c4025f0-01bf-41f7-a39f-d156d201b82b/download/stops.json';

function getDeparturesJsonUrl(stopId) {
  return `https://ckan2.multimediagdansk.pl/departures?stopId=${stopId}`;
}

let stopsDict = {};
let stopsByIdDict = {};
let observedStops = [];

app.get(
  '/stops/:query',
  wrap(async (req, res, next) => {
    const query = req.params.query.toLowerCase();
    if (query.length < 3) {
      res.json([]);
    }

    const list = stopsDict[query.substring(0, 3)];
    if (!list) {
      res.json([]);
    }

    res.json(
      list
        .filter((x) => x.nameLowerCase.startsWith(query))
        .map((x) => {
          return {
            id: x.id,
            name: x.name,
          };
        }),
    );
  }),
);

app.get(
  '/observing',
  wrap(async (req, res, next) => {
    console.log('get observed');
    const stops = [];
    for (const stopId of observedStops) {
      const stopDeps = [];
      const response = await (await fetch(getDeparturesJsonUrl(stopId))).json();
      for (const d of response.departures) {
        stopDeps.push(`${d.routeId} ${d.headsign} ${new Date(d.estimatedTime).toLocaleTimeString('pl-pl')}`);
      }
      stops.push({ name: stopsByIdDict[stopId], departures: stopDeps });
    }

    res.json(stops);
  }),
);

app.put(
  '/observing/:id',
  wrap(async (req, res, next) => {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      res.status(400).send('Bad Request');
    }

    if (!observedStops.includes(id)) {
      observedStops.push(id);
    }

    console.log('add observed stop', id);
    console.log('currently observing:', observedStops);
    res.end();
  }),
);

app.listen(port, async () => {
  const stopsJson = await fs.readFile('temp/stops.json', { encoding: 'utf8' });
  stopsResponse = JSON.parse(stopsJson);
  const dateKey = new Date().toLocaleDateString('en-ca');
  for (let stop of stopsResponse[dateKey].stops) {
    if (!stop.stopName) {
      continue;
    }
    const key = stop.stopName.substring(0, 3).toLowerCase();
    if (!stopsDict[key]) {
      stopsDict[key] = [];
    }
    const name = stop.subName ? `${stop.stopName} ${stop.subName}` : stop.stopName;
    stopsDict[key].push({ id: stop.stopId, name: name, nameLowerCase: name.toLowerCase() });
    stopsByIdDict[stop.stopId] = name;
  }

  console.log(`Example app listening on port ${port}`);
});
