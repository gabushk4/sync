import { usePalette } from "@/contextes/contextePalette";

import React, { ActivityIndicator, View } from "react-native";
import QRCode from "react-native-qrcode-svg";
import { useEffect, useState } from "react";
import { useMembre } from "@/contextes/contexteMembre";
import { useAPI } from "@/contextes/contexteAPI";
import log from "@/functions/log";
import MemberCode from "@/components/memberCode";
import Spinner from "@/components/spinner";

export default function QRCodeAbs() {
    const { colors } = usePalette()
    const { membre } = useMembre()
    const { APIBaseURL } = useAPI()

    const qrCodeValue = membre?.idPublique
    ? JSON.stringify({
          action: 'demande_ami',
          method: 'post',
          url: `${APIBaseURL}/amis/demandes/`,
          body: {
              id_destinataire: membre.idPublique,
          },
      })
    : null;
    
    if(!qrCodeValue){
        return <Spinner/>
    }
    
    return(
        <View style={{width:'100%', height:'100%', alignItems:'center', justifyContent:'center', gap:'4%'}}>
            {qrCodeValue.length > 0 &&
                <QRCode
                    value={qrCodeValue}
                    size={248}
                    color={colors.text}                                
                    backgroundColor={colors.card}
                    quietZone={8}
                />
            }
            <MemberCode code={membre.idPublique??'...'} size={18} />
        </View>
    )
}