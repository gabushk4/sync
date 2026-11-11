import ToastAvertissement from "@/components/toastAvertissement"
import ToastErreur from "@/components/toastErreur"
import ToastNotification from "@/components/toastNotification"
import ToastSucces from "@/components/toastSucces"

// notification: a push received while the app is open (user story 45)
const toastTypes = {warning: 'persoAvertissement', error: 'persoErreur', success: 'persoSucces', notification: 'persoNotification'} 

const toastConfig = {
  persoSucces: (props : any) => <ToastSucces {...props}/>,
  persoErreur: (props : any) => <ToastErreur {...props}/>,
  persoAvertissement: (props : any) => <ToastAvertissement {...props}/>,
  persoNotification: (props : any) => <ToastNotification {...props}/>
}

export {toastConfig, toastTypes}