// Global variables
let allVariables = [];
let selectedVariableId = null;
let selectedTextNodeId = null;
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

// Filter variables based on search term + show suggestion
window.filterVariables = (searchTerm) => {
  const query = (searchTerm || '').trim().toLowerCase();
  const suggestionsBox = document.getElementById('suggestions-box');

  if (!suggestionsBox) return;

  if (query.length === 0) {
    displayVariables(allVariables, currentBoundVariableId || undefined);
    suggestionsBox.innerHTML = '';
    return;
  }

  const filteredVariables = allVariables.filter((variable) => {
    const name = String(variable.name || '').toLowerCase();
    const collection = String(variable.collection || '').toLowerCase();
    const value = String(variable.value || '').toLowerCase();
    return (
      name.includes(query) ||
      collection.includes(query) ||
      value.includes(query)
    );
  });

  console.log("DEBUG filterVariables query:", query, "results:", filteredVariables);

  if (filteredVariables.length > 0) {
    suggestionsBox.innerHTML = filteredVariables
      .slice(0, 5)
      .map(v => `<div class="suggestion-item" data-value="${escapeHtml(v.name)}">${escapeHtml(v.name)}</div>`)
      .join('');

    // bind click event (safe)
    suggestionsBox.querySelectorAll('.suggestion-item').forEach(item => {
      item.addEventListener('click', () => {
        const value = item.getAttribute('data-value');
        window.applySuggestion(value);
      });
    });

  } else {
    suggestionsBox.innerHTML = '<div class="suggestion-item disabled">No matches</div>';
  }

  displayVariables(filteredVariables, currentBoundVariableId || undefined, query);
};

// Apply suggestion (click from dropdown)
window.applySuggestion = (value) => {
  const searchInput = document.getElementById('variable-search');
  if (searchInput) {
    searchInput.value = value;
    window.filterVariables(value);
  }
  const suggestionsBox = document.getElementById('suggestions-box');
  if (suggestionsBox) suggestionsBox.innerHTML = '';
};

// Cancel operation
window.cancel = () => {
  parent.postMessage({
    pluginMessage: { type: 'cancel' }
  }, '*');
};

// Show message
function showMessage(message, type) {
  const messageEl = document.getElementById('message');
  if (!messageEl) return;

  messageEl.textContent = message;
  messageEl.className = `message ${type}`;
  messageEl.classList.remove('hidden');

  setTimeout(() => {
    messageEl.classList.add('show');
  }, 10);

  if (type === 'success') {
    setTimeout(() => {
      messageEl.classList.remove('show');
      setTimeout(() => {
        messageEl.classList.add('hidden');
      }, 300);
    }, 3000);
  }
}

// Listen for messages from plugin
window.onmessage = (event) => {
  const message = event.data.pluginMessage;
  if (!message) return;

  switch (message.type) {
    case 'variables-loaded':
      allVariables = message.variables;
      console.log("DEBUG variables-loaded:", allVariables);
      displayVariables(allVariables);
      break;

    case 'text-selected':
      console.log("DEBUG text-selected:", message);
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
      console.log("DEBUG no-text-selected");
      displayNoSelection();
      selectedTextNodeId = null;
      break;

    case 'success':
      showMessage(message.message, 'success');
      break;

    case 'variable-bound':
      console.log("DEBUG variable-bound:", message.variableDetails);
      showMessage(message.message, 'success');
      break;

    case 'error':
      console.error("DEBUG error:", message.message);
      showMessage(message.message, 'error');
      break;
  }
};

// Show selected text + bound variable
function displaySelectedText(text, nodeName, boundVariable) {
  const selectedTextInfo = document.getElementById('selected-text-info');
  if (!selectedTextInfo) return;

  console.log("DEBUG displaySelectedText ->", { text, nodeName, boundVariable });

  let boundVariableHtml = '';
  if (boundVariable) {
    const displayName = boundVariable.collection
      ? `${boundVariable.collection}/${boundVariable.name}`
      : boundVariable.name;
    boundVariableHtml = `
      <div class="bound-variable-info">
        <strong>Variable:</strong> ${escapeHtml(displayName)}<br>
        <strong>Current Value:</strong> ${escapeHtml(boundVariable.value)}
      </div>
    `;
  }

  selectedTextInfo.innerHTML = `
    <div class="selected-text-content">
      <strong>Text layer name:</strong> ${escapeHtml(nodeName)}<br>
      <strong>Content:</strong> ${escapeHtml(text)}
    </div>
    ${boundVariableHtml}
  `;
}

// Show no selection
function displayNoSelection() {
  const selectedTextInfo = document.getElementById('selected-text-info');
  if (!selectedTextInfo) return;
  selectedTextInfo.innerHTML = '<p class="no-selection">No text node selected.</p>';
}

// Display variables in list
function displayVariables(variables, boundVariableId, searchTerm) {
  const variablesList = document.getElementById('variables-list');
  if (!variablesList) return;

  if (variables.length === 0) {
    variablesList.innerHTML = '<p class="no-variables">No variables found</p>';
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
      <div class="variable-item${boundClass}" data-id="${variable.id}">
        <span class="variable-name">${highlight(displayName)}</span>
        <span class="variable-value">${highlight(String(value))}</span>
        ${isBound ? '<span class="bound-indicator">✓</span>' : ''}
      </div>
    `;
  }).join('');

  variablesList.innerHTML = variablesHtml;

  // bind click
  variablesList.querySelectorAll('.variable-item').forEach(item => {
    item.addEventListener('click', () => {
      const vid = item.getAttribute('data-id');
      window.selectVariable(vid);
    });
  });
}

// Escape HTML
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Select variable
window.selectVariable = (variableId) => {
  selectedVariableId = variableId;

  document.querySelectorAll('.variable-item').forEach(item => {
    item.classList.remove('selected');
  });

  const selectedItem = document.querySelector(`.variable-item[data-id="${variableId}"]`);
  if (selectedItem) selectedItem.classList.add('selected');

  const bindButton = document.getElementById('bind-button');
  if (bindButton) bindButton.disabled = false;

  console.log("DEBUG selectVariable:", variableId);
};

// Init
document.addEventListener('DOMContentLoaded', () => {
  const searchInput = document.getElementById('variable-search'); 
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const val = e.target.value;
      console.log("DEBUG search input typing:", val);
      window.filterVariables(val);
    });
    console.log("DEBUG search input found and listener attached");
  } else {
    console.error("DEBUG search input (#variable-search) not found");
  }

  initResizeHandle();
});

// Resize handle
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
      pluginMessage: { type: 'resize', size: { width: newWidth, height: newHeight } }
    }, '*');
  });

  document.addEventListener('mouseup', () => { isResizing = false; });
}