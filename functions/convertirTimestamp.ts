import { DateTime } from "luxon";
import i18n from "../i18n";
import { SUPPORTED_LANGUAGES } from "../locales/config";
import enFormats from "../locales/en/formats.json";
import frFormats from "../locales/fr/formats.json";
import log from "./log";

type Timestamp = string | Date | DateTime | null | undefined;
type FormatKey = "dateShort" | "dayShort" | "dateLong";

interface FormatsLangue {
    monthsShort: string[];
    weekdaysShort: string[];
    [cle: string]: unknown;
}

const formats: Record<string, FormatsLangue> = { fr: frFormats, en: enFormats };

function getLanguage(): string {
    return i18n.resolvedLanguage || i18n.language || "fr";
}

function getCurrentLocale(): string {
    const languages = SUPPORTED_LANGUAGES as Record<string, { locale: string } | undefined>;
    return languages[getLanguage()]?.locale || "fr-CA";
}

function getDateFormat(formatKey: string): string {
    return (formats[getLanguage()]?.[formatKey] || formats.fr[formatKey]) as string;
}

function formatDate(dateTime: DateTime, formatKey: FormatKey): string {
    const language = getLanguage();
    const languageFormats = formats[language] || formats.fr;
    const month = languageFormats.monthsShort[dateTime.month - 1];

    if (formatKey === "dateShort") {
        return language === "en"
            ? `${month} ${dateTime.day}`
            : `${dateTime.day} ${month}`;
    }

    const weekday = languageFormats.weekdaysShort[dateTime.weekday - 1];
    if (formatKey === "dayShort") {
        return language === "en"
            ? `${weekday}, ${month} ${dateTime.day}`
            : `${weekday} ${dateTime.day} ${month}`;
    }
    return language === "en"
        ? `${weekday}, ${month} ${dateTime.day}, ${dateTime.year}`
        : `${weekday} ${dateTime.day} ${month} ${dateTime.year}`;
}

function translateRelativeTime(key: string, options?: Record<string, unknown>): string {
    return i18n.t(`formats:${key}`, options) as string;
}

function toDateTime(timestamp: Timestamp): DateTime | null {
    if (DateTime.isDateTime(timestamp)) {
        return timestamp;
    }

    if (timestamp instanceof Date) {
        return DateTime.fromJSDate(timestamp);
    }

    if (typeof timestamp === "string") {
        const fromISO = DateTime.fromISO(timestamp);
        if (fromISO.isValid) return fromISO;

        const fromSQL = DateTime.fromSQL(timestamp);
        if (fromSQL.isValid) return fromSQL;
    }

    return null;
}

/**
 * @returns month and day depending on locale ("3 nov." / "Nov 3")
 */
function convertirTimestampDateCourte(timestamp: Timestamp): string {
    const dateTime = toDateTime(timestamp)?.setLocale(getCurrentLocale());
    if (!dateTime?.isValid) {
        log('erreur convertirTimestampDateCourte')
        return '???'
    }

    return formatDate(dateTime, "dateShort");
}

/**
 * Weekday, day and month, without the year: "mar. 3 nov." / "Tue, Nov 3".
 * Like the other helpers here, it uses formats.json, not Luxon's month names
 * (`LLL` in toFormat), which come out as "null" on the phone (no Intl month names).
 */
function convertirTimestampJourCourt(timestamp: Timestamp): string {
    const dateTime = toDateTime(timestamp)?.setLocale(getCurrentLocale());
    if (!dateTime?.isValid) return '???'
    return formatDate(dateTime, "dayShort");
}

function convertirTimestampDateLongue(timestamp: Timestamp): string {
    const dateTime = toDateTime(timestamp)?.setLocale(getCurrentLocale());
    if (!dateTime?.isValid) {
        console.warn("Timestamp n'est pas une date ou un DateTime", typeof (timestamp));
        return '???';
    }

    return formatDate(dateTime, "dateLong");
}

function convertirTimestampHeure(timestamp: Timestamp): string {
    const dateTime = toDateTime(timestamp)?.setLocale(getCurrentLocale());
    if (!dateTime?.isValid)
        return '???'

    return dateTime.toFormat(getDateFormat("time"));
}

function convertToWhen(timestamp: DateTime): string {
    const diff = DateTime.now().diff(timestamp, 'minutes').minutes

    switch (true) {
        case diff < 5:
            return translateRelativeTime("justNow")
        case diff < 60:
            return translateRelativeTime("minutes", { count: Math.floor(diff) })
        case diff < 60 * 3:
            return translateRelativeTime("hours", { count: Math.floor(diff / 60) })
        case diff < 60 * 24:
            return translateRelativeTime("atTime", { time: convertirTimestampHeure(timestamp) })
        case diff < 60 * 48:
            return translateRelativeTime("yesterday")
        default:
            return convertirTimestampDateCourte(timestamp)
    }
}

export { convertirTimestampDateCourte, convertirTimestampDateLongue, convertirTimestampHeure, convertirTimestampJourCourt, convertToWhen };
