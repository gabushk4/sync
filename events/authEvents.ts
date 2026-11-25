import log from "@/functions/log";
import Listener from "@/types/listener"


let listeners: Listener[] = [];

export const authEvents = {
  onUnauthorized(listener: Listener) {
    listeners.push(listener);
    return () => { listeners = listeners.filter(l => l !== listener); };
  },
  emitUnauthorized() {
    log('emit unauthorized')
    listeners.forEach(l => l());
  },
};