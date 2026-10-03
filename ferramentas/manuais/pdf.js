const {chromium}=require(process.env.PLAYWRIGHT || '/home/claude/.npm-global/lib/node_modules/playwright');
(async()=>{const b=await chromium.launch();const p=await b.newPage();
await p.goto('file://'+__dirname+'/manual.html',{waitUntil:'networkidle'});
await p.evaluate(()=>document.fonts.ready);
await p.pdf({path:__dirname+'/manual.pdf',format:'A4',printBackground:true,preferCSSPageSize:true,outline:true,tagged:true});
await b.close()})();
