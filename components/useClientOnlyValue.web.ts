import React from 'react';

const sAbonner = () => () => {};

// On the server (static web render) the server value, in the browser the client one.
// useSyncExternalStore knows which render it is (getServerSnapshot on the server): no
// setState in an effect, which redrew everything once after the first render.
export function useClientOnlyValue<S, C>(server: S, client: C): S | C {
  const surClient = React.useSyncExternalStore(sAbonner, () => true, () => false);
  return surClient ? client : server;
}
