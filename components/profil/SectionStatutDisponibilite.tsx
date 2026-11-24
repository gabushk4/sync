import { memo, useCallback } from 'react';
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Icon from '@react-native-vector-icons/ionicons';
import { useTranslation } from 'react-i18next';

type Statut = 'disponible' | 'silencieux' | 'indisponible';

type Props = {
  visible: boolean;
  statutActuel: Statut | null;
  colors: ReturnType<typeof import('@/contextes/contextePalette').usePalette>['colors'];
  fonts: ReturnType<typeof import('@/contextes/contexteFont').useFont>['fonts'];
  onRequestClose: () => void;
  onSelectStatut: (statut: Statut) => void;
  t: ReturnType<typeof useTranslation>['t'];
};

/**
 * Modal de sélection du statut de disponibilité.
 * Accessible : backdrop pressable pour fermer, labels d'accessibilité sur chaque option.
 */
export const SectionStatutDisponibilite = memo(function SectionStatutDisponibilite({
  visible,
  statutActuel,
  colors,
  fonts,
  onRequestClose,
  onSelectStatut,
  t,
}: Props) {
  const COULEURS: Record<Statut, string> = {
    disponible: '#35B86B',
    silencieux: '#E6B422',
    indisponible: '#E05252',
  };

  const statuts: Statut[] = ['disponible', 'silencieux', 'indisponible'];

  const handleSelect = useCallback(
    (statut: Statut) => {
      onRequestClose();
      onSelectStatut(statut);
    },
    [onRequestClose, onSelectStatut]
  );

  if (!visible) return null;

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onRequestClose}
    >
      <View
        style={[
          styles.backdrop,
          { backgroundColor: 'rgba(0,0,0,0.42)' },
        ]}
      >
        <Pressable
          onPress={onRequestClose}
          style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 }}
          accessibilityRole="button"
          accessibilityLabel={t('availability.close')}
        />
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text
            style={[
              styles.titre,
              { color: colors.text, fontFamily: fonts.title },
            ]}
          >
            {t('availability.change')}
          </Text>
          {statuts.map((statut) => {
            const couleur = COULEURS[statut];
            const actif = statutActuel === statut;
            return (
              <TouchableOpacity
                key={statut}
                accessibilityRole="button"
                accessibilityLabel={t(`availability.${statut}`)}
                accessibilityState={{ selected: actif }}
                onPress={() => handleSelect(statut)}
                style={[
                  styles.option,
                  {
                    minHeight: 50,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                    paddingHorizontal: 10,
                    borderRadius: 10,
                    backgroundColor: actif ? `${couleur}22` : 'transparent',
                  },
                ]}
              >
                <View
                  style={[
                    styles.point,
                    { width: 12, height: 12, borderRadius: 6, backgroundColor: couleur },
                  ]}
                />
                <Text
                  style={[
                    styles.texteOption,
                    { flex: 1, color: colors.text, fontFamily: fonts.body, fontSize: 15 },
                  ]}
                >
                  {t(`availability.${statut}`)}
                </Text>
                {actif && (
                  <Icon name="checkmark" size={20} color={couleur} />
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </Modal>
  );
});

SectionStatutDisponibilite.displayName = 'SectionStatutDisponibilite';

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    alignSelf: 'center',
    padding: 18,
    borderRadius: 18,
    borderWidth: 1,
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  titre: {
    fontSize: 18,
    marginBottom: 12,
  },
  option: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  point: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  texteOption: {
    flex: 1,
    fontSize: 15,
  },
});
