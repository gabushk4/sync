export default function log(...args){
    return;
    
    if(process.env.NODE_ENV=='development'){
        console.log(...args)
    }
        
    return;
}    