/** The board publishes the number of styles it just loaded. The sidebar listens. */
export const RANGE_COUNT_EVENT = 'spindle:range-count';

/** Page size used by the style list. A shorter page is the full board. */
export const RANGE_LIST_LIMIT = 100;

export function publishRangeCount(count: number) {
  window.dispatchEvent(new CustomEvent(RANGE_COUNT_EVENT, { detail: count }));
}

/** A full page may be truncated, so only a shorter page is safe to publish as the total. */
export function publishLoadedRangeCount(count: number) {
  if (count < RANGE_LIST_LIMIT) publishRangeCount(count);
}
