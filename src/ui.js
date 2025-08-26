// Global variables
let allVariables = [];
let selectedVariableId = null;
let selectedTextNodeId = null; // kept for display only, not required for apply
let currentBoundVariableId = null;

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

// Filter variables based on search term
window.filterVariables = (searchTerm) => {
  const query = (searchTerm || '').trim().toLowerCase();
  
  let variablesToFilter = [];
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
function showMessage(message, type) {
  const messageEl = document.getElementById('message');
  if (!messageEl) return;
  
  messageEl.textContent = message;
  messageEl.className = `message ${type}`;
  messageEl.classList.remove('hidden');
  
  // Trigger animation
  setTimeout(() => {
    messageEl.classList.add('show');
  }, 10);
  
  // Auto-hide success messages after 3 seconds
  if (type === 'success') {
    setTimeout(() => {
      messageEl.classList.remove('show');
      setTimeout(() => {
        messageEl.classList.add('hidden');
      }, 300);
    }, 3000);
  }
}

// Show variable bound message with details
function showVariableBoundMessage(message, variableDetails) {
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
  
  // Trigger animation
  setTimeout(() => {
    messageEl.classList.add('show');
  }, 10);
  
  // Auto-hide after 5 seconds
  setTimeout(() => {
    messageEl.classList.remove('show');
    setTimeout(() => {
      messageEl.classList.add('hidden');
    }, 300);
  }, 5000);
}

// Listen for messages from the plugin
window.onmessage = (event) => {
  const message = event.data.pluginMessage;
  
  if (!message) return;
  
  switch (message.type) {
    case 'variables-loaded':
      allVariables = message.variables;
      displayVariables(allVariables);
      break;
    case 'text-selected':
      displaySelectedText(message.text, message.nodeName, message.boundVariable);
      selectedTextNodeId = message.nodeId;
      currentBoundVariableId = message.boundVariable ? message.boundVariable.id : null;
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
function displaySelectedText(text, nodeName, boundVariable) {
  const selectedTextInfo = document.getElementById('selected-text-info');
  if (!selectedTextInfo) return;
  
  let boundVariableHtml = '';
  if (boundVariable) {
    const displayName = boundVariable.collection ? `${boundVariable.collection}/${boundVariable.name}` : boundVariable.name;
    boundVariableHtml = `
      <div class="bound-variable-info">
        <strong>Variable:</strong> ${escapeHtml(displayName)}<br>
        <strong>Value:</strong> ${escapeHtml(boundVariable.value)}
      </div>
    `;
  }
  
  selectedTextInfo.innerHTML = `
    <div class="selected-text-content">
      <strong>Text element:</strong> ${escapeHtml(nodeName)}<br>
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
function displayVariables(variables, boundVariableId, searchTerm) {
  const variablesList = document.getElementById('variables-list');
  if (!variablesList) return;
  
  if (variables.length === 0) {
    variablesList.innerHTML = '<p class="no-variables">No variables found in this file</p>';
    return;
  }
  
  const query = (searchTerm || '').toLowerCase();

  function highlight(text) {
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
    
    return `
      <div class="variable-item${boundClass}" onclick="selectVariable('${variable.id}')" title="${escapeHtml(displayName)}: ${escapeHtml(value)}${isBound ? ' (Currently Bound)' : ''}">
        <span class="variable-name">${highlight(displayName)}</span>
        <span class="variable-value">${highlight(String(value))}</span>
        ${isBound ? '<span class="bound-indicator">✓</span>' : ''}
      </div>
    `;
  }).join('');
  
  variablesList.innerHTML = variablesHtml;
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Select variable for binding
window.selectVariable = (variableId) => {
  selectedVariableId = variableId;
  
  document.querySelectorAll('.variable-item').forEach(item => {
    item.classList.remove('selected');
  });
  
  const selectedItem = document.querySelector(`[onclick="selectVariable('${variableId}')"]`);
  if (selectedItem) {
    selectedItem.classList.add('selected');
  }
  
  const bindButton = document.getElementById('bind-button');
  if (bindButton) {
    bindButton.disabled = false;
  }
};

// Initialize the UI
document.addEventListener('DOMContentLoaded', () => {
  const firstInput = document.querySelector('.mapping-input');
  if (firstInput) {
    firstInput.focus();
  }
  
  initResizeHandle();
});

// Initialize resize handle
function initResizeHandle() {
  const resizeHandle = document.getElementById('resize-handle');
  if (!resizeHandle) return;
  
  let isResizing = false;
  let startX, startY, startWidth, startHeight;
  
  resizeHandle.addEventListener('mousedown', (e) => {
    isResizing = true;
    startX = e.clientX;
    startY = e.clientY;
    startWidth = window.innerWidth;
    startHeight = window.innerHeight;
    
    e.preventDefault();
  });
  
  document.addEventListener('mousemove', (e) => {
    if (!isResizing) return;
    
    const deltaX = e.clientX - startX;
    const deltaY = e.clientY - startY;
    
    const newWidth = Math.max(400, startWidth + deltaX);
    const newHeight = Math.max(600, startHeight + deltaY);
    
    parent.postMessage({
      pluginMessage: {
        type: 'resize',
        size: { width: newWidth, height: newHeight }
      }
    }, '*');
  });
  
  document.addEventListener('mouseup', () => {
    isResizing = false;
  });
}