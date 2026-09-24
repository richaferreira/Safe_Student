/**
 * Cliente HTTP do frontend e suporte a download de arquivos.
 *
 * Arquivo organizado para facilitar leitura, manutenção e apresentação acadêmica.
 */
async function api(path,opts={
}){
  const response=await fetch(path,{
    credentials:'same-origin',...opts,headers:{
      'Content-Type':'application/json',...(opts.headers||{
      })
    }
  });
  const data=await response.json().catch(()=>({
  }));
  if(!response.ok) throw new Error(data.error||'Falha na operação.');
  return data;
}
async function apiBlob(path){
  const response=await fetch(path,{
    credentials:'same-origin'
  });
  if(!response.ok){
    const data=await response.json().catch(()=>({
    }));
    throw new Error(data.error||'Falha na exportação.')
  }
  return response.blob();
}
function downloadBlob(blob,filename){
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url;
  a.download=filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),800)
}
