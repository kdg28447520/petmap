#!/usr/bin/env node
"use strict";
/*
 * petmap.kr editorial pages generated after the existing map/place build.
 * Node standard library only. Does not alter the existing map application source.
 */
const fs=require("node:fs");
const path=require("node:path");
const indexRule=require("./index-rule");
const placeFacts=require("./place-facts");
const ROOT=__dirname, OUT=path.join(ROOT,"dist");
const BASE="https://www.petmap.kr";
const updated="2026-10-14";
const esc=(x)=>String(x==null?"":x).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const plain=x=>String(x||"").replace(/<[^>]+>/g,"").trim();
const data=JSON.parse(fs.readFileSync(path.join(ROOT,"content","guides.json"),"utf8"));
const longGuides=JSON.parse(fs.readFileSync(path.join(ROOT,"content","long-guides.json"),"utf8"));
const EXCLUDED_FROM_LISTS=new Set(["korea-pet-map-counts"]);
const LONG_DATE="2026-10-18";
const all=JSON.parse(fs.readFileSync(path.join(OUT,"places.json"),"utf8")).places;
const sec=(head,body)=>'<section class="section"><h2>'+esc(head)+'</h2>'+body+'</section>';
const para=s=>'<p>'+esc(s)+'</p>';
const PAW='<svg width="23" height="23" viewBox="0 0 24 24" aria-hidden="true"><path fill="#E4572E" d="M12 13.2c2.9 0 5.6 2.3 5.6 4.7 0 1.5-1.1 2.5-2.7 2.5-1 0-1.8-.4-2.9-.4s-1.9.4-2.9.4c-1.6 0-2.7-1-2.7-2.5 0-2.4 2.7-4.7 5.6-4.7ZM6.2 8.1c1 .3 1.5 1.7 1.1 3-.4 1.4-1.5 2.2-2.5 1.9-1-.3-1.5-1.7-1.1-3 .4-1.3 1.5-2.2 2.5-1.9Zm11.6 0c1-.3 2.1.6 2.5 1.9.4 1.3-.1 2.7-1.1 3-1 .3-2.1-.5-2.5-1.9-.4-1.3.1-2.7 1.1-3ZM9.3 3.6c1.1.1 1.9 1.4 1.8 2.9-.1 1.4-1 2.6-2.1 2.5C7.9 8.9 7.1 7.6 7.2 6.2c.1-1.5 1-2.7 2.1-2.6Zm5.4 0c1.1-.1 2 1.1 2.1 2.6.1 1.4-.7 2.7-1.8 2.8-1.1.1-2-1.1-2.1-2.5-.1-1.5.7-2.8 1.8-2.9Z"/></svg>';
const chrome='<header class="site-bar"><a class="brand" href="/"><span class="paw">'+PAW+'</span><span>댕냥이와 함께</span></a><nav class="site-nav" aria-label="주요 메뉴"><a href="/">전국 지도</a><a href="/guides/">여행 가이드</a><a href="/about.html">소개</a></nav></header>';
const trustFooter='<footer class="site-footer"><nav class="trust-nav" aria-label="안내"><a href="/about.html">소개</a><a href="/privacy.html">개인정보처리방침</a><a href="/contact.html">문의</a><a href="/terms.html">이용안내</a></nav><p class="data-credit">장소·반려동물 동반 정보 출처: <a href="https://api.visitkorea.or.kr" target="_blank" rel="noopener">한국관광공사 TourAPI</a> 「반려동물 동반여행 서비스」(<a href="https://www.data.go.kr/data/15135102/openapi.do" target="_blank" rel="noopener">공공데이터포털</a>). 사진은 공공누리 제1유형(출처표시)·제3유형(출처표시+변경금지) 조건에 따라 한국관광공사의 공공저작물을 이용했습니다 (<a href="https://contest.visitkorea.or.kr/kor/helpDesk/copyrightGuide.kto" target="_blank" rel="noopener">한국관광공사 저작권정책</a>). 댕냥이와 함께는 한국관광공사와 제휴하거나 후원받는 사이트가 아닙니다.</p><p>© 2026 댕냥이와 함께 · 운영 김동곤 · <a href="mailto:kdg2844@gmail.com">kdg2844@gmail.com</a> · 공공데이터 기반 안내 · 방문 전 해당 업체에 직접 확인해 주세요.</p><div class="footer-contact"><p><strong>광고 및 제휴 문의</strong></p><p>댕냥이와 함께에 광고 게재나 제휴를 원하시면 아래 메일로 문의해 주세요. 업체명과 문의 내용을 보내주시면 확인 후 회신드리겠습니다.</p><p><a href="mailto:kdg2844@gmail.com">kdg2844@gmail.com</a></p></div></footer>';
const adSlot='<aside class="ad-slot" aria-label="광고"><p class="ad-slot__label">광고</p><ins class="adsbygoogle" style="display:block;width:100%" data-ad-client="ca-pub-4533404826925371" data-ad-format="auto" data-full-width-responsive="true"></ins></aside>';
const adWatch='<script>(function(){function mark(){document.querySelectorAll(".ad-slot").forEach(function(s){var i=s.querySelector("ins.adsbygoogle");s.classList.toggle("is-filled",!!i&&i.getAttribute("data-ad-status")==="filled");});}function topOf(slot){return slot.getBoundingClientRect().top+window.scrollY;}function sink(slot){if(!slot||slot.id==="homeAd")return;slot.style.marginTop="";var steps=0;while(steps<40&&topOf(slot)<window.innerHeight){steps+=1;var next=slot.nextElementSibling;if(next){next.after(slot);continue;}var parent=slot.parentElement;if(parent&&parent!==document.body&&parent.parentElement&&parent.nextElementSibling){parent.after(slot);continue;}break;}var top=topOf(slot);if(top<window.innerHeight)slot.style.marginTop=Math.ceil(window.innerHeight-top)+"px";}function place(){document.querySelectorAll(".ad-slot").forEach(sink);}if(!document.body)return;new MutationObserver(mark).observe(document.body,{subtree:true,attributes:true,attributeFilter:["data-ad-status"]});mark();place();var timer=null;window.addEventListener("resize",function(){if(timer)clearTimeout(timer);timer=setTimeout(place,150);});})();</script>';
const css=':root{color-scheme:light}*{box-sizing:border-box}body{margin:0;background:#faf9f6;color:#262522;font-family:Pretendard,"Noto Sans KR",system-ui,sans-serif;font-size:16px;line-height:1.75;overflow-wrap:break-word}a{color:#1765ac}a:hover{text-decoration:underline}.shell{max-width:920px;margin:auto;padding:0 22px 60px}.site-bar{position:sticky;top:0;z-index:20;display:flex;align-items:center;gap:12px;height:56px;padding:0 16px;background:#faf9f6;border-bottom:1px solid #e7e3da}.brand{display:flex;align-items:center;gap:8px;box-sizing:border-box;min-height:44px;color:#1a1a1a;font-size:17px;font-weight:800;text-decoration:none}.brand .paw{display:grid;place-items:center;width:23px;height:23px}.site-nav{display:flex;gap:2px;margin-left:auto;min-width:0;overflow-x:auto;scrollbar-width:none}.site-nav a{font-size:15px;font-weight:700;color:#1a1a1a;text-decoration:none;box-sizing:border-box;height:44px;min-height:44px;min-width:44px;padding:0 12px;border-radius:999px;white-space:nowrap;background:transparent;display:inline-flex;align-items:center}.site-nav a:hover{background:#f3f1ec}.site-footer{padding:22px 16px 32px;text-align:center;color:#6B675F;font-size:14px}.trust-nav{display:flex;flex-wrap:wrap;justify-content:center;gap:8px 14px;margin:0 0 8px}.trust-nav a{color:#55524C;font-size:15px;font-weight:700;text-decoration:none;box-sizing:border-box;min-width:44px;min-height:44px;padding:0 8px;display:inline-flex;align-items:center;justify-content:center}.course{margin:0;padding-left:20px}.course>li{margin:0 0 18px}.fact-dl{margin:6px 0 0}.fact-dl div{display:grid;grid-template-columns:88px minmax(0,1fr);gap:6px;padding:4px 0;border-bottom:1px solid #f0eeea}.fact-dl dt{color:#6B675F;font-size:14px}.fact-dl dd{margin:0}h1{font-size:clamp(26px,4vw,36px);letter-spacing:-.8px;line-height:1.38;margin:16px 0}h2{font-size:23px;line-height:1.5;margin:36px 0 12px}h3{font-size:18px;margin:20px 0 9px}.lede{font-size:17px;color:#3d4546}.meta{font-size:14px;color:#6B675F}.article{background:white;border-radius:17px;padding:28px 35px;border:1px solid #eceae7}.section{margin-top:27px}.section p{margin:10px 0 16px}.table-scroll{max-width:100%;overflow-x:auto;border-radius:12px;border:1px solid #e8e8e5}table{border-collapse:collapse;width:100%;min-width:580px;font-size:16px}th,td{text-align:left;padding:11px 13px;border-bottom:1px solid #eee}th{background:#f2f5f4}td a{font-weight:700}.figure{margin:23px 0;overflow:hidden;border:1px solid #eee;border-radius:12px;background:#f8f7f2}.figure img{display:block;max-width:100%;width:100%;max-height:300px;object-fit:cover}.figure figcaption{font-size:14px;padding:8px 13px;color:#6B675F}.bullets{padding-left:21px}.bullets li{margin-bottom:12px}.checklist{list-style:none;padding:0}.checklist li{padding:7px 0;border-bottom:1px solid #f3f3f0}.checklist li{position:relative;padding-left:26px}.checklist li:before{content:"";position:absolute;left:0;top:12px;width:16px;height:16px;background:url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2716%27 height=%2716%27 viewBox=%270 0 16 16%27%3E%3Crect x=%271%27 y=%271%27 width=%2714%27 height=%2714%27 rx=%273%27 fill=%27none%27 stroke=%27%235F7161%27 stroke-width=%271.5%27/%3E%3Cpath d=%27M4 8.2 6.6 11 12 5%27 fill=%27none%27 stroke=%27%235F7161%27 stroke-width=%271.6%27 stroke-linecap=%27round%27 stroke-linejoin=%27round%27/%3E%3C/svg%3E") center/16px 16px no-repeat}.subtle{color:#6B675F;font-size:14px}.note{padding:15px 17px;background:#f5f7f5;border-radius:12px;border-left:4px solid #467e70}.summary{margin-top:30px;padding:20px;background:#f6f6f3;border-radius:12px}.refs{padding:14px;background:#faf9f7;border-radius:12px;font-size:15px}.article ul,.article ol{padding-left:21px}.article li{margin:6px 0}.article blockquote{margin:16px 0;padding:12px 16px;background:#f5f7f5;border-left:4px solid #467e70}.article code{font-size:.92em}.miss-links{display:flex;flex-wrap:wrap;gap:4px 8px;align-items:center;margin:12px 0}.miss-links a{display:inline-flex;align-items:center;justify-content:center;box-sizing:border-box;min-width:44px;min-height:44px;padding:0 8px;font-weight:700}.guide-cards{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.guide-card{padding:18px;border:1px solid #ddd;border-radius:12px;background:#fff;text-decoration:none;color:#282722}.guide-card b{display:block;line-height:1.5}.guide-card small{color:#6B675F;font-size:15px}.footer{font-size:14px;color:#6B675F;margin-top:26px}.crumb{font-size:14px;color:#6B675F;margin-top:15px}dl dt{font-weight:700;margin-top:17px}dl dd{margin:4px 0 16px}@media(max-width:680px){.shell{padding:0 14px 45px}.article{padding:18px 17px;border-radius:12px}h2{font-size:20px}.guide-cards{grid-template-columns:1fr}.site-nav{gap:2px}.site-nav a{font-size:15px;height:44px;min-height:44px;min-width:44px;padding:0 12px}}';
function layout(title,desc,url,html,structured){
 const absolute=BASE+url;
 const meta='<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+esc(title)+' | 댕냥이와 함께</title><meta name="description" content="'+esc(desc)+'"><link rel="canonical" href="'+absolute+'"><meta property="og:type" content="article"><meta property="og:title" content="'+esc(title)+'"><meta property="og:description" content="'+esc(desc)+'"><meta property="og:url" content="'+absolute+'"><meta property="og:image" content="'+BASE+'/og/default.png"><meta property="og:site_name" content="댕냥이와 함께"><meta name="twitter:card" content="summary_large_image">';
 return '<!doctype html><html lang="ko"><head>'+meta+'<link rel="stylesheet" href="/ad-slot.css"><style>'+css+'</style>'+(structured?'<script type="application/ld+json">'+JSON.stringify(structured).replace(/</g,"\\u003c")+'</script>':'')+'</head><body>'+chrome+'<div class="shell">'+html+'</div>'+trustFooter+adWatch+'</body></html>';
}
function write(name,html){const p=path.join(OUT,name);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,html,"utf8");}
const PET_EMPTY="정보 없음 — 방문 전 업체에 확인하세요";
const NOT_PET_ALLOWED=new Set(["tour-2528107","tour-3101971","tour-1990092"]);
function isCampsite(place){
 return place.source==="gocamping"&&/캠핑|글램핑|야영|카라반|캠프/.test(place.name||"");
}
function getPlaces(g){
 const terms=g.regionKeys||[];
 let list=all.filter(p=>{
  if(!indexRule.includeInPetLists(p))return false;
  if(NOT_PET_ALLOWED.has(p.id)||/국립공원/.test(p.name||""))return false;
  if(g.categories&&g.categories.length&&!g.categories.includes(p.category))return false;
  if(terms.length&&!terms.some(s=>(p.addr||"").includes(s)))return false;
  if(g.id==="pet-camping-glamping-korea"&&!isCampsite(p))return false;
  return true;
 });
 if(!terms.length)list=list.slice().sort((a,b)=>String(a.name||"").localeCompare(String(b.name||""),"ko"));
 return list.slice(0,8);
}
function itemTable(places){
 const rows=places.map(p=>'<tr><td><a href="/place/'+encodeURIComponent(p.id)+'.html">'+esc(p.name)+'</a></td><td>'+esc(p.addr||"주소 재확인")+'</td><td>'+esc(({stay:"숙박",food:"음식점·카페",park:"산책·놀이터",hospital:"동물병원"})[p.category]||"장소")+'</td><td>'+esc(PET_EMPTY)+'</td></tr>').join("");
 return '<div class="table-scroll"><table><thead><tr><th>장소명</th><th>주소</th><th>유형</th><th>동반 조건·요금</th></tr></thead><tbody>'+rows+'</tbody></table></div><p class="subtle">표의 장소는 사이트 수록 데이터에서 지역·카테고리 기준으로 추린 목록이며, 추천 순위나 최신 운영 보증이 아닙니다. 국립공원은 출입 제한, 도립공원·군립공원·자연휴양림은 출입 미확인이라 이 표에 넣지 않습니다. 자세한 사항은 각 시설에 확인하세요.</p>';
}
function compareTable(g){
 const opts=[
 ["동반 허용","실내/야외/객실 여부","입장 전 전화·공식 공지 확인"],
 ["반려동물 제한","무게·견종·마릿수·묘 동반","시설별 규정과 예외 확인"],
 ["이용 비용","동반 추가요금·청소비·취소 수수료","예약 단계에서 최종 금액 확인"],
 ["위생·안전","리드줄·입마개·접종·배변 처리","현장 규정 준수"],
 ["이동 편의","주차·휴식 장소·응급병원","날씨와 이동시간을 고려"]
 ];
 return '<div class="table-scroll"><table><thead><tr><th>확인 항목</th><th>무엇을 볼까?</th><th>추천 확인 방법</th></tr></thead><tbody>'+opts.map(o=>'<tr>'+o.map(x=>'<td>'+esc(x)+'</td>').join("")+'</tr>').join("")+'</tbody></table></div>';
}
function faqPairs(g){
 let common=[
 ["실내에서도 반려견과 함께 있을 수 있나요?","반려동물 동반 표기가 있어도 실내 허용 여부는 다릅니다. 방문 전 매장에 확인해야 합니다."],
 ["대형견 또는 고양이도 동반할 수 있나요?","동반 가능 종과 체중 제한은 시설마다 다릅니다. 예약 전에 정확한 조건을 확인하세요."],
 ["정확한 요금과 운영시간은 어디서 확인하나요?","지도에 표시된 정보를 참고하되, 예약 화면과 업체 공식 안내에서 최신 조건을 확인하세요."],
 ["동반 장소를 효율적으로 찾는 방법은?","petmap.kr 지도에서 지역명과 카테고리를 검색하고 전화로 조건을 확인하면 편리합니다."]
 ];
 return [g.faq1||common[0],g.faq2||common[1],g.faq3||common[2],g.faq4||common[3]];
}
function factDl(place){
 return '<dl class="fact-dl">'+placeFacts.rows(place).map(row=>{
  const body=row.href?'<a href="'+esc(row.href)+'" target="_blank" rel="noopener">'+esc(row.value)+'</a>':esc(row.value);
  return '<div><dt>'+esc(row.label)+'</dt><dd>'+body+'</dd></div>';
 }).join("")+'</dl>';
}
function localityName(addr){
 const parts=String(addr||"").trim().split(/\s+/);
 return parts[1]||parts[0]||"기타";
}
function regionCourses(g){
 const terms=g.regionKeys||[];
 let pool=all.filter(p=>indexRule.includeInPetLists(p)&&terms.some(s=>(p.addr||"").includes(s)));
 if(g.categories&&g.categories.length){
  const matched=pool.filter(p=>g.categories.includes(p.category));
  if(matched.length>=4)pool=matched;
 }
 const groups=new Map();
 for(const place of pool){
  const key=localityName(place.addr);
  if(!groups.has(key))groups.set(key,[]);
  groups.get(key).push(place);
 }
 const courses=[];
 for(const [name,list] of [...groups.entries()].sort((a,b)=>b[1].length-a[1].length||a[0].localeCompare(b[0],"ko"))){
  if(courses.length>=4)break;
  const picked=[];
  for(const cat of ["park","food","stay","hospital"]){
   const found=list.find(p=>p.category===cat&&!picked.includes(p));
   if(found)picked.push(found);
  }
  for(const place of list){
   if(picked.length>=3)break;
   if(!picked.includes(place))picked.push(place);
  }
  if(picked.length)courses.push({name,places:picked.slice(0,3)});
 }
 return courses;
}
function makeRegionGuide(g){
 const url="/guides/"+g.id+".html";
 const courses=regionCourses(g);
 const label=(g.regionKeys||[]).join("·")||g.title;
 const imgcat=(g.categories||[]).includes("stay")?"stay":(g.categories||[]).includes("hospital")?"hospital":(g.categories||[]).includes("park")?"park":"food";
 const image='<figure class="figure"><img src="/og/'+imgcat+'.png" width="1200" height="630" alt="'+esc(g.title)+'"></figure>';
 let blocks="";
 if(!courses.length){
  blocks=sec("수록 장소",para(label+" 주소와 맞는 수록 장소가 없습니다."));
  blocks+=adSlot;
 }else{
  courses.forEach((course,index)=>{
   const stops=course.places.map(place=>{
    const kind=({stay:"숙박",food:"음식점·카페",park:"산책·놀이",hospital:"동물병원"})[place.category]||"장소";
    return '<li><a href="/place/'+encodeURIComponent(place.id)+'.html">'+esc(place.name)+'</a> · '+esc(kind)+factDl(place)+'</li>';
   }).join("");
   blocks+=sec(course.name+" 코스",'<ol class="course">'+stops+'</ol>');
   if(index===1||(courses.length<2&&index===0))blocks+=adSlot;
  });
 }
 const html='<div class="crumb"><a href="/guides/">여행 가이드</a> / '+esc(g.group)+'</div><article class="article"><h1>'+esc(g.title)+'</h1><p class="meta">수록 장소 코스 · '+updated+'</p><p>'+esc(label)+' 수록 장소의 주소·유형과, 데이터에 있는 동반 조건만 적습니다. 없는 칸은 확인 필요라고 적고, TourAPI 동반 칸이 비어 있으면 정보 없음이라고 적습니다.</p>'+image+blocks+'<p><a href="/">전국 지도</a></p></article>';
 const structured={"@context":"https://schema.org","@type":"Article",headline:g.title,dateModified:updated,inLanguage:"ko-KR",author:{"@type":"Organization",name:"댕냥이와 함께"},mainEntityOfPage:BASE+url};
 return layout(g.title,label+" 수록 장소의 주소·유형·동반 조건 칸",url,html,structured);
}
function inlineMd(raw){
 const re=/(\*\*([^*]+)\*\*|`([^`]+)`|\[([^\]]+)\]\(([^)\s]+)\))/g;
 let out="", last=0, match;
 const text=String(raw);
 while((match=re.exec(text))){
  out+=esc(text.slice(last,match.index));
  if(match[2])out+="<strong>"+esc(match[2])+"</strong>";
  else if(match[3])out+="<code>"+esc(match[3])+"</code>";
  else{
   let href=match[5].replace(/^https:\/\/www\.petmap\.kr(?=\/)/,"");
   const external=/^https?:/i.test(href);
   out+='<a href="'+esc(href)+'"'+(external?' target="_blank" rel="noopener"':'')+'>'+esc(match[4])+"</a>";
  }
  last=match.index+match[0].length;
 }
 return out+esc(text.slice(last));
}
function guideBodyPath(g){return path.join(ROOT,"content","guide-bodies",g.id+".md");}
function guideSource(g){
 const md=fs.readFileSync(guideBodyPath(g),"utf8").replace(/\r\n/g,"\n");
 const title=(md.match(/^#\s+(.+)$/m)||[null,g.title])[1].trim();
 return {md,title};
}
function firstParagraph(md){
 const buf=[];
 for(const line of md.split("\n")){
  if(/^#\s/.test(line))continue;
  if(!line.trim()){if(buf.length)break;continue;}
  if(/^[#|>-]/.test(line)||line.startsWith("|")||line.startsWith("<!--"))break;
  buf.push(line.trim());
 }
 return buf.join(" ");
}
function renderMarkdown(md){
 const lines=md.replace(/\r\n/g,"\n").split("\n");
 const out=[];
 let i=0;
 while(i<lines.length){
  const line=lines[i];
  if(!line.trim()){i++;continue;}
  if(line.startsWith("<!--")&&line.includes("-->")){out.push(line);i++;continue;}
  const heading=line.match(/^(#{1,3})\s+(.+)$/);
  if(heading){
   if(heading[1].length>1)out.push("<h"+heading[1].length+">"+inlineMd(heading[2])+"</h"+heading[1].length+">");
   i++;continue;
  }
  if(line.startsWith("> ")){
   const quote=[];
   while(i<lines.length&&lines[i].startsWith("> ")){quote.push(lines[i].slice(2));i++;}
   out.push("<blockquote><p>"+inlineMd(quote.join(" "))+"</p></blockquote>");
   continue;
  }
  if(line.startsWith("|")){
   const rows=[];
   while(i<lines.length&&lines[i].startsWith("|")){rows.push(lines[i]);i++;}
   const parsed=rows.filter(row=>!/^\|[\s|:-]+\|$/.test(row));
   const cells=row=>row.split("|").slice(1,-1).map(cell=>cell.trim());
   const head=cells(parsed[0]||"");
   const body=parsed.slice(1);
   out.push('<div class="table-scroll"><table><thead><tr>'+head.map(cell=>"<th>"+inlineMd(cell)+"</th>").join("")+"</tr></thead><tbody>"+body.map(row=>"<tr>"+cells(row).map(cell=>"<td>"+inlineMd(cell)+"</td>").join("")+"</tr>").join("")+"</tbody></table></div>");
   continue;
  }
  if(/^[-*]\s/.test(line)){
   const items=[];
   while(i<lines.length&&/^[-*]\s/.test(lines[i])){items.push(lines[i].replace(/^[-*]\s+/,""));i++;}
   out.push("<ul>"+items.map(item=>"<li>"+inlineMd(item)+"</li>").join("")+"</ul>");
   continue;
  }
  const para=[];
  while(i<lines.length&&lines[i].trim()&&!/^#{1,3}\s/.test(lines[i])&&!lines[i].startsWith("|")&&!lines[i].startsWith("> ")&&!/^[-*]\s/.test(lines[i])&&!lines[i].startsWith("<!--")){
   para.push(lines[i].trim());
   i++;
  }
  if(para.length)out.push("<p>"+inlineMd(para.join(" "))+"</p>");
 }
 return out.join("");
}
function campTable(places){
 const kind={stay:"숙박",food:"음식점·카페",park:"산책·공원",hospital:"동물병원"};
 const rows=places.map(place=>"<tr><td><a href=\"/place/"+encodeURIComponent(place.id)+".html\">"+esc(place.name)+"</a></td><td>"+esc(place.addr||"")+"</td><td>"+esc(kind[place.category]||"장소")+"</td><td>"+esc(PET_EMPTY)+"</td></tr>").join("");
 return '<div class="table-scroll"><table><thead><tr><th>장소</th><th>주소</th><th>유형</th><th>동반 조건 (TourAPI)</th></tr></thead><tbody>'+rows+"</tbody></table></div>";
}
function makeGuide(g){
 const url="/guides/"+g.id+".html";
 const src=guideSource(g);
 let body=renderMarkdown(src.md);
 if(g.id==="pet-camping-glamping-korea"){
  if(!body.includes("<!--CAMP_TABLE-->"))throw new Error("캠핑 가이드 표 위치가 없습니다.");
  const camps=getPlaces(g);
  if(camps.length<8||camps.some(place=>place.source!=="gocamping"))throw new Error("캠핑 가이드가 캠핑장을 고르지 못했습니다.");
  body=body.replace("<!--CAMP_TABLE-->",campTable(camps));
 }
 const imgcat=(g.categories||[]).includes("stay")?"stay":(g.categories||[]).includes("hospital")?"hospital":(g.categories||[]).includes("park")?"park":"food";
 const image='<figure class="figure"><img src="/og/'+imgcat+'.png" width="1200" height="630" alt="'+esc(src.title)+'"></figure>';
 const secondHeading=body.indexOf("<h2>",body.indexOf("<h2>")+4);
 if(secondHeading>0)body=body.slice(0,secondHeading)+adSlot+body.slice(secondHeading);
 else body+=adSlot;
 const desc=firstParagraph(src.md)||g.description||src.title;
 const html='<div class="crumb"><a href="/guides/">여행 가이드</a> / '+esc(g.group)+'</div><article class="article"><h1>'+esc(src.title)+'</h1><p class="meta">작성 2026-10-18 · 갱신 2026-10-18</p>'+image+body+'<p><a href="/">전국 지도</a></p></article>';
 const structured={"@context":"https://schema.org","@type":"Article",headline:src.title,description:desc,datePublished:LONG_DATE,dateModified:LONG_DATE,inLanguage:"ko-KR",author:{"@type":"Organization",name:"댕냥이와 함께"},publisher:{"@type":"Organization",name:"댕냥이와 함께"},mainEntityOfPage:BASE+url};
 return layout(src.title,desc,url,html,structured);
}
function makeLongGuide(g){
 const url="/guides/"+g.id+".html";
 const file=path.join(ROOT,"content","long",g.id+".html");
 let body=fs.readFileSync(file,"utf8").trim();
 if(!body.includes("<!--AD-->"))throw new Error("광고 위치가 없습니다: "+g.id);
 body=body.replace("<!--AD-->","");
 let seenSection=0;
 body=body.replace(/<\/section>/g,(tag)=>{seenSection+=1;return seenSection===3?tag+adSlot:tag;});
 if(!body.includes('class="ad-slot"'))body+=adSlot;
 const html='<div class="crumb"><a href="/guides/">여행 가이드</a> / '+esc(g.group)+'</div>'+body;
 const structured={"@context":"https://schema.org","@type":"Article",headline:g.title,description:g.description,datePublished:LONG_DATE,dateModified:LONG_DATE,inLanguage:"ko-KR",author:{"@type":"Person",name:"김동곤"},publisher:{"@type":"Organization",name:"댕냥이와 함께"},mainEntityOfPage:BASE+url};
 return layout(g.title,g.description,url,html,structured);
}
function legal(title,url,description,body,date){const when=date||updated;write(url.slice(1),layout(title,description,url,'<article class="article"><h1>'+esc(title)+'</h1><p class="meta">시행·갱신일: '+when+'</p>'+body+'</article>',null));}
function patchMap(){
 const file=path.join(OUT,"index.html");let html=fs.readFileSync(file,"utf8");
 if(!html.includes("href=\"/guides/\"")){
  html=html.replace('</header>','<div style="display:flex;flex-wrap:wrap;gap:8px;margin:12px 0 0"><a style="font-size:13px;padding:6px 12px;border:1px solid #ddd;border-radius:20px;text-decoration:none;color:inherit" href="/guides/">여행 가이드 31편 ↗</a><a style="font-size:13px;padding:6px 12px;border:1px solid #ddd;border-radius:20px;text-decoration:none;color:inherit" href="/about.html">사이트 소개</a></div></header>');
  html=html.replace('</footer>','<br><a href="/guides/">여행 가이드</a> · <a href="/about.html">소개</a> · <a href="/privacy.html">개인정보처리방침</a> · <a href="/contact.html">문의·정보정정</a> · <a href="/terms.html">이용안내</a></footer>');
 }
 fs.writeFileSync(file,html,"utf8");
}
function guideCard(g,index,total,blurb){
 return '<a class="guide-card" href="/guides/'+g.id+'.html"><small>'+esc(g.group)+' · '+(index+1)+'/'+total+'</small><b>'+esc(g.title)+'</b><small>'+esc(blurb)+'</small></a>';
}
function build(){
 if(!Array.isArray(data)||data.length!==20)throw Error("기존 여행 가이드 항목 수가 20개가 아닙니다.");
 if(!Array.isArray(longGuides)||longGuides.length!==12)throw Error("새 가이드 항목 수가 12개가 아닙니다.");
 const listedLong=longGuides.filter(g=>!EXCLUDED_FROM_LISTS.has(g.id));
 const total=data.length+listedLong.length;
 const longCards=listedLong.map((g,i)=>guideCard(g,i,listedLong.length,g.description)).join("");
 const cardList=data.map((g,i)=>{const src=guideSource(g);const excerpt=firstParagraph(src.md);return guideCard(Object.assign({},g,{title:src.title}),i,data.length,excerpt.length>90?excerpt.slice(0,90)+"…":excerpt);}).join("");
 const cover='<article class="article"><h1>반려동물 동반 여행 가이드 '+total+'편</h1><p class="lede">장소 파일에서 센 지역 분포, 열차·버스·항공·자가용의 공식 규정, 그리고 기존의 지역·테마 글을 한 목록에 모았습니다. 규정 숫자는 출처 페이지에 있는 것만 적습니다.</p><h2>데이터와 규정 '+listedLong.length+'편</h2><div class="guide-cards">'+longCards+'</div><h2>지역·테마·실용 '+data.length+'편</h2><div class="guide-cards">'+cardList+'</div></article>';
 write("guides/index.html",layout("반려동물 동반 여행 가이드 "+total+"편","반려동물 동반 여행의 지역 분포, 교통 규정, 지역별·테마별 가이드 "+total+"편.","/guides/",cover));
 for(let i=0;i<data.length;i++)write("guides/"+data[i].id+".html",makeGuide(data[i],i));
 for(const g of longGuides){const page=makeLongGuide(g);write("guides/"+g.id+".html",EXCLUDED_FROM_LISTS.has(g.id)?page.replace(adSlot,"").replace("<head>",'<head><meta name="robots" content="noindex, follow">'):page);}
 legal("댕냥이와 함께 소개","/about.html","반려동물 동반 전국 지도 서비스의 데이터 출처, 운영 원칙과 정보 이용 방법 안내.",'<p>댕냥이와 함께(petmap.kr)는 반려동물 보호자가 전국의 동반 숙박·카페·음식점·산책 공간과 야간 동물병원을 탐색하도록 돕는 정보 지도입니다. 편집 목적은 장소를 쉽게 비교하고 방문 전에 확인할 사항을 분명하게 알려드리는 것입니다.</p><h2>데이터는 어떻게 마련하나요?</h2><p>장소 정보는 한국관광공사 TourAPI, 공공 관광·문화 데이터, 고캠핑 및 외부 병원 안내 목록을 바탕으로 정리합니다. 데이터 수록과 실제 동반 허용·예약 가능·24시간 응급진료 가능 여부는 동일하지 않습니다. 운영시간, 추가요금, 병원 당직 여부 등은 업체에 직접 확인해 주세요.</p><h2>편집 원칙</h2><p>광고·제휴 여부와 관계없이 실제 여행 준비에 도움이 되는 정보를 우선합니다. 확인되지 않은 가격이나 체중 제한을 사실처럼 표기하지 않고, 오류를 발견한 이용자의 정정 제안을 받습니다. 본 사이트는 수의학적 진단, 예약 대행 또는 현장 이용 허가를 제공하지 않습니다.</p><h2>자료·정정 요청</h2><p>오류·폐업·동반 조건 변경 등이 있다면 <a href="/contact.html">문의·정정 안내</a>를 이용해 주세요. 여행 참고 자료는 <a href="/guides/">여행 가이드</a>에서 확인할 수 있습니다.</p><h2>운영자</h2><p>댕냥이와 함께는 김동곤이 운영합니다. 문의는 <a href="mailto:kdg2844@gmail.com">kdg2844@gmail.com</a>으로 보내 주세요.</p>');
 legal("개인정보처리방침","/privacy.html","petmap.kr의 쿠키·Google AdSense 및 개인정보 취급 안내.",fs.readFileSync(path.join(ROOT,"content/legal/privacy.html"),"utf8"),"2026-10-18");
 legal("문의·장소 정보 정정","/contact.html","petmap.kr 동반 시설 정보 오류, 운영시간 변경 및 개인정보 관련 문의 접수 안내.",'<p>반려동물 동반 규정·영업 여부·병원 진료시간 변경을 발견했다면 근거와 함께 알려 주세요. 정확한 정보를 제공하기 위해 업소 공식 공지 또는 전화 확인 등 검증 가능한 자료가 있으면 도움이 됩니다.</p><p id="placeCorrectionNote">장소 상세의 정보 정정 요청으로 오면 주소에 place 값이 붙습니다. 그 값이 정정하려는 장소입니다.</p><script>(function(){var id=new URLSearchParams(location.search).get("place");var note=document.getElementById("placeCorrectionNote");if(!id||!note)return;note.textContent="정정 요청 장소 ID: "+id+". 아래 제안에 이 값과 상세 페이지 주소를 함께 적어 주세요.";})();</script><h2>정보 정정 제안</h2><p>현재 확인 가능한 공개 정정 창구는 프로젝트 GitHub 이슈입니다. GitHub 로그인이 필요할 수 있으며 문의가 공개될 수 있으므로 전화번호·주소 등 개인정보나 민감한 정보를 기재하지 마세요.</p><p><a href="https://github.com/kdg28447520/petmap/issues/new" target="_blank" rel="noopener">→ GitHub에서 장소 정보 정정 제안하기</a></p><h2>제안 시 유용한 정보</h2><ul><li>장소명과 지도 상세 페이지 URL</li><li>바뀐 항목(운영시간·동반 허용·폐업 등)</li><li>근거 자료의 공개 URL 또는 확인 일자</li></ul><h2>운영자</h2><p>운영자는 김동곤입니다. 장소 정보 정정과 개인정보 관련 문의는 <a href="mailto:kdg2844@gmail.com">kdg2844@gmail.com</a>으로 보내 주세요.</p><h2>개인정보 관련 요청</h2><p>본 사이트는 별도 회원가입 화면을 제공하지 않습니다. 개인정보 요청은 위 이메일로 보내 주세요. GitHub 공개 이슈에는 개인 정보를 올리지 마세요.</p>');
 legal("댕냥이와 함께 이용약관","/terms.html","댕냥이와 함께 이용 조건, 자료 출처, 광고와 책임의 한계.",fs.readFileSync(path.join(ROOT,"content/legal/terms.html"),"utf8"),"2026-10-18");
 patchMap();
 write404();
 const urls=[["/guides/",LONG_DATE],["/about.html",updated],["/privacy.html","2026-10-18"],["/contact.html",updated],["/terms.html","2026-10-18"],...data.map(g=>["/guides/"+g.id+".html",LONG_DATE]),...listedLong.map(g=>["/guides/"+g.id+".html",LONG_DATE])];
 const site=path.join(OUT,"sitemap.xml");let xml=fs.readFileSync(site,"utf8");
 const fresh=urls.filter(([p])=>!xml.includes("<loc>"+BASE+p+"</loc>"));
 xml=xml.replace("</urlset>",fresh.map(([p,when])=>'<url><loc>'+BASE+p+'</loc><lastmod>'+when+'</lastmod></url>').join("\n")+(fresh.length?"\n":"")+"</urlset>");
 fs.writeFileSync(site,xml,"utf8");
 const related=injectRelatedGuides();
 console.log("[petmap guides] published",data.length,"short +",longGuides.length,"long guides and 4 policy pages; sitemap +",urls.length,"URLs; related-guide blocks",related);
}
function write404(){
 const body='<article class="article"><h1>페이지를 찾지 못했습니다</h1><p>주소가 바뀌었거나 없는 페이지입니다. 아래 메뉴에서 다시 찾아 보세요.</p><p class="miss-links"><a href="/">전국 지도</a><a href="/guides/">여행 가이드</a><a href="/about.html">소개</a></p><nav class="miss-links" aria-label="안내"><a href="/privacy.html">개인정보처리방침</a><a href="/contact.html">문의</a><a href="/terms.html">이용안내</a></nav></article>';
 const html=layout("페이지를 찾지 못했습니다","요청한 페이지가 없습니다.","/404.html",body,null).replace("<head>",'<head><meta name="robots" content="noindex, follow">');
 write("404.html",html);
}
function injectRelatedGuides(){
 const byPlace=new Map();
 const guideDir=path.join(OUT,"guides");
 for(const name of fs.readdirSync(guideDir).filter(item=>item.endsWith(".html")&&item!=="index.html"&&item!=="korea-pet-map-counts.html")){
  const html=fs.readFileSync(path.join(guideDir,name),"utf8");
  const title=(html.match(/<h1>([^<]+)<\/h1>/)||[,"여행 가이드"])[1];
  const id=name.replace(/\.html$/,"");
  const ids=new Set([...html.matchAll(/href="\/place\/([^"]+)\.html"/g)].map(match=>decodeURIComponent(match[1])));
  for(const placeId of ids){
   if(!byPlace.has(placeId))byPlace.set(placeId,[]);
   byPlace.get(placeId).push({id,title});
  }
 }
 let shown=0;
 const placeDir=path.join(OUT,"place");
 for(const name of fs.readdirSync(placeDir).filter(item=>item.endsWith(".html"))){
  const file=path.join(placeDir,name);
  let html=fs.readFileSync(file,"utf8");
  const placeId=decodeURIComponent(name.replace(/\.html$/,""));
  const guides=byPlace.get(placeId)||[];
  const block=guides.length?'<h2 class="pd-sec-title">관련 가이드</h2><ul class="pd-related">'+guides.map(guide=>'<li><a href="/guides/'+encodeURIComponent(guide.id)+'.html">'+guide.title+'</a></li>').join("")+"</ul>":"";
  if(guides.length)shown++;
  if(html.includes("<!--RELATED_GUIDES-->"))html=html.replace("<!--RELATED_GUIDES-->",block);
  else if(block&&!html.includes("관련 가이드"))html=html.replace('<p class="pd-correct">',block+'<p class="pd-correct">');
  fs.writeFileSync(file,html);
 }
 return shown;
}
function placeNameLinkStats(){
 const names=new Set(all.map(place=>String(place.name||"").trim()).filter(Boolean));
 let total=0, linked=0, guidesWithPlaceLink=0, guidePages=0;
 const guideDir=path.join(OUT,"guides");
 for(const name of fs.readdirSync(guideDir).filter(item=>item.endsWith(".html")&&item!=="index.html")){
  guidePages++;
  const html=fs.readFileSync(path.join(guideDir,name),"utf8");
  if(/href="\/place\/[^"]+\.html"/.test(html))guidesWithPlaceLink++;
  for(const row of html.matchAll(/<tr>([\s\S]*?)<\/tr>/g)){
   const cell=(row[1].match(/<td>([\s\S]*?)<\/td>/)||[])[1];
   if(!cell)continue;
   const text=cell.replace(/<[^>]+>/g,"").replace(/\s+/g," ").trim();
   if(!names.has(text))continue;
   total++;
   if(/<a\b[^>]*href="\/place\/[^"]+\.html"/.test(cell))linked++;
  }
 }
 return {total, linked, rate:total?linked/total:1, guidesWithPlaceLink, guidePages};
}
build();

function connectAdsense(){
 const publisher="ca-pub-4533404826925371";
 const script='<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client='+publisher+'" crossorigin="anonymous"></script>';
 const meta='<meta name="google-adsense-account" content="'+publisher+'">';
 function walk(dir){
  for(const ent of fs.readdirSync(dir,{withFileTypes:true})){
   const filename=path.join(dir,ent.name);
   if(ent.isDirectory())walk(filename);
   else if(ent.name.endsWith(".html")){
    if(ent.name==="404.html"&&path.dirname(filename)===OUT)continue;
    let html=fs.readFileSync(filename,"utf8");
    let changed=false;
    if(!html.includes("adsbygoogle.js")){
      html=html.replace(/<\/head>/i,script+meta+"</head>");
      changed=true;
    }else if(!html.includes('name="google-adsense-account"')){
      html=html.replace(/<\/head>/i,meta+"</head>");
      changed=true;
    }
    if(changed)fs.writeFileSync(filename,html,"utf8");
   }
  }
 }
 walk(OUT);
 fs.writeFileSync(path.join(OUT,"ads.txt"),"google.com, "+publisher.replace("ca-","")+", DIRECT, f08c47fec0942fa0\n","utf8");
 console.log("[petmap adsense] ad script, verification meta, and ads.txt generated");
}
connectAdsense();

function injectAnalytics(){
 const id="G-18XXSL2NNJ";
 const snippet='<!-- Google tag (gtag.js) --><script async src="https://www.googletagmanager.com/gtag/js?id='+id+'"></script><script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag(\'js\',new Date());gtag(\'config\',\''+id+'\');</script>';
 const present=/googletagmanager\.com\/gtag\/js|google-analytics\.com\/(?:analytics|ga)\.js|googletagmanager\.com\/gtm\.js|\bgtag\s*\(/;
 function walk(dir){
  for(const ent of fs.readdirSync(dir,{withFileTypes:true})){
   const filename=path.join(dir,ent.name);
   if(ent.isDirectory())walk(filename);
   else if(ent.name.endsWith(".html")){
    const html=fs.readFileSync(filename,"utf8");
    if(present.test(html))continue;
    if(!/<head\b/i.test(html))throw new Error("GA를 넣을 head가 없습니다: "+filename);
    fs.writeFileSync(filename,html.replace(/<head\b[^>]*>/i,function(open){return open+snippet;}),"utf8");
   }
  }
 }
 walk(OUT);
 console.log("[petmap analytics] gtag.js "+id);
}
injectAnalytics();

function assertPublished(){
 const xml=fs.readFileSync(path.join(OUT,"sitemap.xml"),"utf8");
 const locs=new Set([...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>m[1]));
 const scriptSrc="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-4533404826925371";
 const problems=[];
 let htmlCount=0, noindex=0, missingScript=0;
 function pageUrl(filename){
  const rel="/"+path.relative(OUT,filename).split(path.sep).join("/");
  if(rel==="/index.html")return BASE+"/";
  if(rel.endsWith("/index.html"))return BASE+rel.slice(0,-"index.html".length);
  return BASE+rel;
 }
 function walk(dir){
  for(const ent of fs.readdirSync(dir,{withFileTypes:true})){
   const filename=path.join(dir,ent.name);
   if(ent.isDirectory())walk(filename);
   else if(ent.name.endsWith(".html")){
    htmlCount++;
    const html=fs.readFileSync(filename,"utf8");
    const url=pageUrl(filename);
    const rel="/"+path.relative(OUT,filename).split(path.sep).join("/");
    if(rel!=="/404.html"&&(!html.includes(scriptSrc)||!html.includes('crossorigin="anonymous"')||!html.includes('name="google-adsense-account"')))missingScript++;
    const headEnd=html.search(/<\/head>/i);
    const head=headEnd>=0?html.slice(0,headEnd):"";
    const gaSrc=(head.match(/https:\/\/www\.googletagmanager\.com\/gtag\/js\?id=G-18XXSL2NNJ/g)||[]).length;
    const gaCfg=(head.match(/gtag\('config','G-18XXSL2NNJ'\)/g)||[]).length;
    const gaAll=(html.match(/G-18XXSL2NNJ/g)||[]).length;
    if(gaSrc!==1||gaCfg!==1||gaAll!==2)problems.push("GA4 gtag이 head에 한 번이 아님: "+rel);
    const blocked=html.includes('name="robots" content="noindex, follow"');
    const adUnit=/<ins\b[^>]*\bclass="adsbygoogle"/.test(html);
    const barePage=rel==="/404.html"||rel.includes("/admin")||rel==="/about.html"||rel==="/privacy.html"||rel==="/contact.html"||rel==="/terms.html";
    if(blocked){
     noindex++;
     if(locs.has(url))problems.push("noindex인데 사이트맵에 있음: "+url);
     if(adUnit)problems.push("noindex 페이지에 광고 단위: "+rel);
    }else if(!locs.has(url))problems.push("색인 대상인데 사이트맵에 없음: "+url);
    if(blocked && !rel.startsWith("/place/") && rel!=="/404.html" && rel!=="/guides/korea-pet-map-counts.html")problems.push("장소가 아닌 페이지가 noindex: "+rel);
    if(barePage && adUnit)problems.push("얇거나 오류 페이지에 광고 단위: "+rel);
    if(rel.startsWith("/place/") && !html.includes("정보 정정 요청"))problems.push("정정 요청 링크 없음: "+rel);
    if(!blocked && rel.startsWith("/place/") && !adUnit)problems.push("색인 장소 페이지에 광고 단위가 없습니다: "+rel);
    if(rel.startsWith("/place/") && adUnit && blocked)problems.push("광고 제외와 noindex가 한 페이지에서 어긋남: "+rel);
   }
  }
 }
 walk(OUT);
 const privacy=fs.readFileSync(path.join(OUT,"privacy.html"),"utf8");
 if(!privacy.includes("Google AdSense")||!privacy.includes("쿠키"))problems.push("개인정보처리방침에 AdSense 쿠키 안내가 없습니다.");
 if(!privacy.includes("맞춤 광고를 끄는 방법")||!privacy.includes("https://adssettings.google.com/")||!privacy.includes("https://aboutads.info/"))problems.push("개인정보처리방침에 맞춤 광고 거부 안내가 없습니다.");
 if(!privacy.includes("Google을 포함한 제3자 업체")||!privacy.includes("다른 웹사이트를 이전에 방문한 기록")||!privacy.includes("https://policies.google.com/technologies/ads")||!privacy.includes("https://www.aboutads.info/choices/"))problems.push("개인정보처리방침에 제3자 업체 쿠키 고지가 없습니다.");
 if(privacy.includes("송출이 확인된 상태는 아닙니다"))problems.push("개인정보처리방침이 아직 광고 미사용으로 적혀 있습니다.");
 if(privacy.includes("코드 기반의 안내"))problems.push("개인정보처리방침에 임시 안내 문장이 남아 있습니다.");
 for(const phrase of ["처리하는 개인정보","제3자에게 제공하지 않습니다","국외 이전","Vercel Inc.","파기 절차","열람","처리정지","개인정보 보호책임자","1833-6972","privacy.kisa.or.kr","만 14세","youronlinechoices.eu","2026년 10월 17일","현재 위치 정보를 사용하지 않습니다.","GitHub, Inc.","OpenStreetMap France","OpenStreetMap Foundation","[상호]"]){
  if(!privacy.includes(phrase))problems.push("개인정보처리방침 항목 누락: "+phrase);
 }
 if(privacy.includes("T맵")||privacy.includes("이용자 기기 안에서만"))problems.push("쓰지 않는 T맵 또는 위치 기능 안내가 남아 있습니다.");
 const ads=fs.readFileSync(path.join(OUT,"ads.txt"),"utf8");
 if(ads!=="google.com, pub-4533404826925371, DIRECT, f08c47fec0942fa0\n")problems.push("ads.txt 내용이 게시자 ID와 다릅니다.");
 const samplePlace=fs.readFileSync(path.join(OUT,"place","tour-2707444.html"),"utf8");
 if(!samplePlace.includes('class="site-bar"')||!samplePlace.includes('href="/privacy.html"')||!samplePlace.includes("이용안내"))problems.push("장소 페이지에 공통 헤더·푸터가 없습니다.");
 const sampleFacts=(samplePlace.match(/<section class="facts"[\s\S]*?<\/section>/)||[""])[0];
 if(samplePlace.includes("확인 중")||sampleFacts.includes("정보 없음 — 방문 전 업체에 확인하세요")||sampleFacts.includes("<dd>확인 필요</dd>")||(!sampleFacts.includes("<dt>")&&!sampleFacts.includes("동반 조건은 방문 전 업체에 확인해 주세요.")))problems.push("빈 정보 행이 장소 페이지에 남아 있습니다.");
 const sampleGuide=fs.readFileSync(path.join(OUT,"guides","jeju-pet-flight-guide.html"),"utf8");
 if(/🐾|📌|☑/.test(sampleGuide))problems.push("가이드에 이모지 아이콘이 남아 있습니다.");
 if(!sampleGuide.includes('class="ad-slot"')||!sampleGuide.includes('href="/ad-slot.css"')||sampleGuide.includes("min-height:250px"))problems.push("접히는 광고 슬롯이 없습니다.");
 if(!/<img\b[^>]*\bwidth="1200"[^>]*\bheight="630"/.test(sampleGuide))problems.push("가이드 이미지에 너비·높이가 없습니다.");
 for(const name of ["about.html","privacy.html","contact.html"]){
  const page=fs.readFileSync(path.join(OUT,name),"utf8");
  if(!page.includes("김동곤")||!page.includes("mailto:kdg2844@gmail.com"))problems.push(name+"에 운영자 이름이나 이메일이 없습니다.");
 }
 const placeLocs=[...locs].filter(u=>u.includes("/place/"));
 const indexHtml=fs.readFileSync(path.join(OUT,"guides","index.html"),"utf8");
 const seenSentence=new Map();
 function loadPlaces(){
  const list=[];
  const dir=path.join(ROOT,"data");
  for(const name of fs.readdirSync(dir).filter(item=>/^places_part\d+\.json$/.test(item)).sort()){
   let text=fs.readFileSync(path.join(dir,name),"utf8").trim();
   if(!text.startsWith("[")&&!text.startsWith("{"))text=Buffer.from(text,"base64").toString("utf8");
   const parsed=JSON.parse(text);
   list.push(...(Array.isArray(parsed)?parsed:parsed.places));
  }
  return list;
 }
 const places=loadPlaces();
 if(places.length!==1389)problems.push("장소 수가 1389가 아니어서 가이드 집계를 다시 세야 합니다: "+places.length); // 2026-10-23 A안 1443→1390, 2026-10-25 중복 병합(도깨비젤라또)으로 1390→1389
 const indexablePlacePages=[...fs.readdirSync(path.join(OUT,"place")).filter(name=>name.endsWith(".html"))].filter(name=>!fs.readFileSync(path.join(OUT,"place",name),"utf8").includes('content="noindex, follow"'));
 if(placeLocs.length!==indexablePlacePages.length)problems.push("사이트맵 장소 URL "+placeLocs.length+"/"+indexablePlacePages.length);
 const hospitals=places.filter(place=>place.category==="hospital");
 if(hospitals.length!==280||hospitals.filter(place=>String(place.tel||"").trim()).length!==279)problems.push("병원 수 또는 전화 칸 수가 글과 다릅니다.");
 for(const g of longGuides){
  const pagePath=path.join(OUT,"guides",g.id+".html");
  const html=fs.readFileSync(pagePath,"utf8");
  const article=(html.match(/<article[\s\S]*<\/article>/)||[""])[0];
  const plainText=article.replace(/<[^>]+>/g,"");
  const hangul=(plainText.replace(/\s/g,"").match(/[가-힣]/g)||[]).length;
  if(hangul<1500||plainText.replace(/\s/g,"").length<1500)problems.push(g.id+" 분량 부족 "+hangul);
  if(!html.includes("펫맵 운영자 김동곤")||!html.includes(LONG_DATE))problems.push(g.id+" 작성자 또는 날짜가 없습니다.");
  if(EXCLUDED_FROM_LISTS.has(g.id)){if(html.includes('class="ad-slot"'))problems.push(g.id+" 에 광고 슬롯이 남아 있습니다.");}
  else if(!html.includes('class="ad-slot"')||!html.includes('href="/ad-slot.css"')||html.includes("min-height:250px"))problems.push(g.id+" 광고 슬롯이 없습니다.");
  if(EXCLUDED_FROM_LISTS.has(g.id)){if(!html.includes("noindex"))problems.push(g.id+" 가 noindex가 아닙니다.");}
  else if(html.includes("noindex"))problems.push(g.id+" 가 noindex입니다.");
  if(!/<img\b[^>]*\bwidth="1200"[^>]*\bheight="630"/.test(article))problems.push(g.id+" 이미지 크기가 없습니다.");
  const internal=[...article.matchAll(/href="(\/[^"#]*)"/g)].map(match=>match[1]);
  const external=[...article.matchAll(/href="(https?:\/\/[^"]+)"/g)].map(match=>match[1]);
  if(internal.length<2||internal.length>4||!internal.some(href=>href.startsWith("/place/")))problems.push(g.id+" 내부 링크 "+internal.join(","));
  if(external.length<1||external.length>3)problems.push(g.id+" 공식 링크 수 "+external.length);
  if(!article.includes("<ol")||!article.includes('class="checklist"')||!article.includes("<dl"))problems.push(g.id+" 절차·목록·질문이 빠졌습니다.");
  if(EXCLUDED_FROM_LISTS.has(g.id)){if(locs.has(BASE+"/guides/"+g.id+".html"))problems.push(g.id+" 가 사이트맵에 남아 있습니다.");if(indexHtml.includes("/guides/"+g.id+".html"))problems.push(g.id+" 가 가이드 목록에 남아 있습니다.");}
  else{
  if(!locs.has(BASE+"/guides/"+g.id+".html"))problems.push(g.id+" 가 사이트맵에 없습니다.");
  if(!indexHtml.includes("/guides/"+g.id+".html"))problems.push(g.id+" 가 가이드 목록에 없습니다.");
  }
  for(const href of internal.filter(item=>item.startsWith("/place/"))){
   if(!fs.existsSync(path.join(OUT,href.slice(1))))problems.push("없는 장소 링크 "+href);
  }
  for(const sentence of plainText.split(/(?<=다\.)\s+/)){
   const key=sentence.replace(/\s/g,"");
   if(key.length<40)continue;
   if(seenSentence.has(key)&&seenSentence.get(key)!==g.id)problems.push("중복 문장 "+g.id+" / "+seenSentence.get(key));
   else seenSentence.set(key,g.id);
  }
 }
 const home=fs.readFileSync(path.join(OUT,"index.html"),"utf8");
 if(!home.includes('href="/guides/"'))problems.push("지도 화면 메뉴에 가이드 링크가 없습니다.");
 const statusPhrase=/불러올 수 없어요|조건에 맞는 장소가 없어요|장소 정보를 불러오는 중|장소 정보를 불러오지 못했어요|장소 목록을 불러오는 중|지도를 불러오지 못했어요|이 브라우저에서 지도를 열 수 없어요|지도 타일을 받지 못했어요|지도 제공처 응답이 늦어요/g;
 let phraseHits=0, footerMiss=0, maxAds=0, adPages=0, brokenLinks=0;
 const brokenSample=[];
 function walkChecks(dir){
  for(const ent of fs.readdirSync(dir,{withFileTypes:true})){
   const filename=path.join(dir,ent.name);
   if(ent.isDirectory()){walkChecks(filename);continue;}
   if(!ent.name.endsWith(".html"))continue;
   const html=fs.readFileSync(filename,"utf8");
   const rel=path.relative(OUT,filename);
   phraseHits+=(html.match(statusPhrase)||[]).length;
   if(html.includes("EXAMPLE-DO-NOT-PUBLISH"))problems.push("예시 보강 행이 페이지에 있습니다: "+rel);
   for(const href of ['href="/about.html"','href="/privacy.html"','href="/contact.html"','href="/terms.html"']){
    if(!html.includes(href)){footerMiss++;problems.push("푸터 링크 없음 "+href+" "+rel);break;}
   }
   const units=(html.match(/<ins\b[^>]*\bclass="adsbygoogle"/g)||[]).length;
   if(units)adPages++;
   if(units>maxAds)maxAds=units;
   if(units>3)problems.push("광고 단위 "+units+"개: "+rel);
   const visible=html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,"");
   const baseDir=path.dirname(filename);
   for(const match of visible.matchAll(/(?:href|src)="([^"]+)"/g)){
    let url=match[1].trim();
    if(!url||url.startsWith("#")||url.startsWith("//")||/^(https?:|mailto:|tel:|javascript:|data:)/i.test(url))continue;
    url=url.split("#")[0].split("?")[0];
    if(!url)continue;
    let target;
    try{target=url.startsWith("/")?path.join(OUT,decodeURIComponent(url)):path.resolve(baseDir,decodeURIComponent(url));}
    catch(error){brokenLinks++;if(brokenSample.length<8)brokenSample.push(rel+" -> "+match[1]);continue;}
    if(!target.startsWith(OUT)){brokenLinks++;if(brokenSample.length<8)brokenSample.push(rel+" -> "+match[1]);continue;}
    if(fs.existsSync(target)&&fs.statSync(target).isDirectory())target=path.join(target,"index.html");
    else if(!path.extname(target)){
     if(fs.existsSync(target+".html"))target=target+".html";
     else if(fs.existsSync(path.join(target,"index.html")))target=path.join(target,"index.html");
    }
    if(!fs.existsSync(target)){brokenLinks++;if(brokenSample.length<8)brokenSample.push(rel+" -> "+match[1]);}
   }
  }
 }
 walkChecks(OUT);
 if(phraseHits)problems.push("서버 HTML 상태 문구 "+phraseHits);
 if(footerMiss)problems.push("푸터 네 링크가 빠진 페이지 "+footerMiss);
 if(brokenLinks)problems.push("깨진 내부 링크 "+brokenLinks+" "+brokenSample.join(" | "));
 if(fs.existsSync(path.join(OUT,"data","enrichment")))problems.push("보강 예시 파일이 dist에 있습니다.");
 const robots=fs.readFileSync(path.join(OUT,"robots.txt"),"utf8");
 if(!/^Sitemap:\s+https:\/\/www\.petmap\.kr\/sitemap\.xml\s*$/m.test(robots))problems.push("robots.txt에 Sitemap 줄이 없습니다.");
 const terms=fs.readFileSync(path.join(OUT,"terms.html"),"utf8");
 if(!terms.includes("이용 안내"))problems.push("이용안내 페이지가 없습니다.");
 for(const phrase of ["제1조","제12조","Google AdSense","OpenStreetMap","공공누리","고의 또는 중대한 과실","kdg2844@gmail.com","2026년 [ ]월 [ ]일"]){
  if(!terms.includes(phrase))problems.push("이용약관 조항 누락: "+phrase);
 }
 const homePlaceLinks=(home.match(/href="\/place\/[^"]+\.html"/g)||[]).length;
 const homeGuideLinks=(home.match(/href="\/guides\/[^"]+\.html"/g)||[]).length;
 if(homePlaceLinks<17)problems.push("홈 장소 링크 "+homePlaceLinks);
 if(homeGuideLinks<6)problems.push("홈 가이드 링크 "+homeGuideLinks);
 if(!home.includes("시·도별 장소 수"))problems.push("홈에 시·도별 장소 수가 없습니다.");
 const linkStats=placeNameLinkStats();
 if(linkStats.total&&linkStats.rate<0.9)problems.push("가이드 표 장소명 링크 "+linkStats.linked+"/"+linkStats.total);
 if(linkStats.guidesWithPlaceLink<30)problems.push("장소 링크가 있는 가이드 "+linkStats.guidesWithPlaceLink+"/"+linkStats.guidePages);
 const notFound=fs.readFileSync(path.join(OUT,"404.html"),"utf8");
 if(!notFound.includes('content="noindex, follow"')||/<ins\b[^>]*\bclass="adsbygoogle"/.test(notFound)||notFound.includes("adsbygoogle.js"))problems.push("404 페이지 색인 또는 광고 단위");
 if(!notFound.includes("페이지를 찾지 못했습니다")||!notFound.includes('class="site-nav"')||!notFound.includes('href="/privacy.html"')||!notFound.includes('href="/terms.html"')||!notFound.includes('href="/contact.html"')||!notFound.includes('href="/guides/"'))problems.push("404 페이지에 한국어 안내나 이동 링크가 없습니다.");
 if(locs.has(BASE+"/404.html"))problems.push("404가 사이트맵에 있습니다.");
 if(!/armHomeMap\(\);\s*route\(\);/.test(home)||!home.includes('class="map-placeholder"')||!home.includes("지도 타일은 화면을 움직이면 불러옵니다."))problems.push("홈 지도 타일이 첫 화면에서 바로 시작됩니다.");
 const flagged=places.filter(place=>indexRule.accessNotice(place));
 const restrictedNames=flagged.filter(place=>indexRule.petAccessStatus(place)==="restricted").map(place=>place.name);
 const unverifiedNames=flagged.filter(place=>indexRule.petAccessStatus(place)==="unverified").map(place=>place.name);
 if(restrictedNames.length!==2)problems.push("출입 제한 장소 "+restrictedNames.join(",")); // 2026-10-23 A안: 월악산 야영장 2곳 제외로 4→2
 if(unverifiedNames.length!==2)problems.push("출입 미확인 장소 "+unverifiedNames.join(",")); // 2026-10-23 A안: 자연휴양림 4곳 제외로 6→2
 for(const place of flagged){
  const page=fs.readFileSync(path.join(OUT,"place",place.id+".html"),"utf8");
  const notice=indexRule.accessNotice(place);
  const note=(page.match(/<aside class="access-note[\s\S]*?<\/aside>/)||[""])[0];
  if(!page.includes(notice.heading)||page.includes("반려동물 동반 ·")||!page.includes('content="noindex, follow"'))problems.push("동반 안내로 남은 장소 "+place.id);
  if(/국립공원/.test(place.name)){
   if(!page.includes("국립공원은 원칙적으로 반려동물 출입이 금지돼요")||note.includes("동반 가능"))problems.push("국립공원 안내 문구 "+place.id);
  }else if(!page.includes("동반 가능 구역·조건은")||!page.includes("확인 필요"))problems.push("동반 안내로 남은 장소 "+place.id);
  if(locs.has(BASE+"/place/"+encodeURIComponent(place.id)+".html"))problems.push("사이트맵에 남은 제한 장소 "+place.id);
 }
 const slotCss=fs.readFileSync(path.join(OUT,"ad-slot.css"),"utf8");
 if(!slotCss.includes("min-height: 0")||!slotCss.includes('data-ad-status="filled"')||!slotCss.includes("min-height: 250px"))problems.push("광고 자리 CSS가 비어 있을 때 높이를 접지 않습니다.");
 for(const g of data){
  const page=fs.readFileSync(path.join(OUT,"guides",g.id+".html"),"utf8");
  if(page.includes("실내에서도 반려견과 함께 있을 수 있나요?")||page.includes("먼저 이동 수단과 체류 시간을 정하고")||page.includes("검증하지 못한 금액")||page.includes("<td>업체 확인</td>"))problems.push(g.id+" 에 공통 템플릿 문장이 있습니다.");
  if(!page.includes("정보 없음 — 방문 전 업체에 확인하세요")&&g.id!=="pet-travel-emergency-vet"){
   const condCells=[...page.matchAll(/<td>([^<]*)<\/td>\s*<\/tr>/g)].map(match=>match[1]);
   if(!condCells.length)problems.push(g.id+" 동반 조건 칸이 없습니다.");
  }
  const placeLinks=(page.match(/href="\/place\/[^"]+\.html"/g)||[]).length;
  if(g.id!=="pet-travel-emergency-vet"&&placeLinks<2)problems.push(g.id+" 장소 링크 "+placeLinks);
  for(const id of NOT_PET_ALLOWED){
   if(page.includes("/place/"+id+".html"))problems.push(g.id+" 가 동반 불가로 등록된 장소를 링크합니다: "+id);
  }
  if(page.includes("/place/tour-127220.html"))problems.push(g.id+" 가 북한산국립공원을 링크합니다.");
 }
 const seoul=fs.readFileSync(path.join(OUT,"guides","seoul-pet-cafes-walks.html"),"utf8");
 if(seoul.includes("이전 판에는")||!seoul.includes("국립공원은 「자연공원법」에 따라 원칙적으로 반려동물 출입이 금지돼 있고")||!seoul.includes("https://reservation.knps.or.kr/contents/withPet.do"))problems.push("서울 가이드 국립공원 안내 문장이 다릅니다.");
 const camping=fs.readFileSync(path.join(OUT,"guides","pet-camping-glamping-korea.html"),"utf8");
 const campIds=[...camping.matchAll(/href="\/place\/([^"]+)\.html"/g)].map(match=>match[1]);
 if(campIds.length<8||campIds.some(id=>!id.startsWith("gocamp-")))problems.push("캠핑 가이드 장소가 캠핑장이 아닙니다: "+campIds.join(","));
 const guideDir=path.join(OUT,"guides");
 for(const name of fs.readdirSync(guideDir).filter(item=>item.endsWith(".html"))){
  const html=fs.readFileSync(path.join(guideDir,name),"utf8");
  for(const place of flagged){
   if(indexRule.petAccessStatus(place)!=="restricted")continue;
   if(html.includes("/place/"+encodeURIComponent(place.id)+".html"))problems.push("가이드가 제한 장소를 동반 목록에 링크 "+name+" "+place.id);
  }
 }
 if(problems.length||missingScript){
  throw new Error("[petmap check] "+problems.slice(0,12).join(" | ")+(missingScript?(" missingScript="+missingScript):""));
 }
 console.log("[petmap check] html",htmlCount,"noindex",noindex,"sitemap",locs.size,"place in sitemap",placeLocs.length,"home place links",homePlaceLinks,"home guide links",homeGuideLinks,"guide place-name links",linkStats.linked+"/"+linkStats.total,"guides with /place/",linkStats.guidesWithPlaceLink+"/"+linkStats.guidePages,"footer miss",footerMiss,"broken links",brokenLinks,"status phrases",phraseHits,"ad pages",adPages,"max ad units",maxAds);
}
assertPublished();
fs.writeFileSync(path.join(OUT, "naverebbe134aa39474015c28a41a735eee7b.html"), "naver-site-verification: naverebbe134aa39474015c28a41a735eee7b.html", "utf8");
