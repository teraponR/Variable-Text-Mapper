// code.js - Figma Variable Mapper (fixed version)
figma.showUI(__html__, { width: 644, height: 600, themeColors: true });

// === Load Variables ===
async function loadVariables() {
  try {
    const localVariables = await figma.variables.getLocalVariablesAsync();
    const variablesData = [];

    for (const v of localVariables) {
      let collectionName = 'Unknown';
      try {
        if (v.variableCollectionId) {
          const collection = await figma.variables.getVariableCollectionByIdAsync(v.variableCollectionId);
          collectionName = collection ? collection.name : 'Unknown';
        }
      } catch (e) { collectionName = 'Unknown'; }

      let value = 'N/A';
      try {
        if (v.valuesByMode && Object.keys(v.valuesByMode).length > 0) {
          const firstModeId = Object.keys(v.valuesByMode)[0];
          const val = v.valuesByMode[firstModeId];
          if (typeof val === 'string') value = val;
          else if (typeof val === 'number') value = val.toString();
          else if (val && typeof val === 'object' && 'r' in val)
            value = `rgb(${Math.round(val.r*255)},${Math.round(val.g*255)},${Math.round(val.b*255)})`;
        }
      } catch(e){ value = 'N/A'; }

      variablesData.push({
        id: v.id,
        name: v.name,
        value,
        type: v.resolvedType,
        collection: collectionName,
        variableObject: v // store object for binding
      });
    }

    figma.ui.postMessage({ type: 'variables-loaded', variables: variablesData });
  } catch (err) {
    console.error('Failed to load variables', err);
    figma.ui.postMessage({ type: 'variables-loaded', variables: [] });
  }
}

// === Check Selected Text Node ===
async function checkSelection() {
  const selection = figma.currentPage.selection.filter(n => n.type === 'TEXT');
  if (!selection.length) {
    figma.ui.postMessage({ type: 'no-text-selected' });
    return;
  }

  const textNode = selection[0];
  let boundVariable = null;

  try {
    if (textNode.boundVariables && textNode.boundVariables.characters) {
      const variableId = textNode.boundVariables.characters;
      const variable = await figma.variables.getVariableByIdAsync(variableId);
      if (variable) {
        let currentValue = 'N/A';
        if (variable.valuesByMode && Object.keys(variable.valuesByMode).length > 0) {
          const firstModeId = Object.keys(variable.valuesByMode)[0];
          const val = variable.valuesByMode[firstModeId];
          if (typeof val === 'string') currentValue = val;
          else if (typeof val === 'number') currentValue = val.toString();
          else if (val && 'r' in val)
            currentValue = `rgb(${Math.round(val.r*255)},${Math.round(val.g*255)},${Math.round(val.b*255)})`;
        }

        const collection = variable.variableCollectionId ? await figma.variables.getVariableCollectionByIdAsync(variable.variableCollectionId) : null;
        boundVariable = { id: variable.id, name: variable.name, value: currentValue, collection: collection ? collection.name : 'Unknown' };
      }
    }
  } catch(e){}

  figma.ui.postMessage({
    type: 'text-selected',
    text: textNode.characters,
    nodeName: textNode.name,
    nodeId: textNode.id,
    boundVariable
  });
}

// === Init ===
(async () => {
  await loadVariables();
  await checkSelection();
})();

figma.on('selectionchange', async () => { await checkSelection(); });

// === Messages from UI ===
figma.ui.onmessage = async (msg) => {
  if (msg.type === 'resize') {
    const { width, height } = msg.size;
    figma.ui.resize(width, height);
  }

  if (msg.type === 'bind-variable') {
    try {
      const variableObj = msg.variableObject; // use object, not id
      if (!variableObj) { 
        figma.ui.postMessage({ type: 'error', message: 'Variable object not found.' }); 
        return; 
      }

      const selection = figma.currentPage.selection.filter(n => n.type === 'TEXT');
      if (!selection.length) { 
        figma.ui.postMessage({ type: 'error', message: 'Select at least one text node.' }); 
        return; 
      }

      for (const node of selection) {
        try {
          await figma.loadFontAsync(node.fontName);
          node.setBoundVariable('characters', variableObj); // pass object
        } catch(e) {
          console.warn(`Failed to bind variable to node ${node.name}`, e);
        }
      }

      const collection = variableObj.variableCollectionId ? await figma.variables.getVariableCollectionByIdAsync(variableObj.variableCollectionId) : null;
      const firstValue = variableObj.valuesByMode ? variableObj.valuesByMode[Object.keys(variableObj.valuesByMode)[0]] : 'N/A';

      figma.ui.postMessage({
        type: 'variable-bound',
        message: `Bound to ${selection.length} node(s).`,
        variableDetails: {
          name: `${collection ? collection.name : 'Unknown'}/${variableObj.name}`,
          value: firstValue
        }
      });
    } catch(e){
      console.error('Failed to bind variable', e);
      figma.ui.postMessage({ type: 'error', message: 'Failed to bind variable.' });
    }
  }

  if (msg.type === 'cancel') figma.closePlugin();
};