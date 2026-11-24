import Ionicons from '@react-native-vector-icons/ionicons'
import { router } from 'expo-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'

import TextInputAbs from '@/abstractions/textInputAbs'
import ToastAbs from '@/abstractions/toastAbs'
import ModalBase from '@/components/modalBase'
import Spinner from '@/components/spinner'
import { toastTypes } from '@/constants/toastConfig'
import { useAPI } from '@/contextes/contexteAPI'
import { useFont } from '@/contextes/contexteFont'
import { usePalette } from '@/contextes/contextePalette'
import catcher from '@/functions/catcher'
import { LONGUEUR_MIN_MDP, motDePasseValide, verifierMotDePasse } from '@/functions/reglesMotDePasse'

/**
 * Changing one's password, opened from the profile editing (user story 50): the current
 * password, the new one (with the sign-up screen's rules, checked as it's typed) and its
 * confirmation, sent to PATCH /membres/mot_de_passe.
 * - wrong current password: an error, nothing changed;
 * - new one = current one: "all good, nothing changed" (the API runs nothing);
 * - otherwise: changed, and the API emails a confirmation with an "it wasn't me" link.
 * The result is said in the modal itself (its toast would vanish with the modal's route).
 *
 * @author Philip — user story 50 (changing one's password)
 * @returns {JSX.Element}
 */
export default function ChangerMotDePasse() {
    const { t } = useTranslation('profile')
    const { colors } = usePalette()
    const { fonts } = useFont()
    const { api } = useAPI()

    const [ancien, setAncien] = useState('')
    const [nouveau, setNouveau] = useState('')
    const [confirmation, setConfirmation] = useState('')
    // The three fields shown in clear.
    const [visibles, setVisibles] = useState(false)
    const [envoi, setEnvoi] = useState(false)
    // Answered: whether the password really changed (else it was already that one).
    const [modifie, setModifie] = useState<boolean | null>(null)

    const regles = verifierMotDePasse(nouveau)
    // Same as the current one: allowed whatever the rules (the API answers "nothing
    // changed"); an older password may not follow today's rules.
    const identique = nouveau.length > 0 && nouveau === ancien
    const concordent = confirmation.length > 0 && confirmation === nouveau
    const peutEnvoyer = !!ancien && concordent && (identique || motDePasseValide(nouveau)) && !envoi

    const envoyer = async () => {
        if (!peutEnvoyer) return
        setEnvoi(true)
        try {
            const reponse = await api.patch('/membres/mot_de_passe', { ancien, nouveau })
            setModifie(reponse.data?.modifie !== false)
        } catch (error: any) {
            if (error?.response?.status === 403) {
                ToastAbs.show({ type: toastTypes.error, text1: t('password.failedTitle'), text2: t('password.wrongCurrent'), position: 'top' })
            } else {
                catcher(error, t('password.failedTitle'))
            }
        } finally {
            setEnvoi(false)
        }
    }

    const s = StyleSheet.create({
        contenu: { flex: 1, width: '100%', minHeight: 0 },
        titre: { color: colors.text, fontFamily: fonts.title, fontSize: 20, textAlign: 'center', paddingVertical: 8 },
        defilement: { paddingHorizontal: 4, paddingTop: 4, paddingBottom: 24, gap: 6 },
        etiquette: { color: colors.muted, fontFamily: fonts.body, marginTop: 8 },
        champ: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 12, color: colors.text, fontFamily: fonts.body },
        regle: { flexDirection: 'row', alignItems: 'center', gap: 6 },
        texteRegle: { fontFamily: fonts.body, fontSize: 13 },
        afficher: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingVertical: 6 },
        texteAfficher: { color: colors.muted, fontFamily: fonts.body, fontSize: 14 },
        bouton: {
            marginTop: 12,
            height: 48,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: colors.secondary,
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'row',
            gap: 8,
        },
        texteBouton: { color: colors.text, fontFamily: fonts.title, fontSize: 15 },
        resultat: { alignItems: 'center', gap: 8, paddingHorizontal: 8, paddingTop: 16 },
        texteResultat: { color: colors.text, fontFamily: fonts.body, fontSize: 15, textAlign: 'center' },
    })

    /** A rule of the new password, green once met. */
    const ligneRegle = (respectee: boolean, texte: string) => (
        <View style={s.regle} key={texte}>
            <Ionicons name={respectee ? 'checkmark-circle' : 'ellipse-outline'} size={16} color={respectee ? colors.success : colors.muted} />
            <Text style={[s.texteRegle, { color: respectee ? colors.success : colors.muted }]}>{texte}</Text>
        </View>
    )

    // One sheet for the form and its result: swapping ModalBase would replay its opening.
    return (
        <ModalBase>
            {modifie !== null ? (
                <View style={s.contenu}>
                    <Text style={s.titre}>{t(modifie ? 'password.changedTitle' : 'password.sameTitle')}</Text>
                    <View style={s.resultat}>
                        <Ionicons name="checkmark-circle" size={44} color={colors.success} />
                        <Text style={s.texteResultat}>{t(modifie ? 'password.changedMessage' : 'password.sameMessage')}</Text>
                    </View>
                    <TouchableOpacity style={s.bouton} onPress={() => router.back()} accessibilityRole="button">
                        <Text style={s.texteBouton}>{t('password.done')}</Text>
                    </TouchableOpacity>
                </View>
            ) : (
            <View style={s.contenu}>
                <Text style={s.titre}>{t('password.title')}</Text>
                <ScrollView contentContainerStyle={s.defilement} keyboardShouldPersistTaps="handled">
                    <Text style={s.etiquette}>{t('password.current')}</Text>
                    <TextInputAbs
                        value={ancien}
                        onChangeText={setAncien}
                        style={s.champ}
                        secureTextEntry={!visibles}
                        autoComplete="current-password"
                        textContentType="password"
                        autoCapitalize="none"
                        autoCorrect={false}
                        placeholder={t('password.current')}
                    />

                    <Text style={s.etiquette}>{t('password.new')}</Text>
                    <TextInputAbs
                        value={nouveau}
                        onChangeText={setNouveau}
                        style={s.champ}
                        secureTextEntry={!visibles}
                        autoComplete="new-password"
                        textContentType="newPassword"
                        autoCapitalize="none"
                        autoCorrect={false}
                        placeholder={t('password.new')}
                    />
                    {identique ? (
                        <Text style={[s.texteRegle, { color: colors.muted }]}>{t('password.sameHint')}</Text>
                    ) : (
                        <>
                            {ligneRegle(regles.longueur, t('password.ruleLength', { length: LONGUEUR_MIN_MDP }))}
                            {ligneRegle(regles.special, t('password.ruleSpecial'))}
                            {ligneRegle(regles.majMin, t('password.ruleCase'))}
                        </>
                    )}

                    <Text style={s.etiquette}>{t('password.confirm')}</Text>
                    <TextInputAbs
                        value={confirmation}
                        onChangeText={setConfirmation}
                        style={s.champ}
                        secureTextEntry={!visibles}
                        autoComplete="new-password"
                        textContentType="newPassword"
                        autoCapitalize="none"
                        autoCorrect={false}
                        placeholder={t('password.confirm')}
                    />
                    {confirmation.length > 0 && ligneRegle(concordent, t(concordent ? 'password.match' : 'password.noMatch'))}

                    <TouchableOpacity
                        style={s.afficher}
                        onPress={() => setVisibles((v) => !v)}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: visibles }}
                    >
                        <Ionicons name={visibles ? 'eye-off-outline' : 'eye-outline'} size={18} color={colors.muted} />
                        <Text style={s.texteAfficher}>{t(visibles ? 'password.hide' : 'password.show')}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[s.bouton, !peutEnvoyer && { opacity: 0.5 }]}
                        onPress={envoyer}
                        disabled={!peutEnvoyer}
                        accessibilityRole="button"
                        accessibilityState={{ disabled: !peutEnvoyer, busy: envoi }}
                    >
                        {envoi
                            ? <Spinner size={20} color={colors.text} />
                            : <Ionicons name="key-outline" size={18} color={colors.text} />}
                        <Text style={s.texteBouton}>{t('password.submit')}</Text>
                    </TouchableOpacity>
                </ScrollView>
            </View>
            )}
        </ModalBase>
    )
}
