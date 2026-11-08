/**
 * requireSession already reads the clinic row on every API call. It parks the clinic's enabled modules here, keyed by
 * the session object it hands back, so moduleGate does not read the same row a second time in the same request.
 * (Each extra database read costs a round trip; on a far-away database that is the difference between a snappy and a slow click.)
 */
export const sessionModules = new WeakMap<object, readonly string[]>();
