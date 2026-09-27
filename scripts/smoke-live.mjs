/** Read-only production smoke checks. Does NOT submit the form or send email. */
import assert from 'node:assert/strict';
for(const [host,lang,privacy]of [['etamade.com','en','privacy'],['etamade.ro','ro','confidentialitate']]){
  const base=`https://${host}`;
  for(const [path,mime]of [['/','text/html'],[`/${privacy}/`,'text/html'],['/llms.txt','text/plain'],['/llms-full.txt','text/plain'],['/index.md','text/markdown'],['/company.json','application/json'],['/sitemap.xml','application/xml'],['/robots.txt','text/plain']]){
    const response=await fetch(base+path,{signal:AbortSignal.timeout(15000)});
    assert.equal(response.status,200,base+path);
    assert.ok(response.headers.get('content-type')?.includes(mime),`${path} content type`);
    const body=await response.text();
    if(path==='/')assert.ok(body.includes(`<html lang="${lang}">`),`${host}: language`);
    assert.equal(response.headers.get('content-language'),lang);
    console.log(`PASS ${base}${path}`);
  }
  const alias=await fetch(`https://www.${host}/`,{redirect:'manual',signal:AbortSignal.timeout(15000)});
  assert.equal(alias.status,308);assert.equal(alias.headers.get('location'),base+'/');
  const config=await (await fetch(base+'/api/config')).json();
  console.log(`${host} contact enabled: ${config.enabled}`);
}
