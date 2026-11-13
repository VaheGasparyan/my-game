// Map registry. To add a map: write a file like the ones here and list it below.

import skyport from './skyport.js';
import dockyard from './dockyard.js';
import dustline from './dustline.js';
import nightshift from './nightshift.js';

export const MAPS = [skyport, dockyard, dustline, nightshift];
export const DEFAULT_MAP = skyport.id;

export function getMap(id) {
  return MAPS.find((m) => m.id === id) || skyport;
}
