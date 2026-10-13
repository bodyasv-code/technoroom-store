import assert from 'node:assert/strict';
import {projectorResolutionLabel,normalizeProjectorResolution} from '../public/projector-specs.js';
for(const raw of ['Full HD','FULL HD','FHD','1920x1080'])assert.equal(projectorResolutionLabel(raw),'FULL HD (1920 × 1080)');
for(const raw of ['WUXGA','1920 x 1200'])assert.equal(projectorResolutionLabel(raw),'WUXGA (1920 × 1200)');
assert.equal(projectorResolutionLabel('1980 x 1200'),'1980 x 1200');
assert.equal(projectorResolutionLabel('WXGA'),'WXGA');
assert.equal(normalizeProjectorResolution('Full HD'),'Full HD');
assert.equal(normalizeProjectorResolution('WUXGA'),'WUXGA');
console.log('Resolution display labels: checks passed');
