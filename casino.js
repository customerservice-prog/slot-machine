"use strict";
(()=>{
 const toast=document.getElementById("lobbyToast");
 const FAV_KEY="pineda_favorites";
 const RECENT_KEY="pineda_recent_game";
 function showToast(msg){
   if(!toast)return;
   toast.textContent=msg;toast.classList.add("show");
   clearTimeout(showToast.t);showToast.t=setTimeout(()=>toast.classList.remove("show"),1800)
 }
 function getFavs(){try{return JSON.parse(localStorage.getItem(FAV_KEY)||"[]")}catch{return []}}
 function setFavs(v){try{localStorage.setItem(FAV_KEY,JSON.stringify(v))}catch{}}
 function isFav(id){return getFavs().includes(id)}
 function syncFavoriteButtons(){
   document.querySelectorAll("[data-game-card]").forEach(card=>{
     const id=card.dataset.game;
     let btn=card.querySelector(".fav-btn");
     if(!btn){
       btn=document.createElement("button");btn.className="fav-btn";btn.type="button";btn.setAttribute("aria-label","Favorite game");
       card.querySelector(".game-thumb")?.appendChild(btn);
       btn.addEventListener("click",e=>{
         e.stopPropagation();e.preventDefault();
         let list=getFavs();
         list=list.includes(id)?list.filter(x=>x!==id):[...list,id];
         setFavs(list);syncFavoriteButtons();
       });
     }
     btn.textContent=isFav(id)?"★":"☆";
     btn.classList.toggle("active",isFav(id));
   })
 }
 function filterCards(f){
   document.querySelectorAll("[data-game-card]").forEach(card=>{
     const tags=(card.dataset.tags||"").toLowerCase();
     card.hidden=f==="favorite"?!isFav(card.dataset.game):(f!=="all"&&!tags.includes(f));
   });
 }
 document.querySelectorAll("[data-game]").forEach(card=>{
  card.addEventListener("click",e=>{
   if(e.target.closest(".fav-btn"))return;
   const id=card.dataset.game;
   if(id==="pineda-power"){
    try{localStorage.setItem(RECENT_KEY,"pineda-power")}catch{}
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
 document.getElementById("creditPlus")?.addEventListener("click",()=>{
   try{
     const key="pineda_power_huff_v1";
     const saved=JSON.parse(localStorage.getItem(key)||"{}");
     saved.balance=(Number(saved.balance)||2500)+2500;
     localStorage.setItem(key,JSON.stringify(saved));
     const bal=document.getElementById("lobbyBalance");if(bal)bal.textContent=Number(saved.balance).toLocaleString(undefined,{maximumFractionDigits:2});
     showToast("+2,500 free-play credits");
   }catch{showToast("Free-play refill unavailable")}
 });
 document.querySelectorAll("[data-filter]").forEach(btn=>btn.addEventListener("click",()=>{
   document.querySelectorAll("[data-filter]").forEach(b=>b.classList.remove("active"));
   btn.classList.add("active");filterCards(btn.dataset.filter);
 }));
 document.querySelector("[data-filter-link='favorite']")?.addEventListener("click",e=>{
   e.preventDefault();
   document.querySelectorAll("[data-filter]").forEach(b=>b.classList.toggle("active",b.dataset.filter==="favorite"));
   filterCards("favorite");
   document.querySelector(".category-strip")?.scrollIntoView({behavior:"smooth",block:"start"});
 });
 const search=document.getElementById("gameSearch");
 if(search)search.addEventListener("input",()=>{
   const q=search.value.trim().toLowerCase();
   document.querySelectorAll("[data-game-card]").forEach(card=>{
     const hay=((card.dataset.title||"")+" "+(card.dataset.tags||"")).toLowerCase();
     card.hidden=!!q&&!hay.includes(q)
   });
 });
 document.querySelectorAll("[data-scroll]").forEach(a=>a.addEventListener("click",e=>{
   const target=document.querySelector(a.dataset.scroll);
   if(target){e.preventDefault();target.scrollIntoView({behavior:"smooth",block:"start"})}
 }));
 try{if(localStorage.getItem(RECENT_KEY)==="pineda-power")document.getElementById("recentSection")?.classList.remove("hidden")}catch{}
 syncFavoriteButtons();
})();