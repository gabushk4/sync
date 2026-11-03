import React, { version as reactVersion, useEffect, useState } from 'react'
import { Dimensions, Platform, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native'
import Constants from 'expo-constants'
import * as Device from 'expo-device'
import * as Network from 'expo-network'
import Icon from '@react-native-vector-icons/ionicons'
import { router, usePathname } from 'expo-router'
import { useTranslation } from 'react-i18next'

import { useAPI } from '@/contextes/contexteAPI'
import { useFont } from '@/contextes/contexteFont'
import { usePalette } from '@/contextes/contextePalette'
import catcher from '@/functions/catcher'
import ToastAbs from '@/abstractions/toastAbs'
import { toastTypes } from '@/constants/toastConfig'
import { useSignalements } from '@/contextes/contexteSignalements'
import ModalBase from '@/components/modalBase'

type TechnicalInfo = { label: string; value: string }

/** Collects a short bug description and useful device context inside the modal route. */
export default function ReportBug() {
  const { t } = useTranslation('common')
  const { api } = useAPI()
  const { colors } = usePalette()
  const { fonts } = useFont()
  const { erreursCapturees, retirerErreursCapturees } = useSignalements()
  const pathname = usePathname()
  const [messageQuand, setMessageQuand] = useState('')
  const [messageExpl, setMessageExpl] = useState('')
  const [infos, setInfos] = useState<TechnicalInfo[]>([])
  const [erreursSelectionnees, setErreursSelectionnees] = useState<string[]>(() => erreursCapturees.slice(0, 4).map((erreur) => erreur.id))
  const idsErreursCapturees = new Set(erreursCapturees.map((erreur) => erreur.id))
  const erreursSelectionneesDisponibles = erreursSelectionnees.filter((id) => idsErreursCapturees.has(id))
  const [sending, setSending] = useState(false)
  const canSend = !!messageQuand.trim() && !!messageExpl.trim() && !sending
  useEffect(() => {
    let actif = true

    const chargerInfos = async () => {
      const screen = Dimensions.get('window')
      let connexion = t('bugReport.unknown')
      try {
        const network = await Network.getNetworkStateAsync()
        const type = network.type ?? t('bugReport.unknown')
        const etat = network.isConnected === null
          ? t('bugReport.unknown')
          : network.isConnected ? t('bugReport.connected') : t('bugReport.disconnected')
        connexion = `${type} · ${etat}`
      } catch {
        // Device/network information is optional; the member can still send a report.
      }

      const nouvellesInfos: TechnicalInfo[] = [
        { label: t('bugReport.device'), value: Device.modelName ?? t('bugReport.unknown') },
        { label: t('bugReport.os'), value: `${Device.osName ?? Platform.OS} ${Device.osVersion ?? ''}`.trim() },
        { label: t('bugReport.screen'), value: `${Math.round(screen.width)} × ${Math.round(screen.height)} dp · ${screen.scale}x` },
        { label: t('bugReport.network'), value: connexion },
        { label: t('bugReport.currentScreen'), value: pathname || t('bugReport.unknown') },
        { label: t('bugReport.appVersion'), value: Constants.expoConfig?.version ?? t('bugReport.unknown') },
        { label: t('bugReport.reactVersion'), value: reactVersion },
      ]

      if (actif) setInfos(nouvellesInfos)
    }

    void chargerInfos()
    return () => { actif = false }
  }, [pathname, t])

  const submit = async () => {
    if (!canSend) return
    setSending(true)
    const description = [
      `${t('bugReport.when')}:\n${messageQuand.trim()}`,
      `${t('bugReport.whatHappened')}:\n${messageExpl.trim()}`,
      t('bugReport.technicalInfo'),
      ...infos.map(({ label, value }) => `${label}: ${value}`),
      `${t('bugReport.reportedAt')}: ${new Date().toISOString()}`,
    ].join('\n\n')
    const erreursAJoindre = erreursCapturees.filter((erreur) => erreursSelectionneesDisponibles.includes(erreur.id)).slice(0, 4)
    const sectionsErreurs = erreursAJoindre.map((erreur, index) => [
      `${t('bugReport.caughtError')} ${index + 1} · ${erreur.horodatage}`,
      erreur.titre,
      erreur.message,
      erreur.statut ? `HTTP ${erreur.statut}` : erreur.code,
      erreur.stack?.split('\n').slice(0, 3).join('\n'),
    ].filter(Boolean).join('\n'))
    let descriptionFinale = description
    for (const section of sectionsErreurs) {
      const separateur = `\n\n${t('bugReport.caughtErrors')}:\n`
      const candidat = descriptionFinale.includes(`${t('bugReport.caughtErrors')}:`)
        ? `${descriptionFinale}\n\n${section}`
        : `${descriptionFinale}${separateur}${section}`
      if (candidat.length > 5000) break
      descriptionFinale = candidat
    }

    try {
      await api.post('/signalements/bugs', {
        description: descriptionFinale,
        app_version: Constants.expoConfig?.version ?? null,
        appareil: Device.modelName ?? null,
      })
      retirerErreursCapturees(erreursAJoindre.map((erreur) => erreur.id))
      ToastAbs.show({ type: toastTypes.success, text1: t('bugReport.successTitle'), text2: t('bugReport.successMessage') })
      router.back()
    } catch (error) {
      catcher(error, t('bugReport.submitFailed'))
    } finally {
      setSending(false)
    }
  }

  const styles = {
    titreSection: { color: colors.text, fontFamily: fonts.title, fontSize: 17 } as const,
    input: {
      minHeight: 104,
      marginTop: 8,
      padding: 12,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      color: colors.text,
      fontFamily: fonts.body,
      backgroundColor: colors.card,
    } as const,
  }

  return (
    <ModalBase>
      <View style={{ flex: 1, width: '100%', minHeight: 0 }}>
        <Text style={{ color: colors.text, fontFamily: fonts.title, fontSize: 20, textAlign: 'center', paddingVertical: 8 }}>{t('bugReport.title')}</Text>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 4, paddingTop: 8, paddingBottom: 20 }} keyboardShouldPersistTaps="handled">

        <Text style={styles.titreSection}>{t('bugReport.when')}</Text>
        <TextInput
          accessibilityLabel={t('bugReport.when')}
          value={messageQuand}
          onChangeText={setMessageQuand}
          placeholder={t('bugReport.whenPlaceholder')}
          placeholderTextColor={colors.muted}
          multiline
          maxLength={1800}
          textAlignVertical="top"
          style={styles.input}
        />

        <Text style={[styles.titreSection, { marginTop: 18 }]}>{t('bugReport.whatHappened')}</Text>
        <TextInput
          accessibilityLabel={t('bugReport.whatHappened')}
          value={messageExpl}
          onChangeText={setMessageExpl}
          placeholder={t('bugReport.whatHappenedPlaceholder')}
          placeholderTextColor={colors.muted}
          multiline
          maxLength={1800}
          textAlignVertical="top"
          style={styles.input}
        />

        <Text style={[styles.titreSection, { marginTop: 22 }]}>{t('bugReport.technicalInfo')}</Text>
        <View style={{ marginTop: 8, paddingHorizontal: 12, borderRadius: 10, backgroundColor: colors.card }}>
          {infos.map(({ label, value }, index) => (
            <View key={label} style={{ minHeight: 38, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderBottomWidth: index < infos.length - 1 ? 1 : 0, borderColor: colors.border }}>
              <Text style={{ color: colors.muted, fontFamily: fonts.body, flex: 1 }}>{label}</Text>
              <Text style={{ color: colors.text, fontFamily: fonts.body, flex: 1, textAlign: 'right' }} numberOfLines={1}>{value}</Text>
            </View>
          ))}
        </View>

        <Text style={[styles.titreSection, { marginTop: 22 }]}>{t('bugReport.caughtErrors')}</Text>
        {erreursCapturees.length === 0 ? (
          <Text style={{ marginTop: 8, color: colors.muted, fontFamily: fonts.body }}>{t('bugReport.noCaughtErrors')}</Text>
        ) : (
          <View style={{ marginTop: 8, gap: 8 }}>
            {erreursCapturees.map((erreur) => {
              const selectionnee = erreursSelectionneesDisponibles.includes(erreur.id)
              const limiteAtteinte = erreursSelectionneesDisponibles.length >= 4 && !selectionnee
              return (
                <TouchableOpacity
                  key={erreur.id}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: selectionnee, disabled: limiteAtteinte }}
                  disabled={limiteAtteinte}
                  onPress={() => setErreursSelectionnees((selection) => {
                    const valides = selection.filter((id) => idsErreursCapturees.has(id))
                    return selectionnee
                      ? valides.filter((id) => id !== erreur.id)
                      : [erreur.id, ...valides].slice(0, 4)
                  })}
                  style={{ padding: 12, borderRadius: 10, borderWidth: 1, borderColor: selectionnee ? colors.secondary : colors.border, backgroundColor: colors.card, opacity: limiteAtteinte ? 0.55 : 1 }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Icon name={selectionnee ? 'checkbox' : 'square-outline'} color={selectionnee ? colors.secondary : colors.muted} size={20} />
                    <Text style={{ color: colors.text, fontFamily: fonts.title, flex: 1 }} numberOfLines={1}>{erreur.titre}</Text>
                    <Text style={{ color: colors.muted, fontFamily: fonts.body, fontSize: 12 }}>{new Date(erreur.horodatage).toLocaleTimeString()}</Text>
                  </View>
                  <Text style={{ marginLeft: 28, marginTop: 5, color: colors.muted, fontFamily: fonts.body }} numberOfLines={2}>{erreur.message}</Text>
                  <Text style={{ marginLeft: 28, marginTop: 3, color: colors.muted, fontFamily: fonts.body, fontSize: 12 }}>{new Date(erreur.horodatage).toLocaleDateString()} · {erreur.horodatage}</Text>
                </TouchableOpacity>
              )
            })}
          </View>
        )}

        </ScrollView>
        <View style={{ alignItems: 'flex-end', paddingHorizontal: 4, paddingTop: 12, paddingBottom: 8, borderTopWidth: 1, borderColor: colors.border, backgroundColor: colors.card }}>
          <TouchableOpacity onPress={submit} accessibilityRole="button" accessibilityLabel={sending ? t('bugReport.sending') : t('bugReport.sendShort')} accessibilityState={{ disabled: !canSend }} disabled={!canSend} style={{ width: 56, height: 56, alignItems: 'center', justifyContent: 'center', borderRadius: 28, borderWidth: 1, borderColor: colors.border, backgroundColor: canSend ? colors.secondary : colors.card, opacity: sending ? 0.7 : 1 }}>
            <Icon name="checkmark" color={colors.text} size={30} />
          </TouchableOpacity>
        </View>
      </View>
    </ModalBase>
  )
}
