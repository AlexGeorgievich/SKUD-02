export class ApiError extends Error {
  constructor(public status:number, message:string){super(message)}
}
export async function request(url:string,options:RequestInit={}):Promise<Response>{
  const response=await fetch(url,{credentials:'same-origin',...options});
  if(!response.ok){
    let detail:string;
    try {const body=await response.json();detail=typeof body.detail==='string'?body.detail:JSON.stringify(body.detail)}
    catch {detail=`Ошибка сервера: ${response.status}`}
    if(response.status===401)window.dispatchEvent(new Event('session-expired'));
    throw new ApiError(response.status,detail);
  }
  return response;
}
export async function api<T>(url:string,options:RequestInit={}):Promise<T>{return (await request(url,options)).json()}
export async function download(url:string,filename:string){
  const blob=await (await request(url)).blob();const objectURL=URL.createObjectURL(blob);
  const a=document.createElement('a');a.href=objectURL;a.download=filename;document.body.append(a);a.click();a.remove();
  window.setTimeout(()=>URL.revokeObjectURL(objectURL),1000);
}
export const errorText=(error:unknown)=>error instanceof Error?error.message:'Не удалось выполнить действие';
export function localDate(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
