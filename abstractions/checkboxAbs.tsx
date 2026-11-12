import { TouchableOpacity, TouchableOpacityProps, StyleProp, ViewStyle } from 'react-native';
import Icon from '@react-native-vector-icons/ionicons';
import { usePalette } from '@/contextes/contextePalette';

type CheckboxAbsProps = {
    /** État coché ou non */
    checked: boolean;
    /** Désactive la checkbox (empêche le clic) */
    disabled?: boolean;
    /** Appelé quand l'utilisateur appuie sur la checkbox */
    onPress: () => void;
    /** Taille de l'icône (défaut: 22) */
    size?: number;
    /** Couleur quand cochée (défaut: colors.secondary) */
    checkedColor?: string;
    /** Couleur quand non cochée (défaut: colors.muted) */
    uncheckedColor?: string;
    /** Style supplémentaire appliqué sur le TouchableOpacity */
    style?: StyleProp<ViewStyle>;
    /** Contenu affiché à droite de l'icône (texte, badge, etc.) */
    children?: React.ReactNode;
    /** Label d'accessibilité */
    accessibilityLabel?: string;
} & Pick<TouchableOpacityProps, 'testID' | 'onLongPress' | 'delayLongPress' | 'hitSlop'>;

/**
 * Checkbox réutilisable dans toute l'application.
 * Encapsule le pattern utilisé dans les écrans de calendriers (Google, Outlook, local)
 * ainsi que dans le rapport de bugs :
 *  - TouchableOpacity avec accessibilityRole="checkbox"
 *  - Ionicons checkbox / square-outline
 *  - Couleurs issues de la palette (secondary / muted par défaut)
 *
 * @returns JSX.Element
 */
export default function CheckboxAbs({
    checked,
    disabled = false,
    onPress,
    size = 22,
    checkedColor,
    uncheckedColor,
    style,
    children,
    accessibilityLabel,
    ...rest
}: CheckboxAbsProps) {
    const { colors } = usePalette();

    return (
        <TouchableOpacity
            accessibilityRole="checkbox"
            accessibilityState={{ checked, disabled }}
            disabled={disabled}
            onPress={onPress}
            accessibilityLabel={accessibilityLabel}
            style={[{ flexDirection: 'row', alignItems: 'center', gap: 8 }, style]}
            {...rest}
        >
            <Icon
                name={checked ? 'checkbox' : 'square-outline'}
                size={size}
                color={checked ? (checkedColor ?? colors.secondary) : (uncheckedColor ?? colors.muted)}
            />
            {children}
        </TouchableOpacity>
    );
}
