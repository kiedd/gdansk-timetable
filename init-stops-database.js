const fs = require('fs');

async function main() {
  const stopsJson = await fetch(
    'https://ckan.multimediagdansk.pl/dataset/c24aa637-3619-4dc2-a171-a23eec8f2172/resource/4c4025f0-01bf-41f7-a39f-d156d201b82b/download/stops.json'
  );
  const stops = await stopsJson.json();
  const dateKey = new Date().toLocaleDateString('en-ca');

  const stopsDict = {};
  const stopsByIdDict = {};
  for (let stop of stops[dateKey].stops) {
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

  const result = [];
  console.log('keyCount: ', Object.keys(stopsDict).length);
  for (const entry of Object.entries(stopsDict)) {
    result.push({ key: entry[0], value: JSON.stringify(entry[1]), expiration_ttl: 31560000 });
  }
  fs.writeFileSync('.temp/stops.json', JSON.stringify(result));

  const stopsById = [];
  console.log('keyCount: ', Object.keys(stopsByIdDict).length);
  for (const entry of Object.entries(stopsByIdDict)) {
    stopsById.push({ key: entry[0], value: entry[1], expiration_ttl: 31560000 });
  }
  fs.writeFileSync('.temp/stopsById.json', JSON.stringify(stopsById));
}

main();
