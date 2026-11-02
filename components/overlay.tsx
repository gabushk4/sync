import Radius from '@/constants/Radius'
import { usePalette } from '@/contextes/contextePalette'
import { BlurView } from 'expo-blur'
import { ReactNode } from 'react'
import { Modal, Pressable, StyleProp, StyleSheet, View, ViewStyle } from 'react-native'

type OverlayProps = {
	children: ReactNode
	visible?: boolean
	onDismiss?: () => void
	style?: StyleProp<ViewStyle>
	overlayStyle?: StyleProp<ViewStyle>
	blurIntensity?: number
}

export default function Overlay({
	children,
	visible = true,
	onDismiss,
	style,
	overlayStyle,
	blurIntensity = 50,
}: OverlayProps) {
	const { colors } = usePalette()

	if (!visible) return null

	return (
		<Modal
			visible={visible}
			transparent
			animationType="fade"
			onRequestClose={onDismiss}
		>
		<View style={[styles.overlay, overlayStyle]}>
			<BlurView
				intensity={blurIntensity}
				tint="default"
				style={StyleSheet.absoluteFill}
				pointerEvents="none"
			/>
			<Pressable
				accessibilityRole="button"
				accessibilityLabel="Fermer la fenêtre"
				onPress={onDismiss}
				style={StyleSheet.absoluteFill}
			/>
			<View
				style={[
					styles.content,
					{
						backgroundColor: colors.background,
						borderColor: colors.border,
					},
					style,
				]}
			>
				{children}
			</View>
		</View>
		</Modal>
	)
}

const styles = StyleSheet.create({
	overlay: {
		flex: 1,
		alignItems: 'center',
		justifyContent: 'center',
	},
	content: {
		width: '85%',
		maxWidth: 480,
		height: 'auto',
		minHeight: 120,
		padding: 16,
		borderRadius: Radius.lg,
		borderWidth: 1,
		overflow: 'hidden',
	},
})
