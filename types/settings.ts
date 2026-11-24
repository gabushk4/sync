import { LinkProps } from "expo-router"
import { TextInputProps } from "react-native"

import { DEFAULT_HUE } from "@/constants/Colors"

export type AppSettings = {
	language: 'en' | 'fr'
	timezone: string,
	theme: number
}

export const DEFAULT_SETTINGS: AppSettings = {
	language: 'fr',
	timezone: 'Etc/UTC',
	// Same constant as "reset to default" (Philip — user story 49).
	theme: DEFAULT_HUE
}

export type SettingKey = keyof AppSettings

export type SettingsRepository = {
  load: () => Promise<Partial<AppSettings>>
  save: (changes: Partial<AppSettings>) => Promise<void>
}

type SettingBase = {
	id: string
	titleKey: string
	descriptionKey?: string
	disabled?: boolean
}

type ToggleSetting = SettingBase & {
	type: 'toggle'
	value: boolean
	onValueChange: (value: boolean) => void | Promise<void>
}

type DropdownSetting<T extends string = string> = SettingBase & {
	type: 'dropdown'
	value: T
	options: Array<{
		value: T
		titleKey?: string
		title?: string
	}>
	onValueChange: (value: T) => void
}

type LinkSetting =
	| (SettingBase & {
		type: 'link'
		href: LinkProps['href'] | string
		externalLink?: boolean
	})
	| (SettingBase & {
		type: 'link'
		onPress: () => void | Promise<void>
	})

type InputSettings = SettingBase & {
	type: 'input'
	value: TextInputProps['value']
	keyboardType: TextInputProps['keyboardType']
	onChangeText: TextInputProps['onChangeText']
	onBlur: TextInputProps['onBlur']
	setDefault?: () => void
}

/** A color in a circle; touching it opens its picker (the theme's, Philip — user story 49). */
type ColorSetting = SettingBase & {
	type: 'color'
	/** CSS color shown in the circle. */
	value: string
	onPress: () => void
}

type Section = {
	id: string
	titleKey: string
	type: 'section'
	settings: Setting[]
}

type Setting =
	| ToggleSetting
	| DropdownSetting
	| LinkSetting
	| Section
	| InputSettings
	| ColorSetting

export default Setting
