import Ionicons from '@react-native-vector-icons/ionicons'
import RNDateTimePicker from '@react-native-community/datetimepicker'
import { DateTime } from 'luxon'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native'

import ConfirmationEnvoi from '@/components/confirmationEnvoi'
import { useFont } from '@/contextes/contexteFont'
import { useMembre } from '@/contextes/contexteMembre'
import { usePalette } from '@/contextes/contextePalette'
import ceilBy5 from '@/functions/ceilBy5'
import { convertirTimestampDateLongue, convertirTimestampHeure } from '@/functions/convertirTimestamp'
import { Creneau, creneauDepuisPlage } from '@/hooks/useReportEvenement'

type Props = {
    /** The event's current time: the default start, and the duration kept. */
    plageActuelle: { debut: DateTime, fin: DateTime }
    /** The creator moves the event (`peut_deplacer`); an invitee who hasn't accepted yet proposes. */
    deplacement: boolean
    /** Being sent (spinner). */
    enCours: boolean
    /** "Tue 12 Nov from 14:00 to 15:00" (useReportEvenement). */
    plage: (debut: string, fin: string) => string
    /** useReportEvenement's envoyerCreneau: whether it was sent. */
    onEnvoyer: (creneau: Creneau) => Promise<boolean>
}

/**
 * "Propose another time" in the event's management view: a date and a time (native
 * pickers, in the member's timezone), the event's duration kept, sent right there —
 * through the same request as the common free slots (useReportEvenement's
 * envoyerCreneau): an invitee who hasn't accepted yet proposes it (the others vote; an
 * accepted participant doesn't get this, the API's `peut_proposer`), the creator moves the event
 * (the invitees confirm again). Confirmed in place (ConfirmationEnvoi).
 *
 * @author Philip — proposing a postponement from the event's management view
 * @param {Props} props
 * @returns {JSX.Element}
 */
export default function SelecteurReport({ plageActuelle, deplacement, enCours, plage, onEnvoyer }: Props) {
    const { t } = useTranslation('events')
    const { colors } = usePalette()
    const { fonts } = useFont()
    const { membre } = useMembre()

    // The member's timezone when it is a real one (the pickers show it), else the device's.
    const fuseau = membre?.timezone && DateTime.local().setZone(membre.timezone).isValid ? membre.timezone : undefined
    const versFuseau = (d: DateTime) => (fuseau ? d.setZone(fuseau) : d)

    const [ouvert, setOuvert] = useState(false)
    const [debut, setDebut] = useState<DateTime>(() => versFuseau(plageActuelle.debut))
    // Android shows each picker as a dialog: one flag each (iOS: always shown, inline).
    const [dateVisible, setDateVisible] = useState(false)
    const [heureVisible, setHeureVisible] = useState(false)

    const dureeMs = Math.max(0, plageActuelle.fin.toMillis() - plageActuelle.debut.toMillis())
    const fin = debut.plus({ milliseconds: dureeMs })
    // Same format as GET /postpone's slots: UTC ISO without offset.
    const creneau: Creneau = creneauDepuisPlage(debut, fin)

    const passe = debut <= DateTime.now()
    const memePlage = debut.toMillis() === plageActuelle.debut.toMillis()
    const avertissement = passe ? t('postpone.futureOnly') : memePlage ? t('postpone.sameTime') : null

    // Android: the dialog closes by itself, chosen or dismissed (onDismiss).
    const fermerDialogues = () => {
        setDateVisible(false)
        setHeureVisible(false)
    }

    const choisirDate = (_: unknown, date: Date) => {
        if (Platform.OS === 'android') setDateVisible(false)
        const jour = versFuseau(DateTime.fromJSDate(date))
        setDebut(debut.set({ year: jour.year, month: jour.month, day: jour.day }))
    }

    const choisirHeure = (_: unknown, date: Date) => {
        if (Platform.OS === 'android') setHeureVisible(false)
        const heure = ceilBy5(versFuseau(DateTime.fromJSDate(date)))
        setDebut(debut.set({ hour: heure.hour, minute: heure.minute, second: 0, millisecond: 0 }))
    }

    const envoyer = async () => {
        if (await onEnvoyer(creneau)) setOuvert(false)
    }

    const s = StyleSheet.create({
        entete: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
        titre: { color: colors.text, fontFamily: fonts.title, fontSize: 16 },
        contenu: { gap: 8 },
        selecteurs: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
        bouton: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            borderWidth: 1,
            borderRadius: 8,
            borderColor: colors.border,
            backgroundColor: colors.primary,
            paddingVertical: 6,
            paddingHorizontal: 10,
        },
        texteBouton: { color: colors.text, fontFamily: fonts.number, fontSize: 15 },
        apercu: { color: colors.text, fontFamily: fonts.body, fontSize: 14 },
        aide: { color: colors.muted, fontFamily: fonts.body, fontSize: 12 },
        avertissement: { color: colors.warning, fontFamily: fonts.body, fontSize: 13 },
    })

    // Shared by both platforms' pickers.
    const proprietes = {
        value: debut.toJSDate(),
        ...(fuseau ? { timeZoneName: fuseau } : {}),
        onDismiss: fermerDialogues,
        ...(Platform.OS === 'ios' ? { accentColor: colors.text } : {}),
    }

    return (
        <View style={s.contenu}>
            <TouchableOpacity style={s.entete} onPress={() => setOuvert((o) => !o)} accessibilityRole="button" accessibilityState={{ expanded: ouvert }}>
                <Text style={s.titre}>{t(deplacement ? 'postpone.moveTitle' : 'postpone.proposeTitle')}</Text>
                <Ionicons name={ouvert ? 'chevron-up' : 'chevron-down'} size={20} color={colors.text} />
            </TouchableOpacity>
            {ouvert && (
                <>
                    <View style={s.selecteurs}>
                        {Platform.OS === 'android' ? (
                            <>
                                <TouchableOpacity style={s.bouton} onPress={() => setDateVisible(true)} disabled={enCours} accessibilityRole="button" accessibilityLabel={t('postpone.date')}>
                                    <Ionicons name="calendar-outline" size={16} color={colors.text} />
                                    <Text style={s.texteBouton}>{convertirTimestampDateLongue(debut)}</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={s.bouton} onPress={() => setHeureVisible(true)} disabled={enCours} accessibilityRole="button" accessibilityLabel={t('postpone.time')}>
                                    <Ionicons name="time-outline" size={16} color={colors.text} />
                                    <Text style={s.texteBouton}>{convertirTimestampHeure(debut)}</Text>
                                </TouchableOpacity>
                                {dateVisible && (
                                    <RNDateTimePicker {...proprietes} mode="date" display="calendar" minimumDate={DateTime.now().startOf('day').toJSDate()} onValueChange={choisirDate} />
                                )}
                                {heureVisible && (
                                    <RNDateTimePicker {...proprietes} mode="time" display="spinner" is24Hour minuteInterval={5} onValueChange={choisirHeure} />
                                )}
                            </>
                        ) : (
                            <>
                                <RNDateTimePicker {...proprietes} mode="date" display="default" minimumDate={DateTime.now().startOf('day').toJSDate()} onValueChange={choisirDate} />
                                <RNDateTimePicker {...proprietes} mode="time" display="default" is24Hour minuteInterval={5} onValueChange={choisirHeure} />
                            </>
                        )}
                    </View>
                    <Text style={s.apercu}>{plage(creneau.debut, creneau.fin)}</Text>
                    <Text style={s.aide}>{t('postpone.keepsDuration')}</Text>
                    {!!avertissement && <Text style={s.avertissement}>{avertissement}</Text>}
                    <ConfirmationEnvoi
                        libelle={t(deplacement ? 'postpone.move' : 'postpone.propose')}
                        icone={deplacement ? 'swap-horizontal' : undefined}
                        question={t(deplacement ? 'postpone.confirmMove' : 'postpone.confirmPropose', { plage: plage(creneau.debut, creneau.fin) })}
                        desactive={!!avertissement}
                        enCours={enCours}
                        onConfirmer={envoyer}
                    />
                </>
            )}
        </View>
    )
}
