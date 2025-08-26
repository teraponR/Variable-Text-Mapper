// code.js - Main plugin logic
figma.showUI(__html__, {
  width: 400,
  height: 600,
  themeColors: true,
  visible: true
});

// Load variables and send to UI
async function loadVariables() {
  try {
    const localVariables = figma.variables.getLocalVariables();
    const variablesData = [];
    
    for (const variable of localVariables) {
      try {
        // Get variable collection
        const collection = figma.variables.getVariableCollectionById(variable.variableCollectionId);
        
        // Get the first available value from the variable
        let value = 'N/A';
        if (variable.valuesByMode && Object.keys(variable.valuesByMode).length > 0) {
          const firstModeId = Object.keys(variable.valuesByMode)[0];
          const variableValue = variable.valuesByMode[firstModeId];
          
          if (typeof variableValue === 'string') {
            value = variableValue;
          } else if (typeof variableValue === 'number') {
            value = variableValue.toString();
          } else if (variableValue && typeof variableValue === 'object' && 'r' in variableValue) {
            // Color value
            const color = variableValue;
            value = `rgb(${Math.round(color.r * 255)}, ${Math.round(color.g * 255)}, ${Math.round(color.b * 255)})`;
          } else if (variableValue && typeof variableValue === 'object' && 'id' in variableValue) {
            // Variable alias
            const aliasVariable = figma.variables.getVariableById(variableValue.id);
            value = aliasVariable ? `→ ${aliasVariable.name}` : 'Alias';
          }
        }
        
        variablesData.push({
          id: variable.id,
          name: variable.name,
          value: value,
          type: variable.resolvedType,
          collection: collection ? collection.name : 'Unknown'
        });
      } catch (error) {
        console.warn('Error processing variable:', variable.name, error);
      }
    }
    
    figma.ui.postMessage({
      type: 'variables-loaded',
      variables: variablesData
    });
  } catch (error) {
    figma.ui.postMessage({
      type: 'variables-loaded',
      variables: []
    });
  }
}

// Check current selection and send to UI
function checkCurrentSelection() {
  const textNodes = figma.currentPage.selection.filter(
    node => node.type === 'TEXT'
  );
  
  if (textNodes.length > 0) {
    const textNode = textNodes[0];
    const selectedText = textNode.characters;
    
    const boundVariables = textNode.boundVariables;
    let boundVariableInfo = null;
    
    if (boundVariables && boundVariables.characters) {
      const variableId = boundVariables.characters;
      const variable = figma.variables.getVariableById(typeof variableId === 'string' ? variableId : variableId.id);
      
      if (variable) {
        const collection = figma.variables.getVariableCollectionById(variable.variableCollectionId);
        
        let currentValue = 'N/A';
        if (variable.valuesByMode && Object.keys(variable.valuesByMode).length > 0) {
          const firstModeId = Object.keys(variable.valuesByMode)[0];
          const variableValue = variable.valuesByMode[firstModeId];
          
          if (typeof variableValue === 'string') {
            currentValue = variableValue;
          } else if (typeof variableValue === 'number') {
            currentValue = variableValue.toString();
          } else if (variableValue && typeof variableValue === 'object' && 'r' in variableValue) {
            const color = variableValue;
            currentValue = `rgb(${Math.round(color.r * 255)}, ${Math.round(color.g * 255)}, ${Math.round(color.b * 255)})`;
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
  } else {
    figma.ui.postMessage({
      type: 'no-text-selected'
    });
  }
}

// Load variables and check selection on startup
loadVariables();
checkCurrentSelection();

// Keep UI in sync when selection changes
figma.on('selectionchange', () => {
  checkCurrentSelection();
});

// ✅ รวม figma.ui.onmessage ให้เหลืออันเดียว
figma.ui.onmessage = async (msg) => {
  if (msg.type === 'resize') {
    const { width, height } = msg.size;
    figma.ui.resize(width, height);
  }

  if (msg.type === 'map-variables') {
    try {
      const { variableMappings } = msg;
      const textNodes = figma.currentPage.selection.filter(
        node => node.type === 'TEXT'
      );
      
      if (textNodes.length === 0) {
        figma.ui.postMessage({
          type: 'error',
          message: 'No text nodes selected. Please select at least one text node.'
        });
        return;
      }
      
      for (const textNode of textNodes) {
        await figma.loadFontAsync(textNode.fontName);
        let newText = textNode.characters;
        
        for (const oldValue in variableMappings) {
          if (variableMappings.hasOwnProperty(oldValue)) {
            const newValue = variableMappings[oldValue];
            newText = newText.replace(new RegExp(oldValue.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), String(newValue));
          }
        }
        
        textNode.characters = newText;
      }
      
      figma.ui.postMessage({
        type: 'success',
        message: `Updated ${textNodes.length} text node(s)`
      });
      
    } catch (error) {
      figma.ui.postMessage({
        type: 'error',
        message: `Error: ${error instanceof Error ? error.message : String(error)}`
      });
    }
  }

  if (msg.type === 'bind-variable') {
    try {
      const { variableId } = msg;
      const variable = figma.variables.getVariableById(variableId);
      if (!variable) {
        figma.ui.postMessage({
          type: 'error',
          message: 'Variable not found.'
        });
        return;
      }

      const textNodes = figma.currentPage.selection.filter(
        node => node.type === 'TEXT'
      );

      if (textNodes.length === 0) {
        figma.ui.postMessage({
          type: 'error',
          message: 'Please select at least one text node in the canvas.'
        });
        return;
      }

      for (const textNode of textNodes) {
        await figma.loadFontAsync(textNode.fontName);
        textNode.setBoundVariable('characters', variableId);
      }

      const collection = figma.variables.getVariableCollectionById(variable.variableCollectionId);
      const collectionName = collection ? collection.name : 'Unknown';
      const variablePath = `${collectionName}/${variable.name}`;
      
      let currentValue = 'N/A';
      if (variable.valuesByMode && Object.keys(variable.valuesByMode).length > 0) {
        const firstModeId = Object.keys(variable.valuesByMode)[0];
        const variableValue = variable.valuesByMode[firstModeId];
        
        if (typeof variableValue === 'string') {
          currentValue = variableValue;
        } else if (typeof variableValue === 'number') {
          currentValue = variableValue.toString();
        } else if (variableValue && typeof variableValue === 'object' && 'r' in variableValue) {
          const color = variableValue;
          currentValue = `rgb(${Math.round(color.r * 255)}, ${Math.round(color.g * 255)}, ${Math.round(color.b * 255)})`;
        }
      }
      
      figma.ui.postMessage({
        type: 'variable-bound',
        message: `Successfully bound variable to ${textNodes.length} text node(s).`,
        variableDetails: {
          name: variablePath,
          value: currentValue,
          type: variable.resolvedType
        }
      });
      
    } catch (error) {
      figma.ui.postMessage({
        type: 'error',
        message: `Error binding variable: ${error instanceof Error ? error.message : String(error)}`
      });
    }
  }

  if (msg.type === 'cancel') {
    figma.closePlugin();
  }
};