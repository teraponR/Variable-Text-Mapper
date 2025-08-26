// Global functions for UI interactions
interface Window {
  cancel: () => void;
  bindVariable: () => void;
  filterVariables: (searchTerm: string) => void;
  selectVariable: (variableId: string) => void;
  loadExternalVariables: () => void;
  switchTab: (tab: string) => void;
}

// Global variables
let allVariables: any[] = [];
let localVariables: any[] = [];
let externalVariables: any[] = [];
let selectedVariableId: string | null = null;
let selectedTextNodeId: string | null = null; // kept for display only, not required for apply
let currentBoundVariableId: string | null = null;
let currentTab: string = 'local';

// Bind variable to selected text node
window.bindVariable = () => {
  if (!selectedVariableId) {
    showMessage('Please select a variable first', 'error');
    return;
  }
  
  parent.postMessage({
    pluginMessage: {
      type: 'bind-variable',
      variableId: selectedVariableId
    }
  }, '*');
};

// Load external variables
window.loadExternalVariables = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    const fileKeyInput = document.getElementById('file-key-input') as HTMLInputElement;
    const fileKey = fileKeyInput.value.trim();
    
    if (!fileKey) {
      showExternalStatus('Please enter a Figma file key', 'error');
      reject(new Error('Figma file key is required'));
      return;
    }
    
    showExternalStatus('Loading external variables...', 'loading');
    
    parent.postMessage({
      pluginMessage: {
        type: 'load-external-variables',
        fileKey: fileKey
      }
    }, '*');
    
    // Assuming some asynchronous operation could call resolve() when done
    resolve();
  });
};

// Switch between variable tabs
window.switchTab = (tab: string) => {
  currentTab = tab;
  
  // Update tab buttons
  document.querySelectorAll('.tab-button').forEach(btn => {
    btn.classList.remove('active');
  });
  document.querySelector(`[onclick="switchTab('${tab}')"]`)?.classList.add('active');
  
  // Filter and display variables
  let variablesToShow: any[] = [];
  switch (tab) {
    case 'local':
      variablesToShow = localVariables;
      break;
    case 'external':
      variablesToShow = externalVariables;
      break;
    case 'all':
      variablesToShow = allVariables;
      break;
  }
  
  displayVariables(variablesToShow, currentBoundVariableId || undefined);
};

// Show external status message
function showExternalStatus(message: string, type: 'success' | 'error' | 'loading') {
  const statusEl = document.getElementById('external-status');
  if (!statusEl) return;
  
  statusEl.textContent = message;
  statusEl.className = `external-status ${type}`;
  statusEl.classList.remove('hidden');
  
  if (type === 'success') {
    setTimeout(() => {
      statusEl.classList.add('hidden');
    }, 3000);
  }
}

// Filter variables based on search term
window.filterVariables = (searchTerm: string) => {
  const query = (searchTerm || '').trim().toLowerCase();
  
  let variablesToFilter: any[] = [];
  switch (currentTab) {
    case 'local':
      variablesToFilter = localVariables;
      break;
    case 'external':
      variablesToFilter = externalVariables;
      break;
    case 'all':
      variablesToFilter = allVariables;
      break;
  }
  
  if (query.length === 0) {
    displayVariables(variablesToFilter, currentBoundVariableId || undefined);
    return;
  }

  const filteredVariables = variablesToFilter.filter((variable) => {
    const name = String(variable.name || '').toLowerCase();
    const collection = String(variable.collection || '').toLowerCase();
    const value = String(variable.value || '').toLowerCase();
    return (
      name.includes(query) ||
      collection.includes(query) ||
      value.includes(query)
    );
  });

  displayVariables(filteredVariables, currentBoundVariableId || undefined, query);
};

// Cancel operation
window.cancel = () => {
  parent.postMessage({
    pluginMessage: {
      type: 'cancel'
    }
  }, '*');
};

// Show message to user
function showMessage(message: string, type: 'success' | 'error') {
  const messageEl = document.getElementById('message');
  if (!messageEl) return;
  
  messageEl.textContent = message;
  messageEl.className = `message ${type}`;
  messageEl.classList.remove('hidden');
  
  // Auto-hide success messages after 3 seconds
  if (type === 'success') {
    setTimeout(() => {
      messageEl.classList.add('hidden');
    }, 3000);
  }
}

// Show variable bound message with details
function showVariableBoundMessage(message: string, variableDetails: any) {
  const messageEl = document.getElementById('message');
  if (!messageEl) return;
  
  messageEl.innerHTML = `
    <div class="variable-bound-message">
      <div class="success-message">${message}</div>
      <div class="variable-details">
        <div class="detail-row">
          <strong>Variable name:</strong> ${escapeHtml(variableDetails.name)}
        </div>
        <div class="detail-row">
          <strong>Value:</strong> ${escapeHtml(variableDetails.value)}
        </div>
      </div>
    </div>
  `;
  messageEl.className = 'message success';
  messageEl.classList.remove('hidden');
  
  // Auto-hide after 5 seconds
  setTimeout(() => {
    messageEl.classList.add('hidden');
  }, 5000);
}

// Listen for messages from the plugin
window.onmessage = (event) => {
  const message = event.data.pluginMessage;
  
  if (!message) return;
  
  switch (message.type) {
    case 'variables-loaded':
      localVariables = message.variables;
      allVariables = [...localVariables, ...externalVariables];
      if (currentTab === 'local' || currentTab === 'all') {
        displayVariables(currentTab === 'local' ? localVariables : allVariables);
      }
      break;
    case 'external-variables-loading':
      showExternalStatus('Loading external variables...', 'loading');
      break;
    case 'external-variables-loaded':
      externalVariables = message.variables;
      allVariables = [...localVariables, ...externalVariables];
      showExternalStatus(`Loaded ${message.variables.length} external variables`, 'success');
      if (currentTab === 'external' || currentTab === 'all') {
        displayVariables(currentTab === 'external' ? externalVariables : allVariables);
      }
      break;
    case 'external-variables-error':
      showExternalStatus(`Error: ${message.error}`, 'error');
      break;
    case 'text-selected':
      displaySelectedText(message.text, message.nodeName, message.boundVariable);
      selectedTextNodeId = message.nodeId;
      currentBoundVariableId = message.boundVariable ? message.boundVariable.id : null;
      // Update variables list to highlight bound variable
      if (message.boundVariable) {
        displayVariables(allVariables, message.boundVariable.id);
      } else {
        displayVariables(allVariables);
      }
      break;
    case 'no-text-selected':
      displayNoSelection();
      selectedTextNodeId = null;
      break;
    case 'success':
      showMessage(message.message, 'success');
      break;
    case 'variable-bound':
      showVariableBoundMessage(message.message, message.variableDetails);
      break;
    case 'error':
      showMessage(message.message, 'error');
      break;
  }
};

// Display selected text information
function displaySelectedText(text: string, nodeName: string, boundVariable?: any) {
  const selectedTextInfo = document.getElementById('selected-text-info');
  if (!selectedTextInfo) return;
  
  let boundVariableHtml = '';
  if (boundVariable) {
    const displayName = boundVariable.collection ? `${boundVariable.collection}/${boundVariable.name}` : boundVariable.name;
    boundVariableHtml = `
      <div class="bound-variable-info">
        <strong>Bound Variable:</strong> ${escapeHtml(displayName)}<br>
        <strong>Current Value:</strong> ${escapeHtml(boundVariable.value)}
      </div>
    `;
  }
  
  selectedTextInfo.innerHTML = `
    <div class="selected-text-content">
      <strong>Node:</strong> ${escapeHtml(nodeName)}<br>
      <strong>Content:</strong> ${escapeHtml(text)}
    </div>
    ${boundVariableHtml}
  `;
}

// Display no selection message
function displayNoSelection() {
  const selectedTextInfo = document.getElementById('selected-text-info');
  if (!selectedTextInfo) return;
  
  selectedTextInfo.innerHTML = '<p class="no-selection">No text node selected. Please select a text node.</p>';
}

// Display variables in the UI
function displayVariables(variables: any[], boundVariableId?: string, searchTerm?: string) {
  const variablesList = document.getElementById('variables-list');
  if (!variablesList) return;
  
  if (variables.length === 0) {
    variablesList.innerHTML = '<p class="no-variables">No variables found in this file</p>';
    return;
  }
  
  const query = (searchTerm || '').toLowerCase();

  function highlight(text: string): string {
    if (!query) return escapeHtml(text);
    const idx = text.toLowerCase().indexOf(query);
    if (idx === -1) return escapeHtml(text);
    const before = escapeHtml(text.slice(0, idx));
    const match = escapeHtml(text.slice(idx, idx + query.length));
    const after = escapeHtml(text.slice(idx + query.length));
    return `${before}<span class="highlight">${match}</span>${after}`;
  }

  const variablesHtml = variables.map(variable => {
    const name = variable.name || 'Unnamed Variable';
    const value = variable.value || 'N/A';
    const collection = variable.collection || '';
    const displayName = collection ? `${collection}/${name}` : name;
    const isBound = boundVariableId === variable.id;
    const boundClass = isBound ? ' bound' : '';
    const sourceClass = variable.source === 'external' ? ' external' : ' local';
    
    return `
      <div class="variable-item${boundClass}${sourceClass}" onclick="selectVariable('${variable.id}')" title="${escapeHtml(displayName)}: ${escapeHtml(value)}${isBound ? ' (Currently Bound)' : ''} [${variable.source || 'local'}]">
        <span class="variable-name">${highlight(displayName)}</span>
        <span class="variable-value">${highlight(String(value))}</span>
        ${isBound ? '<span class="bound-indicator">✓</span>' : ''}
      </div>
    `;
  }).join('');
  
  variablesList.innerHTML = variablesHtml;
}

// Escape HTML to prevent XSS
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Select variable for binding
window.selectVariable = (variableId: string) => {
  selectedVariableId = variableId;
  
  // Update UI to show selection
  document.querySelectorAll('.variable-item').forEach(item => {
    item.classList.remove('selected');
  });
  
  const selectedItem = document.querySelector(`[onclick="selectVariable('${variableId}')"]`);
  if (selectedItem) {
    selectedItem.classList.add('selected');
  }
  
  // Enable bind button
  const bindButton = document.getElementById('bind-button') as HTMLButtonElement;
  if (bindButton) {
    bindButton.disabled = false;
  }
};

// Initialize the UI
document.addEventListener('DOMContentLoaded', () => {
  // Focus on the first input
  const firstInput = document.querySelector('.mapping-input') as HTMLInputElement;
  if (firstInput) {
    firstInput.focus();
  }
});
