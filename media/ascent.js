(function(){"use strict";var STORE_KEY="stellarFuel";var START_CREDITS=1000;var STAKE_STEP=5;var STAKE_MAX=50000;var EDGE_FACTOR=0.96;var MULT_CAP=50;var CLIMB_RATE=0.13;var LOG_LIMIT=10;var viewportEl=document.getElementById("st-viewport");var canvas=document.getElementById("st-sky");var gaugeEl=document.getElementById("st-gauge");var commsEl=document.getElementById("st-comms");var logEl=document.getElementById("st-flight-log");var tankEl=document.getElementById("st-tank-sum");var refuelBtn=document.getElementById("st-refuel");var stakeField=document.getElementById("st-stake-field");var stakeDown=document.getElementById("st-stake-down");var stakeUp=document.getElementById("st-stake-up");var launchBtn=document.getElementById("st-launch");var ejectBtn=document.getElementById("st-eject");if(!viewportEl||!canvas||!gaugeEl||!commsEl||!logEl||!tankEl||!refuelBtn||!stakeField||!stakeDown||!stakeUp||!launchBtn||!ejectBtn||!canvas.getContext){return;}
var ctx=canvas.getContext("2d");var view={w:0,h:0,dpr:1};var stars=[];var sparks=[];var ring=null;var game={phase:"idle",credits:loadCredits(),stake:0,mult:1,crashAt:1,liftStart:0,exitVy:0,pilotY:0};var rafId=0;var lastTick=0;function round2(v){return Math.round(v*100)/100;}
function fmt(v){var r=round2(v);return r===Math.floor(r)?String(r):r.toFixed(2);}
function loadCredits(){var raw=null;try{raw=window.localStorage.getItem(STORE_KEY);}catch(err){raw=null;}
if(raw===null||raw===""){return START_CREDITS;}
var v=Number(raw);return(isFinite(v)&&v>=0)?round2(v):START_CREDITS;}
function saveCredits(){try{window.localStorage.setItem(STORE_KEY,String(game.credits));}catch(err){}}
function paintCredits(){tankEl.textContent=fmt(game.credits);}
function readStake(){var v=Math.floor(Number(stakeField.value));return isFinite(v)?v:0;}
function clampStake(){var v=readStake();if(v<1){v=1;}
if(v>STAKE_MAX){v=STAKE_MAX;}
stakeField.value=String(v);}
function nudgeStake(delta){if(game.phase!=="idle"){return;}
var v=readStake()+delta;if(v<1){v=1;}
if(v>STAKE_MAX){v=STAKE_MAX;}
stakeField.value=String(v);}
function lockCabin(locked){stakeField.disabled=locked;stakeDown.disabled=locked;stakeUp.disabled=locked;refuelBtn.disabled=locked;launchBtn.disabled=locked;}
function say(text,tone){commsEl.textContent=text;commsEl.classList.remove("st-comms-good","st-comms-bad");if(tone==="good"){commsEl.classList.add("st-comms-good-2d46d760");}
if(tone==="bad"){commsEl.classList.add("st-comms-bad-2d46d760");}}
function paintGauge(value,mood){gaugeEl.textContent=value.toFixed(2)+"×";gaugeEl.classList.remove("st-gauge-live","st-gauge-hit","st-gauge-safe");if(mood){gaugeEl.classList.add(mood);}}
function logFlight(value,won){var li=document.createElement("li");li.className="st-log-entry-2d46d760"+
(won?"st-log-win":"st-log-loss");li.textContent=value.toFixed(2)+"×";logEl.insertBefore(li,logEl.firstChild);while(logEl.children.length>LOG_LIMIT){logEl.removeChild(logEl.lastChild);}}
function fitCanvas(){var w=viewportEl.clientWidth;if(w<1){return;}
var h=Math.round(Math.min(380,Math.max(230,w*0.56)));var dpr=window.devicePixelRatio||1;view.w=w;view.h=h;view.dpr=dpr;canvas.style.height=h+"px";canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);seedStars();if(!rafId){drawIdleFrame(0);}}
function seedStars(){stars=[];var layers=[{speed:18,rMin:0.5,rMax:1.1,alpha:0.45},{speed:42,rMin:0.8,rMax:1.6,alpha:0.7},{speed:86,rMin:1.2,rMax:2.2,alpha:1}];var perLayer=Math.max(14,Math.round(view.w*view.h/9000));for(var l=0;l<layers.length;l+=1){for(var i=0;i<perLayer;i+=1){stars.push({x:Math.random()*view.w,y:Math.random()*view.h,r:layers[l].rMin+Math.random()*(layers[l].rMax-layers[l].rMin),speed:layers[l].speed,alpha:layers[l].alpha*(0.6+Math.random()*0.4)});}}}
function roundedBox(x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();}
function paintBackdrop(){var g=ctx.createLinearGradient(0,0,0,view.h);g.addColorStop(0,"#070b1e");g.addColorStop(1,"#111a3d");ctx.fillStyle=g;ctx.fillRect(0,0,view.w,view.h);var neb=ctx.createRadialGradient(view.w*0.82,view.h*0.2,10,view.w*0.82,view.h*0.2,view.w*0.55);neb.addColorStop(0,"rgba(167, 139, 250, 0.16)");neb.addColorStop(1,"rgba(167, 139, 250, 0)");ctx.fillStyle=neb;ctx.fillRect(0,0,view.w,view.h);var neb2=ctx.createRadialGradient(view.w*0.12,view.h*0.75,10,view.w*0.12,view.h*0.75,view.w*0.5);neb2.addColorStop(0,"rgba(110, 231, 255, 0.10)");neb2.addColorStop(1,"rgba(110, 231, 255, 0)");ctx.fillStyle=neb2;ctx.fillRect(0,0,view.w,view.h);}
function paintStars(dt,scrollFactor){for(var i=0;i<stars.length;i+=1){var s=stars[i];if(scrollFactor>0){s.y+=s.speed*scrollFactor*dt;if(s.y>view.h+3){s.y=-3;s.x=Math.random()*view.w;}}
ctx.globalAlpha=s.alpha;ctx.fillStyle="#dbe6ff";ctx.beginPath();ctx.arc(s.x,s.y,s.r,0,Math.PI*2);ctx.fill();}
ctx.globalAlpha=1;}
function paintPad(){var padY=view.h-22;ctx.strokeStyle="rgba(110, 231, 255, 0.5)";ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(view.w/2-34,padY);ctx.lineTo(view.w/2+34,padY);ctx.stroke();ctx.strokeStyle="rgba(110, 231, 255, 0.22)";ctx.beginPath();ctx.moveTo(view.w/2-20,padY+7);ctx.lineTo(view.w/2+20,padY+7);ctx.stroke();}
function paintPilot(ax,ay,thrusting,now){ctx.save();ctx.translate(ax,ay);if(thrusting){var len=22+Math.random()*16;var flame=ctx.createLinearGradient(0,12,0,12+len);flame.addColorStop(0,"rgba(110, 231, 255, 0.95)");flame.addColorStop(0.6,"rgba(167, 139, 250, 0.7)");flame.addColorStop(1,"rgba(167, 139, 250, 0)");ctx.fillStyle=flame;ctx.beginPath();ctx.moveTo(-7,12);ctx.lineTo(7,12);ctx.lineTo(0,12+len);ctx.closePath();ctx.fill();}
ctx.fillStyle="#7c6cd9";roundedBox(-14,-12,28,26,7);ctx.fill();ctx.fillStyle="#e9eeff";roundedBox(-10,-14,20,30,8);ctx.fill();ctx.strokeStyle="#cfd9f7";ctx.lineCap="round";ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(-9,-4);ctx.lineTo(-17,6);ctx.moveTo(9,-4);ctx.lineTo(17,6);ctx.stroke();ctx.beginPath();ctx.moveTo(-5,15);ctx.lineTo(-7,24);ctx.moveTo(5,15);ctx.lineTo(7,24);ctx.stroke();ctx.fillStyle="#f4f7ff";ctx.beginPath();ctx.arc(0,-22,12,0,Math.PI*2);ctx.fill();ctx.fillStyle="#121b3f";ctx.beginPath();ctx.arc(0,-22,8,-0.25*Math.PI,1.05*Math.PI);ctx.fill();ctx.fillStyle="rgba(110, 231, 255, 0.85)";ctx.beginPath();ctx.arc(3,-24,2.4+Math.sin(now/300)*0.4,0,Math.PI*2);ctx.fill();ctx.restore();}
function spawnBurst(ax,ay){sparks=[];var colors=["#6ee7ff","#a78bfa","#ffd166","#ff5d7d","#f4f7ff"];for(var i=0;i<46;i+=1){var ang=Math.random()*Math.PI*2;var speed=60+Math.random()*270;sparks.push({x:ax,y:ay,vx:Math.cos(ang)*speed,vy:Math.sin(ang)*speed,life:0.55+Math.random()*0.55,age:0,r:1.4+Math.random()*2.4,color:colors[i%colors.length]});}
ring={x:ax,y:ay,age:0,life:0.5};}
function paintBurst(dt){var alive=false;if(ring){ring.age+=dt;if(ring.age<ring.life){alive=true;var t=ring.age/ring.life;ctx.globalAlpha=1-t;ctx.strokeStyle="#ffd166";ctx.lineWidth=3*(1-t)+0.5;ctx.beginPath();ctx.arc(ring.x,ring.y,12+t*74,0,Math.PI*2);ctx.stroke();ctx.globalAlpha=1;}else{ring=null;}}
for(var i=0;i<sparks.length;i+=1){var p=sparks[i];p.age+=dt;if(p.age>=p.life){continue;}
alive=true;p.vy+=150*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;ctx.globalAlpha=1-p.age/p.life;ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);ctx.fill();}
ctx.globalAlpha=1;return alive;}
function pilotAnchor(now){var lift=Math.min(1,(game.mult-1)/1.4);var eased=1-Math.pow(1-lift,3);var groundY=view.h-48;var y=groundY-eased*(view.h*0.52);var x=view.w/2;if(game.phase==="flying"&&eased>0.95){x+=Math.sin(now/480)*5;y+=Math.sin(now/640)*3;}
return{x:x,y:y};}
function drawScene(now){var dt=lastTick?Math.min(0.05,(now-lastTick)/1000):0;lastTick=now;paintBackdrop();var scroll=0;if(game.phase==="flying"){scroll=0.2+Math.min(2.6,(game.mult-1)*0.5);}else if(game.phase==="exit"){scroll=2.2;}else if(game.phase==="burst"){scroll=0.35;}
paintStars(dt,scroll);if(game.phase==="idle"||game.mult<1.15){paintPad();}
var keepGoing=false;if(game.phase==="flying"){game.mult=Math.min(MULT_CAP,Math.exp(CLIMB_RATE*(now-game.liftStart)/1000));if(game.mult>=game.crashAt){game.mult=game.crashAt;blowUp(now);}else{var a=pilotAnchor(now);game.pilotY=a.y;paintPilot(a.x,a.y,true,now);paintGauge(game.mult,"st-gauge-live");ejectBtn.textContent="Cash Out "+
fmt(round2(game.stake*game.mult));keepGoing=true;}}
if(game.phase==="exit"){game.exitVy+=900*dt;game.pilotY-=game.exitVy*dt;if(game.pilotY>-60){paintPilot(view.w/2,game.pilotY,true,now);keepGoing=true;}}
if(game.phase==="burst"||sparks.length){if(paintBurst(dt)){keepGoing=true;}else{sparks=[];}}
if(!keepGoing&&(game.phase==="burst"||game.phase==="exit")){game.phase="idle";lockCabin(false);}
if(keepGoing){rafId=window.requestAnimationFrame(drawScene);}else{rafId=0;lastTick=0;if(game.phase==="idle"){drawIdleFrame(now);}}}
function drawIdleFrame(now){paintBackdrop();paintStars(0,0);paintPad();paintPilot(view.w/2,view.h-48-24,false,now||0);}
function wakeLoop(){if(!rafId){lastTick=0;rafId=window.requestAnimationFrame(drawScene);}}
function sampleCrashPoint(){var u=Math.random();return Math.min(MULT_CAP,Math.max(1,EDGE_FACTOR/(1-u)));}
function liftOff(){if(game.phase!=="idle"){return;}
clampStake();var stake=readStake();if(stake<1){say("Minimum stake is 1 credit.","bad");return;}
if(stake>game.credits){say("Not enough credits for that stake. Refuel or lower it.","bad");return;}
game.stake=stake;game.credits=round2(game.credits-stake);saveCredits();paintCredits();game.crashAt=sampleCrashPoint();game.mult=1;game.liftStart=window.performance.now();game.phase="flying";lockCabin(true);ejectBtn.disabled=false;paintGauge(1,"st-gauge-live");say("Ignition. Punch out before the flare hits.",null);wakeLoop();}
function blowUp(now){var a=pilotAnchor(now);spawnBurst(a.x,game.pilotY||a.y);game.phase="burst";ejectBtn.disabled=true;ejectBtn.textContent="Cash Out";paintGauge(game.crashAt,"st-gauge-hit");logFlight(game.crashAt,false);say("Flare at "+game.crashAt.toFixed(2)+"× — the stake burned up.","bad");if(game.credits<1){say("Flare at "+game.crashAt.toFixed(2)+"×. Tank empty — press Refuel to keep training.","bad");}}
function punchOut(){if(game.phase!=="flying"){return;}
var haul=round2(game.stake*game.mult);game.credits=round2(game.credits+haul);saveCredits();paintCredits();game.phase="exit";game.exitVy=220;ejectBtn.disabled=true;ejectBtn.textContent="Cash Out";paintGauge(game.mult,"st-gauge-safe");logFlight(game.mult,true);say("Banked "+fmt(haul)+" at "+game.mult.toFixed(2)+"×. Clean exit.","good");wakeLoop();}
function refuel(){if(game.phase!=="idle"){return;}
game.credits=START_CREDITS;saveCredits();paintCredits();say("Tank topped up to "+START_CREDITS+" credits.",null);}
launchBtn.addEventListener("click",liftOff);ejectBtn.addEventListener("click",punchOut);refuelBtn.addEventListener("click",refuel);stakeDown.addEventListener("click",function(){nudgeStake(-STAKE_STEP);});stakeUp.addEventListener("click",function(){nudgeStake(STAKE_STEP);});stakeField.addEventListener("change",clampStake);window.addEventListener("resize",fitCanvas);fitCanvas();paintCredits();if(game.credits<1){say("Tank is empty — press Refuel to load demo credits.",null);}})();