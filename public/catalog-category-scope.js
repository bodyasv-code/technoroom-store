const legacyCategoryAliases = {
  projector: 'cat-projectors', audio: 'cat-audio', tv: 'cat-displays',
  'laser-proj': 'projectors', 'home-projectors': 'projectors',
  'short-throw-projectors': 'projectors', 'installation-projectors': 'projectors',
  'universal-projectors': 'projectors', 'erc-display-03': 'projectors',
  'erc-display-11': 'projectors', 'erc-display-12': 'projectors', 'erc-display-13': 'projectors'
};
const legacyCategoryChildren = {
  'cat-projectors': ['projector', 'laser-proj', 'home-projectors', 'short-throw-projectors', 'installation-projectors', 'universal-projectors', 'projection-screens'],
  'cat-audio': ['audio'],
  'cat-displays': ['tv']
};

export const canonicalCategorySlug=slug=>Object.hasOwn(legacyCategoryAliases,slug)?legacyCategoryAliases[slug]:slug;
export function catalogCategoryScope(tree,slug){const resolved=canonicalCategorySlug(slug);return new Set([slug,...tree.branch(resolved),...(legacyCategoryChildren[resolved]||[])]);}
