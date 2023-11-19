const fs = require('fs');

function main() {
  const stopsByIdJson = fs.readFileSync('.temp/stopsById.json', { encoding: 'utf-8' });
  const stopsById = JSON.parse(stopsByIdJson);
  const chunkSize = 500;
  for (let i = 0; i < stopsById.length; i += chunkSize) {
    const chunk = stopsById.slice(i, i + chunkSize);
    fs.writeFileSync(`.temp/stopsById-${i + 1}.json`, JSON.stringify(chunk));
    console.log('chunk written: ', chunk.length, 'elements');
  }
}

main();
