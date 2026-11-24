interface LanguageConfig {
    labelKey: string
    locale: string
    allowedLocales: readonly string[]
}

// `as const` garde les clés exactes ('en' | 'fr') ; `satisfies` vérifie la forme sans l'élargir.
export const SUPPORTED_LANGUAGES = {
    en: {
        labelKey: 'english',
        locale: 'en-CA',
        allowedLocales: ['en', 'en-CA', 'en-US'],
    },
    fr: {
        labelKey: 'french',
        locale: 'fr-CA',
        allowedLocales: ['fr', 'fr-CA', 'fr-FR'],
    },
} as const satisfies Record<string, LanguageConfig>

// 'en' | 'fr' : ajouter une langue dans SUPPORTED_LANGUAGES met ce type à jour tout seul
export type LanguageCode = keyof typeof SUPPORTED_LANGUAGES

export const DEFAULT_LANGUAGE: LanguageCode = 'fr'

export const SUPPORTED_LANGUAGE_CODES = Object.keys(SUPPORTED_LANGUAGES) as LanguageCode[]