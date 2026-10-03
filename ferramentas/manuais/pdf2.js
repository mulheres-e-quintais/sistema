const {chromium}=require(process.env.PLAYWRIGHT || '/home/claude/.npm-global/lib/node_modules/playwright');
(async()=>{const b=await chromium.launch();const p=await b.newPage();
for(const [h,o] of [['essencial.html','Por_que_o_sistema_e_essencial_Mulheres_e_Quintais.pdf'],['guias.html','Guias_rapidos_por_perfil_Mulheres_e_Quintais.pdf']]){
await p.goto('file://'+__dirname+'/'+h,{waitUntil:'networkidle'});await p.evaluate(()=>document.fonts.ready);
if(h==='guias.html'){const r=await p.evaluate(()=>[...document.querySelectorAll('.guia')].map(g=>{const f=g.querySelector('footer').getBoundingClientRect(),G=g.getBoundingClientRect();return Math.round(G.bottom-f.bottom)}));console.log('folga no rodapé (px) por guia:',r.join(' '))}
await p.pdf({path:__dirname+'/'+o,format:'A4',printBackground:true,preferCSSPageSize:true,tagged:true});}
await b.close()})();
