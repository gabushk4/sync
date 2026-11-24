import { memo, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import Icon from '@react-native-vector-icons/ionicons';

import { useFont } from '@/contextes/contexteFont';
import { usePalette } from '@/contextes/contextePalette';
import { FPType} from '@/types/pfp';
import { convertirTimestampDateCourte, Timestamp } from '@/functions/convertirTimestamp';
import MemberCode from '@/components/memberCode';
import PfpWithAvailability, { StatutDisponibilite } from '@/components/pfpWithAvailability';

type Props = {
  membre: {
    pseudo: string;
    idPublique?: string | null;
    fp: FPType;
    statutDisponibilite?: StatutDisponibilite | null;
    bio: string;
    tempsCreation?: Timestamp;
    admin?: boolean;
  };
  colors: ReturnType<typeof usePalette>['colors'];
  fonts: ReturnType<typeof useFont>['fonts'];
  onPressStatut: () => void;
  menuStatutVisible: boolean;
  setMenuStatutVisible: (visible: boolean) => void;
  bioMaxLines?: number;
};

/**
 * Header de la page profil : bannière, photo de profil, pseudo, code membre, statut et bio.
 * Mémoïsé pour éviter les re-renders quand le parent change d'état non pertinent.
 */
export const ProfilHeader = memo(function ProfilHeader({
  membre,
  colors,
  fonts,
  onPressStatut,
  menuStatutVisible,
  setMenuStatutVisible,
  bioMaxLines = 3,
}: Props) {
  const { t } = useTranslation('profile');

  // Animation locale pour l'apparition des infos
  const opaciteInfos = useSharedValue(1);
  const animInfos = useAnimatedStyle(() => ({
    opacity: opaciteInfos.value,
  }));

  const couleurStatut = useMemo(() => {
    switch (membre.statutDisponibilite) {
      case 'disponible': return '#35B86B';
      case 'silencieux': return '#E6B422';
      case 'indisponible': return '#E05252';
      default: return colors.muted;
    }
  }, [membre.statutDisponibilite, colors.muted]);

  return (
    <View style={styles.conteneur}>
      {/* Photo de profil */}
      <View style={styles.conteneurPfp}>
        <PfpWithAvailability
          size={120}
          pfp={membre.fp}
          statut={membre.statutDisponibilite}
          style={styles.pfp}
        />
      </View>

      {/* Infos texte */}
      <Animated.View style={[styles.conteneurInfos, animInfos]}>
        <View style={styles.lignePseudo}>
          <Text style={[styles.pseudo, { color: colors.text, fontFamily: fonts.title }]}>
            @{membre.pseudo}
          </Text>
          <MemberCode code={membre.idPublique ?? ''} />
        </View>

        <Text
          style={[
            styles.dateMembre,
            { color: colors.muted, fontFamily: fonts.body },
          ]}
        >
          {t('memberSince', {
            date: convertirTimestampDateCourte(membre.tempsCreation),
          })}
        </Text>

        {/* Bouton statut disponibilité */}
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={t('availability.change')}
          accessibilityState={{ expanded: menuStatutVisible }}
          onPress={onPressStatut}
          style={[
            styles.boutonStatut,
            {
              borderColor: couleurStatut,
              backgroundColor: colors.card,
            },
          ]}
        >
          <View
            style={[
              styles.pointStatut,
              { backgroundColor: couleurStatut },
            ]}
          />
          <Text
            style={[
              styles.texteStatut,
              { color: colors.text, fontFamily: fonts.body },
            ]}
          >
            {t(`availability.${membre.statutDisponibilite ?? 'disponible'}`)}
          </Text>
          <Icon name="chevron-down" size={16} color={colors.muted} />
        </TouchableOpacity>

        {/* Bio */}
        <View style={styles.conteneurBio}>
          <Text
            style={[styles.bio, { color: colors.text, fontFamily: fonts.body }]}
            numberOfLines={bioMaxLines}
            ellipsizeMode="tail"
          >
            {membre.bio}
          </Text>
        </View>
      </Animated.View>
    </View>
  );
});

ProfilHeader.displayName = 'ProfilHeader';

const styles = StyleSheet.create({
  conteneur: {
    width: '100%',
    alignItems: 'center',
  },
  conteneurPfp: {
    height: 120,
    width: 120,
    marginTop: -56,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },
  pfp: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  conteneurInfos: {
    flexDirection: 'column',
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 12,
    width: '100%',
    alignItems: 'flex-start',
  },
  lignePseudo: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    width: '100%',
  },
  pseudo: {
    fontSize: 24,
    fontWeight: '600',
  },
  dateMembre: {
    fontSize: 14,
    paddingLeft: 4,
  },
  boutonStatut: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  pointStatut: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  texteStatut: {
    fontSize: 13,
  },
  conteneurBio: {
    width: '100%',
    paddingHorizontal: 16,
    paddingVertical: 4,
    flexShrink: 1,
  },
  bio: {
    fontSize: 16,
    lineHeight: 22,
    maxHeight: 66,
    flexShrink: 1,
  },
});
