// Global variables
let allVariables = [];
let selectedVariableId = null;
let selectedTextNodeId = null;
let currentBoundVariableId = null;

// Store current selected node info
let selectedNodeText = '';
let selectedNodeName = '';

// Bind variable to selected text node
window.bindVariable = () => {
  if (!selectedVariableId) {
    showMessage('Please select a variable first', 'error');
    return;
  }

  const boundVar = allVariables.find(v => v.id === selectedVariableId);
  if (!boundVar) return;

  currentBoundVariableId = selectedVariableId;

  // Refresh variable list to show checkmark
  displayVariables(allVariables, currentBoundVariableId);

  // Refresh selected text info
  if (selectedTextNodeId) {
    displaySelectedText(selectedNodeText, selectedNodeName, boundVar);
  }

  showMessage(`Variable "${boundVar.name}" applied`, 'success');

  parent.postMessage({
    pluginMessage: {
      type: 'bind-variable',
      variableId: selectedVariableId
    }
  }, '*');
};

// Filter variables + suggestions
window.filterVariables = (searchTerm) => {
  const query = (searchTerm || '').trim().toLowerCase();
  const suggestionsBox = document.getElementById('suggestions-box');
  if (!suggestionsBox) return;

  if (query.length === 0) {
    displayVariables(allVariables, currentBoundVariableId || undefined);
    suggestionsBox.style.display = "none";
    return;
  }

  const filtered = allVariables.filter(v => {
    const name = String(v.name || '').toLowerCase();
    const collection = String(v.collection || '').toLowerCase();
    const value = String(v.value || '').toLowerCase();
    return name.includes(query) || collection.includes(query) || value.includes(query);
  });

  suggestionsBox.style.display = "block";
  suggestionsBox.innerHTML = filtered.length > 0
    ? filtered.slice(0,5).map(v => `<div class="suggestion-item px-3 py-1 hover:bg-gray-100 cursor-pointer" onclick="applySuggestion('${escapeHtml(v.name)}')">${escapeHtml(v.name)}</div>`).join('')
    : '<div class="suggestion-item disabled px-3 py-1 text-gray-400">No matches</div>';

  displayVariables(filtered, currentBoundVariableId || undefined, query);
};

// Apply suggestion
window.applySuggestion = (value) => {
  const searchInput = document.getElementById('variable-search');
  if (searchInput) searchInput.value = value;
  window.filterVariables(value);
  document.getElementById('clear-search')?.classList.remove('hidden');
  document.getElementById('suggestions-box').style.display = 'none';
};

// Clear search input
window.clearSearch = () => {
  const searchInput = document.getElementById('variable-search');
  if (searchInput) searchInput.value = '';
  document.getElementById('clear-search')?.classList.add('hidden');
  window.filterVariables('');
};

// Show toast message
function showMessage(message, type) {
  const messageEl = document.getElementById('message');
  if (!messageEl) return;

  messageEl.textContent = message;
  messageEl.classList.remove('bg-green-500','bg-red-500');
  messageEl.classList.add(type==='success'?'bg-green-500':'bg-red-500');

  messageEl.classList.remove('hidden','translate-x-0','opacity-100');
  messageEl.classList.add('translate-x-full','opacity-0');

  setTimeout(() => {
    messageEl.classList.remove('translate-x-full','opacity-0');
    messageEl.classList.add('translate-x-0','opacity-100');
  },10);

  setTimeout(() => {
    messageEl.classList.remove('translate-x-0','opacity-100');
    messageEl.classList.add('translate-x-full','opacity-0');
    setTimeout(()=>messageEl.classList.add('hidden'),300);
  },3000);
}

// Listen for messages from plugin
window.onmessage = (event) => {
  const message = event.data.pluginMessage;
  if (!message) return;

  switch(message.type) {
    case 'variables-loaded':
      allVariables = message.variables;
      displayVariables(allVariables);
      break;

    case 'text-selected':
      selectedTextNodeId = message.nodeId;
      selectedNodeText = message.text || '';
      selectedNodeName = message.nodeName || 'Selected Node';
      currentBoundVariableId = message.boundVariable ? message.boundVariable.id : null;
      displaySelectedText(selectedNodeText, selectedNodeName, message.boundVariable);
      displayVariables(allVariables, currentBoundVariableId || undefined);
      break;

    case 'no-text-selected':
      selectedTextNodeId = null;
      selectedNodeText = '';
      selectedNodeName = '';
      displayNoSelection();
      break;

    case 'success':
      showMessage(message.message,'success');
      break;

    case 'variable-bound':
      showMessage(message.message,'success');
      break;

    case 'error':
      showMessage(message.message,'error');
      break;
  }
};

// Display selected text + bound variable
function displaySelectedText(text, nodeName, boundVariable) {
  const infoEl = document.getElementById('selected-text-info');
  if (!infoEl) return;

  let boundHtml = '';
  if (boundVariable) {
    const displayName = boundVariable.collection ? `${boundVariable.collection}/${boundVariable.name}` : boundVariable.name;
    boundHtml = `
      <div class="mt-2 p-2 rounded bg-yellow-50 border border-yellow-200 text-xs">
        <strong>Variable:</strong> ${escapeHtml(displayName)}<br>
        <strong>Current Value:</strong> ${escapeHtml(boundVariable.value)}
      </div>`;
  }

  infoEl.innerHTML = `
    <div class="p-2 rounded border border-green-200 bg-white text-xs">
      <strong>Text element:</strong> ${escapeHtml(nodeName)}<br>
      <strong>Current Content:</strong> ${escapeHtml(text)}
    </div>
    ${boundHtml}`;
}

// Show no selection
function displayNoSelection() {
  const infoEl = document.getElementById('selected-text-info');
  if (!infoEl) return;
  infoEl.innerHTML = '<p class="italic text-gray-400">No text node selected.</p>';
}

// Display variables
function displayVariables(variables, boundVariableId, searchTerm){
  const listEl = document.getElementById('variables-list');
  if(!listEl) return;

  const query = (searchTerm||'').toLowerCase();
  const highlight = text => {
    if(!query) return escapeHtml(text);
    const idx = text.toLowerCase().indexOf(query);
    if(idx===-1) return escapeHtml(text);
    return escapeHtml(text.slice(0,idx)) + `<span class="bg-yellow-200">${escapeHtml(text.slice(idx,idx+query.length))}</span>` + escapeHtml(text.slice(idx+query.length));
  };

  listEl.innerHTML = variables.map(v=>{
    const name=v.name||'Unnamed', value=v.value||'N/A', collection=v.collection||'Default';
    const isBound = boundVariableId===v.id;

    return `
      <div class="variable-item flex justify-between items-start px-3 py-3 rounded-lg cursor-pointer transition-all hover:bg-blue-50 ${isBound?'bg-blue-100 border border-blue-300':''}" onclick="selectVariable('${v.id}')">
        <div class="flex flex-col gap-1">
          <div class="flex gap-2 mt-1">
            <span class="px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-100 text-blue-800">Collection: ${escapeHtml(collection)}</span>
          </div>
          <span class="font-medium text-gray-800">${highlight(name)}</span>
          <span class="text-xs text-gray-500 font-mono">${highlight(String(value))}</span>
        </div>
        ${isBound?`<span class="text-green-600 ml-2"><svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414L9 14.414l-3.707-3.707a1 1 0 011.414-1.414L9 11.586l6.293-6.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg></span>`:''}
      </div>
    `;
  }).join('');
}

// Escape HTML
function escapeHtml(text){ const div=document.createElement('div'); div.textContent=text; return div.innerHTML;}

// Select variable
window.selectVariable = (id)=>{
  selectedVariableId=id;
  document.querySelectorAll('.variable-item').forEach(item=>item.classList.remove('bg-blue-100','border'));
  const sel = document.querySelector(`[onclick="selectVariable('${id}')"]`);
  if(sel) sel.classList.add('bg-blue-100','border');
  document.getElementById('bind-button')?.removeAttribute('disabled');
};

// Init
document.addEventListener('DOMContentLoaded',()=>{
  const searchInput = document.getElementById('variable-search');
  if(searchInput){
    searchInput.addEventListener('input',e=>{
      window.filterVariables(e.target.value);
      document.getElementById('clear-search')?.classList.remove('hidden');
    });
  }
  initResizeHandle();
});

// Resize handle
function initResizeHandle(){
  const handle = document.getElementById('resize-handle');
  if(!handle) return;

  let resizing=false, startX, startY, startWidth, startHeight;

  handle.addEventListener('mousedown',e=>{
    resizing=true;
    startX=e.clientX; startY=e.clientY;
    startWidth=window.innerWidth; startHeight=window.innerHeight;
    e.preventDefault();
  });

  document.addEventListener('mousemove',e=>{
    if(!resizing) return;
    const newWidth = Math.max(400,startWidth + (e.clientX-startX));
    const newHeight = Math.max(600,startHeight + (e.clientY-startY));
    parent.postMessage({pluginMessage:{type:'resize',size:{width:newWidth,height:newHeight}}},'*');
  });

  document.addEventListener('mouseup',()=>{resizing=false;});
}