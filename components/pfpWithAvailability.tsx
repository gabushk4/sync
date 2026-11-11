import { usePalette } from '@/contextes/contextePalette'
import { FPType } from '@/types/pfp'
import { StyleProp, View, ViewStyle } from 'react-native'
import ProfilPic from './pfp'

export type StatutDisponibilite = 'disponible' | 'silencieux' | 'indisponible'

type Props = {
  size: number
  pfp: FPType
  statut?: StatutDisponibilite | null
  style?: StyleProp<ViewStyle>
}

const COULEURS: Record<StatutDisponibilite, string> = {
  disponible: '#35B86B',
  silencieux: '#E6B422',
  indisponible: '#E05252',
}

export default function PfpWithAvailability({ size, pfp, statut, style }: Props) {
  const { colors } = usePalette()
  const couleur = statut ? COULEURS[statut] : undefined
  const diameter = Math.min(26, Math.max(16, Math.round(size * 0.27)))

  return (
    <View style={[{ width: size, height: size, position: 'relative' }, style]}>
      <ProfilPic size={size} pfp={pfp} />
      {couleur && (
        <View
          style={{
            position: 'absolute',
            right: -1,
            bottom: -1,
            width: diameter,
            height: diameter,
            borderRadius: diameter / 2,
            borderWidth: Math.max(2, Math.round(diameter * 0.18)),
            borderColor: colors.card,
            backgroundColor: couleur,
          }}
        />
      )}
    </View>
  )
}
