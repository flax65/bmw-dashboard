// ═══════════════════════════════════════════════
//  DASHBOARD – canvas seven-segment display
// ═══════════════════════════════════════════════

const W = 800, H = 360;
let theme = localStorage.getItem('dashTheme') || 'light';

const canvas = document.getElementById('c');
const ctx    = canvas.getContext('2d');

// ── Seven-segment helpers ──
const SEGS = {
    '0':[1,1,1,1,1,1,0],'1':[0,1,1,0,0,0,0],'2':[1,1,0,1,1,0,1],
    '3':[1,1,1,1,0,0,1],'4':[0,1,1,0,0,1,1],'5':[1,0,1,1,0,1,1],
    '6':[1,0,1,1,1,1,1],'7':[1,1,1,0,0,0,0],'8':[1,1,1,1,1,1,1],
    '9':[1,1,1,1,0,1,1],' ':[0,0,0,0,0,0,0],'-':[0,0,0,0,0,0,1]
};
function fp(pts){ctx.beginPath();ctx.moveTo(pts[0],pts[1]);for(let i=2;i<pts.length;i+=2)ctx.lineTo(pts[i],pts[i+1]);ctx.closePath();ctx.fill();}
function dd(x,y,w,h,ch,sw,col){
    const seg=SEGS[ch]||SEGS[' '],p=sw*0.45;
    ctx.fillStyle=col||'#111';
    if(seg[0])fp([x+p,y,x+w-p,y,x+w-p-sw,y+sw,x+p+sw,y+sw]);
    if(seg[1])fp([x+w,y+p,x+w,y+h/2-p,x+w-sw,y+h/2-p-sw*0.3,x+w-sw,y+p+sw]);
    if(seg[2])fp([x+w,y+h/2+p,x+w,y+h-p,x+w-sw,y+h-p-sw,x+w-sw,y+h/2+p+sw*0.3]);
    if(seg[3])fp([x+p,y+h,x+w-p,y+h,x+w-p-sw,y+h-sw,x+p+sw,y+h-sw]);
    if(seg[4])fp([x,y+h/2+p,x,y+h-p,x+sw,y+h-p-sw,x+sw,y+h/2+p+sw*0.3]);
    if(seg[5])fp([x,y+p,x,y+h/2-p,x+sw,y+h/2-p-sw*0.3,x+sw,y+p+sw]);
    if(seg[6])fp([x+p+sw*0.3,y+h/2,x+p+sw,y+h/2-sw*0.45,x+w-p-sw,y+h/2-sw*0.45,x+w-p-sw*0.3,y+h/2,x+w-p-sw,y+h/2+sw*0.45,x+p+sw,y+h/2+sw*0.45]);
}
function dot(x,y,r,col){ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fillStyle=col||'#111';ctx.fill();}
function dn(str,x,y,dw,dh,sw,gap,col){
    let cx=x;
    for(let i=0;i<str.length;i++){
        const ch=str[i];
        if(ch==='.'){dot(cx+sw*0.5,y+dh+sw*0.15,sw*0.45,col);cx+=sw*1.2;}
        else{if(ch!=' ')dd(cx,y,dw,dh,ch,sw,col);cx+=dw+gap;}
    }
}
function tw(str,dw,sw,gap){let w=0;for(let i=0;i<str.length;i++)w+=str[i]==='.'?sw*1.2:dw+gap;return w-gap;}
function lb(txt,x,y,sz,col,sp){ctx.fillStyle=col||'#999';ctx.font=`600 ${sz||9}px Arial`;ctx.letterSpacing=(sp||'2')+'px';ctx.fillText(txt,x,y);}

function draw() {
    const BG   = theme === 'dark' ? '#000' : '#fff';
    const LINE = theme === 'dark' ? '#222' : '#eee';
    const DIG  = theme === 'dark' ? '#fff' : '#111';
    const LBL  = theme === 'dark' ? '#555' : '#999';
    const UNIT = theme === 'dark' ? '#444' : '#777';

    document.querySelector('.frame').style.background = BG;

    ctx.fillStyle=BG; ctx.fillRect(0,0,W,H);
    const SP=H*0.60, HL=W*0.5;
    ctx.fillStyle=LINE;
    ctx.fillRect(0,SP,W,0.5); ctx.fillRect(HL,0,0.5,SP);
    for(let i=1;i<4;i++) ctx.fillRect(W*i/5,SP,0.5,H-SP);
    ctx.fillRect(W*4/5,SP,0.5,H-SP);

    // RPM
    const DWB=58,DHB=106,SWB=11,GB=10;
    const rs=String(Math.round(data.rpm)),rw=tw(rs,DWB,SWB,GB),rx=(HL-rw)/2,ry=(SP-DHB)/2;
    dn(rs,rx,ry,DWB,DHB,SWB,GB,DIG); lb('RPM',rx,ry-8,11,LBL,'4');

    // SPEED
    const ss=String(Math.round(data.spd)),sw2=tw(ss,DWB,SWB,GB),sx=HL+(HL-sw2)/2-24,sy=ry;
    dn(ss,sx,sy,DWB,DHB,SWB,GB,DIG);
    ctx.fillStyle=UNIT; ctx.font='400 11px Arial'; ctx.letterSpacing='0px'; ctx.fillText('km/h',sx+sw2+12,sy+DHB);
    lb('SPEED',sx,sy-8,11,LBL,'4');

    // TOT / TRIP
    const DWK=12,DHK=22,SWK=2.6,GK=2,ty=sy+DHB+18;
    ctx.fillStyle=LINE; ctx.fillRect(HL+8,ty-6,HL-16,0.5);
    const ts=Number(data.tot).toFixed(1),tw2=tw(ts,DWK,SWK,GK),tx=HL+12;
    dn(ts,tx,ty,DWK,DHK,SWK,GK,DIG);
    ctx.fillStyle=UNIT; ctx.font='400 9px Arial'; ctx.letterSpacing='0px'; ctx.fillText('km',tx+tw2+4,ty+DHK-1);
    lb('TOT',tx,ty-4,7,LBL,'1.5');
    const tr=Number(data.trip).toFixed(1),trw=tw(tr,DWK,SWK,GK),trx=HL+HL/2+4;
    dn(tr,trx,ty,DWK,DHK,SWK,GK,DIG);
    ctx.fillStyle=UNIT; ctx.font='400 9px Arial'; ctx.letterSpacing='0px'; ctx.fillText('km',trx+trw+4,ty+DHK-1);
    lb('TRIP',trx,ty-4,7,LBL,'1.5');
    ctx.fillStyle=LINE; ctx.fillRect(HL+HL/2-2,ty,0.5,DHK+10);

    // BOTTOM PARAMS
    const DWS=19,DHS=40,SWS=4,GS=3,BY=SP+(H-SP-DHS)/2;
    const params=[
        {l:'IAT', v:Number(data.iat).toFixed(1), u:'°C'},
        {l:'CLT', v:Number(data.clt).toFixed(1), u:'°C'},
        {l:'LMD', v:String(Math.round(data.lmd)),  u:'mV'},
        {l:'BAT', v:Number(data.bat).toFixed(2),   u:'V'}
    ];
    params.forEach(({l,v,u},c)=>{
        const cw=W/5,cx=c*cw,vw=tw(v,DWS,SWS,GS),bx=cx+(cw-vw)/2-8;
        dn(v,bx,BY,DWS,DHS,SWS,GS,DIG);
        ctx.fillStyle=UNIT; ctx.font='400 11px Arial'; ctx.letterSpacing='0px'; ctx.fillText(u,bx+vw+5,BY+DHS);
        ctx.fillStyle=LBL;  ctx.font='600 9px Arial';  ctx.letterSpacing='2px'; ctx.fillText(l,bx,BY-9);
    });

    // GEAR
    const DWG=32,DHG=54,SWG=7,gcx=W*4/5,gcw=W/5;
    const gs=String(data.gear),gw=tw(gs,DWG,SWG,0),gx=gcx+(gcw-gw)/2,gy=SP+(H-SP-DHG)/2;
    dn(gs,gx,gy,DWG,DHG,SWG,0,DIG);
    ctx.fillStyle=LBL; ctx.font='600 9px Arial'; ctx.letterSpacing='2px'; ctx.fillText('GEAR',gx,gy-9);
}

function resizeAndDraw() {
    requestAnimationFrame(() => {
        const w = document.documentElement.clientWidth;
        const h = document.documentElement.clientHeight;
        canvas.style.width  = w + 'px';
        canvas.style.height = h + 'px';
        canvas.width  = w * devicePixelRatio;
        canvas.height = h * devicePixelRatio;
        ctx.setTransform(canvas.width/W, 0, 0, canvas.height/H, 0, 0);
        draw();
    });
}
window.addEventListener('resize', resizeAndDraw);
window.addEventListener('orientationchange', () => {
    setTimeout(resizeAndDraw, 100);
    setTimeout(resizeAndDraw, 400);
});
