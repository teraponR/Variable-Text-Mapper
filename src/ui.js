// === Global Variables ===
let allVariables = [];
let filteredVariables = [];
let selectedVariableId = null;
let selectedVariableObject = null;
let selectedTextNodeId = null;
let selectedNodeText = '';
let selectedNodeName = '';
let currentBoundVariable = null; // 🔹 variable เดิมจาก node
let applyVariableObject = null;   // 🔹 variable ที่เลือกจะ apply
let themeMode = 'system';

// === Theme Toggle + Init ===
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      themeMode = btn.dataset.mode;
      document.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('bg-blue-600','text-white','ring-2','ring-blue-400'));
      btn.classList.add('bg-blue-600','text-white','ring-2','ring-blue-400');
      applyTheme(themeMode);
    });
  });

  document.getElementById('variable-search')?.addEventListener('input', e => {
    filterVariables(e.target.value);
    document.getElementById('clear-search')?.classList.remove('hidden');
  });

  document.getElementById('clear-search')?.addEventListener('click', () => clearSearch());

  initResizeHandle();
  applyTheme(themeMode);
});

// === Apply Theme ===
function applyTheme(mode){
  if(mode==='dark') document.documentElement.classList.add('dark');
  else if(mode==='light') document.documentElement.classList.remove('dark');
  else document.documentElement.classList.toggle('dark', window.matchMedia('(prefers-color-scheme: dark)').matches);
}

// === Filter + Suggestions ===
function filterVariables(searchTerm){
  const query = (searchTerm || '').trim().toLowerCase();
  const suggestionsBox = document.getElementById('suggestions-box');
  if(!suggestionsBox) return;

  if(query.length === 0){
    filteredVariables = [...allVariables];
    displayVariables(filteredVariables, selectedVariableId);
    suggestionsBox.style.display = 'none';
    return;
  }

  filteredVariables = allVariables.filter(v => {
    const name = (v.name||'').toLowerCase();
    const collection = (v.collection||'').toLowerCase();
    const value = (v.value||'').toLowerCase();
    return name.includes(query) || collection.includes(query) || value.includes(query);
  });

  suggestionsBox.style.display = filteredVariables.length > 0 ? 'block' : 'none';
  suggestionsBox.innerHTML = filteredVariables.length > 0
    ? filteredVariables.slice(0,5).map(v => `<div class="suggestion-item px-3 py-1 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer" onclick="applySuggestion('${v.name}')">${v.name}</div>`).join('')
    : '<div class="suggestion-item disabled px-3 py-1 text-gray-400 dark:text-gray-500">No matches</div>';

  displayVariables(filteredVariables, selectedVariableId, query);
}

function applySuggestion(value){
  const searchInput = document.getElementById('variable-search');
  if(searchInput) searchInput.value = value;
  filterVariables(value);
  document.getElementById('clear-search')?.classList.remove('hidden');
  document.getElementById('suggestions-box').style.display='none';
}

function clearSearch(){
  const searchInput = document.getElementById('variable-search');
  if(searchInput) searchInput.value='';
  document.getElementById('clear-search')?.classList.add('hidden');
  filterVariables('');
}

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
window.onmessage = (event) => {
  const m = event.data.pluginMessage;
  if(!m) return;
  switch(m.type){
    case 'variables-loaded':
      allVariables = m.variables;
      filteredVariables = [...allVariables];
      displayVariables(filteredVariables);
      break;

    case 'text-selected':
      selectedTextNodeId = m.nodeId;
      selectedNodeText = m.text||'';
      selectedNodeName = m.nodeName||'Selected Node';
      currentBoundVariable = m.boundVariable || null; // 🔹 เก็บ variable เดิม
      applyVariableObject = null; // ยังไม่เลือกอะไร

      displaySelectedText(selectedNodeText, selectedNodeName, currentBoundVariable, applyVariableObject);
      displayVariables(filteredVariables, currentBoundVariable ? currentBoundVariable.id : null);
      break;

    case 'no-text-selected':
      selectedTextNodeId=null; selectedNodeText=''; selectedNodeName='';
      currentBoundVariable = null; applyVariableObject = null;
      displayNoSelection();
      break;

    case 'success':
      showMessage(m.message,'success');
      break;

    case 'variable-bound':
      showMessage(m.message,'success');
      if(selectedTextNodeId && applyVariableObject){
        currentBoundVariable = {...applyVariableObject};
        applyVariableObject = null;
        displaySelectedText(selectedNodeText, selectedNodeName, currentBoundVariable, applyVariableObject);
        displayVariables(filteredVariables, currentBoundVariable.id);
      }
      break;

    case 'error':
      showMessage(m.message,'error');
      break;
  }
};

// === Display selected text + currently + apply variable ===
function displaySelectedText(text,nodeName,currentlyVar,applyVar){
  const info=document.getElementById('selected-text-info');
  if(!info) return;

  let currentlyHtml = '';
  console.log(currentlyVar);
  if(currentlyVar){
    const dn = currentlyVar.collection ? `${currentlyVar.collection}/${currentlyVar.name}` : currentlyVar.name;
    const val = currentlyVar.value ?? 'N/A';
    currentlyHtml = `<div class="mt-2 p-2 rounded bg-yellow-50 dark:bg-yellow-800 border border-yellow-200 dark:border-yellow-700 text-xs">
      <!--<strong>Text element:</strong> ${currentlyVar.name}<br>-->
      <strong>Currently variable:</strong> ${dn}<br>
      <strong>Content:</strong> ${val}
    </div>`;
  }

  let applyHtml = '';
  if(applyVar){
    const dn = applyVar.collection ? `${applyVar.collection}/${applyVar.name}` : applyVar.name;
    const val = applyVar.value ?? 'N/A';
    applyHtml = `<div class="mt-2 p-2 rounded bg-blue-200 dark:bg-blue-700 border border-blue-200 dark:border-blue-700 text-xs">
      <strong>Apply variable:</strong> ${dn}<br>
      <strong>Content:</strong> ${val}
    </div>`;
  }

  info.innerHTML=`<div class="p-2 rounded border border-green-200 dark:border-green-700 bg-white dark:bg-gray-900 text-xs">
    <strong>Text element:</strong> ${nodeName}<br>
    <!--<strong>Content:</strong> ${text}-->
  </div>${currentlyHtml}${applyHtml}`;
}

// === No selection ===
function displayNoSelection(){ 
  const info=document.getElementById('selected-text-info'); 
  if(!info) return; 
  info.innerHTML='<p class="italic text-gray-500 dark:text-white">No text node selected.</p>'; 
}

// === Display Variables List ===
function displayVariables(vars,boundId,searchTerm){
  const list=document.getElementById('variables-list');
  if(!list) return;
  const query=(searchTerm||'').toLowerCase();
  list.innerHTML='';

  vars.forEach(v=>{
    const name=v.name||'Unnamed', value=v.value||'N/A', collection=v.collection||'Default', type=v.type||'Unknown';
    const id=v.id;

    const wrapper=document.createElement('label');
    wrapper.className=`relative flex cursor-pointer rounded-lg px-5 py-4 shadow-md focus:outline-none ${
      boundId===id?'bg-indigo-100 dark:bg-blue-900':'bg-white dark:bg-gray-800'
    } hover:bg-blue-50 dark:hover:bg-blue-900 border ${
      boundId===id?'border-blue-300 dark:border-blue-600':'border-gray-200 dark:border-gray-700'
    }`;

    wrapper.innerHTML=`<div class="flex items-center justify-between w-full">
      <div class="flex flex-col gap-1">
        <div class="flex gap-2 flex-wrap">
          <span class="inline-flex w-fit px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-100 dark:bg-blue-700 text-blue-800 dark:text-blue-200">Collection: ${collection}</span>
          <span class="inline-flex w-fit px-2 py-0.5 rounded-full text-[10px] lowercase font-medium bg-green-100 dark:bg-green-700 text-green-800 dark:text-green-200">Type: ${type}</span>
        </div>
        <span class="block text-sm font-medium text-gray-900 dark:text-gray-200">${name}</span>
        <span class="block text-xs text-gray-500 dark:text-gray-400 font-mono">${value}</span>
      </div>
      <input type="radio" name="variable-radio" value="${id}" class="h-5 w-5 text-blue-600 dark:text-blue-400" ${boundId===id?'checked':''}/>
    </div>`;

    wrapper.querySelector('input')?.addEventListener('change',()=>{
      selectVariable(id);
    });

    list.appendChild(wrapper);
  });
}

// === Select variable ===
function selectVariable(id){
  selectedVariableId = id;
  applyVariableObject = allVariables.find(v => v.id===id); // 🔹 variable preview
  displaySelectedText(selectedNodeText, selectedNodeName, currentBoundVariable, applyVariableObject);
  displayVariables(filteredVariables, selectedVariableId);
  document.getElementById('bind-button')?.removeAttribute('disabled');
}

// === Bind variable ===
function bindVariable(){
  if(!applyVariableObject){
    showMessage('Please select a variable first','error');
    return;
  }

  parent.postMessage({
    pluginMessage: {
      type: 'bind-variable',
      variableObject: applyVariableObject
    }
  }, '*');

  // 🔥 อัปเดต UI ทันที
  currentBoundVariable = {...applyVariableObject};
  applyVariableObject = null;
  displaySelectedText(selectedNodeText, selectedNodeName, currentBoundVariable, applyVariableObject);
  displayVariables(filteredVariables, currentBoundVariable.id);
  showMessage(`Bound "${currentBoundVariable.name}" to selection`, 'success');
}

// === Resize handle ===
function initResizeHandle(){
  const h=document.getElementById('resize-handle');
  if(!h) return;
  let r=false, sX, sY, sW, sH;
  h.addEventListener('mousedown', e=>{
    r=true; sX=e.clientX; sY=e.clientY; sW=window.innerWidth; sH=window.innerHeight;
    e.preventDefault();
  });
  document.addEventListener('mousemove', e=>{
    if(!r) return;
    const nw=Math.max(400, sW + (e.clientX - sX));
    const nh=Math.max(600, sH + (e.clientY - sY));
    parent.postMessage({pluginMessage:{type:'resize',size:{width:nw,height:nh}}}, '*');
  });
  document.addEventListener('mouseup', ()=>{r=false;});
}