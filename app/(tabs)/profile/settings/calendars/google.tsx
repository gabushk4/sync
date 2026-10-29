import Container from '@/abstractions/container';
import ToastAbs from '@/abstractions/toastAbs';
import CalendarOptions from '@/components/calendarOptions';
import ModalBase from '@/components/modalBase';
import Radius from '@/constants/Radius';
import { toastTypes } from '@/constants/toastConfig';
import { useAPI } from '@/contextes/contexteAPI';
import { useFont } from '@/contextes/contexteFont';
import { usePalette } from '@/contextes/contextePalette';
import { useAgendaImport } from '@/hooks/useAgendaImport';
import catcher from '@/functions/catcher';
import {
    type CalendrierGoogle,
    chargerCalendriersGoogle,
    chargerComptesGoogle,
    chargerConfigGoogle,
    connecterCompteGoogle,
    deconnecterCompteGoogle,
    modifierCalendriersGoogle,
    resynchroniserCalendrierGoogle,
    selectionnerCalendriersGoogle,
} from '@/functions/googleAgenda';
import { demanderCodeGoogle } from '@/functions/googleOAuth';
import Icon from '@react-native-vector-icons/ionicons';
import { JSX, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Modal, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, useColorScheme, View } from 'react-native';

import { convertToWhen } from '@/functions/convertirTimestamp';
import log from '@/functions/log';
import RenderCalendarColor from '@/functions/renderCalendarColor';
import { convertUTCToLocal } from '@/functions/convertirUTCenLocal';

/**
 * Écran « Google Agenda » : linker un compte Google, choisir les calendriers à
 * importer, puis suivre l'import en temps réel.
 *
 * Le serveur reste maître de la liaison (il détient le secret OAuth) : l'app
 * récupère un code d'autorisation, l'API l'échange et chiffre le jeton.
 * La sélection passe par PUT /calendriers/google, qui est idempotent : le
 * tableau envoyé fait foi, un calendrier non envoyé est désactivé et ses événements
 * supprimés de façon soft.
 *
 * @returns {JSX.Element} Écran de gestion des calendriers Google.
 * @author Gabriel Pereira Levesque | S2 2026 - US 19
 */
export default function GoogleAgendaScreen() : JSX.Element  {
    const { t } = useTranslation('calendar');
    const { api } = useAPI();
    const { colors } = usePalette();
    const { fonts } = useFont();
    const scheme = useColorScheme();

    const [selectedCalendar, setSelectedCalendar] = useState<CalendrierGoogle>();
    const [optionsModalVisible, setOptionsModalVisible] = useState<boolean>(false);
    const {
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
        mettreAJourCalendrier,
    } = useAgendaImport({
        api,
        prefixe: 'google',
        chargerComptesEtCalendriers: async () => {
            const [listeComptes, reponse] = await Promise.all([
                chargerComptesGoogle(api),
                chargerCalendriersGoogle(api),
            ]);
            return { comptes: listeComptes, calendriers: reponse.calendriers };
        },
        selectionner: (idsExternes) => selectionnerCalendriersGoogle(api, idsExternes),
        relancerImport: (idPublique) => resynchroniserCalendrierGoogle(api, idPublique),
        deconnecterCompte: (idPublique) => deconnecterCompteGoogle(api, idPublique),
        obtenirCode: async () => {
            const plateforme = Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : undefined;
            const config = await chargerConfigGoogle(api, plateforme);
            const code = await demanderCodeGoogle(config);
            return code ? { ...code, client_id: config.client_id } : null;
        },
        connecterCompte: (api, code, codeVerifier, clientId) =>
            connecterCompteGoogle(api, code, codeVerifier, clientId),
    });

    const styles = StyleSheet.create({
        content: { paddingBottom: 32 },
        heading: { color: colors.text, fontFamily: fonts.title, fontSize: 22, marginVertical: 8 },
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
        rowDisabled: { opacity: 0.5 },
        rowText: { flex: 1, color: colors.text, fontFamily: fonts.body, fontSize: 16, justifyContent:'center' },
        rowSubText: { color: colors.muted, fontFamily: fonts.body, fontSize: 13, marginTop: 2 },
        syncBadge: {
            maxWidth: 132,
            paddingHorizontal: 8,
            paddingVertical: 4,
            borderRadius: Radius.sm,
            backgroundColor: colors.primary,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
        },
        syncBadgeText: { color: colors.muted, fontFamily: fonts.body, fontSize: 11 },
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
        actionSecondary: {
            minHeight: 46,
            paddingHorizontal: 14,
            borderRadius: Radius.md,
            borderWidth: 1,
            borderColor: colors.border,
            justifyContent: 'center',
            alignItems: 'center',
            flexDirection: 'row',
            gap: 8,
        },
        actionText: { color: colors.text, fontFamily: fonts.title, fontSize: 17 },
        actionTextSecondary: { color: colors.secondary, fontFamily: fonts.title, fontSize: 15 },
        disabled: { opacity: 0.5 },
        center: { paddingVertical: 24, alignItems: 'center' },
        badge: {
            paddingHorizontal: 8,
            paddingVertical: 2,
            borderRadius: Radius.sm,
            fontFamily: fonts.body,
            fontSize: 12,
            overflow: 'hidden',
        },
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

    const enregistrerModificationsCalendrier = async (
        calendrier: CalendrierGoogle,
        modifications: Partial<CalendrierGoogle>,
    ) => {
        if (calendrier.id_publique) mettreAJourCalendrier(calendrier.id_publique, modifications);

        if (calendrier.id_publique) {
            try {
                await modifierCalendriersGoogle(api, calendrier.id_publique, modifications)
                ToastAbs.show({
                    type: toastTypes.success,
                    text1: 'modifié',
                    text2: `modifications: ${Object.keys(modifications).join(',')}`
                })
            } catch (err) {
                log('impossible de modifier le calendrier', calendrier.nom, err)
                catcher(err, 'modification impossible')
            }
        }
            
    };

    const fermerOptionsCalendrier = () => {
        setOptionsModalVisible(false);
    };

    const comptesActifs = comptes.filter(c => c.statut === 'actif');

    return (
        <Container style={{ backgroundColor: colors.background, paddingVertical:8, paddingHorizontal:16 }}>
            <ScrollView contentContainerStyle={styles.content}>
                <Text style={styles.body}>{t('google.description')}</Text>

                {/* Comptes liés */}
                <Text style={styles.section}>{t('google.accountsSection')}</Text>

                {chargement ? (
                    <View style={styles.center}><ActivityIndicator color={colors.secondary} /></View>
                ) : comptes.length === 0 ? (
                    <Text style={styles.body}>{t('google.noAccount')}</Text>
                ) : (
                    comptes.map(compte => (
                        <View key={compte.id} style={styles.row}>
                            <Icon
                                name={compte.statut === 'actif' ? 'logo-google' : 'warning-outline'}
                                size={22}
                                color={compte.statut === 'actif' ? colors.secondary : colors.error}
                            />
                            <View style={styles.rowText}>
                                <Text numberOfLines={1} style={[styles.body, {color:colors.text}]}>{compte.courriel ?? t('google.unknownAccount')}</Text>
                                {compte.a_reconnecter ? (
                                    <Text style={[styles.rowSubText, { color: colors.error }]}>
                                        {t('google.needsReconnect')}
                                    </Text>
                                ) : null}
                            </View>
                            <TouchableOpacity
                                accessibilityRole="button"
                                accessibilityState={{ disabled: occupe }}
                                disabled={occupe}
                                onPress={() => {
                                    compte.statut === 'actif'
                                        ? deconnecter(compte)
                                        : connecter()
                                }}
                            >
                                <Text style={[styles.actionTextSecondary, { color: compte.statut === 'actif' ? colors.error : colors.success }]}>
                                    {compte.statut === 'actif' ? t('google.disconnect') : t('google.connectShort')}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    ))
                )}

                <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityState={{ disabled: occupe }}
                    disabled={occupe}
                    style={[styles.action, { marginTop: 12 }, occupe && styles.disabled]}
                    onPress={connecter}
                >
                    {action === 'connexion'
                        ? <ActivityIndicator color={colors.text} />
                        : (
                            <>
                                <Icon name="logo-google" size={20} color={colors.text} />
                                <Text style={styles.actionText}>{t('google.connect')}</Text>
                            </>
                        )}
                </TouchableOpacity>

                {/* Calendriers */}
                {comptesActifs.length > 0 ? (
                    <>
                        <View style={styles.separator} />
                        <Text style={styles.section}>{t('google.calendarsSection')}</Text>
                        <Text style={styles.body}>{t('google.calendarsDescription')}</Text>

                        {calendriers.length === 0 ? (
                            <Text style={[styles.body, { marginTop: 12 }]}>{t('google.noCalendars')}</Text>
                        ) : (
                            <>
                                <TouchableOpacity
                                    accessibilityRole="button"
                                    style={{ alignSelf: 'flex-start', paddingVertical: 8 }}
                                    onPress={toutBasculer}
                                >
                                    <Text style={[styles.body, { color: colors.secondary }]}>
                                        {toutCoche ? t('google.selectNone') : t('google.selectAll')}
                                    </Text>
                                </TouchableOpacity>

                                {calendriers.map(calendrier => {
                                    const coche = selection.has(calendrier.id_externe);
                                    const indisponible = !calendrier.disponible;
                                    return (
                                        <View key={`${calendrier.id_compte}-${calendrier.id_externe}`}>
                                            <TouchableOpacity
                                                accessibilityRole="checkbox"
                                                accessibilityState={{ checked: coche, disabled: indisponible }}
                                                disabled={indisponible || occupe}
                                                style={[styles.row, indisponible && styles.rowDisabled, { backgroundColor: RenderCalendarColor(calendrier.couleur ?? 275, scheme) }]}
                                                onPress={() => basculer(calendrier.id_externe)}
                                            >
                                                <Icon
                                                    name={coche ? 'checkbox' : 'square-outline'}
                                                    size={22}
                                                    color={coche ? colors.secondary : colors.muted}
                                                />
                                                <View style={styles.rowText}>
                                                    <Text numberOfLines={1} style={styles.rowText}>{calendrier.nom}</Text>
                                                    {calendrier.suggere ? (
                                                        <Text style={styles.rowSubText}>{t('google.suggested')}</Text>
                                                    ) : null}
                                                    {indisponible ? (
                                                        <Text style={styles.rowSubText}>{t('google.linkedElsewhere')}</Text>
                                                    ) : null}
                                                </View>
                                                {calendrier.derniere_synchro ? (
                                                    <View style={styles.syncBadge}>
                                                        <Icon
                                                            name='time'
                                                            color={colors.secondary}
                                                            size={16}
                                                        />
                                                        <Text numberOfLines={1} style={styles.syncBadgeText}>
                                                            {convertToWhen(convertUTCToLocal(calendrier.derniere_synchro))}
                                                        </Text>
                                                    </View>
                                                ) : null}
                                                {calendrier.actif && calendrier.id_publique &&
                                                    <TouchableOpacity
                                                        onPress={() => {
                                                            setSelectedCalendar(calendrier);
                                                            setOptionsModalVisible(true)
                                                        }}
                                                    >
                                                        <Icon name='ellipsis-horizontal' size={24} color={colors.secondary} />
                                                    </TouchableOpacity>
                                                }
                                            </TouchableOpacity>
                                            {calendrier.actif && calendrier.id_publique ? (
                                                <TouchableOpacity
                                                    accessibilityRole="button"
                                                    accessibilityState={{ disabled: occupe }}
                                                    disabled={occupe}
                                                    style={[styles.actionSecondary, { marginBottom: 8 }]}
                                                    onPress={() => resynchroniser(calendrier)}
                                                >
                                                    <Icon name="refresh-outline" size={18} color={colors.secondary} />
                                                    <Text style={styles.actionTextSecondary}>{t('google.resync')}</Text>
                                                </TouchableOpacity>
                                            ) : null}
                                        </View>
                                    );
                                })}

                                <TouchableOpacity
                                    accessibilityRole="button"
                                    accessibilityState={{ disabled: occupe }}
                                    disabled={occupe}
                                    style={[styles.action, { marginTop: 8 }, occupe && styles.disabled]}
                                    onPress={enregistrer}
                                >
                                    {action === 'enregistrement'
                                        ? <ActivityIndicator color={colors.text} />
                                        : <Text style={styles.actionText}>{t('google.save')}</Text>}
                                </TouchableOpacity>
                                <Text style={styles.hint}>{t('google.saveHint')}</Text>
                            </>
                        )}
                    </>
                ) : null}

                {/* ---------- Progression de l'import ---------- */}
                {progression ? (
                    <View style={styles.progress}>
                        <Text style={styles.progressTitle}>{t('google.importTitle')}</Text>
                        {progression.jobs.length === 0 ? (
                            <View style={styles.progressRow}>
                                <ActivityIndicator color={colors.secondary} />
                                <Text style={styles.progressText}>{t('google.importStarting')}</Text>
                            </View>
                        ) : (
                            progression.jobs.map(job => (
                                <View key={job.id} style={styles.progressRow}>
                                    {job.done
                                        ? <Icon
                                            name={job.success === false ? 'close-circle' : 'checkmark-circle'}
                                            size={20}
                                            color={job.success === false ? colors.error : colors.success}
                                        />
                                        : <ActivityIndicator size="small" color={colors.secondary} />}
                                    <Text style={styles.progressText}>
                                        {job.label ?? t('google.untitledCalendar')}
                                    </Text>
                                </View>
                            ))
                        )}
                        <Text style={styles.hint}>
                            {t('google.importProgress', { done: progression.done, total: progression.total })}
                        </Text>
                    </View>
                ) : null}
            </ScrollView>
            {/* Options Modal: il est possible de: 
            
                - modifier la couleur du calendrier ainsi que des blocs evenementiels liés
                - resyncroniser le calendrier */}
            <Modal
                visible={optionsModalVisible}
                onRequestClose={fermerOptionsCalendrier}
                transparent={true}
            >
                <ModalBase canDismiss={false} onDismiss={fermerOptionsCalendrier}>
                    <CalendarOptions
                        selectedCalendar={selectedCalendar}
                        onSave={enregistrerModificationsCalendrier}
                        onClose={fermerOptionsCalendrier}
                    />
                </ModalBase>
            </Modal>
        </Container>
    );
}
