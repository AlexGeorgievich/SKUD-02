function phoneDigits(value:string):string{
 const digits=value.replace(/\D/g,'');
 if(!digits)return '';
 if(digits[0]==='8')return `7${digits.slice(1,11)}`;
 if(digits[0]==='7')return digits.slice(0,11);
 return `7${digits.slice(0,10)}`;
}

export function normalizePersonalPhoneInput(value:string):string{
 const digits=phoneDigits(value);
 return digits?`+${digits}`:'';
}

export function formatPersonalPhone(value:string):string{
 const digits=phoneDigits(value);
 if(!digits)return '';
 const local=digits.slice(1);
 let result='+7';
 if(local.length)result+=` (${local.slice(0,3)}`;
 if(local.length>3)result+=`) ${local.slice(3,6)}`;
 if(local.length>6)result+=`-${local.slice(6,8)}`;
 if(local.length>8)result+=`-${local.slice(8,10)}`;
 return result;
}
