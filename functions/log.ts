// Mettre à true pour réactiver les logs en développement.
const LOGS_ACTIFS = true

export default function log(...args: unknown[]): void {
    if (LOGS_ACTIFS && __DEV__) {
        console.log(...args)
    }
}