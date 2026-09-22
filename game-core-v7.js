"use strict";
(function(root,factory){
  const api=factory();
  if(typeof module!=="undefined"&&module.exports) module.exports=api;
  if(root) root.PinedaCore=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
  const PAY_IDS=["T","J","Q","K","A","TAPE","TOOL","PG","PB"];
  const DEFAULT_PAY={
    T:[.15,.35,.8],J:[.18,.45,1],Q:[.22,.55,1.2],K:[.28,.7,1.5],A:[.35,.9,1.9],
    TAPE:[.55,1.4,3],TOOL:[.7,1.8,4],PG:[1,2.8,7],PB:[1.4,4,10]
  };
  function positions(grid,id){
    const out=[]; for(let c=0;c<5;c++)for(let r=0;r<3;r++)if(grid[c][r]===id)out.push(c*3+r); return out;
  }
  function classifyTriggers(grid){
    const hats=positions(grid,"HAT"),saws=positions(grid,"SAW");
    return {hats,saws,free:hats.length>=6,wheel:saws.length>=3};
  }
  function evaluateWays(grid,bet=10,pay=DEFAULT_PAY){
    let total=0; const cells=[],seen=new Set();
    for(const id of PAY_IDS){
      let ways=1,length=0;
      for(let c=0;c<5;c++){
        let matches=0;
        for(let r=0;r<3;r++) if(grid[c][r]===id||grid[c][r]==="WILD") matches++;
        if(!matches) break;
        ways*=matches; length++;
      }
      if(length>=3){
        total+=bet*((pay[id]||[0,0,0])[length-3]||0)*ways/20;
        for(let c=0;c<length;c++)for(let r=0;r<3;r++)if(grid[c][r]===id||grid[c][r]==="WILD"){
          const key=c+"_"+r; if(!seen.has(key)){seen.add(key);cells.push([c,r])}
        }
      }
    }
    return {win:Math.round(total*100)/100,cells};
  }
  function createFeatureFrames(type,seedPositions=[],rng=Math.random){
    const frames=Array(15).fill(0);
    if(type==="free") seedPositions.forEach(p=>frames[p]=Math.max(frames[p],1));
    if(type==="buzz") seedPositions.forEach(p=>{const c=Math.floor(p/3),r=p%3;for(let cc=c;cc<5;cc++)frames[cc*3+r]=Math.max(frames[cc*3+r],1)});
    if(type==="mega"){
      const shapes=[[2,2],[3,3],[5,3]],shape=shapes[Math.floor(rng()*shapes.length)];
      const w=shape[0],h=shape[1],startC=Math.floor(rng()*(6-w)),startR=Math.floor(rng()*(4-h));
      for(let c=startC;c<startC+w;c++)for(let r=startR;r<startR+h;r++)frames[c*3+r]=1;
    }
    if(type==="mansion"){
      const pool=[...Array(15).keys()];
      for(let i=pool.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[pool[i],pool[j]]=[pool[j],pool[i]]}
      pool.slice(0,5).forEach(p=>frames[p]=3); seedPositions.forEach(p=>frames[p]=3);
    }
    return frames;
  }
  function frameReward(level,bet,jp,r=Math.random){
    if(level===1){const m=[2,3,4,5,8][Math.floor(r()*5)];return {label:m+"×",amount:bet*m}}
    if(level===2){
      const x=r(); if(x<.05)return {label:"MINI",amount:jp.mini};
      const m=[5,8,10,12,15][Math.floor(r()*5)];return {label:m+"×",amount:bet*m}
    }
    if(level===3){
      const x=r();
      if(x<.008)return {label:"GRAND",amount:jp.grand};
      if(x<.035)return {label:"MAJOR",amount:jp.major};
      if(x<.11)return {label:"MINOR",amount:jp.minor};
      if(x<.22)return {label:"MINI",amount:jp.mini};
      const m=[15,20,25,30,40,50][Math.floor(r()*6)];return {label:m+"×",amount:bet*m}
    }
    return {label:"",amount:0};
  }
  function selfTest(){
    const payGrid=[
      ["A","A","A"],["A","K","A"],["A","Q","A"],["A","J","A"],["A","T","A"]
    ];
    if(evaluateWays(payGrid,10).win<=0) throw new Error("ways evaluation failed");
    const trigGrid=[
      ["HAT","HAT","SAW"],["HAT","HAT","SAW"],["HAT","HAT","SAW"],["A","K","Q"],["J","T","A"]
    ];
    const t=classifyTriggers(trigGrid);
    if(!t.free||!t.wheel) throw new Error("trigger classification failed");
    for(const type of ["free","buzz","mega","mansion"]){
      const f=createFeatureFrames(type,[0,3,6],()=>.2);
      if(!Array.isArray(f)||f.length!==15) throw new Error(type+" feature frames failed");
    }
    return true;
  }
  return {PAY_IDS,DEFAULT_PAY,positions,classifyTriggers,evaluateWays,createFeatureFrames,frameReward,selfTest};
});