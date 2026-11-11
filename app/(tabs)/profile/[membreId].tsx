import ProfilPic from '@/components/pfp'
import WidgetDisposCommunes from '@/components/widgetDisposCommunes'
import { useAPI } from '@/contextes/contexteAPI'
import { useFont } from '@/contextes/contexteFont'
import { useMembre } from '@/contextes/contexteMembre'
import { usePalette } from '@/contextes/contextePalette'
import Icon from '@react-native-vector-icons/ionicons'
import catcher from '@/functions/catcher'
import { useLocalSearchParams } from 'expo-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useFocusEffect } from 'expo-router/react-navigation'
import { useTranslation } from 'react-i18next'
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native'

type FriendProfile = {
  pseudo: string
  bio: string | null
  fp_url: string | null
  etat_ame: string | null
}

/** Displays a friend's public profile and their mood when the friendship allows it. */
export default function MemberProfil() {
  const { t } = useTranslation('profile')
  const { membreId } = useLocalSearchParams<{ membreId: string }>()
  const { api } = useAPI()
  const { colors } = usePalette()
  const { fonts } = useFont()
  const { membre } = useMembre()
  const [profile, setProfile] = useState<FriendProfile | null>(null)
  // Friends only (and not on one's own profile): the common availabilities widget.
  // Philip — user story 25.
  const [estAmi, setEstAmi] = useState(false)
  const [estAmiProche, setEstAmiProche] = useState(false)
  const [miseAJourAmiProche, setMiseAJourAmiProche] = useState(false)
  const [loading, setLoading] = useState(true)
  const etatAmiProcheRef = useRef(false)
  const etatConfirmeAmiProcheRef = useRef(false)
  const prochainEtatAmiProcheRef = useRef<boolean | null>(null)
  const requeteAmiProcheActiveRef = useRef(false)
  const derniereRequeteAmiProcheRef = useRef(0)
  const minuterieAmiProcheRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const programmerRequeteAmiProcheRef = useRef<() => void>(() => {})

  useFocusEffect(useCallback(() => {
    let active = true
    setLoading(true)
    api.get(`/membres/${encodeURIComponent(membreId)}`)
      .then(({ data }) => {
        if (!active) return
        setProfile(data.profil)
        setEstAmi(!!data.estAmi && data.id_publique !== membre.idPublique)
        const proche = !!(data.estAmiProche ?? data.profil?.estAmiProche ?? data.proche ?? data.profil?.proche)
        etatAmiProcheRef.current = proche
        etatConfirmeAmiProcheRef.current = proche
        prochainEtatAmiProcheRef.current = null
        setEstAmiProche(proche)
      })
      .catch((error) => catcher(error, t('errors.loadFriendProfileFailed')))
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [api, membreId, membre.idPublique, t]))

  // Sends the latest requested value, serializing writes and limiting them to one
  // request per second. Taps update the star immediately; taps during a request are
  // coalesced into the next write instead of creating overlapping requests.
  const programmerRequeteAmiProche = useCallback(() => {
    if (requeteAmiProcheActiveRef.current || minuterieAmiProcheRef.current !== null) return
    const prochainEtat = prochainEtatAmiProcheRef.current
    if (prochainEtat === null) return
    if (prochainEtat === etatConfirmeAmiProcheRef.current) {
      prochainEtatAmiProcheRef.current = null
      setMiseAJourAmiProche(false)
      return
    }

    const attente = derniereRequeteAmiProcheRef.current === 0
      ? 1000
      : Math.max(0, 1000 - (Date.now() - derniereRequeteAmiProcheRef.current))
    minuterieAmiProcheRef.current = setTimeout(async () => {
      minuterieAmiProcheRef.current = null
      if (requeteAmiProcheActiveRef.current) return

      const valeurAEnvoyer = prochainEtatAmiProcheRef.current
      if (valeurAEnvoyer === null) {
        setMiseAJourAmiProche(false)
        return
      }
      if (valeurAEnvoyer === etatConfirmeAmiProcheRef.current) {
        prochainEtatAmiProcheRef.current = null
        setMiseAJourAmiProche(false)
        return
      }

      prochainEtatAmiProcheRef.current = null
      requeteAmiProcheActiveRef.current = true
      derniereRequeteAmiProcheRef.current = Date.now()
      try {
        const { data } = await api.patch(`/amis/${encodeURIComponent(membreId)}/proche`, { proche: valeurAEnvoyer })
        const valeurConfirmee = Boolean(data?.proche ?? data?.estAmiProche ?? valeurAEnvoyer)
        etatConfirmeAmiProcheRef.current = valeurConfirmee
        if (prochainEtatAmiProcheRef.current === null) {
          etatAmiProcheRef.current = valeurConfirmee
          setEstAmiProche(valeurConfirmee)
        }
      } catch (error) {
        catcher(error, t('errors.closeFriendUpdateFailed'))
        if (prochainEtatAmiProcheRef.current === null) {
          etatAmiProcheRef.current = etatConfirmeAmiProcheRef.current
          setEstAmiProche(etatConfirmeAmiProcheRef.current)
        }
      } finally {
        requeteAmiProcheActiveRef.current = false
        if (prochainEtatAmiProcheRef.current !== null) {
          programmerRequeteAmiProcheRef.current()
        } else {
          setMiseAJourAmiProche(false)
        }
      }
    }, attente)
  }, [api, membreId, t])

  useEffect(() => {
    programmerRequeteAmiProcheRef.current = programmerRequeteAmiProche
  }, [programmerRequeteAmiProche])

  const basculerAmiProche = () => {
    if (!estAmi) return
    const proche = !etatAmiProcheRef.current
    etatAmiProcheRef.current = proche
    prochainEtatAmiProcheRef.current = proche
    setEstAmiProche(proche)
    setMiseAJourAmiProche(true)
    programmerRequeteAmiProcheRef.current()
  }

  // Spinner only before the first answer: reloading on focus (e.g. back from creating
  // an event from the widget) keeps the page, so the widget keeps its week.
  // Philip — user story 25.
  if (loading && !profile) return <View style={{ flex: 1, justifyContent: 'center', backgroundColor: colors.background }}><ActivityIndicator color={colors.text} /></View>
  if (!profile) return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}><Text style={{ color: colors.text, fontFamily: fonts.body }}>{t('errors.friendProfileUnavailable')}</Text></View>

  return (
    <ScrollView contentContainerStyle={{ flexGrow: 1, alignItems: 'center', padding: 24, backgroundColor: colors.background }}>
      <ProfilPic size={120} pfp={profile.fp_url ?? undefined} />
      <View style={{ marginTop: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
        <Text style={{ color: colors.text, fontFamily: fonts.title, fontSize: 24 }}>@{profile.pseudo}</Text>
        {estAmi && (
          <TouchableOpacity
            onPress={basculerAmiProche}
            accessibilityRole="button"
            accessibilityLabel={t(estAmiProche ? 'closeFriend.remove' : 'closeFriend.add')}
            accessibilityState={{ selected: estAmiProche, busy: miseAJourAmiProche }}
            style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22, borderWidth: 1, borderColor: estAmiProche ? colors.warning : colors.border, backgroundColor: colors.card }}
          >
            <Icon name={estAmiProche ? 'star' : 'star-outline'} size={24} color={estAmiProche ? colors.warning : colors.muted} />
          </TouchableOpacity>
        )}
      </View>
      <View style={{ width: '100%', padding: 16, marginTop: 24, borderRadius: 12, backgroundColor: colors.card }}>
        <Text style={{ color: colors.muted, fontFamily: fonts.title, fontSize: 16 }}>{t('friendMood')}</Text>
        <Text style={{ marginTop: 8, color: colors.text, fontFamily: fonts.body, fontSize: 18 }}>
          {profile.etat_ame?.trim() || t('moodEmpty')}
        </Text>
      </View>
      <View style={{ width: '100%', padding: 16, marginTop: 12, borderRadius: 12, backgroundColor: colors.card }}>
        <Text style={{ color: colors.muted, fontFamily: fonts.title, fontSize: 16 }}>{t('edit.bioLabel')}</Text>
        <Text style={{ marginTop: 8, color: colors.text, fontFamily: fonts.body, fontSize: 16 }}>{profile.bio?.trim() || t('bioEmpty')}</Text>
      </View>
      {/* Widgets, under the profile's info (user story 25). */}
      {estAmi && (
        <WidgetDisposCommunes ami={{ id: membreId, pseudo: profile.pseudo, fp_url: profile.fp_url }} />
      )}
    </ScrollView>
  )
}
