"use strict";
(()=>{
 const toast=document.getElementById("lobbyToast");
 function showToast(msg){if(!toast)return;toast.textContent=msg;toast.classList.add("show");clearTimeout(showToast.t);showToast.t=setTimeout(()=>toast.classList.remove("show"),1800)}
 document.querySelectorAll("[data-game]").forEach(card=>{
  card.addEventListener("click",e=>{
   const id=card.dataset.game;
   if(id==="pineda-power"){
    try{localStorage.setItem("pineda_recent_game","pineda-power")}catch{}
    location.href="/game/pineda-power";
   }else{e.preventDefault();showToast("Coming soon — Pineda Power is playable now.")}
  });
 });
 try{
   const saved=JSON.parse(localStorage.getItem("pineda_power_huff_v1")||"null");
   const bal=document.getElementById("lobbyBalance");
   if(saved&&bal&&Number.isFinite(saved.balance))bal.textContent=Number(saved.balance).toLocaleString(undefined,{maximumFractionDigits:2});
  }catch{}
 document.getElementById("guestProfile")?.addEventListener("click",()=>showToast("Guest profile • Free-play mode • No cash value"));
 document.querySelectorAll("[data-filter]").forEach(btn=>btn.addEventListener("click",()=>{
   document.querySelectorAll("[data-filter]").forEach(b=>b.classList.remove("active"));
   btn.classList.add("active");
   const f=btn.dataset.filter;
   document.querySelectorAll("[data-game-card]").forEach(card=>{
     const tags=(card.dataset.tags||"").toLowerCase();
     card.hidden=f!=="all"&&!tags.includes(f);
   });
 }));
 const search=document.getElementById("gameSearch");
 if(search)search.addEventListener("input",()=>{
   const q=search.value.trim().toLowerCase();
   document.querySelectorAll("[data-game-card]").forEach(card=>{const hay=(card.dataset.title+" "+card.dataset.tags).toLowerCase();card.hidden=!!q&&!hay.includes(q)});
 });
 document.querySelectorAll("[data-scroll]").forEach(a=>a.addEventListener("click",e=>{const target=document.querySelector(a.dataset.scroll);if(target){e.preventDefault();target.scrollIntoView({behavior:"smooth",block:"start"})}}));
 try{if(localStorage.getItem("pineda_recent_game")==="pineda-power")document.getElementById("recentSection")?.classList.remove("hidden")}catch{}
})();