// code.js - Main plugin logic
figma.showUI(__html__, {
  width: 644,
  height: 600,
  themeColors: true,
  visible: true
});

// Load variables and send to UI
async function loadVariables() {
  try {
    const localVariables = figma.variables.getLocalVariables();

    const variablesData = await Promise.all(localVariables.map(async (variable) => {
      try {
        const collection = await figma.variables.getVariableCollectionByIdAsync(variable.variableCollectionId);

        let value = 'N/A';
        if (variable.valuesByMode && Object.keys(variable.valuesByMode).length > 0) {
          const firstModeId = Object.keys(variable.valuesByMode)[0];
          const variableValue = variable.valuesByMode[firstModeId];

          if (typeof variableValue === 'string') value = variableValue;
          else if (typeof variableValue === 'number') value = variableValue.toString();
          else if (variableValue && typeof variableValue === 'object' && 'r' in variableValue) {
            const color = variableValue;
            value = `rgb(${Math.round(color.r*255)},${Math.round(color.g*255)},${Math.round(color.b*255)})`;
          } else if (variableValue && typeof variableValue === 'object' && 'id' in variableValue) {
            const aliasVariable = await figma.variables.getVariableByIdAsync(variableValue.id);
            value = aliasVariable ? `→ ${aliasVariable.name}` : 'Alias';
          }
        }

        return {
          id: variable.id,
          name: variable.name,
          value,
          type: variable.resolvedType,
          collection: collection ? collection.name : 'Unknown'
        };
      } catch (err) {
        console.warn('Error processing variable:', variable.name, err);
        return {
          id: variable.id,
          name: variable.name,
          value: 'N/A',
          type: variable.resolvedType,
          collection: 'Unknown'
        };
      }
    }));

    figma.ui.postMessage({ type: 'variables-loaded', variables: variablesData });

  } catch (err) {
    figma.ui.postMessage({ type: 'variables-loaded', variables: [] });
  }
}

// Check current selection and send to UI
async function checkCurrentSelection() {
  const textNodes = figma.currentPage.selection.filter(n => n.type === 'TEXT');
  if (textNodes.length === 0) {
    figma.ui.postMessage({ type: 'no-text-selected' });
    return;
  }

  const textNode = textNodes[0];
  const selectedText = textNode.characters;
  let boundVariableInfo = null;

  if (textNode.boundVariables && textNode.boundVariables.characters) {
    const variableId = textNode.boundVariables.characters;
    const variable = await figma.variables.getVariableByIdAsync(typeof variableId === 'string' ? variableId : variableId.id);
    if (variable) {
      const collection = await figma.variables.getVariableCollectionByIdAsync(variable.variableCollectionId);
      let currentValue = 'N/A';
      if (variable.valuesByMode && Object.keys(variable.valuesByMode).length > 0) {
        const firstModeId = Object.keys(variable.valuesByMode)[0];
        const variableValue = variable.valuesByMode[firstModeId];

        if (typeof variableValue === 'string') currentValue = variableValue;
        else if (typeof variableValue === 'number') currentValue = variableValue.toString();
        else if (variableValue && typeof variableValue === 'object' && 'r' in variableValue) {
          const color = variableValue;
          currentValue = `rgb(${Math.round(color.r*255)},${Math.round(color.g*255)},${Math.round(color.b*255)})`;
        }
      }

      boundVariableInfo = {
        id: variable.id,
        name: variable.name,
        value: currentValue,
        collection: collection ? collection.name : 'Unknown'
      };
    }
  }

  figma.ui.postMessage({
    type: 'text-selected',
    text: selectedText,
    nodeName: textNode.name,
    nodeId: textNode.id,
    boundVariable: boundVariableInfo
  });
}

// Load variables and check selection on startup
loadVariables();
checkCurrentSelection();

// Keep UI in sync when selection changes
figma.on('selectionchange', () => {
  checkCurrentSelection();
});

// Handle messages from UI
figma.ui.onmessage = async (msg) => {
  if (msg.type === 'resize') {
    const { width, height } = msg.size;
    figma.ui.resize(width, height);
  }

  if (msg.type === 'bind-variable') {
    const { variableId } = msg;
    const variable = await figma.variables.getVariableByIdAsync(variableId);
    if (!variable) {
      figma.ui.postMessage({ type: 'error', message: 'Variable not found.' });
      return;
    }

    const textNodes = figma.currentPage.selection.filter(n => n.type === 'TEXT');
    if (textNodes.length === 0) {
      figma.ui.postMessage({ type: 'error', message: 'Select at least one text node.' });
      return;
    }

    for (const textNode of textNodes) {
      await figma.loadFontAsync(textNode.fontName);
      textNode.setBoundVariable('characters', variableId);
    }

    const collection = await figma.variables.getVariableCollectionByIdAsync(variable.variableCollectionId);
    const collectionName = collection ? collection.name : 'Unknown';
    let currentValue = 'N/A';
    if (variable.valuesByMode && Object.keys(variable.valuesByMode).length > 0) {
      const firstModeId = Object.keys(variable.valuesByMode)[0];
      const variableValue = variable.valuesByMode[firstModeId];
      if (typeof variableValue === 'string') currentValue = variableValue;
      else if (typeof variableValue === 'number') currentValue = variableValue.toString();
      else if (variableValue && typeof variableValue === 'object' && 'r' in variableValue) {
        const color = variableValue;
        currentValue = `rgb(${Math.round(color.r*255)},${Math.round(color.g*255)},${Math.round(color.b*255)})`;
      }
    }

    figma.ui.postMessage({
      type: 'variable-bound',
      message: `Successfully bound variable to ${textNodes.length} text node(s).`,
      variableDetails: { name: `${collectionName}/${variable.name}`, value: currentValue, type: variable.resolvedType }
    });
  }

  if (msg.type === 'cancel') {
    figma.closePlugin();
  }
};