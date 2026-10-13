export function catalogResultState({count = 0, loading = false, error = false} = {}) {
  if (loading) return count > 0 ? 'loading-results' : 'loading';
  if (error) return count > 0 ? 'partial-results' : 'error';
  return count > 0 ? 'results' : 'empty';
}
