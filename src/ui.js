// === Global Variables ===
let allVariables = [];
let selectedVariableId = null;
let selectedTextNodeId = null;
let currentBoundVariableId = null;
let selectedNodeText = '';
let selectedNodeName = '';
let themeMode = 'system';

// === Theme Toggle ===
document.addEventListener('DOMContentLoaded',()=>{
  document.querySelectorAll('.toggle-btn').forEach(btn=>{
    btn.addEventListener('click',()=>{
      themeMode = btn.dataset.mode;
      document.querySelectorAll('.toggle-btn').forEach(b=>b.classList.remove('bg-white','dark:bg-gray-700','ring'));
      btn.classList.add('bg-white','dark:bg-gray-700','ring');
      applyTheme(themeMode);
    });
  });
});

// === Apply Theme ===
function applyTheme(mode){
  if(mode==='dark') document.documentElement.classList.add('dark');
  else if(mode==='light') document.documentElement.classList.remove('dark');
  else document.documentElement.classList.toggle('dark',window.matchMedia('(prefers-color-scheme: dark)').matches);
}

// === Bind variable ===
window.bindVariable=()=>{
  if(!selectedVariableId){ showMessage('Please select a variable first','error'); return; }
  const boundVar = allVariables.find(v=>v.id===selectedVariableId);
  if(!boundVar) return;
  currentBoundVariableId = selectedVariableId;
  displayVariables(allVariables,currentBoundVariableId);
  if(selectedTextNodeId) displaySelectedText(selectedNodeText,selectedNodeName,boundVar);
  showMessage(`Variable "${boundVar.name}" applied`,'success');
  parent.postMessage({pluginMessage:{type:'bind-variable',variableId:selectedVariableId}},'*');
};

// === Filter + Suggestions ===
window.filterVariables=(searchTerm)=>{
  const query=(searchTerm||'').trim().toLowerCase();
  const suggestionsBox=document.getElementById('suggestions-box');
  if(!suggestionsBox) return;
  if(query.length===0){ displayVariables(allVariables,currentBoundVariableId); suggestionsBox.style.display='none'; return; }
  const filtered = allVariables.filter(v=>{
    const name=(v.name||'').toLowerCase();
    const collection=(v.collection||'').toLowerCase();
    const value=(v.value||'').toLowerCase();
    return name.includes(query)||collection.includes(query)||value.includes(query);
  });
  suggestionsBox.style.display='ืnone';
  suggestionsBox.innerHTML=filtered.length>0
    ? filtered.slice(0,5).map(v=>`<div class="suggestion-item px-3 py-1 hover:bg-gray-100 dark:hover:bg-gray-100 cursor-pointer" onclick="applySuggestion('${v.name}')">${v.name}</div>`).join('')
    : '<div class="suggestion-item disabled px-3 py-1 text-gray-400 dark:text-gray-500">No matches</div>';
  displayVariables(filtered,currentBoundVariableId,query);
};

// === Apply suggestion ===
window.applySuggestion=(value)=>{
  const searchInput=document.getElementById('variable-search');
  if(searchInput) searchInput.value=value;
  window.filterVariables(value);
  document.getElementById('clear-search')?.classList.remove('hidden');
  document.getElementById('suggestions-box').style.display='none';
};

// === Clear search ===
window.clearSearch=()=>{
  const searchInput=document.getElementById('variable-search');
  if(searchInput) searchInput.value='';
  document.getElementById('clear-search')?.classList.add('hidden');
  window.filterVariables('');
};

// === Toast ===
function showMessage(msg,type){
  const el=document.getElementById('message');
  if(!el) return;
  el.textContent=msg;
  el.classList.remove('bg-green-500','bg-red-500');
  el.classList.add(type==='success'?'bg-green-500':'bg-red-500');
  el.classList.remove('hidden','translate-x-0','opacity-100');
  el.classList.add('translate-x-full','opacity-0');
  setTimeout(()=>{
    el.classList.remove('translate-x-full','opacity-0');
    el.classList.add('translate-x-0','opacity-100');
  },10);
  setTimeout(()=>{
    el.classList.remove('translate-x-0','opacity-100');
    el.classList.add('translate-x-full','opacity-0');
    setTimeout(()=>el.classList.add('hidden'),300);
  },3000);
}

// === Messages from plugin ===
window.onmessage=(event)=>{
  const m=event.data.pluginMessage;
  if(!m) return;
  switch(m.type){
    case 'variables-loaded': allVariables=m.variables; displayVariables(allVariables); break;
    case 'text-selected':
      selectedTextNodeId=m.nodeId;
      selectedNodeText=m.text||'';
      selectedNodeName=m.nodeName||'Selected Node';
      currentBoundVariableId=m.boundVariable?m.boundVariable.id:null;
      displaySelectedText(selectedNodeText,selectedNodeName,m.boundVariable);
      displayVariables(allVariables,currentBoundVariableId||undefined);
      break;
    case 'no-text-selected': selectedTextNodeId=null; selectedNodeText=''; selectedNodeName=''; displayNoSelection(); break;
    case 'success': showMessage(m.message,'success'); break;
    case 'variable-bound': showMessage(m.message,'success'); break;
    case 'error': showMessage(m.message,'error'); break;
  }
};

// === Display selected text + bound variable ===
function displaySelectedText(text,nodeName,bound){
  const info=document.getElementById('selected-text-info');
  if(!info) return;
  let boundHtml='';
  if(bound){
    const dn=bound.collection?`${bound.collection}/${bound.name}`:bound.name;
    boundHtml=`<div class="mt-2 p-2 rounded bg-yellow-50 dark:bg-yellow-800 border border-yellow-200 dark:border-yellow-700 text-xs">
      <strong>Bound Variable:</strong> ${dn}<br>
      <strong>Current Value:</strong> ${bound.value}
    </div>`;
  }
  info.innerHTML=`<div class="p-2 rounded border border-green-200 dark:border-green-700 bg-white dark:bg-gray-900 text-xs">
    <strong>Node:</strong> ${nodeName}<br>
    <strong>Content:</strong> ${text}
  </div>${boundHtml}`;
}

// === No selection ===
function displayNoSelection(){ const info=document.getElementById('selected-text-info'); if(!info) return; info.innerHTML='<p class="italic text-gray-400 dark:text-gray-500">No text node selected.</p>'; }

// === Display Variables List as RadioGroup ===
function displayVariables(vars,boundId,searchTerm){
  const list=document.getElementById('variables-list');
  if(!list) return;
  const query=(searchTerm||'').toLowerCase();
  list.innerHTML='';
  vars.forEach(v=>{
    const name=v.name||'Unnamed', value=v.value||'N/A', collection=v.collection||'Default';
    const id=v.id;
    const wrapper=document.createElement('label');
    wrapper.className=`relative flex cursor-pointer rounded-lg px-5 py-4 shadow-md focus:outline-none ${boundId===id?'bg-indigo-100 dark:bg-blue-900':'bg-white dark:bg-gray-800'} hover:bg-blue-50 dark:hover:bg-blue-900 border ${boundId===id?'border-blue-300 dark:border-blue-600':'border-gray-200 dark:border-gray-700'}`;
    wrapper.innerHTML=`<div class="flex items-center justify-between w-full">
      <div class="flex flex-col">
        <span class="mt-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-100 dark:bg-blue-700 text-blue-800 dark:text-blue-200">Collection: ${collection}</span>
        <span class="block text-sm font-medium text-gray-900 dark:text-gray-200">${name}</span>
        <span class="block text-xs text-gray-500 dark:text-gray-400 font-mono">${value}</span>
      </div>
      <input type="radio" name="variable-radio" value="${id}" class="h-5 w-5 text-blue-600 dark:text-blue-400" ${boundId===id?'checked':''}/>
    </div>`;
    wrapper.querySelector('input')?.addEventListener('change',()=>selectVariable(id));
    list.appendChild(wrapper);
  });
}

// === Select variable ===
window.selectVariable=id=>{
  selectedVariableId=id;
  displayVariables(allVariables,id);
  document.getElementById('bind-button')?.removeAttribute('disabled');
};

// === Resize handle ===
function initResizeHandle(){
  const h=document.getElementById('resize-handle');
  if(!h) return;
  let r=false,sX,sY,sW,sH;
  h.addEventListener('mousedown',e=>{r=true;sX=e.clientX;sY=e.clientY;sW=window.innerWidth;sH=window.innerHeight;e.preventDefault();});
  document.addEventListener('mousemove',e=>{if(!r) return; const nw=Math.max(400,sW+(e.clientX-sX)), nh=Math.max(600,sH+(e.clientY-sY)); parent.postMessage({pluginMessage:{type:'resize',size:{width:nw,height:nh}}},'*');});
  document.addEventListener('mouseup',()=>{r=false;});
}

// === Init ===
document.addEventListener('DOMContentLoaded',()=>{
  document.getElementById('variable-search')?.addEventListener('input',e=>{window.filterVariables(e.target.value); document.getElementById('clear-search')?.classList.remove('hidden');});
  document.getElementById('clear-search')?.addEventListener('click',()=>window.clearSearch());
  initResizeHandle();
  applyTheme(themeMode);
});