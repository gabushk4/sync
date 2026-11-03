import Container from '@/abstractions/container';
import CalendarOptions from '@/components/calendarOptions';
import ExternalCalendarRow from '@/components/ExternalCalendarRow';
import ModalBase from '@/components/modalBase';
import Radius from '@/constants/Radius';
import { useFont } from '@/contextes/contexteFont';
import { usePalette } from '@/contextes/contextePalette';
import type { CalendrierImport, CompteImport, ProgressionImport } from '@/functions/imports';
import type { ActionCompte } from '@/hooks/useAgendaImport';
import Icon from '@react-native-vector-icons/ionicons';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type Props<TCompte extends CompteImport, TCalendrier extends CalendrierImport> = {
    fournisseur: 'google' | 'outlook';
    chargement: boolean;
    comptes: TCompte[];
    calendriers: TCalendrier[];
    selection: Set<string>;
    action: ActionCompte;
    progression: ProgressionImport | null;
    occupe: boolean;
    toutCoche: boolean;
    basculer: (idExterne: string) => void;
    toutBasculer: () => void;
    enregistrer: () => Promise<void>;
    resynchroniser: (calendrier: TCalendrier) => Promise<void>;
    deconnecter: (compte: TCompte) => Promise<void>;
    connecter: () => Promise<void>;
    enregistrerPreferences?: (calendrier: TCalendrier, modifications: Partial<TCalendrier>) => Promise<void>;
};

export default function ExternalCalendarForm<TCompte extends CompteImport, TCalendrier extends CalendrierImport>(props: Props<TCompte, TCalendrier>) {
    const {
        fournisseur,
        chargement,
        comptes,
        calendriers,
        selection,
        action,
        progression,
        occupe,
        toutCoche,
        basculer,
        toutBasculer,
        enregistrer,
        resynchroniser,
        deconnecter,
        connecter,
        enregistrerPreferences,
    } = props;
    const [calendrierOptions, setCalendrierOptions] = useState<TCalendrier>();
    const { t } = useTranslation('calendar');
    const { colors } = usePalette();
    const { fonts } = useFont();
    const prefix = fournisseur;
    const comptesActifs = comptes.filter(compte => compte.statut === 'actif');
    const logo = fournisseur === 'google' ? 'logo-google' : 'logo-microsoft';

    const styles = StyleSheet.create({
        content: { paddingBottom: 32 },
        body: { color: colors.muted, fontFamily: fonts.body, fontSize: 16, lineHeight: 23 },
        section: { marginTop: 28, marginBottom: 6, color: colors.text, fontFamily: fonts.title, fontSize: 18 },
        row: {
            minHeight: 56,
            paddingHorizontal: 12,
            paddingVertical: 10,
            marginBottom: 8,
            borderRadius: Radius.md,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.card,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
        },
        rowText: { flex: 1, color: colors.text, fontFamily: fonts.body, fontSize: 16, justifyContent: 'center' },
        rowSubText: { color: colors.muted, fontFamily: fonts.body, fontSize: 13, marginTop: 2 },
        action: {
            minHeight: 52,
            paddingHorizontal: 16,
            borderRadius: Radius.md,
            backgroundColor: colors.secondary,
            justifyContent: 'center',
            alignItems: 'center',
            flexDirection: 'row',
            gap: 8,
        },
        actionText: { color: colors.text, fontFamily: fonts.title, fontSize: 17 },
        actionTextSecondary: { color: colors.secondary, fontFamily: fonts.title, fontSize: 15 },
        disabled: { opacity: 0.5 },
        center: { paddingVertical: 24, alignItems: 'center' },
        progress: {
            marginTop: 16,
            padding: 12,
            borderRadius: Radius.md,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.card,
        },
        progressTitle: { color: colors.text, fontFamily: fonts.title, fontSize: 16 },
        progressRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
        progressText: { flex: 1, color: colors.muted, fontFamily: fonts.body, fontSize: 15 },
        separator: { height: 1, backgroundColor: colors.border, marginTop: 28 },
        hint: { color: colors.muted, fontFamily: fonts.body, fontSize: 13, marginTop: 6 },
    });

    return (
        <>
            <Container style={{ backgroundColor: colors.background, paddingVertical: 8, paddingHorizontal: 16 }}>
                <ScrollView contentContainerStyle={styles.content}>
                    <Text style={styles.body}>{t(`${prefix}.description`)}</Text>
                    <Text style={styles.section}>{t(`${prefix}.accountsSection`)}</Text>

                    {chargement ? (
                        <View style={styles.center}><ActivityIndicator color={colors.secondary} /></View>
                    ) : comptes.length === 0 ? (
                        <Text style={styles.body}>{t(`${prefix}.noAccount`)}</Text>
                    ) : comptes.map(compte => (
                        <View key={compte.id} style={styles.row}>
                            <Icon
                                name={compte.statut === 'actif' ? logo : 'warning-outline'}
                                size={22}
                                color={compte.statut === 'actif' ? colors.secondary : colors.error}
                            />
                            <View style={styles.rowText}>
                                <Text numberOfLines={1} style={[styles.body, { color: colors.text }]}>
                                    {compte.courriel ?? t(`${prefix}.unknownAccount`)}
                                </Text>
                                {compte.a_reconnecter ? (
                                    <Text style={[styles.rowSubText, { color: colors.error }]}>{t(`${prefix}.needsReconnect`)}</Text>
                                ) : null}
                            </View>
                            <TouchableOpacity
                                accessibilityRole="button"
                                accessibilityState={{ disabled: occupe }}
                                disabled={occupe}
                                onPress={() => compte.statut === 'actif' ? deconnecter(compte) : connecter()}
                            >
                                <Text style={[styles.actionTextSecondary, { color: compte.statut === 'actif' ? colors.error : colors.success }]}>
                                    {compte.statut === 'actif' ? t(`${prefix}.disconnect`) : t(`${prefix}.connectShort`)}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    ))}

                    <TouchableOpacity
                        accessibilityRole="button"
                        accessibilityState={{ disabled: occupe }}
                        disabled={occupe}
                        style={[styles.action, { marginTop: 12 }, occupe && styles.disabled]}
                        onPress={connecter}
                    >
                        {action === 'connexion'
                            ? <ActivityIndicator color={colors.text} />
                            : <>
                                <Icon name={logo} size={20} color={colors.text} />
                                <Text style={styles.actionText}>{t(`${prefix}.connect`)}</Text>
                            </>}
                    </TouchableOpacity>

                    {comptesActifs.length > 0 ? (
                        <>
                            <View style={styles.separator} />
                            <Text style={styles.section}>{t(`${prefix}.calendarsSection`)}</Text>
                            <Text style={styles.body}>{t(`${prefix}.calendarsDescription`)}</Text>
                            {calendriers.length === 0 ? (
                                <Text style={[styles.body, { marginTop: 12 }]}>{t(`${prefix}.noCalendars`)}</Text>
                            ) : (
                                <>
                                    <TouchableOpacity
                                        accessibilityRole="button"
                                        style={{ alignSelf: 'flex-start', paddingVertical: 8 }}
                                        onPress={toutBasculer}
                                    >
                                        <Text style={[styles.body, { color: colors.secondary }]}>
                                            {toutCoche ? t(`${prefix}.selectNone`) : t(`${prefix}.selectAll`)}
                                        </Text>
                                    </TouchableOpacity>
                                    {calendriers.map(calendrier => (
                                        <ExternalCalendarRow
                                            key={`${calendrier.id_compte}-${calendrier.id_externe}`}
                                            fournisseur={fournisseur}
                                            calendrier={calendrier}
                                            selectionne={selection.has(calendrier.id_externe)}
                                            occupe={occupe}
                                            onBasculer={basculer}
                                            onResynchroniser={resynchroniser}
                                            onOptions={enregistrerPreferences ? setCalendrierOptions : undefined}
                                        />
                                    ))}
                                    <TouchableOpacity
                                        accessibilityRole="button"
                                        accessibilityState={{ disabled: occupe }}
                                        disabled={occupe}
                                        style={[styles.action, { marginTop: 8 }, occupe && styles.disabled]}
                                        onPress={enregistrer}
                                    >
                                        {action === 'enregistrement'
                                            ? <ActivityIndicator color={colors.text} />
                                            : <Text style={styles.actionText}>{t(`${prefix}.save`)}</Text>}
                                    </TouchableOpacity>
                                    <Text style={styles.hint}>{t(`${prefix}.saveHint`)}</Text>
                                </>
                            )}
                        </>
                    ) : null}

                    {progression ? (
                        <View style={styles.progress}>
                            <Text style={styles.progressTitle}>{t(`${prefix}.importTitle`)}</Text>
                            {progression.jobs.length === 0 ? (
                                <View style={styles.progressRow}>
                                    <ActivityIndicator color={colors.secondary} />
                                    <Text style={styles.progressText}>{t(`${prefix}.importStarting`)}</Text>
                                </View>
                            ) : progression.jobs.map(job => (
                                <View key={job.id} style={styles.progressRow}>
                                    {job.done
                                        ? <Icon
                                            name={job.success === false ? 'close-circle' : 'checkmark-circle'}
                                            size={20}
                                            color={job.success === false ? colors.error : colors.success}
                                        />
                                        : <ActivityIndicator size="small" color={colors.secondary} />}
                                    <Text style={styles.progressText}>{job.label ?? t(`${prefix}.untitledCalendar`)}</Text>
                                </View>
                            ))}
                            <Text style={styles.hint}>
                                {t(`${prefix}.importProgress`, { done: progression.done, total: progression.total })}
                            </Text>
                        </View>
                    ) : null}
                </ScrollView>
            </Container>
            {enregistrerPreferences ? (
                <Modal visible={Boolean(calendrierOptions)} transparent onRequestClose={() => setCalendrierOptions(undefined)}>
                    <ModalBase canDismiss={false} onDismiss={() => setCalendrierOptions(undefined)}>
                        <CalendarOptions
                            key={calendrierOptions?.id_publique ?? 'calendar-options'}
                            selectedCalendar={calendrierOptions}
                            onSave={enregistrerPreferences}
                            onClose={() => setCalendrierOptions(undefined)}
                        />
                    </ModalBase>
                </Modal>
            ) : null}
        </>
    );
}