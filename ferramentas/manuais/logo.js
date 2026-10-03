const {chromium}=require(process.env.PLAYWRIGHT || '/home/claude/.npm-global/lib/node_modules/playwright');const fs=require('fs');
(async()=>{const b=await chromium.launch();const p=await b.newPage();
const svg=fs.readFileSync(__dirname + '/../../assets/isotipo.svg','utf8').replace(/<\?xml[^>]*\?>/,'');
await p.setContent('<style>@page{size:A4;margin:0}body{margin:0}div{position:absolute;left:20.2mm;top:14.6mm;width:3mm}svg{width:100%;height:auto;display:block}</style><div>'+svg+'</div>');
await p.pdf({path:__dirname+'/logo.pdf',format:'A4',preferCSSPageSize:true});await b.close()})();
