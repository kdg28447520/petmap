#!/usr/bin/env node
"use strict";
/*
 * petmap.kr editorial pages generated after the existing map/place build.
 * Node standard library only. Does not alter the existing map application source.
 */
const fs=require("node:fs");
const path=require("node:path");
const ROOT=__dirname, OUT=path.join(ROOT,"dist");
const BASE="https://www.petmap.kr";
const updated="2026-10-14";
const esc=(x)=>String(x==null?"":x).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const plain=x=>String(x||"").replace(/<[^>]+>/g,"").trim();
const data=JSON.parse(fs.readFileSync(path.join(ROOT,"content","guides.json"),"utf8"));
const all=JSON.parse(fs.readFileSync(path.join(OUT,"places.json"),"utf8")).places;
const sec=(head,body)=>'<section class="section"><h2>'+esc(head)+'</h2>'+body+'</section>';
const para=s=>'<p>'+esc(s)+'</p>';
const PAW='<svg width="23" height="23" viewBox="0 0 24 24" aria-hidden="true"><path fill="#E4572E" d="M12 13.2c2.9 0 5.6 2.3 5.6 4.7 0 1.5-1.1 2.5-2.7 2.5-1 0-1.8-.4-2.9-.4s-1.9.4-2.9.4c-1.6 0-2.7-1-2.7-2.5 0-2.4 2.7-4.7 5.6-4.7ZM6.2 8.1c1 .3 1.5 1.7 1.1 3-.4 1.4-1.5 2.2-2.5 1.9-1-.3-1.5-1.7-1.1-3 .4-1.3 1.5-2.2 2.5-1.9Zm11.6 0c1-.3 2.1.6 2.5 1.9.4 1.3-.1 2.7-1.1 3-1 .3-2.1-.5-2.5-1.9-.4-1.3.1-2.7 1.1-3ZM9.3 3.6c1.1.1 1.9 1.4 1.8 2.9-.1 1.4-1 2.6-2.1 2.5C7.9 8.9 7.1 7.6 7.2 6.2c.1-1.5 1-2.7 2.1-2.6Zm5.4 0c1.1-.1 2 1.1 2.1 2.6.1 1.4-.7 2.7-1.8 2.8-1.1.1-2-1.1-2.1-2.5-.1-1.5.7-2.8 1.8-2.9Z"/></svg>';
const chrome='<header class="site-bar"><a class="brand" href="/"><span class="paw">'+PAW+'</span><span>댕냥이와 함께</span></a><nav class="site-nav" aria-label="주요 메뉴"><a href="/">전국 지도</a><a href="/guides/">여행 가이드</a><a href="/about.html">소개</a></nav></header>';
const trustFooter='<footer class="site-footer"><nav class="trust-nav" aria-label="안내"><a href="/about.html">소개</a><a href="/privacy.html">개인정보처리방침</a><a href="/contact.html">문의</a><a href="/terms.html">이용안내</a></nav><p>© 댕냥이와 함께 · 공공데이터 기반 안내 · 방문 전 해당 업체에 직접 확인해 주세요.</p></footer>';
const adSlot='<aside class="ad-slot" aria-label="광고"><p class="ad-slot-label">광고</p><ins class="adsbygoogle" style="display:block;width:100%;min-height:250px" data-ad-client="ca-pub-4533404826925371" data-ad-format="auto" data-full-width-responsive="true"></ins></aside>';
const css=':root{color-scheme:light}*{box-sizing:border-box}body{margin:0;background:#faf9f6;color:#262522;font-family:Pretendard,"Noto Sans KR",system-ui,sans-serif;font-size:16px;line-height:1.75}a{color:#1765ac}a:hover{text-decoration:underline}.shell{max-width:920px;margin:auto;padding:0 22px 60px}.site-bar{position:sticky;top:0;z-index:20;display:flex;align-items:center;gap:12px;height:56px;padding:0 16px;background:#faf9f6;border-bottom:1px solid #e7e3da}.brand{display:flex;align-items:center;gap:8px;color:#1a1a1a;font-size:17px;font-weight:800;text-decoration:none}.brand .paw{display:grid;place-items:center;width:23px;height:23px}.site-nav{display:flex;gap:2px;margin-left:auto;min-width:0;overflow-x:auto;scrollbar-width:none}.site-nav a{font-size:15px;font-weight:700;color:#1a1a1a;text-decoration:none;padding:8px 10px;border-radius:999px;white-space:nowrap;background:transparent}.site-nav a:hover{background:#f3f1ec}.site-footer{padding:22px 16px 32px;text-align:center;color:#6B675F;font-size:14px}.trust-nav{display:flex;flex-wrap:wrap;justify-content:center;gap:8px 14px;margin:0 0 8px}.trust-nav a{color:#55524C;font-size:15px;font-weight:700;text-decoration:none}.ad-slot{min-height:280px;margin:28px 0;contain:layout;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;background:#f3f1ec;border:1px solid #e7e3da;border-radius:12px;overflow:hidden}.ad-slot-label{margin:0;font-size:13px;font-weight:700;letter-spacing:.06em;color:#6B675F}h1{font-size:clamp(26px,4vw,36px);letter-spacing:-.8px;line-height:1.38;margin:16px 0}h2{font-size:23px;line-height:1.5;margin:36px 0 12px}h3{font-size:18px;margin:20px 0 9px}.lede{font-size:17px;color:#3d4546}.meta{font-size:14px;color:#6B675F}.article{background:white;border-radius:17px;padding:28px 35px;border:1px solid #eceae7}.section{margin-top:27px}.section p{margin:10px 0 16px}.table-scroll{max-width:100%;overflow-x:auto;border-radius:12px;border:1px solid #e8e8e5}table{border-collapse:collapse;width:100%;min-width:580px;font-size:16px}th,td{text-align:left;padding:11px 13px;border-bottom:1px solid #eee}th{background:#f2f5f4}td a{font-weight:700}.figure{margin:23px 0;overflow:hidden;border:1px solid #eee;border-radius:12px;background:#f8f7f2}.figure img{display:block;max-width:100%;width:100%;max-height:300px;object-fit:cover}.figure figcaption{font-size:14px;padding:8px 13px;color:#6B675F}.bullets{padding-left:21px}.bullets li{margin-bottom:12px}.checklist{list-style:none;padding:0}.checklist li{padding:7px 0;border-bottom:1px solid #f3f3f0}.checklist li{position:relative;padding-left:26px}.checklist li:before{content:"";position:absolute;left:0;top:12px;width:16px;height:16px;background:url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2716%27 height=%2716%27 viewBox=%270 0 16 16%27%3E%3Crect x=%271%27 y=%271%27 width=%2714%27 height=%2714%27 rx=%273%27 fill=%27none%27 stroke=%27%235F7161%27 stroke-width=%271.5%27/%3E%3Cpath d=%27M4 8.2 6.6 11 12 5%27 fill=%27none%27 stroke=%27%235F7161%27 stroke-width=%271.6%27 stroke-linecap=%27round%27 stroke-linejoin=%27round%27/%3E%3C/svg%3E") center/16px 16px no-repeat}.subtle{color:#6B675F;font-size:14px}.note{padding:15px 17px;background:#f5f7f5;border-radius:12px;border-left:4px solid #467e70}.summary{margin-top:30px;padding:20px;background:#f6f6f3;border-radius:12px}.refs{padding:14px;background:#faf9f7;border-radius:12px;font-size:15px}.guide-cards{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.guide-card{padding:18px;border:1px solid #ddd;border-radius:12px;background:#fff;text-decoration:none;color:#282722}.guide-card b{display:block;line-height:1.5}.guide-card small{color:#6B675F;font-size:15px}.footer{font-size:14px;color:#6B675F;margin-top:26px}.crumb{font-size:14px;color:#6B675F;margin-top:15px}dl dt{font-weight:700;margin-top:17px}dl dd{margin:4px 0 16px}@media(max-width:680px){.shell{padding:0 14px 45px}.article{padding:18px 17px;border-radius:12px}h2{font-size:20px}.guide-cards{grid-template-columns:1fr}.site-nav{gap:2px}.site-nav a{font-size:15px;padding:8px 10px}}';
function layout(title,desc,url,html,structured){
 const absolute=BASE+url;
 const meta='<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+esc(title)+' | 댕냥이와 함께</title><meta name="description" content="'+esc(desc)+'"><link rel="canonical" href="'+absolute+'"><meta property="og:type" content="article"><meta property="og:title" content="'+esc(title)+'"><meta property="og:description" content="'+esc(desc)+'"><meta property="og:url" content="'+absolute+'"><meta property="og:image" content="'+BASE+'/og/default.png"><meta property="og:site_name" content="댕냥이와 함께"><meta name="twitter:card" content="summary_large_image">';
 return '<!doctype html><html lang="ko"><head>'+meta+'<style>'+css+'</style>'+(structured?'<script type="application/ld+json">'+JSON.stringify(structured).replace(/</g,"\\u003c")+'</script>':'')+'</head><body>'+chrome+'<div class="shell">'+html+'</div>'+trustFooter+'</body></html>';
}
function write(name,html){const p=path.join(OUT,name);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,html,"utf8");}
function getPlaces(g){
 const terms=g.regionKeys||[];
 return all.filter(p=>(!g.categories||g.categories.includes(p.category))&&(!terms.length||terms.some(s=>(p.addr||"").includes(s)))).slice(0,8);
}
function itemTable(places){
 const rows=places.map(p=>'<tr><td><a href="/place/'+encodeURIComponent(p.id)+'.html">'+esc(p.name)+'</a></td><td>'+esc(p.addr||"주소 재확인")+'</td><td>'+esc(({stay:"숙박",food:"음식점·카페",park:"산책·놀이터",hospital:"동물병원"})[p.category]||"장소")+'</td><td>업체 확인</td></tr>').join("");
 return '<div class="table-scroll"><table><thead><tr><th>장소명</th><th>주소</th><th>유형</th><th>동반 조건·요금</th></tr></thead><tbody>'+rows+'</tbody></table></div><p class="subtle">표의 장소는 사이트 수록 데이터에서 지역·카테고리 기준으로 추린 예시이며, 추천 순위나 최신 운영 보증이 아닙니다. 자세한 사항은 각 시설에 확인하세요.</p>';
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
function makeGuide(g,idx){
 const url="/guides/"+g.id+".html", places=getPlaces(g), intro=esc(g.lead), details=g.route||[];
 const imgcat=(g.categories||[]).includes("stay")?"stay":(g.categories||[]).includes("hospital")?"hospital":(g.categories||[]).includes("park")?"park":"food";
 const image='<figure class="figure"><img src="/og/'+imgcat+'.png" width="1200" height="630" alt="'+esc(g.title)+' 관련 반려동물 지도 일러스트"><figcaption>반려동물 동반 정보는 현장 운영 조건에 따라 달라집니다.</figcaption></figure>';
 const first=sec("어떤 순서로 준비하면 좋을까요?",para(g.context)+para(g.detail)+para("먼저 이동 수단과 체류 시간을 정하고, 산책·식사·휴식 시간을 분리해 보세요. 사람에게는 짧은 이동이어도 반려동물에게는 냄새와 소음이 낯선 긴 외출일 수 있습니다. 예약 가능한 장소만 연결하고, 당일 취소나 우천 시 대안도 하나씩 마련하는 편이 좋습니다."));
 const second=sec(g.routeTitle||"추천 일정과 동선",'<ol class="bullets">'+details.map(x=>'<li>'+esc(x)+'</li>').join("")+'</ol>'+para(g.routeAfter)+image);
 const third=sec("지도에 수록된 실제 장소 확인하기",para("다음은 댕냥이와 함께 장소 데이터에서 이 글과 관련된 장소를 골라 보여주는 표입니다. 주소·유형을 우선 확인하고, 영업시간과 동반 가능 범위가 중요한 경우 반드시 출발 전에 문의하세요.")+(places.length?itemTable(places):para("현재 지도 데이터에서 이 주제와 일치하는 장소를 충분히 찾지 못했습니다. 전국 지도에서 지역명을 입력하고 다른 카테고리도 함께 살펴보세요."))+para(g.placesTip||"검색 결과는 시점에 따라 달라질 수 있습니다. 직접 확인한 조건이 기존 정보와 다르면 문의·정정 경로를 통해 알려주세요."));
 const fourth=sec("예약·이용 전에 비교할 조건",para(g.priceGuide)+compareTable(g)+para("요금은 평일·주말, 시즌, 반려견 크기, 객실 형태에 따라 달라집니다. 이 문서에는 검증하지 못한 금액을 임의로 넣지 않았습니다. 가격이나 주차 가능 여부를 표시하지 않은 곳은 공식 예약화면 또는 업체 전화가 가장 정확합니다."));
 const fifth=sec(g.cautionTitle||"현장에서 꼭 챙길 안전·펫티켓",para(g.safety)+'<ul class="checklist">'+g.checks.map(x=>'<li>'+esc(x)+'</li>').join("")+'</ul>'+para("비상용 물과 배변봉투는 이동 거리와 관계없이 챙기는 편이 안전합니다. 더위·추위·습도 때문에 걷기 힘들어한다면 동선을 바로 줄이세요. 강아지가 낯선 곳을 힘들어하는 경우 사진이나 방문 개수보다 안정된 휴식이 우선입니다."));
 const sixth=sec("자주 묻는 질문",'<dl>'+faqPairs(g).map(pair=>'<dt>'+esc(pair[0])+'</dt><dd>'+esc(pair[1])+'</dd>').join("")+'</dl>');
 const links=data.filter(x=>x.id!==g.id&&(x.group===g.group||x.categories&&g.categories&&x.categories.some(c=>g.categories.includes(c)))).slice(0,3).map(x=>'<li><a href="/guides/'+x.id+'.html">'+esc(x.title)+'</a></li>').join("");
 const notes='<div class="summary"><strong>핵심 정리</strong><p>'+esc(g.summary)+'</p><ul><li>동반 허용 범위·운영시간은 방문 전 재확인</li><li>무게·마릿수 제한과 추가요금은 별도 확인</li><li>일정을 줄여 반려동물 휴식 시간 확보</li></ul></div>';
 const refs='<div class="refs"><strong>정보 확인 경로</strong><ul><li><a href="https://korean.visitkorea.or.kr/" target="_blank" rel="noopener">한국관광공사 대한민국 구석구석</a></li><li><a href="https://www.gocamping.or.kr/" target="_blank" rel="noopener">고캠핑(캠핑장 현황)</a></li><li><a href="https://www.foodsafetykorea.go.kr/portal/petKorea.do" target="_blank" rel="noopener">식품안전나라(동반 가능 음식점 현황)</a></li></ul><p>정보 검토일: '+updated+' · 장소별 조건은 업체 공식 안내 우선</p></div>';
 let html='<div class="crumb"><a href="/guides/">여행 가이드</a> / '+esc(g.group)+'</div><article class="article"><h1>'+esc(g.title)+'</h1><div class="meta">댕냥이와 함께 편집팀 · '+updated+' 검토 · 읽는 시간 약 6~8분</div><p class="lede">'+intro+'</p><p class="note"><strong>10초 요약:</strong> '+esc(g.summary)+'</p><nav aria-label="이 글의 목차"><strong>목차</strong><ol><li>준비 순서</li><li>추천 동선</li><li>실제 장소 보기</li><li>예약 조건 비교</li><li>안전·펫티켓</li><li>FAQ</li></ol></nav>'+first+second+adSlot+third+fourth+fifth+sixth+notes+refs+'<h2>함께 읽으면 좋은 글</h2><ul>'+links+'</ul><p><a href="/">→ petmap.kr 전국 지도에서 해당 장소 찾아보기</a></p></article>';
 const structured={"@context":"https://schema.org","@type":"Article",headline:g.title,description:g.summary,datePublished:updated,dateModified:updated,inLanguage:"ko-KR",author:{"@type":"Organization",name:"댕냥이와 함께"},publisher:{"@type":"Organization",name:"댕냥이와 함께"},mainEntityOfPage:BASE+url};
 return layout(g.title,g.description||g.summary,url,html,structured);
}
function legal(title,url,description,body,date){const when=date||updated;write(url.slice(1),layout(title,description,url,'<article class="article"><h1>'+esc(title)+'</h1><p class="meta">시행·갱신일: '+when+'</p>'+body+'</article>',null));}
function patchMap(){
 const file=path.join(OUT,"index.html");let html=fs.readFileSync(file,"utf8");
 if(!html.includes("href=\"/guides/\"")){
  html=html.replace('</header>','<div style="display:flex;flex-wrap:wrap;gap:8px;margin:12px 0 0"><a style="font-size:13px;padding:6px 12px;border:1px solid #ddd;border-radius:20px;text-decoration:none;color:inherit" href="/guides/">여행 가이드 20편 ↗</a><a style="font-size:13px;padding:6px 12px;border:1px solid #ddd;border-radius:20px;text-decoration:none;color:inherit" href="/about.html">사이트 소개</a></div></header>');
  html=html.replace('</footer>','<br><a href="/guides/">여행 가이드</a> · <a href="/about.html">소개</a> · <a href="/privacy.html">개인정보처리방침</a> · <a href="/contact.html">문의·정보정정</a> · <a href="/terms.html">이용안내</a></footer>');
 }
 fs.writeFileSync(file,html,"utf8");
}
function build(){
 if(!Array.isArray(data)||data.length!==20)throw Error("여행 가이드 항목 수가 20개가 아닙니다.");
 const cardList=data.map((g,i)=>'<a class="guide-card" href="/guides/'+g.id+'.html"><small>'+esc(g.group)+' · '+(i+1)+'/20</small><b>'+esc(g.title)+'</b><small>'+esc(g.summary)+'</small></a>').join("");
 const cover='<article class="article"><h1>반려동물 동반 여행 가이드 20편</h1><p class="lede">지역별 여행 계획부터 캠핑·숙박·대중교통·응급 대응까지, 필요한 정보를 하나씩 확인할 수 있도록 모았습니다. 장소 정보는 운영 상황에 따라 변경되므로 출발 전 업체 확인을 권장합니다.</p><div class="guide-cards">'+cardList+'</div></article>';
 write("guides/index.html",layout("반려동물 동반 여행 가이드 20편","전국 반려견·반려묘 동반 여행을 준비하는 지역별·테마별·실용 가이드 20편.","/guides/",cover));
 for(let i=0;i<data.length;i++)write("guides/"+data[i].id+".html",makeGuide(data[i],i));
 legal("댕냥이와 함께 소개","/about.html","반려동물 동반 전국 지도 서비스의 데이터 출처, 운영 원칙과 정보 이용 방법 안내.",'<p>댕냥이와 함께(petmap.kr)는 반려동물 보호자가 전국의 동반 숙박·카페·음식점·산책 공간과 야간 동물병원을 탐색하도록 돕는 정보 지도입니다. 편집 목적은 장소를 쉽게 비교하고 방문 전에 확인할 사항을 분명하게 알려드리는 것입니다.</p><h2>데이터는 어떻게 마련하나요?</h2><p>장소 정보는 한국관광공사 TourAPI, 공공 관광·문화 데이터, 고캠핑 및 외부 병원 안내 목록을 바탕으로 정리합니다. 데이터 수록과 실제 동반 허용·예약 가능·24시간 응급진료 가능 여부는 동일하지 않습니다. 운영시간, 추가요금, 병원 당직 여부 등은 업체에 직접 확인해 주세요.</p><h2>편집 원칙</h2><p>광고·제휴 여부와 관계없이 실제 여행 준비에 도움이 되는 정보를 우선합니다. 확인되지 않은 가격이나 체중 제한을 사실처럼 표기하지 않고, 오류를 발견한 이용자의 정정 제안을 받습니다. 본 사이트는 수의학적 진단, 예약 대행 또는 현장 이용 허가를 제공하지 않습니다.</p><h2>자료·정정 요청</h2><p>오류·폐업·동반 조건 변경 등이 있다면 <a href="/contact.html">문의·정정 안내</a>를 이용해 주세요. 여행 참고 자료는 <a href="/guides/">여행 가이드</a>에서 확인할 수 있습니다.</p><h2>운영자</h2><p>댕냥이와 함께는 김동곤이 운영합니다. 문의는 <a href="mailto:kdg2844@gmail.com">kdg2844@gmail.com</a>으로 보내 주세요.</p>');
 legal("개인정보처리방침","/privacy.html","petmap.kr의 위치정보·쿠키·Google AdSense 및 개인정보 취급 안내.",'<p>댕냥이와 함께는 지도 검색 기능을 제공하는 웹사이트입니다. 아래 내용은 현재 공개된 웹사이트 코드 기반의 안내이며, 외부 서비스 정책과 사이트 기능 변경 시 수정될 수 있습니다.</p><h2>위치정보</h2><p>웹 브라우저에서 이용자가 위치 접근을 허용하면 주변 장소 표시를 위해 브라우저가 제공하는 위치정보를 이용할 수 있습니다. 사용자는 브라우저 권한 설정에서 접근을 거절하거나 철회할 수 있습니다. 위치 권한을 허용하지 않아도 지역명 검색을 이용할 수 있습니다.</p><h2>기술 서비스와 접속정보</h2><p>사이트는 지도 타일(OpenStreetMap 관련 타일 서비스) 및 화면 작동을 위한 외부 라이브러리 제공 서버와 통신할 수 있습니다. 외부 서버는 접속 과정에서 IP 주소 등 기술적 접속정보를 처리할 수 있으므로 각 제공자의 개인정보처리방침을 확인해 주세요. 웹 호스팅 제공자 또한 접속·오류 로그를 처리할 수 있습니다.</p><h2>광고·쿠키</h2><p>댕냥이와 함께는 Google AdSense 광고 스크립트를 사용합니다. 광고 심사가 끝나면 페이지에 Google 광고가 표시될 수 있습니다. 스크립트가 실행되는 동안 Google과 광고 파트너는 광고를 게재하고, 같은 광고가 너무 자주 나오지 않게 조정하고, 노출과 클릭을 측정하기 위해 쿠키와 유사한 기술(웹 비콘, 광고 식별자 등)을 기기에 저장하거나 읽을 수 있습니다.</p><p>이 과정에서 쿠키 식별자, IP 주소, 브라우저 종류, 방문한 페이지, 대략적인 위치, 광고를 보거나 클릭한 기록이 처리될 수 있습니다. 같은 정보를 바탕으로 이용자에게 맞춘 광고가 나올 수도 있습니다. 맞춤 광고는 <a href="https://adssettings.google.com/" target="_blank" rel="noopener">Google 광고 설정</a>에서 끄거나 조정할 수 있고, 브라우저 설정에서 서드파티 쿠키를 차단하거나 이미 저장된 쿠키를 삭제할 수도 있습니다.</p><p>이 사이트는 회원가입으로 이름이나 연락처를 수집하지 않으며, AdSense 쿠키를 자체 서버에 저장하거나 판매하지 않습니다. Google이 파트너 사이트에서 데이터를 어떻게 이용하는지는 <a href="https://policies.google.com/technologies/partner-sites" target="_blank" rel="noopener">Google의 파트너 사이트 데이터 이용 안내</a>에서 확인할 수 있습니다.</p><h2>문의 및 정책 변경</h2><p>장소 정보나 개인정보 관련 문의는 <a href="/contact.html">문의·정정 페이지</a>에 기재된 공식 안내 경로를 이용해 주세요. 운영자는 김동곤이며, 개인정보 관련 요청은 <a href="mailto:kdg2844@gmail.com">kdg2844@gmail.com</a>으로 보내 주세요. 이 방침은 2026년 10월 17일에 Google AdSense 쿠키 안내와 운영자 연락처를 반영해 고쳤습니다.</p>',"2026-10-17");
 legal("문의·장소 정보 정정","/contact.html","petmap.kr 동반 시설 정보 오류, 운영시간 변경 및 개인정보 관련 문의 접수 안내.",'<p>반려동물 동반 규정·영업 여부·병원 진료시간 변경을 발견했다면 근거와 함께 알려 주세요. 정확한 정보를 제공하기 위해 업소 공식 공지 또는 전화 확인 등 검증 가능한 자료가 있으면 도움이 됩니다.</p><h2>정보 정정 제안</h2><p>현재 확인 가능한 공개 정정 창구는 프로젝트 GitHub 이슈입니다. GitHub 로그인이 필요할 수 있으며 문의가 공개될 수 있으므로 전화번호·주소 등 개인정보나 민감한 정보를 기재하지 마세요.</p><p><a href="https://github.com/kdg28447520/petmap/issues/new" target="_blank" rel="noopener">→ GitHub에서 장소 정보 정정 제안하기</a></p><h2>제안 시 유용한 정보</h2><ul><li>장소명과 지도 상세 페이지 URL</li><li>바뀐 항목(운영시간·동반 허용·폐업 등)</li><li>근거 자료의 공개 URL 또는 확인 일자</li></ul><h2>운영자</h2><p>운영자는 김동곤입니다. 장소 정보 정정과 개인정보 관련 문의는 <a href="mailto:kdg2844@gmail.com">kdg2844@gmail.com</a>으로 보내 주세요.</p><h2>개인정보 관련 요청</h2><p>본 사이트는 별도 회원가입 화면을 제공하지 않습니다. 개인정보 요청은 위 이메일로 보내 주세요. GitHub 공개 이슈에는 개인 정보를 올리지 마세요.</p>');
 legal("이용 안내·면책","/terms.html","petmap.kr 지도 데이터와 반려동물 동반 장소 이용 시 주의사항.",'<p>댕냥이와 함께의 지도와 가이드는 여행·외출 참고용 정보입니다. 등록 여부가 반려동물의 입장 허가 또는 병원의 당일 진료 가능 여부를 뜻하지 않습니다.</p><h2>시설 정보 확인</h2><p>운영시간·예약·요금·반려동물 조건은 시설과 시기에 따라 달라질 수 있습니다. 숙박은 객실별 규정, 캠핑은 사이트별 규정, 음식점은 실내·야외 허용 범위를 별도 확인해 주세요. 의학적 응급상황은 지체하지 말고 병원에 먼저 전화하세요.</p><h2>자료 출처와 권리</h2><p>일부 장소 정보는 공공·민간 제공 자료에서 유래하며, 각 출처의 이용조건을 따릅니다. 본 웹사이트의 편집 설명과 가이드를 무단으로 대량 복제·재배포하지 마세요. 잘못된 정보는 <a href="/contact.html">정정 요청</a>할 수 있습니다.</p>');
 patchMap();
 const urls=[["/guides/",updated],["/about.html",updated],["/privacy.html","2026-10-17"],["/contact.html",updated],["/terms.html",updated],...data.map(g=>["/guides/"+g.id+".html",updated])];
 const site=path.join(OUT,"sitemap.xml");let xml=fs.readFileSync(site,"utf8");
 xml=xml.replace("</urlset>",urls.map(([p,when])=>'<url><loc>'+BASE+p+'</loc><lastmod>'+when+'</lastmod></url>').join("\n")+"\n</urlset>");
 fs.writeFileSync(site,xml,"utf8");
 console.log("[petmap guides] published",data.length,"guides and 4 policy pages; sitemap +",urls.length,"URLs");
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
    if(!html.includes(scriptSrc)||!html.includes('crossorigin="anonymous"')||!html.includes('name="google-adsense-account"'))missingScript++;
    const blocked=html.includes('name="robots" content="noindex, follow"');
    if(blocked){
     noindex++;
     if(locs.has(url))problems.push("noindex인데 사이트맵에 있음: "+url);
    }else if(!locs.has(url))problems.push("색인 대상인데 사이트맵에 없음: "+url);
    const rel="/"+path.relative(OUT,filename).split(path.sep).join("/");
    if(blocked && !rel.startsWith("/place/"))problems.push("장소가 아닌 페이지가 noindex: "+rel);
   }
  }
 }
 walk(OUT);
 const privacy=fs.readFileSync(path.join(OUT,"privacy.html"),"utf8");
 if(!privacy.includes("Google AdSense")||!privacy.includes("쿠키"))problems.push("개인정보처리방침에 AdSense 쿠키 안내가 없습니다.");
 if(privacy.includes("송출이 확인된 상태는 아닙니다"))problems.push("개인정보처리방침이 아직 광고 미사용으로 적혀 있습니다.");
 const ads=fs.readFileSync(path.join(OUT,"ads.txt"),"utf8");
 if(ads!=="google.com, pub-4533404826925371, DIRECT, f08c47fec0942fa0\n")problems.push("ads.txt 내용이 게시자 ID와 다릅니다.");
 const samplePlace=fs.readFileSync(path.join(OUT,"place","tour-2707444.html"),"utf8");
 if(!samplePlace.includes('class="site-bar"')||!samplePlace.includes('href="/privacy.html"')||!samplePlace.includes("이용안내"))problems.push("장소 페이지에 공통 헤더·푸터가 없습니다.");
 if(samplePlace.includes("정보 없음")||samplePlace.includes("확인 중"))problems.push("빈 정보 행이 장소 페이지에 남아 있습니다.");
 const sampleGuide=fs.readFileSync(path.join(OUT,"guides","jeju-pet-flight-guide.html"),"utf8");
 if(/🐾|📌|☑/.test(sampleGuide))problems.push("가이드에 이모지 아이콘이 남아 있습니다.");
 if(!sampleGuide.includes('class="ad-slot"')||!sampleGuide.includes("min-height:250px"))problems.push("고정 높이 광고 슬롯이 없습니다.");
 if(!/<img\b[^>]*\bwidth="1200"[^>]*\bheight="630"/.test(sampleGuide))problems.push("가이드 이미지에 너비·높이가 없습니다.");
 for(const name of ["about.html","privacy.html","contact.html"]){
  const page=fs.readFileSync(path.join(OUT,name),"utf8");
  if(!page.includes("김동곤")||!page.includes("mailto:kdg2844@gmail.com"))problems.push(name+"에 운영자 이름이나 이메일이 없습니다.");
 }
 const placeLocs=[...locs].filter(u=>u.includes("/place/"));
 if(problems.length||missingScript){
  throw new Error("[petmap check] "+problems.slice(0,12).join(" | ")+(missingScript?(" missingScript="+missingScript):""));
 }
 console.log("[petmap check] html",htmlCount,"noindex",noindex,"sitemap",locs.size,"place in sitemap",placeLocs.length);
}
assertPublished();
