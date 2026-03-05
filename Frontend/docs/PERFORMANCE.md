# Making the app feel faster

## Already in place

- **Optimistic UI**: Save/unsave (heart), rating, and add-photo update the UI immediately; requests run in the background and we revert + show an error if they fail.
- **Saved tab**: Opens right away with the current list; refetch runs in the background and the list updates when done.
- **Debounced search**: The search dropdown filters 200ms after you stop typing so typing stays smooth and we don’t re-filter on every key.
- **Memoized list cards**: `FountainCard` and `FeaturedFountainCard` are wrapped in `React.memo` so list re-renders don’t re-render every card when props are unchanged.
- **Image skeletons**: Remote images show a skeleton while loading.
- **useMemo/useCallback**: Heavy lists and handlers are memoized in `Home` and `FountainDetail`.

## Optional next steps

- **Long lists**: If the closest-fountains or saved list gets large (e.g. 50+), replace `ScrollView` + `.map()` with `FlatList` and `initialNumToRender` (e.g. 10) so only visible rows mount.
- **Map markers**: If you have many fountains on the map, consider clustering (e.g. `react-native-maps-super-cluster`) so only visible markers render.
- **Prefetch**: When the user taps a fountain, you could prefetch its saved state or rating before the detail sheet finishes opening (e.g. start the request in `handleFountainClick`).
- **Cache water sources**: Keep the last fetch of water sources in memory for a short time (e.g. 30s) so reopening the app or the list doesn’t refetch until stale.
- **Reduce re-renders**: Avoid passing new object/array literals as props (e.g. `style={[styles.x, { margin: 8 }]}` creates a new array every render). Prefer stable refs or useMemo for composite styles when it matters.
