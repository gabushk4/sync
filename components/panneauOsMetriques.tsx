/**
 * Panneau de métriques OS (serveur) — onglet "OS" du dashboard admin.
 *
 * Affiche les moyennes d'usage du serveur (CPU, mémoire, disque) pour une
 * période donnée, avec un graphique de tendance CPU en série temporelle
 * dessiné avec react-native-svg (déjà présent dans le projet).
 *
 * Deux modes :
 *  - "Tout l'historique" : moyenne sur l'ensemble des échantillons (pas de query).
 *  - Période prédéfinie / personnalisée : moyenne sur [start, end[
 *    envoyés en query à GET /admin/os_metrics.
 *
 * Le graphique de tendance appelle GET /admin/os_metrics/points qui retourne
 * une série de points (moyennes groupées par heure ou par jour).
 *
 * Le chargement est paresseux : chaque panneau repliable (PanneauCollapsable)
 * déclenche le fetch lorsqu'il est ouvert, et le résultat est mis en cache par
 * clé de période pour ne pas surcharger l'API à l'ouverture/fermeture répétée.
 *
 * Un voile de chargement (VoileEnvoi) s'affiche en overlay pendant le chargement
 * de la période courante.
 */
import { DateTime } from 'luxon'
import React, { useCallback, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
    ActivityIndicator,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    useColorScheme,
    Dimensions,
} from 'react-native'
import Icon from '@react-native-vector-icons/ionicons'
import { Picker } from '@react-native-picker/picker'
import RNDateTimePicker from '@react-native-community/datetimepicker'
import Svg, {
    Line,
    Circle,
    Text as SvgText,
    G,
    Path,
} from 'react-native-svg'

import { useAPI } from '@/contextes/contexteAPI'
import { useFont } from '@/contextes/contexteFont'
import { usePalette } from '@/contextes/contextePalette'
import catcher from '@/functions/catcher'
import VoileEnvoi from '@/components/voileEnvoi'
import PanneauCollapsable from './PanneauCollapsable'

type MetriqueOs = {
    sample_count: number
    avg_cpu_percent: number | null
    avg_rss_bytes: number | null
    avg_heap_used_bytes: number | null
    avg_external_bytes: number | null
    avg_disk_total_bytes: number | null
    avg_disk_used_bytes: number | null
    avg_disk_available_bytes: number | null
}

type PointOs = {
    periode: string
    avg_cpu_percent: number | null
    avg_rss_bytes: number | null
    avg_heap_used_bytes: number | null
    sample_count: number
}

type PeriodeId = 'historique' | '24h' | '7j' | '30j' | '90j' | 'personnalise'

type Etat = 'idle' | 'chargement' | 'pret' | 'erreur'

type EntreeCache = {
    donnees: MetriqueOs | null
    etat: Etat
}

type PointsCache = {
    points: PointOs[] | null
    etat: Etat
}

type Props = {
    /** 401/403 : le parent (dashboard admin) sort du dashboard. */
    onAccesRefuse: () => void
}

const PERIODES: { id: PeriodeId; cleTraduction: string }[] = [
    { id: 'historique', cleTraduction: 'historique' },
    { id: '24h', cleTraduction: 'periode24h' },
    { id: '7j', cleTraduction: 'periode7j' },
    { id: '30j', cleTraduction: 'periode30j' },
    { id: '90j', cleTraduction: 'periode90j' },
    { id: 'personnalise', cleTraduction: 'personnalise' },
]

export default function PanneauOsMetriques({ onAccesRefuse }: Props) {
    const { t, i18n } = useTranslation('profile')
    const { api } = useAPI()
    const { colors } = usePalette()
    const { fonts } = useFont()
    const scheme = useColorScheme() ?? 'light'

    const { width: SCREEN_W } = Dimensions.get('window')

    const [periode, setPeriode] = useState<PeriodeId>('historique')
    const [start, setStart] = useState<DateTime | null>(null)
    const [end, setEnd] = useState<DateTime | null>(null)
    const [showStartPicker, setShowStartPicker] = useState(false)
    const [showEndPicker, setShowEndPicker] = useState(false)

    // Cache des moyennes globales, indexé par une clé qui intègre la période et ses bornes.
    const [cache, setCache] = useState<Map<string, EntreeCache>>(new Map())
    // Cache des points de série temporelle, indexé de la même manière.
    const [pointsCache, setPointsCache] = useState<Map<string, PointsCache>>(new Map())

    /** Fenêtre [start, end] pour la période sélectionnée. */
    const fenetre = useCallback((): { from?: string; to?: string } => {
        if (periode === 'historique') return {}
        const finReference = end ?? DateTime.now()
        let debut: DateTime
        switch (periode) {
            case '24h':
                debut = finReference.minus({ hours: 24 })
                break
            case '7j':
                debut = finReference.minus({ days: 7 })
                break
            case '30j':
                debut = finReference.minus({ days: 30 })
                break
            case '90j':
                debut = finReference.minus({ days: 90 })
                break
            case 'personnalise':
                debut = start ?? finReference.minus({ days: 7 })
                break
            default:
                debut = finReference.minus({ days: 30 })
        }
        return { from: debut.toISO()!, to: finReference.toISO()! }
    }, [periode, start, end])

    /** Clé de cache pour la période courante (période + bornes). */
    const cleCache = useMemo(() => {
        if (periode === 'historique') return 'historique'
        const { from, to } = fenetre()
        return `${periode}:${from ?? ''}:${to ?? ''}`
    }, [periode, fenetre])

    /** Sous-titre affiché sous le titre de chaque panneau (période active). */
    const sousTitrePeriode = useMemo(() => {
        if (periode === 'historique') return t('admin.os_metrics.historique')
        const { from, to } = fenetre()
        if (!from || !to) return ''
        const debut = DateTime.fromISO(from).toFormat('dd/MM')
        const fin = DateTime.fromISO(to).toFormat('dd/MM')
        return t('admin.os_metrics.periodeSousTitre', { debut, fin })
    }, [periode, fenetre, t])

    const entree = cache.get(cleCache)
    const etat = entree?.etat ?? 'idle'
    const donnees = entree?.donnees ?? null
    const enChargement = etat === 'chargement'

    const pointsEntree = pointsCache.get(cleCache)
    const pointsEtat = pointsEntree?.etat ?? 'idle'
    const points = pointsEntree?.points ?? null
    const pointsEnChargement = pointsEtat === 'chargement'

    const formaterOctets = (octets: number | null) => {
        if (octets == null) return '---'
        const ko = octets / 1024
        if (ko < 1024) return ko.toFixed(1) + ' Ko'
        const mo = ko / 1024
        if (mo < 1024) return mo.toFixed(1) + ' Mo'
        return (mo / 1024).toFixed(1) + ' Go'
    }

    const formaterNombre = (value: number | null) =>
        value == null ? '---' : value.toLocaleString(i18n.language)
    const formaterPourcent = (value: number | null) =>
        value == null
            ? '---'
            : value.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' %'

    const pctDisqueUtilise =
        donnees?.avg_disk_used_bytes != null && donnees?.avg_disk_total_bytes && donnees.avg_disk_total_bytes > 0
            ? (donnees.avg_disk_used_bytes / donnees.avg_disk_total_bytes) * 100
            : null

    const charger = useCallback(async (silencieux = false) => {
        if (!silencieux) {
            setCache((precedent) => {
                const suivant = new Map(precedent)
                suivant.set(cleCache, { donnees: null, etat: 'chargement' })
                return suivant
            })
        }
        try {
            const { from, to } = fenetre()
            const params: Record<string, string> = {}
            if (from) params.start = from
            if (to) params.end = to
            const {data} = await api.get<{metrics: MetriqueOs}>('/admin/os_metrics', { params })
            
            console.log("os metriques data: ", data.metrics)

            setCache((precedent) => {
                const suivant = new Map(precedent)
                suivant.set(cleCache, { donnees: data.metrics, etat: 'pret' })
                return suivant
            })
        } catch (error: any) {
            const status = error?.response?.status
            if (status === 401 || status === 403) {
                onAccesRefuse()
                return
            }
            setCache((precedent) => {
                const suivant = new Map(precedent)
                suivant.set(cleCache, { donnees: null, etat: 'erreur' })
                return suivant
            })
            catcher(error, t('admin.os_metrics.loadFailed'))
        }
    }, [api, cleCache, fenetre, t, onAccesRefuse])

    const chargerPoints = useCallback(async (silencieux = false) => {
        if (periode === 'historique') {
            setPointsCache((precedent) => {
                const suivant = new Map(precedent)
                suivant.set(cleCache, { points: [], etat: 'pret' })
                return suivant
            })
            return
        }
        if (!silencieux) {
            setPointsCache((precedent) => {
                const suivant = new Map(precedent)
                suivant.set(cleCache, { points: null, etat: 'chargement' })
                return suivant
            })
        }
        try {
            const { from, to } = fenetre()
            const params: Record<string, string> = {}
            if (from) params.start = from
            if (to) params.end = to
            params.interval = periode === '24h' ? 'hour' : 'day'
            const { data } = await api.get<{ points: PointOs[] }>('/admin/os_metrics/points', { params })
            setPointsCache((precedent) => {
                const suivant = new Map(precedent)
                suivant.set(cleCache, { points: data.points ?? [], etat: 'pret' })
                return suivant
            })
        } catch (error: any) {
            const status = error?.response?.status
            if (status === 401 || status === 403) {
                onAccesRefuse()
                return
            }
            setPointsCache((precedent) => {
                const suivant = new Map(precedent)
                suivant.set(cleCache, { points: null, etat: 'erreur' })
                return suivant
            })
            catcher(error, t('admin.os_metrics.loadFailed'))
        }
    }, [api, cleCache, fenetre, periode, t, onAccesRefuse])

    const chargerRef = useRef(charger)
    const chargerPointsRef = useRef(chargerPoints)

    React.useEffect(() => {
        chargerRef.current = charger
        chargerPointsRef.current = chargerPoints
        void chargerRef.current(false)
        void chargerPointsRef.current(false)
    }, [cleCache, charger, chargerPoints])

    const ouvrir = useCallback(() => {
        void charger(true)
    }, [charger])

    const rafraichir = async () => {
        await charger(false)
        await chargerPoints(false)
    }

    const s = StyleSheet.create({
        page: { flex: 1, backgroundColor: colors.background },
        entete: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 16,
            paddingVertical: 10,
        },
        titre: { color: colors.text, fontFamily: fonts.title, fontSize: 18 },
        boutonRefresh: { padding: 8, borderRadius: 20 },
        selecteur: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            paddingHorizontal: 16,
            paddingBottom: 10,
        },
        labelPeriode: {
            color: colors.muted,
            fontFamily: fonts.body,
            fontSize: 13,
        },
        picker: {
            flex: 1,
            color: colors.text,
            fontFamily: fonts.body,
            fontSize: 13,
        },
        perso: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 10,
            paddingHorizontal: 16,
            paddingBottom: 10,
        },
        boutonDate: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            paddingVertical: 7,
            paddingHorizontal: 10,
            borderRadius: 8,
            backgroundColor: colors.card,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: colors.border,
        },
        texteDate: { color: colors.text, fontFamily: fonts.body, fontSize: 13 },
        sousTitrePeriode: {
            color: colors.muted,
            fontFamily: fonts.body,
            fontSize: 12,
            paddingHorizontal: 16,
            paddingBottom: 6,
        },
        centre: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
        message: { padding: 24, color: colors.muted, fontFamily: fonts.body, fontSize: 16, textAlign: 'center' },
        retry: {
            color: colors.secondary,
            fontFamily: fonts.title,
            fontSize: 15,
            textAlign: 'center',
            marginTop: 8,
        },
        liste: { paddingBottom: 32 },
        graphContainer: {
            width: SCREEN_W - 32,
            height: 220,
            marginHorizontal: 16,
            marginBottom: 16,
            backgroundColor: colors.card,
            borderRadius: 12,
            paddingHorizontal: 16,
            paddingVertical: 12,
        },
        graphTitre: {
            color: colors.text,
            fontFamily: fonts.title,
            fontSize: 15,
            marginBottom: 8,
            marginHorizontal: 16,
        },
    })

    const graphWidth = SCREEN_W - 64
    const graphHeight = 140

    const cpuValues = useMemo(() => {
        if (!points || points.length === 0) return []
        return points.map((p) => p.avg_cpu_percent ?? 0)
    }, [points])

    const maxCpu = useMemo(() => {
        if (cpuValues.length === 0) return 1
        const max = Math.max(...cpuValues)
        if (max === 0) return 1
        // Marge de 25 % au-dessus du max réel pour que la courbe ne touche pas le bord.
        return max * 1.25
    }, [cpuValues])

    return (
        <View style={s.page}>
            {/* En-tête : titre + bouton d'actualisation */}
            <View style={s.entete}>
                <Text style={s.titre}>{t('admin.os_metrics.title')}</Text>
                <TouchableOpacity
                    onPress={rafraichir}
                    accessibilityRole="button"
                    accessibilityLabel={t('admin.metrics.refresh')}
                    style={s.boutonRefresh}
                    disabled={enChargement || pointsEnChargement}
                >
                    <Icon
                        name={enChargement || pointsEnChargement ? 'refresh' : 'refresh-outline'}
                        size={24}
                        color={colors.text}
                    />
                </TouchableOpacity>
            </View>

            {/* Sélecteur de période */}
            <View style={s.selecteur}>
                <Text style={s.labelPeriode}>{t('admin.os_metrics.periode')}</Text>
                <Picker
                    style={s.picker}
                    selectedValue={periode}
                    onValueChange={(valeur: string) => {
                        setPeriode(valeur as PeriodeId)
                        if (valeur !== 'personnalise') {
                            setStart(null)
                            setEnd(null)
                        }
                    }}
                >
                    {PERIODES.map((p) => (
                        <Picker.Item
                            key={p.id}
                            label={t(`admin.os_metrics.${p.cleTraduction}`)}
                            value={p.id}
                        />
                    ))}
                </Picker>
            </View>

            {/* Mode personnalisé : sélecteurs de dates de début et de fin */}
            {periode === 'personnalise' && (
                <View style={s.perso}>
                    <TouchableOpacity
                        onPress={() => setShowStartPicker(true)}
                        accessibilityRole="button"
                        accessibilityLabel={t('admin.os_metrics.debut')}
                        style={s.boutonDate}
                    >
                        <Icon name="calendar" size={18} color={colors.text} />
                        <Text style={s.texteDate}>
                            {t('admin.os_metrics.debut')}:{' '}
                            {start?.toFormat('dd/MM/yyyy') ?? t('admin.os_metrics.debut')}
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => setShowEndPicker(true)}
                        accessibilityRole="button"
                        accessibilityLabel={t('admin.os_metrics.fin')}
                        style={s.boutonDate}
                    >
                        <Icon name="calendar" size={18} color={colors.text} />
                        <Text style={s.texteDate}>
                            {t('admin.os_metrics.fin')}:{' '}
                            {end?.toFormat('dd/MM/yyyy') ?? t('admin.os_metrics.fin')}
                        </Text>
                    </TouchableOpacity>
                </View>
            )}

            {/* Date pickers natifs */}
            {showStartPicker && (
                <RNDateTimePicker
                    value={start?.toJSDate() ?? DateTime.now().toJSDate()}
                    mode="date"
                    display={Platform.OS === 'android' ? 'calendar' : 'default'}
                    onChange={(_, date) => {
                        if (date) {
                            setShowStartPicker(false)
                            setStart(DateTime.fromJSDate(date).startOf('day'))
                        }
                    }}
                />
            )}
            {showEndPicker && (
                <RNDateTimePicker
                    value={end?.toJSDate() ?? DateTime.now().toJSDate()}
                    mode="date"
                    display={Platform.OS === 'android' ? 'calendar' : 'default'}
                    onChange={(_, date) => {
                        if (date) {
                            setShowEndPicker(false)
                            setEnd(DateTime.fromJSDate(date).endOf('day'))
                        }
                    }}
                />
            )}

            {/* Sous-titre de la période active */}
            {periode !== 'historique' && <Text style={s.sousTitrePeriode}>{sousTitrePeriode}</Text>}

            {/* État : erreur globale */}
            {etat === 'erreur' && (
                <View style={s.centre}>
                    <Text style={s.message}>{t('admin.os_metrics.loadFailed')}</Text>
                    <TouchableOpacity onPress={() => void rafraichir()} accessibilityRole="button">
                        <Text style={s.retry}>{t('admin.metrics.retry')}</Text>
                    </TouchableOpacity>
                </View>
            )}

            {/* État : vide */}
            {etat === 'pret' && !donnees && (
                <View style={s.centre}>
                    <Text style={s.message}>{t('admin.os_metrics.empty')}</Text>
                </View>
            )}

            {/* Contenu : graphique + panneaux repliables */}
            {etat === 'pret' && donnees && (
                <ScrollView style={{ flex: 1 }} contentContainerStyle={s.liste}>
                    <View style={s.graphContainer}>
                        <Text style={s.graphTitre}>{t('admin.os_metrics.tendanceCpu')}</Text>
                        <GraphiqueCpu
                            points={cpuValues}
                            maxValue={maxCpu}
                            width={graphWidth}
                            height={graphHeight}
                            colors={colors}
                        />
                        {pointsEtat === 'chargement' && (
                            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
                                <ActivityIndicator color={colors.secondary} />
                            </View>
                        )}
                    </View>

                    <PanneauCollapsable
                        titre={t('admin.os_metrics.systeme')}
                        sousTitre={sousTitrePeriode}
                        ouvertParDefaut={false}
                        onOuvert={ouvrir}
                    >
                        <StatLineOs
                            label={t('admin.os_metrics.cpu')}
                            valeur={formaterPourcent(donnees.avg_cpu_percent)}
                            scheme={scheme}
                        />
                        <StatLineOs
                            label={t('admin.os_metrics.memoireRss')}
                            valeur={formaterOctets(donnees.avg_rss_bytes)}
                            scheme={scheme}
                        />
                        <StatLineOs
                            label={t('admin.os_metrics.heapUtilise')}
                            valeur={formaterOctets(donnees.avg_heap_used_bytes)}
                            scheme={scheme}
                        />
                        <StatLineOs
                            label={t('admin.os_metrics.octetsExternes')}
                            valeur={formaterOctets(donnees.avg_external_bytes)}
                            scheme={scheme}
                        />
                    </PanneauCollapsable>

                    <PanneauCollapsable
                        titre={t('admin.os_metrics.disque')}
                        sousTitre={sousTitrePeriode}
                        ouvertParDefaut={false}
                        onOuvert={ouvrir}
                    >
                        <StatLineOs
                            label={t('admin.os_metrics.disqueTotal')}
                            valeur={formaterOctets(donnees.avg_disk_total_bytes)}
                            scheme={scheme}
                        />
                        <StatLineOs
                            label={t('admin.os_metrics.disqueUtilise')}
                            valeur={formaterOctets(donnees.avg_disk_used_bytes)}
                            scheme={scheme}
                        />
                        <StatLineOs
                            label={t('admin.os_metrics.disqueDisponible')}
                            valeur={formaterOctets(donnees.avg_disk_available_bytes)}
                            scheme={scheme}
                        />
                        <StatLineOs
                            label={t('admin.os_metrics.utilisationDisque')}
                            valeur={formaterPourcent(pctDisqueUtilise)}
                            scheme={scheme}
                        />
                    </PanneauCollapsable>

                    <PanneauCollapsable
                        titre={t('admin.os_metrics.echantillons')}
                        sousTitre={sousTitrePeriode}
                        ouvertParDefaut={false}
                        onOuvert={ouvrir}
                    >
                        <StatLineOs
                            label={t('admin.os_metrics.nbEchantillons')}
                            valeur={formaterNombre(donnees.sample_count)}
                            scheme={scheme}
                        />
                    </PanneauCollapsable>
                </ScrollView>
            )}

            {/* Voile de chargement */}
            {enChargement && <VoileEnvoi />}
        </View>
    )
}

/** Graphique de ligne CPU dessiné avec react-native-svg. */
function GraphiqueCpu({ points, maxValue, width, height, colors }: {
    points: number[]
    maxValue: number
    width: number
    height: number
    colors: { text: string; muted: string; secondary: string }
}) {
    if (!points || points.length === 0) return null

    const padding = { left: 30, right: 10, top: 10, bottom: 30 }
    const plotW = width - padding.left - padding.right
    const plotH = height - padding.top - padding.bottom
    const stepX = points.length > 1 ? plotW / (points.length - 1) : 0

    // Normalise les valeurs entre 0 et 1
    const normalized = points.map((v) => Math.min(maxValue, Math.max(0, v)) / maxValue)

    // Construit le path de la ligne
    let path = ''
    normalized.forEach((y, i) => {
        console.log({y, i})
        const x = padding.left + i * stepX
        const yPos = padding.top + plotH - y * plotH
        if (i === 0) path += `M ${x} ${yPos}`
        else path += ` L ${x} ${yPos}`
    })

    // Détermine le nombre de décimales nécessaires pour afficher les labels Y
    // de façon lisible (ex: 0.004 pour des petites valeurs, 100 pour des grandes).
    const getDecimals = (val: number) => {
        if (val >= 10) return 0
        if (val >= 1) return 1
        if (val >= 0.1) return 2
        if (val >= 0.01) return 3
        return 4
    }
    const decimals = getDecimals(maxValue)

    // Axe Y : valeurs max, milieu, 0
    const yLabels = [0, maxValue / 2, maxValue]

    return (
        <Svg width={width} height={height}>
            {/* Ligne de fond (zéro) */}
            <Line
                x1={padding.left}
                y1={padding.top + plotH}
                x2={padding.left + plotW}
                y2={padding.top + plotH}
                stroke={colors.muted}
                strokeWidth={1}
                strokeDasharray="4,4"
            />
            {/* Courbe CPU */}
            <Path d={path} stroke={colors.secondary} strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
            {/* Points */}
            {normalized.map((y, i) => {
                const x = padding.left + i * stepX
                const yPos = padding.top + plotH - y * plotH
                return (
                    <Circle key={i} cx={x} cy={yPos} r={3} fill={colors.secondary} />
                )
            })}
            {/* Labels Y */}
            {yLabels.map((val) => {
                const yPos = padding.top + plotH - (val / maxValue) * plotH
                return (
                    <G key={`yl-${val}`}>
                        <SvgText x={padding.left - 6} y={yPos + 4} fontSize={9} fill={colors.muted} textAnchor="end">
                            {val.toFixed(decimals)}
                        </SvgText>
                        <Line x1={padding.left - 4} y1={yPos} x2={padding.left} y2={yPos} stroke={colors.muted} strokeWidth={1} />
                    </G>
                )
            })}
            {/* Labels X (dates) */}
            {points.map((_, i) => {
                if (i === 0 || i === points.length - 1 || i % Math.ceil(points.length / 4) === 0) {
                    const x = padding.left + i * stepX
                    return (
                        <SvgText key={`xl-${i}`} x={x} y={height - 6} fontSize={9} fill={colors.muted} textAnchor="middle">
                            {i === 0 ? 'début' : i === points.length - 1 ? 'fin' : ''}
                        </SvgText>
                    )
                }
                return null
            })}
        </Svg>
    )
}

/** Ligne stat simple (label + valeur) réutilisée dans les panneaux OS. */
function StatLineOs({ label, valeur, scheme }: { label: string; valeur: string; scheme: 'light' | 'dark' }) {
    const { colors } = usePalette()
    const { fonts } = useFont()

    const s = StyleSheet.create({
        racine: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingVertical: 7,
            paddingHorizontal: 10,
            borderRadius: 8,
            backgroundColor: colors.card,
            marginBottom: 4,
        },
        label: { color: colors.muted, fontFamily: fonts.body, fontSize: 13, flex: 1 },
        valeur: { color: colors.text, fontFamily: fonts.number, fontSize: 13 },
    })

    return (
        <View style={s.racine}>
            <Text style={s.label} numberOfLines={1}>
                {label}
            </Text>
            <Text style={s.valeur}>{valeur}</Text>
        </View>
    )
}
