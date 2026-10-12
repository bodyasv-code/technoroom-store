import {normalizeProjectorResolution, normalizeProjectorLightSource} from './projector-specs.js?v=20261012-spec-format';
import {comparableSpecificationValue} from './specification-values.js?v=20261012-spec-format';
const text = value => String(Array.isArray(value) ? value.join(' · ') : value ?? '').normalize('NFKC').trim().toLocaleLowerCase('uk-UA').replace(/\s+/g,' ');
const resolutionDimensions={'svga':'800 × 600','xga':'1024 × 768','wxga':'1280 × 800','hd':'1280 × 720','full hd':'1920 × 1080','wuxga':'1920 × 1200','wqxga':'2560 × 1600','4k uhd':'3840 × 2160','8k uhd':'7680 × 4320','wvga':'854 × 480'};
function lightSource(raw) {
  const value=text(raw), type=normalizeProjectorLightSource(value);
  return type?{type,numbers:value.match(/\d+(?:[.,]\d+)?/gu)||[]}:null;
}
// Used only by the read-only audit. Never discard or rewrite supplier details.
export function equivalentSpecification(key,left,right,{projector=false}={}) {
  const a=comparableSpecificationValue(key,left),b=comparableSpecificationValue(key,right);
  if(a===b)return true;
  if(!projector)return false;
  if(key==='Джерело світла'){
    const first=lightSource(a),second=lightSource(b);
    if(!first||!second||first.type!==second.type)return false;
    // A generic source and the same source with lifespan/power are compatible.
    // If both include numeric details, different details remain a review item.
    return !first.numbers.length||!second.numbers.length||first.numbers.join('|')===second.numbers.join('|');
  }
  if(key==='Роздільна здатність'){
    const first=normalizeProjectorResolution(a),second=normalizeProjectorResolution(b);
    return !!first&&!!second&&(resolutionDimensions[first.toLowerCase()]||first)===(resolutionDimensions[second.toLowerCase()]||second);
  }
  return false;
}
