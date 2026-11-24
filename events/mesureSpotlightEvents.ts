import Listener from "@/types/listener"

const listeners = new Set<Listener>()

export const measureSpotlightEvents = {
  onMeasureSpotlight(listener: Listener) {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  },
  emitMeasureSpotlight() {
    listeners.forEach(listener => listener())
  }
}
