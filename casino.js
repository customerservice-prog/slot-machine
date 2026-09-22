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
 const search=document.getElementById("gameSearch");
 if(search)search.addEventListener("input",()=>{
   const q=search.value.trim().toLowerCase();
   document.querySelectorAll("[data-game-card]").forEach(card=>{const hay=(card.dataset.title+" "+card.dataset.tags).toLowerCase();card.hidden=!!q&&!hay.includes(q)});
 });
 document.querySelectorAll("[data-scroll]").forEach(a=>a.addEventListener("click",e=>{const target=document.querySelector(a.dataset.scroll);if(target){e.preventDefault();target.scrollIntoView({behavior:"smooth",block:"start"})}}));
 try{if(localStorage.getItem("pineda_recent_game")==="pineda-power")document.getElementById("recentSection")?.classList.remove("hidden")}catch{}
})();