import { useState } from 'react'
import { Image, ImageProps, StyleSheet, View } from 'react-native'

import Spinner from '@/components/spinner'
import { usePalette } from '@/contextes/contextePalette'

type Props = ImageProps & {
    /** Size of the spinner, in px. Defaults to 24. */
    tailleSpinner?: number
    /** Its colour. Defaults to the palette's muted colour. */
    couleurSpinner?: string
}

/**
 * A photo from the server with the app's spinner over it until it has loaded (or
 * failed). The spinner fills the image's parent: put it in a sized box, like the photo
 * grids do. Same props as an Image.
 *
 * @example
 * <ImageChargement source={{ uri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
 */
export default function ImageChargement({ tailleSpinner = 24, couleurSpinner, onLoadEnd, source, ...props }: Props) {
    const { colors } = usePalette()
    const uri = source && typeof source === 'object' && !Array.isArray(source) ? source.uri : undefined
    // The address that finished loading: another photo in the same place (recycled list
    // row) shows the spinner again without resetting anything.
    const [uriChargee, setUriChargee] = useState<string | undefined>()
    const chargee = !uri || uriChargee === uri

    return (
        <>
            <Image
                {...props}
                source={source}
                onLoadEnd={() => {
                    setUriChargee(uri)
                    onLoadEnd?.()
                }}
            />
            {!chargee && (
                <View pointerEvents="none" style={s.voile}>
                    <Spinner size={tailleSpinner} color={couleurSpinner ?? colors.muted} />
                </View>
            )}
        </>
    )
}

const s = StyleSheet.create({
    voile: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center' },
})
