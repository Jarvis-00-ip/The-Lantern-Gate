
import { ROAD_NETWORK } from './src/core/RoadNetworkData.js';
import fs from 'fs';

const newNetwork = ROAD_NETWORK.map(path => ({
    path: path,
    properties: { oneWay: false }
}));

const fileContent = `export const ROAD_NETWORK = ${JSON.stringify(newNetwork, null, 4)};`;

fs.writeFileSync('./src/core/RoadNetworkData.js', fileContent);
console.log("Migration complete.");
