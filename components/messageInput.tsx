import { useRef, useState } from 'react'
import { StyleSheet, TouchableOpacity, View } from 'react-native'
import { useTranslation } from 'react-i18next'

import Icon from "@react-native-vector-icons/ionicons"

import TextInputAbs from '@/abstractions/textInputAbs'
import SelecteurPhotos, { type PhotoAEnvoyer, type SelecteurPhotosRef } from '@/components/selecteurPhotos'
import { usePalette } from '@/contextes/contextePalette'
import VoiceRecorderButton from './voiceRecorderButton'

export type { PhotoAEnvoyer } from '@/components/selecteurPhotos'

/** Photos per send */
const MAX_PHOTOS = 10

type Props = {
    onEnvoyerTexte: (texte: string) => Promise<void> | void
    onEnvoyerVocal: (uri: string, dureeSecondes: number) => Promise<void> | void
    /** the picked photos, sent as ONE message (an album when several); throws if it failed */
    onEnvoyerImages?: (photos: PhotoAEnvoyer[]) => Promise<void> | void
}

export default function MessageInput({ onEnvoyerTexte, onEnvoyerVocal, onEnvoyerImages }: Props){
    const {colors} = usePalette()
    const { t } = useTranslation('inbox')
    const [texte,setTexte] = useState('')
    const [photos, setPhotos] = useState<PhotoAEnvoyer[]>([])
    const [enEnvoi, setEnEnvoi] = useState(false)
    // the photos checked in the gallery being made ready (sending waits for them)
    const [preparation, setPreparation] = useState(false)
    const selecteur = useRef<SelecteurPhotosRef>(null)

    // The photos first, all in one message (in the picked order), then the text, like
    // Messenger. If the photos fail, they stay in the strip (and the text in the field).
    const envoyer = async () => {
        const texteAEnvoyer = texte.trim()
        if ((texteAEnvoyer.length === 0 && photos.length === 0) || enEnvoi || preparation) return
        setEnEnvoi(true)
        try {
            if (photos.length > 0 && onEnvoyerImages) {
                await onEnvoyerImages(photos)
                setPhotos([])
            }
            if (texteAEnvoyer.length > 0) {
                setTexte('')
                try {
                    await onEnvoyerTexte(texteAEnvoyer)
                } catch {
                    setTexte(texteAEnvoyer) // remettre le texte si l'envoi a échoué
                }
            }
        } catch {
            // the photos failed: the error was shown, they (and the text) stay
        } finally {
            setEnEnvoi(false)
        }
    }
    const aEnvoyer = texte.trim().length > 0 || photos.length > 0

    return (
        <View style={[styles.conteneur, {backgroundColor: colors.card, borderTopColor: colors.border}]}>
            {/* The picked photos, with the + to add more: the app's photo picker */}
            {onEnvoyerImages && (
                <SelecteurPhotos
                    ref={selecteur}
                    photos={photos}
                    onChange={setPhotos}
                    max={MAX_PHOTOS}
                    desactive={enEnvoi}
                    onPreparation={setPreparation}
                />
            )}

            <View style={styles.ligne}>
                {onEnvoyerImages && (
                    <TouchableOpacity
                        onPress={() => selecteur.current?.ouvrir()}
                        disabled={enEnvoi || preparation}
                        hitSlop={6}
                        accessibilityRole="button"
                        accessibilityLabel={t('photo.send')}
                        style={styles.boutonPhoto}
                    >
                        <Icon name="image-outline" size={26} color={colors.text} />
                    </TouchableOpacity>
                )}
                <TextInputAbs
                    value={texte}
                    onChangeText={setTexte}
                    placeholder="écris un message…"
                    multiline
                    maxLength={2000}
                    style={styles.input}
                />
                {aEnvoyer
                    ? (
                        <TouchableOpacity
                            onPress={envoyer}
                            disabled={enEnvoi || preparation}
                            accessibilityRole="button"
                            accessibilityState={{ busy: enEnvoi || preparation }}
                            style={[styles.boutonEnvoyer,{backgroundColor: colors.secondary,opacity:enEnvoi || preparation ? 0.5 : 1}]}>
                                <Icon name="send" size={16} color="white"/>
                        </TouchableOpacity>
                    )
                    : <VoiceRecorderButton onEnregistrementTermine={onEnvoyerVocal} />
                }
            </View>
        </View>
    )

}
const styles = StyleSheet.create({
    conteneur: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderTopWidth: 1,
        gap: 8,
    },
    ligne: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: 10,
    },
    input: { flex: 1, maxHeight: 100 },
    boutonPhoto: { width: 36, height: 48, alignItems: 'center', justifyContent: 'center' },
    boutonEnvoyer: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
})
