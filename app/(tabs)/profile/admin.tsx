import { router, useFocusEffect } from 'expo-router'
import React, { useCallback, useState, Dispatch, SetStateAction } from 'react'
import { useTranslation } from 'react-i18next'
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import Icon from '@react-native-vector-icons/ionicons'

import { useAPI } from '@/contextes/contexteAPI'
import { useFont } from '@/contextes/contexteFont'
import { usePalette } from '@/contextes/contextePalette'
import ToastAbs from '@/abstractions/toastAbs'
import { toastTypes } from '@/constants/toastConfig'
import catcher from '@/functions/catcher'
import DemandesLoi25 from '@/components/demandesLoi25'
import PagesGlissables from '@/components/pagesGlissables'
import PanneauMetriques from '@/components/panneauMetriques'
import PanneauOsMetriques from '@/components/panneauOsMetriques'
import type { PageGlissable } from '@/components/pagesGlissables'

type BugRapporte = {
  id_publique: string
  description: string
  cree_le: string
  app_version?: string | null
  appareil?: string | null
  pseudo?: string | null
}

type Etat = 'verification' | 'chargement' | 'pret' | 'erreur'

// Stories #29 et #30 (loi 25) : demandes d'export et de suppression des données
// US #36: ajout des metriques d'utilisations des usagers

function extraireSection(description: string, labels: string[]): string | null {
  const lignes = description.split(/\r?\n/)
  const debut = lignes.findIndex((ligne) => labels.some((label) => ligne.trim().toLocaleLowerCase() === `${label.toLocaleLowerCase()}:`))
  if (debut < 0) return null
  const contenu: string[] = []
  for (const ligne of lignes.slice(debut + 1)) {
    if (!ligne.trim()) break
    contenu.push(ligne)
  }
  return contenu.join('\n').trim() || null
}

/** Coque commune à chaque page du dashboard : chargeur pendant le chargement, bouton "réessayer" en erreur, sinon les enfants (état "pret"). */
function EtatPage({ etat, onRecharger, children }: { etat: Etat; onRecharger: () => void; children?: React.ReactNode }) {
  const { t } = useTranslation('profile')
  const { colors } = usePalette()
  const { fonts } = useFont()

  const s = StyleSheet.create({
    centre: { flex: 1, alignItems: 'center' as const, justifyContent: 'center' as const },
    message: { padding: 24, color: colors.muted, fontFamily: fonts.body, fontSize: 16, textAlign: 'center' as const },
    retry: { color: colors.secondary, fontFamily: fonts.title, fontSize: 15, textAlign: 'center' as const },
  })

  if (etat === 'verification' || etat === 'chargement') {
    return <View style={s.centre}><ActivityIndicator color={colors.secondary} /></View>
  }

  if (etat === 'erreur') {
    return (
      <TouchableOpacity onPress={() => void onRecharger()} accessibilityRole="button">
        <Text style={s.message}>{t('admin.loadFailed')}</Text>
        <Text style={s.retry}>{t('admin.retry')}</Text>
      </TouchableOpacity>
    )
  }

  return children ?? null
}

/** Liste (ou message vide) des bugs rapportés, partagée par les onglets "bugs" et "metriques". */
function ZoneBugs({ bugs, bugOuvert, setBugOuvert }: { bugs: BugRapporte[]; bugOuvert: string | null; setBugOuvert: Dispatch<SetStateAction<string | null>> }) {
  const { t, i18n } = useTranslation('profile')
  const { colors } = usePalette()
  const { fonts } = useFont()

  const s = StyleSheet.create({
    liste: { padding: 16, paddingBottom: 32, gap: 12 },
    carte: { padding: 16, borderRadius: 12, backgroundColor: colors.card, gap: 8 },
    pseudo: { color: colors.text, fontFamily: fonts.title, fontSize: 16 },
    description: { color: colors.text, fontFamily: fonts.body, fontSize: 15 },
    metadonnees: { color: colors.muted, fontFamily: fonts.body, fontSize: 13 },
    details: { color: colors.text, fontFamily: fonts.body, fontSize: 14, lineHeight: 20 },
    message: { padding: 24, color: colors.muted, fontFamily: fonts.body, fontSize: 16, textAlign: 'center' as const },
  })

  if (bugs.length === 0) return <Text style={s.message}>{t('admin.empty')}</Text>

  return (
    <ScrollView contentContainerStyle={s.liste}>
      {bugs.map((bug) => (
        <TouchableOpacity
          key={bug.id_publique}
          style={s.carte}
          onPress={() => setBugOuvert((id) => (id === bug.id_publique ? null : bug.id_publique))}
          accessibilityRole="button"
          accessibilityState={{ expanded: bugOuvert === bug.id_publique }}
          accessibilityLabel={`${bug.pseudo || t('admin.unknown')}, ${t('admin.reportedAt', { date: new Date(bug.cree_le).toLocaleString(i18n.language) })}`}
        >
          <Text style={s.pseudo}>@{bug.pseudo || t('admin.unknown')}</Text>
          <Text style={s.description}>
            {extraireSection(bug.description, [t('bugReport.whatHappened', { ns: 'common' }), 'What happened']) || bug.description}
          </Text>
          <Text style={s.metadonnees}>{t('admin.reportedAt', { date: new Date(bug.cree_le).toLocaleString(i18n.language) })}</Text>
          {bugOuvert === bug.id_publique && (
            <View style={{ gap: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.border }}>
              <Text style={s.details}>{bug.description}</Text>
              <Text style={s.metadonnees}>{t('admin.appVersion', { version: bug.app_version || t('admin.unknown') })}</Text>
              <Text style={s.metadonnees}>{t('admin.device', { device: bug.appareil || t('admin.unknown') })}</Text>
            </View>
          )}
        </TouchableOpacity>
      ))}
    </ScrollView>
  )
}

function PageBugs({ etat, bugs, bugOuvert, setBugOuvert, charger }: { etat: Etat; bugs: BugRapporte[]; bugOuvert: string | null; setBugOuvert: Dispatch<SetStateAction<string | null>>; charger: () => void }) {
  const { t } = useTranslation('profile')
  const { colors } = usePalette()

  const s = StyleSheet.create({
    page: { flex: 1, backgroundColor: colors.background, position: 'relative' },
  })

  return (
    <View style={s.page}>
      <EtatPage etat={etat} onRecharger={charger}>
        <ZoneBugs bugs={bugs} bugOuvert={bugOuvert} setBugOuvert={setBugOuvert} />
        <TouchableOpacity onPress={() => void charger()} accessibilityRole="button" accessibilityLabel={t('admin.retry')} style={{ position: 'absolute', top: 12, right: 20 }}>
          <Icon name="refresh" size={22} color={colors.text} />
        </TouchableOpacity>
      </EtatPage>
    </View>
  )
}

function PageLoi25({ type, onAccesRefuse }: { type: 'export' | 'suppression'; onAccesRefuse: () => void }) {
  return <DemandesLoi25 type={type} onAccesRefuse={onAccesRefuse} />
}

function PageMetriques({ onAccesRefuse }: { onAccesRefuse: () => void }) {
  return <PanneauMetriques onAccesRefuse={onAccesRefuse} />
}

/** Admin-only dashboard. The API also enforces admin access on the bug endpoint. */
export default function DashboardAdmin() {
  const { t } = useTranslation('profile')
  const { api } = useAPI()
  const [etat, setEtat] = useState<Etat>('verification')
  const [bugs, setBugs] = useState<BugRapporte[]>([])
  const [bugOuvert, setBugOuvert] = useState<string | null>(null)

  const sortirAccesRefuse = useCallback(() => {
    ToastAbs.show({ type: toastTypes.error, text1: t('admin.accessDenied') })
    router.replace('/(tabs)/profile')
  }, [t])

  const charger = useCallback(async () => {
    setEtat('verification')
    try {
      const { data: membre } = await api.get('/membres')
      if (membre.role !== 'admin') {
        ToastAbs.show({ type: toastTypes.error, text1: t('admin.accessDenied') })
        router.replace('/(tabs)/profile')
        return
      }

      setEtat('chargement')
      const { data } = await api.get('/admin/bugs')
      setBugs(Array.isArray(data.bugs) ? data.bugs : [])
      setEtat('pret')
    } catch (error: any) {
      if (error?.response?.status === 401 || error?.response?.status === 403) {
        ToastAbs.show({ type: toastTypes.error, text1: t('admin.accessDenied') })
        router.replace('/(tabs)/profile')
        return
      }
      setEtat('erreur')
      catcher(error, t('admin.loadFailed'))
    }
  }, [api, t])

  useFocusEffect(useCallback(() => {
    void charger()
  }, [charger]))

  const pages: PageGlissable[] = [
    { id: 'bugs', titre: t('admin.bugsTab'), contenu: <PageBugs etat={etat} bugs={bugs} bugOuvert={bugOuvert} setBugOuvert={setBugOuvert} charger={charger} /> },
    { id: 'exports', titre: t('admin.exportsTab'), contenu: <PageLoi25 type="export" onAccesRefuse={sortirAccesRefuse} /> },
    { id: 'suppressions', titre: t('admin.deletionsTab'), contenu: <PageLoi25 type="suppression" onAccesRefuse={sortirAccesRefuse} /> },
    { id: 'metriques', titre: t('admin.metricsTab'), contenu: <PageMetriques onAccesRefuse={sortirAccesRefuse} /> },
    { id: 'os_metrics', titre: t('admin.osMetricsTab'), contenu: <PanneauOsMetriques onAccesRefuse={sortirAccesRefuse} /> },
  ]

  return <PagesGlissables pages={pages} />
}
